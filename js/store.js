// IndexedDB storage: the content key (non-extractable CryptoKey) and decrypted track blobs.
const DB_NAME = 'sleepy';
const KEY_ID = 'contentKey';

function request(r) {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

export async function openStore() {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore('meta');
    open.result.createObjectStore('tracks');
  };
  const db = await request(open);

  const run = (name, mode, fn) => new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const r = fn(tx.objectStore(name));
    tx.oncomplete = () => resolve(r?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });

  return {
    getKey: () => run('meta', 'readonly', s => s.get(KEY_ID)),
    putKey: k => run('meta', 'readwrite', s => s.put(k, KEY_ID)),
    listTracks: () => run('tracks', 'readonly', s => s.getAllKeys()).then(keys => keys.map(String)),
    getTrack: file => run('tracks', 'readonly', s => s.get(file)),
    putTrack: (file, blob) => run('tracks', 'readwrite', s => s.put(blob, file)),
    deleteTrack: file => run('tracks', 'readwrite', s => s.delete(file)),
    clear: async () => { await run('meta', 'readwrite', s => s.clear()); await run('tracks', 'readwrite', s => s.clear()); },
  };
}

export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch { return false; }
}
