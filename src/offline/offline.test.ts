import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const update = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ update: (v: unknown) => ({ eq: (_: string, id: string) => ({ select: () => update(id, v) }) }) }) } }));
vi.stubGlobal('navigator', { onLine: false });
const { secureStore } = await import('./secureStore');
const { syncQueue, overlayPending } = await import('./queue');

beforeEach(() => { syncQueue.reset(); update.mockReset(); (navigator as any).onLine = false; });
describe('secureStore', () => {
  it('round-trips and stores ciphertext only', async () => {
    await secureStore.set('x', { confirmation: 'ABC123' });
    expect(await secureStore.get('x')).toEqual({ confirmation: 'ABC123' });
    const raw: any = await new Promise((res) => { const r = indexedDB.open('compandra-secure', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('x'); q.onsuccess = () => res(q.result); }; });
    expect(new TextDecoder().decode(raw.data)).not.toContain('ABC123');
  });
  it('wipe removes everything', async () => { await secureStore.set('y', 1); await secureStore.wipe(); expect(await secureStore.get('y')).toBeNull(); });
});
describe('sync queue', () => {
  it('queues offline, coalesces per item, overlays, and replays on reconnect', async () => {
    await syncQueue.tick({ itemId: 'a', eventId: 'e', isPacked: true });
    await syncQueue.tick({ itemId: 'a', eventId: 'e', isPacked: false });
    await syncQueue.tick({ itemId: 'b', eventId: 'e', isPacked: true });
    expect(update).not.toHaveBeenCalled();
    expect(syncQueue.get().pending).toHaveLength(2);
    expect(overlayPending([{ id: 'b', is_packed: false }], 'e')[0].is_packed).toBe(true);
    update.mockResolvedValue({ data: [{ id: 'x' }], error: null });
    (navigator as any).onLine = true;
    await syncQueue.flush();
    expect(update).toHaveBeenCalledWith('a', { is_packed: false });
    expect(syncQueue.get().pending).toHaveLength(0);
  });
  it('keeps ticks when the network fails mid-flush', async () => {
    await syncQueue.tick({ itemId: 'a', eventId: 'e', isPacked: true });
    update.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    (navigator as any).onLine = true;
    await syncQueue.flush();
    expect(syncQueue.get().pending).toHaveLength(1);
  });
});
