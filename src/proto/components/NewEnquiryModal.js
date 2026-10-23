import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import Modal from './Modal';
import Dropzone from './Dropzone';
import EditableSelect from './EditableSelect';
import ProcessPicker from './ProcessPicker';
import CustomerFields from './CustomerFields';
import { useProtoData } from '../ProtoDataContext';
import { loadDraft, saveDraft, clearDraft } from './draftStore';

const DEFAULT_MATERIAL = 'Aluminium 6061';
const DEFAULT_FINISH = 'As machined';
const SAVE_DELAY_MS = 600;

const emptyPart = () => ({
  key: Math.random().toString(36).slice(2), partName: '', qty: 1, material: DEFAULT_MATERIAL, finish: DEFAULT_FINISH,
  processes: [], cadFile: null, drawingFile: null, receivedFiles: [],
});
const emptyForm = () => ({ customerName: '', assemblyName: '', remarks: '', parts: [emptyPart()], receivedFiles: [] });

// Anything typed, picked or attached that isn't the blank form's default.
function formHasContent(f) {
  return !!(f.customerName || f.assemblyName.trim() || f.remarks.trim() || f.receivedFiles.length || f.parts.length > 1
    || f.parts.some(p => p.partName.trim() || p.cadFile || p.drawingFile || (p.receivedFiles || []).length || (p.processes || []).length
      || String(p.qty) !== '1' || p.material !== DEFAULT_MATERIAL || p.finish !== DEFAULT_FINISH));
}

const fmtSaved = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function customerLabel(c) {
  return c.company && c.company !== c.name ? `${c.name} (${c.company})` : c.name;
}

