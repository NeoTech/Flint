/**
 * Simple promisified IndexedDB helper for browser use.
 */
export async function open(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    throw new Error('IndexedDB not available in this environment');
  }

  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('flint-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('secrets')) db.createObjectStore('secrets');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function get(storeName: 'kv' | 'secrets', key: string): Promise<any> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function set(storeName: 'kv' | 'secrets', key: string, val: any): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(val, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function del(storeName: 'kv' | 'secrets', key: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
