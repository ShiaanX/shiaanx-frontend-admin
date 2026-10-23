import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { LEGACY_JOB_STATUS } from './fixtures';
import { call, fetchDocument, hasToken, login as apiLogin, logout as apiLogout, AuthError } from './api';

// All data lives in shiaanx-backend (the production-flow API, /api/v1/admin/flow), shared by everyone
// on the team. This provider loads it once, keeps it fresh (after every change, and every 20 s while
// the tab is open), and exposes the same actions the screens were built against. Nothing fills in on
// its own: every write here is the result of a click.
const ProtoDataContext = createContext(null);

const REFRESH_MS = 20000;

// Placeholder for the AI lines that are not connected to a real generator yet: something to open,
// stamped with when it was made, saying plainly that it is not computed.
function placeholderFile(label) {
  const when = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const html = `<!doctype html><title>${label}</title><body style="font:14px system-ui;padding:40px;max-width:640px;margin:auto">
    <h2>${label}</h2><p>Marked generated on ${when}.</p>
    <p style="color:#64748b">This line is not connected to a generator yet, so nothing was computed. It only marks the item done so the flow can be followed end to end.</p></body>`;
  return new File([html], `${label.replace(/\W+/g, '_')}.html`, { type: 'text/html' });
}

function partLibraryFrom(rows) {
  const lib = {};
  rows.forEach(r => r.parts.forEach(p => {
    const s = p.planSummary || {};
    lib[p.tmpl] = {
      name: p.name, customer: r.customer, rev: String((p.revisions || []).length + 1),
      programSource: s.programSource || 'Enquiry stage', setups: s.setups || 'Not yet planned',
      operations: s.operations || '—', stock: s.stock || '—', planStatus: s.planStatus || 'PENDING',
      datums: null, dims: null, fixture: null,
      cadFileKey: p.fileKey || null, drawingFileKey: p.drawingFileKey || null, drawingFileName: p.drawingFileName || null,
      qcJobId: p.qcJobId || null,
    };
  }));
  return lib;
}

// Anything being made — an order, or a job produced without one — is on the board from the start:
// a part with no stage yet is in the queue. Stage names saved before the rename map over.
function withStages(r) {
  const inProduction = r.isOrder || r.jobType === 'TRIAL';
  return { ...r, parts: r.parts.map(p => ({ ...p, jobStatus: LEGACY_JOB_STATUS[p.jobStatus] || p.jobStatus || (inProduction ? 'IN_QUEUE' : undefined) })) };
}

