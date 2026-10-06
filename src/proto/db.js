// Minimal IndexedDB wrapper — no new dependency. Everything you add in the preview (new
// enquiries/customers, uploaded files, checklist state) is written here so it survives a reload,
// but it lives only in this browser; nobody else who opens the link sees it. Nothing auto-fills:
// every write here happens because of an explicit click (Create enquiry, Upload, Generate).
const DB_NAME = 'shiaanx-proto';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const FILES_STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// All calls fail soft (resolve with a fallback) rather than throw — private browsing / blocked
// storage should degrade to "nothing persists", not break the page.
// fn(store) must return the IDBRequest from the store call (get/put/delete all return one); its
// .result is read once the transaction completes, not immediately — reading result synchronously
// after e.g. s.get(key) would be undefined because the request hasn't resolved yet.
async function withStore(storeName, mode, fn) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('proto db unavailable:', e);
    return undefined;
  }
}

export async function kvGet(key, fallback) {
  const value = await withStore(KV_STORE, 'readonly', (s) => s.get(key));
  return value === undefined ? fallback : value;
}

export async function kvSet(key, value) {
  await withStore(KV_STORE, 'readwrite', (s) => s.put(value, key));
}

// Files are stored as { blob, name, type } so a later "View" knows what it's opening.
export async function fileSave(key, file) {
  await withStore(FILES_STORE, 'readwrite', (s) => s.put({ blob: file, name: file.name, type: file.type }, key));
}

export async function fileGet(key) {
  return withStore(FILES_STORE, 'readonly', (s) => s.get(key));
}

export async function fileOpen(key) {
  const entry = await fileGet(key);
  if (!entry) return false;
  const url = URL.createObjectURL(entry.blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