// Ported from the mockup's New Enquiry modal, including the quick-add customer flow. Create
// actually adds a row (via ProtoDataContext.createEnquiry). An enquiry can carry several part
// types — each gets its own name/qty/material/finish/processes/CAD file/drawing, plus any number of
// other client documents (surface-finish specs, technical notes); job-level documents go under
// "Project documents".
//
// The form autosaves to this browser as a draft (draftStore: IndexedDB, files included, one per
// logged-in user), so closing it, moving to another page or reloading loses nothing. Reopening
// restores the draft with a note and a "Discard draft" button; a successful create clears it.
// While the form has content, a click outside it (or Cancel / ×) asks before closing.
//
// The "no confirmed order" choice is no longer made here — it's an action on the enquiry itself
// once it exists (see EnquiryDetail's "Produce without a confirmed order" button), so it can be
// decided later rather than guessed at intake.
export default function NewEnquiryModal({ onClose }) {
  const { customers, addCustomer, createEnquiry, materials, finishes, addMaterial, addFinish, processes, addProcess, me } = useProtoData();
  const navigate = useNavigate();
  const userId = me && me.id;
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qa, setQa] = useState({ name: '', company: '', email: '', website: '', phone: '' });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState('');
  const [restoredAt, setRestoredAt] = useState(null); // when the restored draft was saved
  const [draftReady, setDraftReady] = useState(false); // no autosave until the stored draft is read

  const { customerName, assemblyName, remarks, parts, receivedFiles } = form;
  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const hasContent = formHasContent(form);

  // ── draft ──
  const formRef = useRef(form);
  formRef.current = form;
  const timer = useRef(null);
  const finished = useRef(false); // created or closed: nothing more to save
  const draftReadyRef = useRef(false);
  draftReadyRef.current = draftReady;

  useEffect(() => {
    let alive = true;
    loadDraft(userId).then(d => {
      if (!alive) return;
      if (d && d.form && formHasContent({ ...emptyForm(), ...d.form })) {
        // Only if nothing has been typed in the moment it took to read.
        setForm(cur => (formHasContent(cur) ? cur : { ...emptyForm(), ...d.form, parts: d.form.parts && d.form.parts.length ? d.form.parts : [emptyPart()] }));
        setRestoredAt(d.savedAt);
      }
      setDraftReady(true);
    }).catch(() => { if (alive) setDraftReady(true); });
    return () => { alive = false; };
  }, [userId]);

  const writeDraft = useCallback(async () => {
    if (finished.current) return;
    const f = formRef.current;
    try {
      if (formHasContent(f)) await saveDraft(userId, f);
      else await clearDraft(userId);
    } catch (e) { /* draftStore already logs; the form keeps working */ }
  }, [userId]);

  // Debounced autosave as the form changes.
  useEffect(() => {
    if (!draftReady) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(writeDraft, SAVE_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [form, draftReady, writeDraft]);

  // Leaving without the debounce having fired (closed, navigated away) still saves the latest.
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (draftReadyRef.current) writeDraft();
  }, [writeDraft]);

  const discardDraft = async () => {
    clearTimeout(timer.current);
    try { await clearDraft(userId); } catch (e) { /* ignore */ }
    setForm(emptyForm());
    setRestoredAt(null);
    setShowErrors(false);
    setError('');
  };

  const requestClose = async () => {
    if (formHasContent(formRef.current) && !window.confirm('Close this enquiry? Your draft is kept, and opens again next time.')) return;
    clearTimeout(timer.current);
    if (draftReady) await writeDraft();
    finished.current = true;
    onClose();
  };

  // ── form ──
  const saveQuickAdd = async () => {
    const name = qa.name.trim() || 'New customer';
    try {
      await addCustomer({ name, company: qa.company || name, email: qa.email, website: qa.website, phone: qa.phone });
      set({ customerName: name });
      setShowQuickAdd(false);
    } catch (e) { setError(`Could not save the customer: ${e.message || e}`); }
  };

  const updatePart = (key, patch) => setForm(f => ({ ...f, parts: f.parts.map(p => (p.key === key ? { ...p, ...patch } : p)) }));
  const addPart = () => setForm(f => ({ ...f, parts: [...f.parts, emptyPart()] }));
  const removePart = (key) => setForm(f => ({ ...f, parts: f.parts.length > 1 ? f.parts.filter(p => p.key !== key) : f.parts }));

  // Part name is the only required field. Clicking Create with one missing marks it in red rather
  // than leaving a disabled button that looks like it's ignoring the click.
  const missingName = (p) => !p.partName.trim();
  const create = async () => {
    if (parts.some(missingName)) {
      setShowErrors(true);
      setTimeout(() => document.querySelector('.proto-app .invalid')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      return;
    }
    setSaving(true);
    setError('');
    clearTimeout(timer.current);
    try {
      const jobId = await createEnquiry({ customer: customerName, parts, remarks, assemblyName, receivedFiles });
      finished.current = true;
      clearTimeout(timer.current);
      await clearDraft(userId);
      onClose();
      navigate(`/proto/enquiries/${jobId}`);
    } catch (e) {
      console.error('Create failed:', e);
      setError(`Could not create this enquiry: ${e.message || e}`);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New enquiry"
      maxWidth={640}
      onClose={requestClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={requestClose}>Cancel</button>
        <button type="button" className="btn px-btn-primary" disabled={saving} onClick={create}>
          {saving ? 'Creating…' : 'Create enquiry'}
        </button>
      </>}
    >
      {restoredAt && (
        <div data-draft-note style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--primary-light)', fontSize: 12.5 }}>
          <span style={{ flex: 1 }}>Restored your unsaved draft from {fmtSaved(restoredAt)}.</span>
          <button type="button" className="btn-sm text" onClick={discardDraft}>Discard draft</button>
        </div>
      )}

      <div className="field">
        <label>Customer</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ flex: 1 }} value={customerName} onChange={(e) => set({ customerName: e.target.value })}>
            <option value="">Select a customer…</option>
            {customers.map(c => <option key={c.id} value={c.name}>{customerLabel(c)}</option>)}
          </select>
          <button type="button" className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowQuickAdd(s => !s)}>
            <Icon name="plus" /> New
          </button>
        </div>
      </div>
      {showQuickAdd && (
        <div className="inline-add">
          <CustomerFields form={qa} setForm={setQa} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn-sm text" onClick={() => setShowQuickAdd(false)}>Cancel</button>
            <button type="button" className="btn-sm primary" onClick={saveQuickAdd}>Save customer</button>
          </div>
        </div>
      )}

      <div className="field" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <label>Assembly / job name (optional)</label>
        <input value={assemblyName} onChange={e => set({ assemblyName: e.target.value })} placeholder="e.g. Pump Housing Assembly — leave blank to list parts by name" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {parts.map((p, i) => (
          <div className="inline-add" key={p.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: 12.5 }}>Part {i + 1}</b>
              {parts.length > 1 && <button type="button" className="btn-sm text" onClick={() => removePart(p.key)}>Remove</button>}
            </div>
            <div className="field-row">
              <div className="field">
                <label>Part name</label>
                <input className={showErrors && missingName(p) ? 'invalid' : ''} value={p.partName} onChange={e => updatePart(p.key, { partName: e.target.value })} placeholder="e.g. Bracket, Base Plate" />
                {showErrors && missingName(p) && <span className="field-error">Part name is required.</span>}
              </div>
              <div className="field"><label>Quantity</label><input type="number" value={p.qty} onChange={e => updatePart(p.key, { qty: e.target.value })} min={1} /></div>
            </div>
            <div className="field-row">
              <EditableSelect label="Material" options={materials} value={p.material} onChange={(v) => updatePart(p.key, { material: v })} onAdd={addMaterial} placeholder="e.g. Titanium Grade 5" />
              <EditableSelect label="Finish" options={finishes} value={p.finish} onChange={(v) => updatePart(p.key, { finish: v })} onAdd={addFinish} placeholder="e.g. Chromate conversion" />
            </div>
            <ProcessPicker options={processes || []} value={p.processes} onChange={(v) => updatePart(p.key, { processes: v })} onAdd={addProcess} />
            <Dropzone label="CAD file (.step/.stp)" accept=".step,.stp" file={p.cadFile} onChange={(f) => updatePart(p.key, { cadFile: f })} />
            <Dropzone label="Drawing (.pdf)" accept=".pdf" file={p.drawingFile} onChange={(f) => updatePart(p.key, { drawingFile: f })} />
            <Dropzone multiple label="Other documents (any number)" hint="surface-finish specs, technical docs" files={p.receivedFiles} onChange={(fs) => updatePart(p.key, { receivedFiles: fs })} />
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={addPart}><Icon name="plus" /> Add another part type</button>
      </div>

      <Dropzone multiple label="Project documents (any number)" hint="for the whole job, not one part" files={receivedFiles} onChange={(fs) => set({ receivedFiles: fs })} />

      <div className="field"><label>Remarks (optional)</label><textarea value={remarks} onChange={e => set({ remarks: e.target.value })} placeholder="Anything the team should know about this enquiry…" /></div>
      {hasContent && draftReady && userId && <p className="cell-sub" style={{ margin: 0 }}>Draft saved in this browser as you type.</p>}
      {showErrors && parts.some(missingName) && <p className="field-error" style={{ margin: 0 }}>Not created yet — the fields marked in red above are missing.</p>}
      {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
    </Modal>
  );
}