function openBlob(entry, download) {
  const url = URL.createObjectURL(entry.blob);
  if (download) {
    const a = document.createElement('a');
    a.href = url; a.download = entry.name || 'download';
    document.body.appendChild(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return url;
}

export function ProtoDataProvider({ children }) {
  const [authed, setAuthed] = useState(hasToken());
  const [data, setData] = useState(null); // bootstrap payload
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  // Live status of a running Generate, keyed `${jobId}:${artifactId}` — {text} while running,
  // {error} if it failed.
  const [artifactProgress, setArtifactProgress] = useState({});
  const busy = useRef(0);

  const onAuthLost = useCallback(() => { apiLogout(); setAuthed(false); setData(null); }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await call('GET', '/bootstrap');
      setData(d);
      setLoadError('');
    } catch (e) {
      if (e instanceof AuthError) onAuthLost();
      else setLoadError(e.message);
    }
  }, [onAuthLost]);

  useEffect(() => {
    if (!authed) return undefined;
    refresh();
    const t = setInterval(() => { if (!document.hidden && busy.current === 0) refresh(); }, REFRESH_MS);
    // Coming back to the tab shows what others changed meanwhile, without waiting for the timer.
    const onVisible = () => { if (!document.hidden && busy.current === 0) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [authed, refresh]);

  // Runs one change against the server. A returned row replaces the one on screen straight away;
  // then everything is reloaded so other people's changes show too. Errors are shown in the banner
  // and re-thrown so a form can keep itself open.
  const run = useCallback(async (fn) => {
    busy.current += 1;
    setActionError('');
    try {
      const out = await fn();
      if (out && out.uuid && out.parts) {
        setData(d => (d ? { ...d, rows: d.rows.some(r => r.uuid === out.uuid) ? d.rows.map(r => (r.uuid === out.uuid ? out : r)) : [out, ...d.rows] } : d));
      }
      busy.current -= 1;
      refresh();
      return out;
    } catch (e) {
      busy.current -= 1;
      if (e instanceof AuthError) onAuthLost();
      else setActionError(e.message || String(e));
      throw e;
    }
  }, [refresh, onAuthLost]);

  const login = useCallback(async (email, password) => { await apiLogin(email, password); setAuthed(true); }, []);
  const logout = useCallback(() => onAuthLost(), [onAuthLost]);

  const rows = data ? data.rows.map(withStages) : [];
  const findRow = (id) => rows.find(r => r.uuid === id || r.id === id);
  const rowForJob = (jobId) => rows.find(r => r.id === jobId || r.orderId === jobId || r.uuid === jobId);
  const customers = data ? data.customers : [];
  const customerByName = (name) => customers.find(c => c.name === name);

  // ── customers ──
  const addCustomer = (c) => run(() => call('POST', '/customers', { json: c }));
  const updateCustomer = (name, patch) => {
    const c = customerByName(name);
    return c ? run(() => call('PATCH', `/customers/${c.id}`, { json: patch })) : Promise.resolve();
  };
  const deleteCustomer = (name) => {
    const c = customerByName(name);
    return c ? run(() => call('DELETE', `/customers/${c.id}`)) : Promise.resolve();
  };

  // ── enquiries ──
  const formWithParts = (payload, parts) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    parts.forEach((p, i) => {
      if (p.cadFile) form.append(`cad_${i}`, p.cadFile, p.cadFile.name);
      if (p.drawingFile) form.append(`drawing_${i}`, p.drawingFile, p.drawingFile.name);
    });
    return form;
  };

  // Returns the new enquiry's id for its page address.
  const createEnquiry = async (f) => {
    const c = f.customer ? customerByName(f.customer) : null;
    const payload = {
      customerId: c ? c.id : null, remarks: f.remarks || '', assemblyName: f.assemblyName || '',
      parts: f.parts.map(p => ({ partName: p.partName, qty: p.qty, material: p.material, finish: p.finish })),
    };
    const row = await run(() => call('POST', '/enquiries', { form: formWithParts(payload, f.parts) }));
    return row.uuid;
  };

  // One "the client sent updates" action for the whole enquiry; see UpdateEnquiryModal. The server
  // keeps what each changed part was before as a revision — nothing is overwritten.
  const applyEnquiryUpdate = (row, { remarks, assemblyName, parts, note }) => {
    const payload = {
      remarks, assemblyName, note,
      parts: parts.map(p => (p.existing
        ? { existing: true, partId: row.parts[p.originalIndex].uuid, qty: p.qty, material: p.material, finish: p.finish }
        : { partName: p.partName, qty: p.qty, material: p.material, finish: p.finish })),
    };
    return run(() => call('POST', `/enquiries/${row.uuid}/update`, { form: formWithParts(payload, parts) }));
  };

  const patchEnquiry = (row, patch) => run(() => call('PATCH', `/enquiries/${row.uuid}`, { json: patch }));

  // Both return the row's id for its page address (the same id serves the enquiry and the order).
  const convertToOrder = async (id) => { const r = findRow(id); await run(() => call('POST', `/enquiries/${r.uuid}/convert`)); return r.uuid; };
  const revertToEnquiry = async (row) => { await run(() => call('POST', `/enquiries/${row.uuid}/revert`)); return row.uuid; };
  const markNoOrderJob = (id) => { const r = findRow(id); return run(() => call('POST', `/enquiries/${r.uuid}/no-order`)); };

  // ── quotes ──
  const getAutoQuote = (rowId, partIndex) => { const r = findRow(rowId); return (r && r.parts[partIndex] && r.parts[partIndex].autoQuote) || null; };

  // Fills the same field shape insta_quote's /process returns (and enquiry_parts.auto_quote_data
  // stores), with starting values rather than real geometry. Only runs when clicked.
  const generateAutoQuote = (rowId, partIndex, part) => {
    const d = {
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
    const r = findRow(rowId);
    run(() => call('PATCH', `/parts/${r.parts[partIndex].uuid}`, { json: { autoQuote: { data: d, status: 'DRAFT' } } })).catch(() => {});
    return d;
  };

  const saveAutoQuote = (rowId, partIndex, d, finalize) => {
    const r = findRow(rowId);
    return run(() => call('PATCH', `/parts/${r.parts[partIndex].uuid}`, { json: { autoQuote: { data: d, status: finalize ? 'FINALIZED' : 'DRAFT' } } })).catch(() => {});
  };

  // A manual quote — an Excel sheet or PDF made outside the auto-quote tool.
  const uploadManualQuote = (rowId, file) => {
    const r = findRow(rowId);
    const form = new FormData();
    form.append('slot', 'manualQuote');
    form.append('file', file, file.name);
    return run(() => call('POST', `/enquiries/${r.uuid}/documents`, { form })).catch(() => {});
  };

  // ── parts ──
  const setPartStatus = (rowId, partIndex, status) => {
    const r = findRow(rowId);
    return run(() => call('PATCH', `/parts/${r.parts[partIndex].uuid}`, { json: { stage: status } })).catch(() => {});
  };
  const patchPartLibrary = (tmpl, patch) => {
    const body = {};
    if ('qcJobId' in patch) body.qcJobId = patch.qcJobId;
    return run(() => call('PATCH', `/parts/${tmpl}`, { json: body })).catch(() => {});
  };

  // CAM program (AI): the server sends the part's current STEP file through the CAPP pipeline and
  // stores the program sheet it returns.
  const generateProcessPlan = async (jobId, row, partIndex) => {
    const pKey = `${jobId}:p${partIndex}.plan`;
    const part = row.parts[partIndex];
    if (!part.fileKey) {
      setArtifactProgress(prev => ({ ...prev, [pKey]: { error: 'No STEP file is attached to this part, and the CAM program is worked out from the STEP file. Attach one first.' } }));
      return;
    }
    setArtifactProgress(prev => ({ ...prev, [pKey]: { text: `${part.name}: running the CAPP pipeline on the STEP file…` } }));
    try {
      await run(() => call('POST', `/parts/${part.uuid}/generate-cam`));
      setArtifactProgress(prev => { const next = { ...prev }; delete next[pKey]; return next; });
    } catch (e) {
      setActionError('');
      setArtifactProgress(prev => ({ ...prev, [pKey]: { error: e.message || String(e) } }));
    }
  };

  // ── documents ──
  const slotOf = (row, artifactId) => {
    const m = /^p(\d+)\.(.+)$/.exec(artifactId);
    if (!m) return { slot: artifactId, partId: null };
    const part = row.parts[Number(m[1])];
    return { slot: m[2], partId: part ? part.uuid : null };
  };

  const uploadTo = (row, slot, partId, file, note) => {
    const form = new FormData();
    form.append('slot', slot);
    if (partId) form.append('partId', partId);
    if (note) form.append('note', note);
    form.append('file', file, file.name);
    return run(() => call('POST', `/enquiries/${row.uuid}/documents`, { form })).catch(() => {});
  };

  // src 'human' uploads the picked file; a not-yet-connected AI line stores a placeholder that says so.
  const markArtifactDone = (jobId, artifactId, { src, file, label } = {}) => {
    const row = rowForJob(jobId);
    const { slot, partId } = slotOf(row, artifactId);
    if (src === 'human' && file) return uploadTo(row, slot, partId, file);
    return uploadTo(row, slot, partId, placeholderFile(label || artifactId), `Marked generated · not connected yet`);
  };

  const addOtherDocument = (jobId, scope, file) => {
    const row = rowForJob(jobId);
    const partId = scope === 'job' ? null : slotOf(row, `${scope}.other`).partId;
    return uploadTo(row, 'other', partId, file);
  };
  const removeOtherDocument = (jobId, scope, fileKey) => run(() => call('DELETE', `/documents/${fileKey}`)).catch(() => {});

  const fetchFile = useCallback((fileKey) => fetchDocument(fileKey).catch((e) => {
    if (e instanceof AuthError) onAuthLost();
    return null;
  }), [onAuthLost]);

  // The tab is opened before the file arrives, so the browser treats it as part of the click and
  // does not block it as a pop-up.
  const openFile = async (fileKey) => {
    const w = window.open('', '_blank');
    const entry = await fetchFile(fileKey);
    if (!entry) { if (w) w.close(); setActionError('That file could not be opened.'); return false; }
    const url = openBlob(entry, false);
    if (w) w.location.href = url; else window.open(url, '_blank');
    return true;
  };
  const downloadFile = async (fileKey) => {
    const entry = await fetchFile(fileKey);
    if (!entry) { setActionError('That file could not be downloaded.'); return false; }
    openBlob(entry, true);
    return true;
  };
  const openArtifactFile = (jobId, artifactId) => {
    const e = (rowForJob(jobId) || {}).checklist || {};
    return e[artifactId] && e[artifactId].fileKey ? openFile(e[artifactId].fileKey) : Promise.resolve(false);
  };

  const artifactState = Object.fromEntries(rows.flatMap(r => [[r.id, r.checklist || {}], ...(r.orderId && r.orderId !== r.id ? [[r.orderId, r.checklist || {}]] : [])]));
  const getClientReleased = (jobId) => ((rowForJob(jobId) || {}).released) || {};
  const toggleClientRelease = (jobId, artifactId) => {
    const row = rowForJob(jobId);
    const entry = row && row.checklist[artifactId];
    if (!entry || !entry.fileKey) return Promise.resolve();
    return run(() => call('PATCH', `/documents/${entry.fileKey}`, { json: { clientVisible: !row.released[artifactId] } })).catch(() => {});
  };

  // ── settings ──
  const settings = data ? data.settings : { users: [], materials: [], finishes: [], tools: [], machines: [] };
  const saveSetting = (kind, id, values) => run(() => call(id ? 'PATCH' : 'POST', id ? `/settings/${kind}/${id}` : `/settings/${kind}`, { json: values }));
  const removeSetting = (kind, id) => run(() => call('DELETE', `/settings/${kind}/${id}`));
  const addMaterial = (name) => saveSetting('materials', null, { name }).catch(() => {});
  const addFinish = (name) => saveSetting('finishes', null, { name }).catch(() => {});
  const materials = settings.materials.map(m => m.name);
  const finishes = settings.finishes.map(f => f.name);

  const value = {
    authed, login, logout, me: data && data.me,
    loaded: !!data, loadError, actionError, clearActionError: () => setActionError(''), refresh,
    rows, customers, partLibrary: partLibraryFrom(rows),
    materials, finishes, addMaterial, addFinish,
    findRow,
    findOrder: (id) => rows.find(r => r.isOrder && (r.uuid === id || r.orderId === id)),
    addCustomer, updateCustomer, deleteCustomer, createEnquiry, convertToOrder, revertToEnquiry, markNoOrderJob,
    patchEnquiry, setPartStatus, applyEnquiryUpdate,
    getAutoQuote, generateAutoQuote, saveAutoQuote, uploadManualQuote,
    settings, saveSetting, removeSetting, patchPartLibrary,
    generateProcessPlan, artifactProgress, addOtherDocument, removeOtherDocument,
    artifactState, markArtifactDone, openArtifactFile, openFile, downloadFile, fetchFile,
    getClientReleased, toggleClientRelease,
  };

  return <ProtoDataContext.Provider value={value}>{children}</ProtoDataContext.Provider>;
}

export function useProtoData() {
  const ctx = useContext(ProtoDataContext);
  if (!ctx) throw new Error('useProtoData must be used inside ProtoDataProvider');
  return ctx;
}
