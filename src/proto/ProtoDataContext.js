import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ROWS, INITIAL_CUSTOMERS, INITIAL_ARTIFACT_STATE, PART_LIBRARY, MATERIAL_OPTIONS, FINISH_OPTIONS } from './fixtures';
import { kvGet, kvSet, fileSave, fileOpen } from './db';

// Everything you add in the preview — new enquiries, customers, uploads, checklist state — is kept
// here and mirrored into IndexedDB (see db.js), so it survives a reload in THIS browser only.
// Nothing fills in on its own: Generate/Upload only happen when you click them. The sample rows
// from fixtures.js can be hidden with the "Sample data" toggle without losing anything you added.
const ProtoDataContext = createContext(null);

const K = {
  userRows: 'userRows', userCustomers: 'userCustomers', userPartLibrary: 'userPartLibrary',
  artifactState: 'artifactState', clientReleased: 'clientReleased', sampleDataOn: 'sampleDataOn',
  userMaterials: 'userMaterials', userFinishes: 'userFinishes',
};

export function ProtoDataProvider({ children }) {
  const [userRows, setUserRows] = useState([]);
  const [userCustomers, setUserCustomers] = useState([]);
  const [userPartLibrary, setUserPartLibrary] = useState({});
  const [artifactState, setArtifactState] = useState(INITIAL_ARTIFACT_STATE);
  const [clientReleased, setClientReleased] = useState({});
  const [sampleDataOn, setSampleDataOn] = useState(true);
  const [userMaterials, setUserMaterials] = useState([]);
  const [userFinishes, setUserFinishes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    (async () => {
      setUserRows(await kvGet(K.userRows, []));
      setUserCustomers(await kvGet(K.userCustomers, []));
      setUserPartLibrary(await kvGet(K.userPartLibrary, {}));
      setArtifactState(await kvGet(K.artifactState, INITIAL_ARTIFACT_STATE));
      setClientReleased(await kvGet(K.clientReleased, {}));
      setSampleDataOn(await kvGet(K.sampleDataOn, true));
      setUserMaterials(await kvGet(K.userMaterials, []));
      setUserFinishes(await kvGet(K.userFinishes, []));
      setLoaded(true);
    })();
  }, []);

  const nextId = useCallback((prefix) => {
    seq.current += 1;
    return `${prefix}-${Date.now().toString(36).toUpperCase()}${seq.current}`;
  }, []);

  const addCustomer = useCallback((c) => {
    setUserCustomers(prev => { const next = [...prev, c]; kvSet(K.userCustomers, next); return next; });
  }, []);

  // Builds the enquiry row + a matching Part Workspace entry from the New Enquiry form, saves any
  // uploaded CAD file / drawing into the file store, and returns the new row's id.
  const createEnquiry = useCallback(async (form) => {
    const jobId = nextId('ENQ-USER');
    const tmpl = nextId('TMPL-USER');
    const today = new Date().toISOString().slice(0, 10);

    let cadFileKey = null, drawingFileKey = null;
    if (form.cadFile) { cadFileKey = `${jobId}:cad`; await fileSave(cadFileKey, form.cadFile); }
    if (form.drawingFile) { drawingFileKey = `${jobId}:drawing`; await fileSave(drawingFileKey, form.drawingFile); }

    const row = {
      id: jobId, customer: form.noOrderMode ? '— Internal / R&D —' : (form.customer || 'Unnamed customer'),
      date: today, status: 'PENDING', isOrder: false,
      jobType: form.noOrderMode ? 'TRIAL' : undefined,
      remarks: form.remarks || '',
      parts: [{
        tmpl, name: form.partName || 'Untitled part', material: form.material, qty: Number(form.qty) || 1,
        finish: form.finish, file: form.cadFile ? form.cadFile.name : 'Not uploaded', fileKey: cadFileKey,
      }],
      drawingFileKey,
    };
    setUserRows(prev => { const next = [...prev, row]; kvSet(K.userRows, next); return next; });
    setUserPartLibrary(prev => {
      const next = {
        ...prev,
        [tmpl]: {
          name: row.parts[0].name, customer: row.customer, rev: '1', programSource: 'Enquiry stage',
          setups: 'Not yet planned', operations: '—', stock: '—', planStatus: 'PENDING',
          datums: null, dims: null, fixture: null, cadFileKey, drawingFileKey,
        },
      };
      kvSet(K.userPartLibrary, next);
      return next;
    });
    return jobId;
  }, [nextId]);

  // src is 'human' (Upload) or 'ai'/'tech' (Generate). For a human artifact we store the real file
  // the user picked; for a generated one we write a small placeholder document so "View" opens
  // something real, stamped with when it was generated — nothing is computed from uploaded data yet.
  const markArtifactDone = useCallback(async (jobId, artifactId, { src, file, label } = {}) => {
    const fileKey = `${jobId}:${artifactId}`;
    const when = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (src === 'human' && file) {
      await fileSave(fileKey, file);
    } else {
      const html = `<!doctype html><title>${label}</title><body style="font:14px system-ui;padding:40px;max-width:640px;margin:auto">
        <h2>${label}</h2><p>Generated in the preview on ${when}.</p>
        <p style="color:#64748b">This is a placeholder — the preview has no backend yet to run the real pipeline, so clicking Generate does not compute real content. It only marks this item done and gives you something to open, so the flow can be clicked through end to end.</p></body>`;
      await fileSave(fileKey, new File([html], `${artifactId}.html`, { type: 'text/html' }));
    }
    setArtifactState(prev => {
      const next = { ...prev, [jobId]: { ...(prev[jobId] || {}), [artifactId]: { done: true, fileKey, note: file ? `Uploaded · ${file.name}` : `Generated · ${when}` } } };
      kvSet(K.artifactState, next);
      return next;
    });
  }, []);

  const openArtifactFile = useCallback((jobId, artifactId) => fileOpen(`${jobId}:${artifactId}`), []);
  const openFile = useCallback((fileKey) => fileOpen(fileKey), []);

  const toggleClientRelease = useCallback((jobId, artifactId) => {
    setClientReleased(prev => {
      const jobState = prev[jobId] || { inspReport: true, materialCert: true };
      const next = { ...prev, [jobId]: { ...jobState, [artifactId]: !jobState[artifactId] } };
      kvSet(K.clientReleased, next);
      return next;
    });
  }, []);

  const getClientReleased = useCallback((jobId) => clientReleased[jobId] || { inspReport: true, materialCert: true }, [clientReleased]);

  const toggleSampleData = useCallback(() => {
    setSampleDataOn(prev => { const next = !prev; kvSet(K.sampleDataOn, next); return next; });
  }, []);

  // "+ Add new…" in the New Enquiry form's Material/Finish fields. Added once, remembered after —
  // the next enquiry sees it as a normal option.
  const addMaterial = useCallback((name) => {
    setUserMaterials(prev => (prev.includes(name) ? prev : (() => { const next = [...prev, name]; kvSet(K.userMaterials, next); return next; })()));
  }, []);
  const addFinish = useCallback((name) => {
    setUserFinishes(prev => (prev.includes(name) ? prev : (() => { const next = [...prev, name]; kvSet(K.userFinishes, next); return next; })()));
  }, []);

  const rows = sampleDataOn ? [...userRows, ...ROWS] : [...userRows];
  const customers = sampleDataOn ? [...userCustomers, ...INITIAL_CUSTOMERS] : [...userCustomers];
  const partLibrary = { ...(sampleDataOn ? PART_LIBRARY : {}), ...userPartLibrary };

  const materials = [...MATERIAL_OPTIONS, ...userMaterials];
  const finishes = [...FINISH_OPTIONS, ...userFinishes];

  const value = {
    loaded, rows, customers, partLibrary, sampleDataOn, toggleSampleData,
    materials, finishes, addMaterial, addFinish,
    findRow: (id) => rows.find(r => r.id === id),
    findOrder: (orderId) => rows.find(r => r.orderId === orderId),
    addCustomer, createEnquiry,
    artifactState, markArtifactDone, openArtifactFile, openFile,
    getClientReleased, toggleClientRelease,
  };

  return <ProtoDataContext.Provider value={value}>{children}</ProtoDataContext.Provider>;
}

export function useProtoData() {
  const ctx = useContext(ProtoDataContext);
  if (!ctx) throw new Error('useProtoData must be used inside ProtoDataProvider');
  return ctx;
}
