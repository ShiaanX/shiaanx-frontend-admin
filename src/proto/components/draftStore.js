// The New enquiry draft, kept in this browser's IndexedDB (files included) so a half-filled form
// survives closing the modal, moving to another page or a reload. One draft per logged-in user.
// Every call swallows its own errors: with IndexedDB blocked (private window, cleared site data)
// the form simply works without a draft.
const DB_NAME = 'sx-proto-drafts';
const STORE = 'drafts';

function openDb() {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    } catch (e) { reject(e); }
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { try { db.close(); } catch (e) { /* ignore */ } }
}

const keyFor = (userId) => `new-enquiry:${userId}`;

// Files are stored as plain blobs plus their name, and turned back into File objects on load.
const packFile = (f) => (f ? { name: f.name, type: f.type, lastModified: f.lastModified, blob: f } : null);
function unpackFile(r) {
  if (!r || !r.blob) return null;
  try { return new File([r.blob], r.name, { type: r.type || r.blob.type, lastModified: r.lastModified }); } catch (e) { return null; }
}
const packFiles = (list) => (list || []).map(packFile).filter(Boolean);
const unpackFiles = (list) => (list || []).map(unpackFile).filter(Boolean);

export async function loadDraft(userId) {
  if (!userId) return null;
  try {
    const d = await withStore('readonly', s => s.get(keyFor(userId)));
    if (!d || !d.form) return null;
    const f = d.form;
    return {
      savedAt: d.savedAt,
      form: {
        ...f,
        receivedFiles: unpackFiles(f.receivedFiles),
        parts: (f.parts || []).map(p => ({
          ...p,
          processes: p.processes || [],
          cadFile: unpackFile(p.cadFile),
          drawingFile: unpackFile(p.drawingFile),
          receivedFiles: unpackFiles(p.receivedFiles),
        })),
      },
    };
  } catch (e) {
    console.warn('Could not read the enquiry draft:', e);
    return null;
  }
}

export async function saveDraft(userId, form) {
  if (!userId) return null;
  const savedAt = new Date().toISOString();
  try {
    const packed = {
      ...form,
      receivedFiles: packFiles(form.receivedFiles),
      parts: form.parts.map(p => ({
        ...p,
        cadFile: packFile(p.cadFile),
        drawingFile: packFile(p.drawingFile),
        receivedFiles: packFiles(p.receivedFiles),
      })),
    };
    await withStore('readwrite', s => s.put({ savedAt, form: packed }, keyFor(userId)));
    return savedAt;
  } catch (e) {
    console.warn('Could not save the enquiry draft:', e);
    return null;
  }
}

export async function clearDraft(userId) {
  if (!userId) return;
  try { await withStore('readwrite', s => s.delete(keyFor(userId))); } catch (e) { console.warn('Could not clear the enquiry draft:', e); }
}
