// Offline write queue for packing checkboxes. Ticks are idempotent and coalesced per item,
// so replaying after reconnect is safe. All ticks use this path, online or not.
import { supabase } from '@/lib/supabase';
import { secureStore } from './secureStore';

export interface PendingTick { itemId: string; eventId: string; isPacked: boolean; }
type State = { pending: PendingTick[]; syncing: boolean; online: boolean; failed: number };
let state: State = { pending: [], syncing: false, online: typeof navigator === 'undefined' ? true : navigator.onLine, failed: 0 };
const subs = new Set<() => void>();
let onSynced: ((eventIds: string[]) => void) | null = null;
const emit = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const persist = () => secureStore.set('queue', state.pending);

export const syncQueue = {
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  get: () => state,
  onSynced: (f: (ids: string[]) => void) => { onSynced = f; },
  async load() { emit({ pending: (await secureStore.get<PendingTick[]>('queue')) ?? [] }); return syncQueue.flush(); },
  async tick(t: PendingTick) {
    emit({ pending: [...state.pending.filter((p) => p.itemId !== t.itemId), t] });
    await persist();
    return syncQueue.flush();
  },
  async flush() {
    if (state.syncing || !state.pending.length || !navigator.onLine) return;
    emit({ syncing: true });
    const events = new Set<string>();
    let failed = 0;
    for (const t of [...state.pending]) {
      const { data, error } = await supabase.from('packing_items').update({ is_packed: t.isPacked }).eq('id', t.itemId).select('id');
      if (error && /fetch|network/i.test(error.message)) break; // still offline; keep the rest
      if (error || !data?.length) failed++; // no longer permitted or item deleted: don't retry forever
      // Remove only this tick; a newer tick for the item may have been queued meanwhile.
      emit({ pending: state.pending.filter((p) => p !== t) });
      events.add(t.eventId);
    }
    await persist();
    emit({ syncing: false, failed: state.failed + failed });
    if (events.size) onSynced?.([...events]);
  },
  setOnline(online: boolean) { emit({ online }); if (online) void syncQueue.flush(); },
  clearFailed() { emit({ failed: 0 }); },
  reset() { state = { ...state, pending: [], failed: 0 }; subs.forEach((f) => f()); },
};
export const overlayPending = <T extends { id: string; is_packed: boolean }>(items: T[], eventId: string): T[] => {
  const p = state.pending.filter((x) => x.eventId === eventId);
  return p.length ? items.map((i) => { const t = p.find((x) => x.itemId === i.id); return t ? { ...i, is_packed: t.isPacked } : i; }) : items;
};
