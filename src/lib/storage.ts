// localStorage that never throws (private windows, blocked storage).
export function getJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}
export function setJSON(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function remove(key: string) { try { localStorage.removeItem(key); } catch { /* ignore */ } }

// IndexedDB for exported clips so a queued clip survives a refresh.
const DB = 'cut', STORE = 'clips';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export interface StoredClip { id: string; name: string; size: number; createdAt: number; blob: Blob; credit?: string }
export const putClip = (c: StoredClip) => tx('readwrite', (s) => s.put(c, c.id));
export const getClip = (id: string) => tx<StoredClip | undefined>('readonly', (s) => s.get(id));
export const deleteClip = (id: string) => tx('readwrite', (s) => s.delete(id));
export const listClips = () => tx<StoredClip[]>('readonly', (s) => s.getAll() as IDBRequest<StoredClip[]>);
