import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { LEGACY_JOB_STATUS, ROWS, INITIAL_CUSTOMERS, INITIAL_ARTIFACT_STATE, PART_LIBRARY, MATERIAL_OPTIONS, FINISH_OPTIONS, SETTINGS } from './fixtures';
import { kvGet, kvSet, fileSave, fileGet, fileOpen, fileDownload } from './db';

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
  autoQuoteState: 'autoQuoteState', partLibraryOverrides: 'partLibraryOverrides', cappUrl: 'cappUrl', settingsTables: 'settingsTables',
};

// Settings lists as rows of strings, seeded from the sample values.
const INITIAL_SETTINGS = {
  users: SETTINGS.users.map(r => r.slice(0, 2)),
  materials: SETTINGS.materials.map(r => r.slice(0, 3)),
  tools: SETTINGS.tools.map(r => r.slice(0, 3)),
  machines: SETTINGS.machines.map(r => r.slice(0, 3)),
};

const DEFAULT_CAPP_URL = 'http://localhost:8001';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// The CAPP pipeline only has cutting data for these; anything else is planned as aluminium and the
// result says so.
function pipelineMaterial(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('alumin')) return { key: 'aluminium', exact: true };
  if (n.includes('titanium')) return { key: 'titanium', exact: true };
  if (n.includes('brass')) return { key: 'brass', exact: true };
  if (n.includes('steel')) return { key: 'steel', exact: true };
  return { key: 'aluminium', exact: false };
}

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
  const [cappUrl, setCappUrlState] = useState(DEFAULT_CAPP_URL);
  const [settingsTables, setSettingsTables] = useState(INITIAL_SETTINGS);
  // Live status of a running Generate, keyed `${jobId}:${artifactId}` — {text} while running,
  // {error} if it failed. Not persisted.
  const [artifactProgress, setArtifactProgress] = useState({});
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
      setCappUrlState(await kvGet(K.cappUrl, DEFAULT_CAPP_URL));
      setSettingsTables({ ...INITIAL_SETTINGS, ...(await kvGet(K.settingsTables, {})) });
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

    const row = {
      id: jobId, customer, date: today, status: 'PENDING', isOrder: false,
      remarks: form.remarks || '', assemblyName: form.assemblyName || '', parts,
    };
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

  // One combined "the client sent updates" action for the whole enquiry, mirroring the New Enquiry
  // form filled in with the current values: any of a part's qty/material/finish/CAD file/drawing
  // can change, remarks can change, and new parts can be added in the same pass. Nothing is
  // overwritten — each changed existing part gets its prior qty/material/finish/CAD/drawing/remarks
  // appended to that part's revisions[] before the new values replace them; a brand-new part is just
  // added. Takes the current `row` object (from `rows`/`findRow`) rather than looking it up itself.
  //
  // `formParts` entries: existing ones carry {existing:true, originalIndex, qty, material, finish,
  // cadFile?, drawingFile?}; newly added ones carry {existing:false, partName, qty, material,
  // finish, cadFile?, drawingFile?}.
  const applyEnquiryUpdate = useCallback(async (row, { remarks, assemblyName, parts: formParts, note }) => {
    const at = new Date().toISOString();
    const newParts = [];
    const libraryPatches = {};
    const newLibraryEntries = {};

    for (let i = 0; i < formParts.length; i++) {
      const fp = formParts[i];
      if (fp.existing) {
        const orig = row.parts[fp.originalIndex];
        const qty = Number(fp.qty) || orig.qty;
        const material = fp.material || orig.material;
        const finish = fp.finish || orig.finish;

        let fileKey = orig.fileKey, fileName = orig.file;
        if (fp.cadFile) {
          fileKey = `${row.id}:cad:${fp.originalIndex}:${Date.now().toString(36)}`;
          fileName = fp.cadFile.name;
          await fileSave(fileKey, fp.cadFile);
        }
        let drawingFileKey = orig.drawingFileKey, drawingFileName = orig.drawingFileName;
        if (fp.drawingFile) {
          drawingFileKey = `${row.id}:drawing:${fp.originalIndex}:${Date.now().toString(36)}`;
          drawingFileName = fp.drawingFile.name;
          await fileSave(drawingFileKey, fp.drawingFile);
        }

        const changed = qty !== orig.qty || material !== orig.material || finish !== orig.finish || !!fp.cadFile || !!fp.drawingFile;
        const revisions = changed
          ? [...(orig.revisions || []), {
              at, note: note || '',
              qty: orig.qty, material: orig.material, finish: orig.finish,
              file: orig.file, fileKey: orig.fileKey,
              drawingFileKey: orig.drawingFileKey, drawingFileName: orig.drawingFileName,
              remarks: row.remarks,
            }]
          : (orig.revisions || []);

        const updated = { ...orig, qty, material, finish, file: fileName, fileKey, drawingFileKey, drawingFileName, revisions };
        newParts.push(updated);
        libraryPatches[orig.tmpl] = { material, finish, cadFileKey: fileKey, drawingFileKey, drawingFileName };
      } else {
        const tmpl = nextId('TMPL-USER');
        let fileKey = null, fileName = 'Not uploaded';
        if (fp.cadFile) { fileKey = `${row.id}:cad:new:${tmpl}`; fileName = fp.cadFile.name; await fileSave(fileKey, fp.cadFile); }
        let drawingFileKey = null, drawingFileName = null;
        if (fp.drawingFile) { drawingFileKey = `${row.id}:drawing:new:${tmpl}`; drawingFileName = fp.drawingFile.name; await fileSave(drawingFileKey, fp.drawingFile); }
        const name = fp.partName || `Untitled part ${i + 1}`;
        newParts.push({ tmpl, name, material: fp.material, qty: Number(fp.qty) || 1, finish: fp.finish, file: fileName, fileKey, drawingFileKey, drawingFileName });
        newLibraryEntries[tmpl] = {
          name, customer: row.customer, rev: '1', programSource: 'Enquiry stage',
          setups: 'Not yet planned', operations: '—', stock: '—', planStatus: 'PENDING',
          datums: null, dims: null, fixture: null, cadFileKey: fileKey, drawingFileKey, drawingFileName,
        };
      }
    }

    const remarksChanged = remarks !== undefined && remarks !== row.remarks;
    const assemblyNameChanged = assemblyName !== undefined && assemblyName !== (row.assemblyName || '');
    patchRow(row.id, {
      parts: newParts,
      ...(remarksChanged ? { remarks } : {}),
      ...(assemblyNameChanged ? { assemblyName } : {}),
    });
    Object.entries(libraryPatches).forEach(([tmpl, patch]) => patchPartLibrary(tmpl, patch));
    if (Object.keys(newLibraryEntries).length) {
      setUserPartLibrary(prev => { const next = { ...prev, ...newLibraryEntries }; kvSet(K.userPartLibrary, next); return next; });
    }
  }, [nextId, patchRow, patchPartLibrary]);

  const setSettingsTable = useCallback((name, tableRows) => {
    setSettingsTables(prev => { const next = { ...prev, [name]: tableRows }; kvSet(K.settingsTables, next); return next; });
  }, []);

  const setCappUrl = useCallback((url) => {
    const clean = (url || '').trim().replace(/\/+$/, '') || DEFAULT_CAPP_URL;
    setCappUrlState(clean);
    kvSet(K.cappUrl, clean);
  }, []);

  // Process plan: the one checklist item that is really generated. Each part's uploaded STEP file is
  // sent to the CAPP service (capp_service in the shiaanx-CAPP repo — the 8-stage pipeline), and the
  // program sheet PDF it returns is stored as the artifact. The setups / operations / envelope it
  // works out also fill that part's Part Workspace overview. The service has to be running and
  // reachable from this browser; if it isn't, this says so rather than faking a result.
  const generateProcessPlan = useCallback(async (jobId, row, partIndex) => {
    const pKey = `${jobId}:p${partIndex}.plan`;
    const say = (text) => setArtifactProgress(prev => ({ ...prev, [pKey]: { text } }));
    const fail = (error) => setArtifactProgress(prev => ({ ...prev, [pKey]: { error } }));

    const targets = row.parts.map((p, i) => ({ p, i })).filter(t => t.i === partIndex && t.p.fileKey);
    if (targets.length === 0) {
      fail('No STEP file is attached to this part, and the CAM program is worked out from the STEP file. Attach one first.');
      return;
    }

    const files = [];
    const summaries = [];
    const notes = [];
    try {
      for (const { p, i } of targets) {
        const entry = await fileGet(p.fileKey);
        if (!entry) throw new Error(`The STEP file for ${p.name} is no longer in this browser's storage.`);
        const mat = pipelineMaterial(p.material);
        if (!mat.exact) notes.push(`${p.name}: no cutting data for ${p.material}, planned as aluminium`);

        say(`${p.name}: sending STEP file to the CAPP pipeline…`);
        const body = new FormData();
        body.append('step_file', entry.blob, entry.name || 'part.step');
        body.append('part_name', p.name);
        body.append('material', mat.key);
        let res;
        try {
          res = await fetch(`${cappUrl}/jobs`, { method: 'POST', body });
        } catch (e) {
          throw new Error(`Could not reach the CAPP service at ${cappUrl}. It has to be running on this computer for the CAM program to be generated.`);
        }
        if (!res.ok) throw new Error(`CAPP service refused the file (${res.status}).`);
        const { job_id: cappJob } = await res.json();

        let status;
        for (let n = 0; n < 240; n++) {
          await sleep(1500);
          status = await (await fetch(`${cappUrl}/jobs/${cappJob}`)).json();
          if (status.status === 'COMPLETE' || status.status === 'FAILED') break;
          say(`${p.name}: stage ${status.stage}/9 — ${status.stage_name}`);
        }
        if (!status || status.status !== 'COMPLETE') {
          const why = status && status.error ? String(status.error).trim().split('\n').slice(-3).join(' ') : 'timed out';
          throw new Error(`The pipeline failed on ${p.name}: ${why}`);
        }

        say(`${p.name}: fetching the program sheet…`);
        const pdf = await (await fetch(`${cappUrl}/jobs/${cappJob}/pdf`)).blob();
        const fileKey = `${jobId}:plan:${i}`;
        await fileSave(fileKey, new File([pdf], `${p.name}_program_sheet.pdf`, { type: 'application/pdf' }));
        files.push({ label: p.name, fileKey });

        const out = await (await fetch(`${cappUrl}/jobs/${cappJob}/output/setups`)).json();
        const setups = out.setups || [];
        const ops = setups.reduce((sum, s) => sum + (s.operation_count || 0), 0);
        const bb = out.bounding_box || {};
        summaries.push({ setups: setups.length, ops });
        patchPartLibrary(p.tmpl, {
          setups: `${setups.length} — ${setups.map(s => s.wcs).join(', ')}`,
          operations: `${ops}, across ${setups.length} setup${setups.length === 1 ? '' : 's'}`,
          stock: bb.length_x ? `Part envelope ${bb.length_x} × ${bb.length_y} × ${bb.length_z} mm` : '—',
          programSource: 'AI_GENERATED · CAPP pipeline', planStatus: 'DRAFT', cappJobId: cappJob,
        });
      }
    } catch (e) {
      fail(e.message || String(e));
      return;
    }

    const when = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const totals = `${summaries[0].setups} setup(s), ${summaries[0].ops} operations`;
    const note = [`CAPP pipeline · ${when} · ${totals}`, ...notes].filter(Boolean).join(' · ');
    setArtifactState(prev => {
      const next = { ...prev, [jobId]: { ...(prev[jobId] || {}), [`p${partIndex}.plan`]: { done: true, fileKey: files[0].fileKey, note } } };
      kvSet(K.artifactState, next);
      return next;
    });
    setArtifactProgress(prev => { const next = { ...prev }; delete next[pKey]; return next; });
  }, [cappUrl, patchPartLibrary]);

  // Turns any enquiry row into an order — generates an order id and switches it over, same as a
  // real "Convert to order" would. Works on a sample row too, so the flow can be tried end to end.
  const convertToOrder = useCallback((id, statusNow) => {
    // Re-converting after a revert reuses the earlier order id, so whatever was uploaded against
    // that order (PO, CAM program, certificates) is attached again instead of orphaned.
    const prior = rowOverrides[id] || {};
    const orderId = prior.lastOrderId || nextId('ORD-USER');
    const today = new Date().toISOString().slice(0, 10);
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    patchRow(id, {
      isOrder: true, orderId, orderDate: today, deadline, status: 'IN_PRODUCTION', jobType: undefined,
      statusBeforeOrder: statusNow || prior.statusBeforeOrder || 'QUOTED',
    });
    return orderId;
  }, [nextId, patchRow, rowOverrides]);

  // Undo for Convert to order: the record goes back to being an enquiry with the quote status it
  // had before. Nothing uploaded is deleted — the order id is remembered for a later re-convert.
  const revertToEnquiry = useCallback((row) => {
    patchRow(row.id, {
      isOrder: false, orderId: undefined, orderDate: undefined, deadline: undefined,
      lastOrderId: row.orderId, status: row.statusBeforeOrder || 'QUOTED',
    });
  }, [patchRow]);

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

  const addOtherDocument = useCallback(async (jobId, scope, file) => {
    const fileKey = `${jobId}:${scope}.other:${Date.now().toString(36)}`;
    await fileSave(fileKey, file);
    const at = new Date().toISOString();
    setArtifactState(prev => {
      const key = `${scope}.other`;
      const job = prev[jobId] || {};
      const items = [...((job[key] && job[key].items) || []), { fileKey, name: file.name, at }];
      const next = { ...prev, [jobId]: { ...job, [key]: { items } } };
      kvSet(K.artifactState, next);
      return next;
    });
  }, []);

  const removeOtherDocument = useCallback((jobId, scope, fileKey) => {
    setArtifactState(prev => {
      const key = `${scope}.other`;
      const job = prev[jobId] || {};
      const items = ((job[key] && job[key].items) || []).filter(it => it.fileKey !== fileKey);
      const next = { ...prev, [jobId]: { ...job, [key]: { items } } };
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
    setSettingsTables(prev => {
      if (prev.materials.some(m => m[0] === name)) return prev;
      const next = { ...prev, materials: [...prev.materials, [name, '', '']] };
      kvSet(K.settingsTables, next);
      return next;
    });
    setUserMaterials(prev => (prev.includes(name) ? prev : (() => { const next = [...prev, name]; kvSet(K.userMaterials, next); return next; })()));
  }, []);
  const addFinish = useCallback((name) => {
    setUserFinishes(prev => (prev.includes(name) ? prev : (() => { const next = [...prev, name]; kvSet(K.userFinishes, next); return next; })()));
  }, []);

  const applyOverride = (r) => {
    let out = rowOverrides[r.id] ? { ...r, ...rowOverrides[r.id] } : r;
    const partPatch = partStatusOverrides[r.id];
    if (partPatch) out = { ...out, parts: out.parts.map((p, i) => (partPatch[i] ? { ...p, jobStatus: partPatch[i] } : p)) };
    // Anything being made — an order, or a job produced without one — is on the board from the
    // start: a part with no stage yet is in the queue. Stage names saved before the rename map over.
    const inProduction = out.isOrder || out.jobType === 'TRIAL';
    out = { ...out, parts: out.parts.map(p => {
      const st = LEGACY_JOB_STATUS[p.jobStatus] || p.jobStatus || (inProduction ? 'IN_QUEUE' : undefined);
      return st === p.jobStatus ? p : { ...p, jobStatus: st };
    }) };
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

  const materials = [...new Set([...MATERIAL_OPTIONS, ...settingsTables.materials.map(m => m[0]), ...userMaterials])].filter(Boolean);
  const finishes = [...FINISH_OPTIONS, ...userFinishes];

  const value = {
    loaded, rows, customers, partLibrary, sampleDataOn, toggleSampleData,
    materials, finishes, addMaterial, addFinish,
    findRow: (id) => rows.find(r => r.id === id),
    findOrder: (orderId) => rows.find(r => r.orderId === orderId),
    addCustomer, updateCustomer, deleteCustomer, createEnquiry, convertToOrder, revertToEnquiry, markNoOrderJob, updateQuote, setPartStatus,
    applyEnquiryUpdate,
    getAutoQuote, generateAutoQuote, saveAutoQuote, uploadManualQuote,
    settingsTables, setSettingsTable,
    cappUrl, setCappUrl, generateProcessPlan, artifactProgress, addOtherDocument, removeOtherDocument,
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
