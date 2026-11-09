// Encrypted-at-rest cache. AES-GCM with a non-extractable key held in IndexedDB:
// script can use the key but never read it, and data is unreadable as plain storage.
// Wiped entirely on sign-out.
const DB = 'compandra-secure', KEY = 'k1';
let dbp: Promise<IDBDatabase> | null = null;
const open = () => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('keys'); r.result.createObjectStore('kv'); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = async <T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
  const db = await open();
  return new Promise((res, rej) => { const q = fn(db.transaction(store, mode).objectStore(store)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
};
let keyp: Promise<CryptoKey> | null = null;
const key = () => (keyp ??= (async () => {
  const existing = await tx<CryptoKey | undefined>('keys', 'readonly', (s) => s.get(KEY));
  if (existing) return existing;
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await tx('keys', 'readwrite', (s) => s.put(k, KEY));
  return k;
})());

export const secureStore = {
  async set(k: string, value: unknown) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(JSON.stringify(value)));
    await tx('kv', 'readwrite', (s) => s.put({ iv, data }, k));
  },
  async get<T>(k: string): Promise<T | null> {
    const row = await tx<{ iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer } | undefined>('kv', 'readonly', (s) => s.get(k));
    if (!row) return null;
    try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv }, await key(), row.data))) as T; }
    catch { return null; }
  },
  async del(k: string) { await tx('kv', 'readwrite', (s) => s.delete(k)); },
  /** Removes all data and the key itself. */
  async wipe() { await tx('kv', 'readwrite', (s) => s.clear()); await tx('keys', 'readwrite', (s) => s.clear()); keyp = null; },
};
