import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ROWS, INITIAL_CUSTOMERS, INITIAL_ARTIFACT_STATE, PART_LIBRARY, MATERIAL_OPTIONS, FINISH_OPTIONS } from './fixtures';
import { kvGet, kvSet, fileSave, fileOpen, fileDownload } from './db';

// Everything you add in the preview — new enquiries, customers, uploads, checklist state — is kept
// here and mirrored into IndexedDB (see db.js), so it survives a reload in THIS browser only.
// Nothing fills in on its own: Generate/Upload only happen when you click them. The sample rows
// from fixtures.js can be hidden with the "Sample data" toggle without losing anything you added.
const ProtoDataContext = createContext(null);

const K = {
  userRows: 'userRows', userCustomers: 'userCustomers', userPartLibrary: 'userPartLibrary',
  artifactState: 'artifactState', clientReleased: 'clientReleased', sampleDataOn: 'sampleDataOn',
  userMaterials: 'userMaterials', userFinishes: 'userFinishes', rowOverrides: 'rowOverrides',
  partStatusOverrides: 'partStatusOverrides', customerOverrides: 'customerOverrides', deletedCustomers: 'deletedCustomers',
  autoQuoteState: 'autoQuoteState', partLibraryOverrides: 'partLibraryOverrides',
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
  // Patches applied on top of a row by id — covers both user-created rows and the sample fixture
  // rows, so Convert to order / Edit quote / Produce without an order work the same on a sample row
  // (for trying the flow) as on one you created.
  const [rowOverrides, setRowOverrides] = useState({});
  // Production Board drag-and-drop: {rowId: {partIndex: newJobStatus}}, layered onto the matching
  // part the same way rowOverrides layers onto a row — so a dragged status shows up everywhere that
  // part appears (the board, the order's Closed-loop card), not just on the board itself.
  const [partStatusOverrides, setPartStatusOverrides] = useState({});
  // Same pattern again, keyed by customer name: Edit/Delete in Customers works on a sample customer
  // (to try it) or one you added, through one path instead of two.
  const [customerOverrides, setCustomerOverrides] = useState({});
  const [deletedCustomers, setDeletedCustomers] = useState([]);
  // {rowId: {partIndex: {data, status}}} — the same shape as shiaanx-backend's
  // enquiry_parts.auto_quote_data / auto_quote_status, so this maps onto the real schema later
  // instead of its own invented one.
  const [autoQuoteState, setAutoQuoteState] = useState({});
  // Patches onto a Part Workspace entry by tmpl id — mirrors rowOverrides so a sample part's
  // workspace view (drawing/finish) can be revised too, same as a row.
  const [partLibraryOverrides, setPartLibraryOverrides] = useState({});
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
      setRowOverrides(await kvGet(K.rowOverrides, {}));
      setPartStatusOverrides(await kvGet(K.partStatusOverrides, {}));
      setCustomerOverrides(await kvGet(K.customerOverrides, {}));
      setDeletedCustomers(await kvGet(K.deletedCustomers, []));
      setAutoQuoteState(await kvGet(K.autoQuoteState, {}));
      setPartLibraryOverrides(await kvGet(K.partLibraryOverrides, {}));
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

  const updateCustomer = useCallback((name, patch) => {
    setCustomerOverrides(prev => {
      const next = { ...prev, [name]: { ...(prev[name] || {}), ...patch } };
      kvSet(K.customerOverrides, next);
      return next;
    });
  }, []);

  const deleteCustomer = useCallback((name) => {
    setDeletedCustomers(prev => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      kvSet(K.deletedCustomers, next);
      return next;
    });
  }, []);

  // Builds the enquiry row — one or more parts — plus a matching Part Workspace entry for each
  // part, saves any uploaded CAD file / drawing into the file store, and returns the new row's id.
  // Each part keeps its own drawing (a drawing is specific to one part, not shared across the
  // enquiry) alongside its own CAD file.
  const createEnquiry = useCallback(async (form) => {
    const jobId = nextId('ENQ-USER');
    const today = new Date().toISOString().slice(0, 10);
    const customer = form.customer || 'Unnamed customer';

    const parts = [];
    const libraryEntries = {};
    for (let i = 0; i < form.parts.length; i++) {
      const p = form.parts[i];
      const tmpl = nextId('TMPL-USER');
      let cadFileKey = null;
      if (p.cadFile) { cadFileKey = `${jobId}:cad:${i}`; await fileSave(cadFileKey, p.cadFile); }
      let drawingFileKey = null, drawingFileName = null;
      if (p.drawingFile) {
        drawingFileKey = `${jobId}:drawing:${i}`;
        drawingFileName = p.drawingFile.name;
        await fileSave(drawingFileKey, p.drawingFile);
      }
      const name = p.partName || `Untitled part ${i + 1}`;
      parts.push({
        tmpl, name, material: p.material, qty: Number(p.qty) || 1,
        finish: p.finish, file: p.cadFile ? p.cadFile.name : 'Not uploaded', fileKey: cadFileKey,
        drawingFileKey, drawingFileName,
      });
      libraryEntries[tmpl] = {
        name, customer, rev: '1', programSource: 'Enquiry stage',
        setups: 'Not yet planned', operations: '—', stock: '—', planStatus: 'PENDING',
        datums: null, dims: null, fixture: null, cadFileKey, drawingFileKey, drawingFileName,
      };
    }

    const row = { id: jobId, customer, date: today, status: 'PENDING', isOrder: false, remarks: form.remarks || '', parts };
    setUserRows(prev => { const next = [...prev, row]; kvSet(K.userRows, next); return next; });
    setUserPartLibrary(prev => { const next = { ...prev, ...libraryEntries }; kvSet(K.userPartLibrary, next); return next; });
    return jobId;
  }, [nextId]);

  const patchRow = useCallback((id, patch) => {
    setRowOverrides(prev => {
      const next = { ...prev, [id]: { ...(prev[id] || {}), ...patch } };
      kvSet(K.rowOverrides, next);
      return next;
    });
  }, []);

  const patchPartLibrary = useCallback((tmpl, patch) => {
    setPartLibraryOverrides(prev => {
      const next = { ...prev, [tmpl]: { ...(prev[tmpl] || {}), ...patch } };
      kvSet(K.partLibraryOverrides, next);
      return next;
    });
  }, []);

  // A client sending a revised drawing, or a finish/remarks change, after the enquiry was created.
  // The earlier drawing and values are kept as a revision entry on the part — never overwritten —
  // so the full history of what was received stays visible; only the "current" fields (read by
  // Documents received, Part Workspace, CAM, etc.) move to the new values. Takes the current `row`
  // object (as returned by `rows`/`findRow`) rather than looking it up itself.
  const updatePartRevision = useCallback(async (row, partIndex, { drawingFile, finish, remarks, note }) => {
    const part = row.parts[partIndex];
    const at = new Date().toISOString();

    let drawingFileKey = part.drawingFileKey;
    let drawingFileName = part.drawingFileName;
    if (drawingFile) {
      drawingFileKey = `${row.id}:drawing:${partIndex}:${Date.now().toString(36)}`;
      drawingFileName = drawingFile.name;
      await fileSave(drawingFileKey, drawingFile);
    }
    const newFinish = finish || part.finish;
    const remarksChanged = remarks !== undefined && remarks !== row.remarks;

    // Snapshot of what's being superseded, not what's new — so the revision list reads as a log of
    // what the part used to be.
    const revision = {
      at, note: note || '',
      drawingFileKey: part.drawingFileKey, drawingFileName: part.drawingFileName,
      finish: part.finish, remarks: row.remarks,
    };
    const newParts = row.parts.map((p, i) => (i === partIndex
      ? { ...p, drawingFileKey, drawingFileName, finish: newFinish, revisions: [...(p.revisions || []), revision] }
      : p));

    patchRow(row.id, { parts: newParts, ...(remarksChanged ? { remarks } : {}) });
    patchPartLibrary(part.tmpl, { drawingFileKey, drawingFileName, finish: newFinish });
  }, [patchRow, patchPartLibrary]);

  // Turns any enquiry row into an order — generates an order id and switches it over, same as a
  // real "Convert to order" would. Works on a sample row too, so the flow can be tried end to end.
  const convertToOrder = useCallback((id) => {
    const orderId = nextId('ORD-USER');
    const today = new Date().toISOString().slice(0, 10);
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    patchRow(id, { isOrder: true, orderId, orderDate: today, deadline, status: 'IN_PRODUCTION', jobType: undefined });
    return orderId;
  }, [nextId, patchRow]);

  // "We're manufacturing this without a confirmed order" — moved here from enquiry creation, so it
  // is a decision you make about an enquiry that already exists, not a checkbox up front. Order?
  // stays No, but it unlocks the full artifact checklist (CAM program, inspection, etc.) the same
  // way converting to an order would.
  const markNoOrderJob = useCallback((id) => {
    patchRow(id, { jobType: 'TRIAL', status: 'IN_PRODUCTION' });
  }, [patchRow]);

  const updateQuote = useCallback((id, patch) => patchRow(id, patch), [patchRow]);

  const getAutoQuote = useCallback((rowId, partIndex) => (autoQuoteState[rowId] || {})[partIndex] || null, [autoQuoteState]);

  // Fills the same field shape insta_quote/server.py's /process endpoint returns (and
  // enquiry_parts.auto_quote_data stores), but with sensible defaults rather than real geometry —
  // there's no backend here to run the actual CAPP pipeline. Only runs when you click it.
  const generateAutoQuote = useCallback((rowId, partIndex, part) => {
    const data = {
      partName: part.name, quantity: part.qty || 1, materialName: part.material,
      setupCount: 1, stepCount: 6, cycleTimeMin: 12, uniqueOperations: 4, weightedFeatures: 6,
      featureCount: 4, faceMillCount: 1, circularInterpCount: 0, contourMillCount: 1,
      stockMassKg: 0.5, partMassKg: 0.35, removedMassKg: 0.15,
      stockX: 100, stockY: 80, stockZ: 20,
      materialRate: /aluminium/i.test(part.material || '') ? 420 : 150,
      machineRate: 400, setupTimePerSetupMin: 30, setupCostPerMin: 25, fixtureCost: 0,
      inspectionBaseHours: 1, inspectionPerSetupHours: 0.35, inspectionPerFeatureHours: 0.03,
      inspectionRateCmm: 1000, inspectionRateManual: 600,
      packagingCost: 1500, shippingCost: 1500, miscCost: 350, gstPercent: 18,
      inspectionType: 'Manual Inspection', packagingType: 'Wooden Box', shippingType: 'Train',
      notes: 'Starting values only — fill in the real figures for this part before sending.',
      finishes: [], secondaryOps: [], extraCharges: [], _source: 'placeholder',
    };
    setAutoQuoteState(prev => {
      const next = { ...prev, [rowId]: { ...(prev[rowId] || {}), [partIndex]: { data, status: 'DRAFT' } } };
      kvSet(K.autoQuoteState, next);
      return next;
    });
    return data;
  }, []);

  const saveAutoQuote = useCallback((rowId, partIndex, data, finalize) => {
    setAutoQuoteState(prev => {
      const next = { ...prev, [rowId]: { ...(prev[rowId] || {}), [partIndex]: { data, status: finalize ? 'FINALIZED' : 'DRAFT' } } };
      kvSet(K.autoQuoteState, next);
      return next;
    });
    if (finalize) patchRow(rowId, { status: 'QUOTED' });
  }, [patchRow]);

  // A manual quote — an Excel sheet or PDF put together outside the auto-quote tool — attached to
  // the enquiry directly, as an alternative to building a line-item quote in the app.
  const uploadManualQuote = useCallback(async (rowId, file) => {
    const fileKey = `${rowId}:manualQuote`;
    await fileSave(fileKey, file);
    patchRow(rowId, { manualQuoteFileKey: fileKey, manualQuoteFileName: file.name, status: 'QUOTED' });
  }, [patchRow]);

  // Dragging a Production Board card to a new column.
  const setPartStatus = useCallback((rowId, partIndex, status) => {
    setPartStatusOverrides(prev => {
      const next = { ...prev, [rowId]: { ...(prev[rowId] || {}), [partIndex]: status } };
      kvSet(K.partStatusOverrides, next);
      return next;
    });
  }, []);

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
  const downloadFile = useCallback((fileKey) => fileDownload(fileKey), []);

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

  const applyOverride = (r) => {
    let out = rowOverrides[r.id] ? { ...r, ...rowOverrides[r.id] } : r;
    const partPatch = partStatusOverrides[r.id];
    if (partPatch) out = { ...out, parts: out.parts.map((p, i) => (partPatch[i] ? { ...p, jobStatus: partPatch[i] } : p)) };
    return out;
  };
  const rows = (sampleDataOn ? [...userRows, ...ROWS] : [...userRows]).map(applyOverride);
  const customers = (sampleDataOn ? [...userCustomers, ...INITIAL_CUSTOMERS] : [...userCustomers])
    .filter(c => !deletedCustomers.includes(c.name))
    .map(c => (customerOverrides[c.name] ? { ...c, ...customerOverrides[c.name] } : c));
  const partLibraryBase = { ...(sampleDataOn ? PART_LIBRARY : {}), ...userPartLibrary };
  const partLibrary = Object.fromEntries(Object.entries(partLibraryBase).map(([tmpl, p]) => [
    tmpl, partLibraryOverrides[tmpl] ? { ...p, ...partLibraryOverrides[tmpl] } : p,
  ]));

  const materials = [...MATERIAL_OPTIONS, ...userMaterials];
  const finishes = [...FINISH_OPTIONS, ...userFinishes];

  const value = {
    loaded, rows, customers, partLibrary, sampleDataOn, toggleSampleData,
    materials, finishes, addMaterial, addFinish,
    findRow: (id) => rows.find(r => r.id === id),
    findOrder: (orderId) => rows.find(r => r.orderId === orderId),
    addCustomer, updateCustomer, deleteCustomer, createEnquiry, convertToOrder, markNoOrderJob, updateQuote, setPartStatus,
    updatePartRevision,
    getAutoQuote, generateAutoQuote, saveAutoQuote, uploadManualQuote,
    artifactState, markArtifactDone, openArtifactFile, openFile, downloadFile,
    getClientReleased, toggleClientRelease,
  };

  return <ProtoDataContext.Provider value={value}>{children}</ProtoDataContext.Provider>;
}

export function useProtoData() {
  const ctx = useContext(ProtoDataContext);
  if (!ctx) throw new Error('useProtoData must be used inside ProtoDataProvider');
  return ctx;
}
