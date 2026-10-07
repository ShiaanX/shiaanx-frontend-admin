import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import Modal from './Modal';
import Dropzone from './Dropzone';
import EditableSelect from './EditableSelect';
import CustomerFields from './CustomerFields';
import { useProtoData } from '../ProtoDataContext';

const emptyPart = () => ({ key: Math.random().toString(36).slice(2), partName: '', qty: 1, material: 'Aluminium 6061', finish: 'As machined', cadFile: null, drawingFile: null });

function customerLabel(c) {
  return c.company && c.company !== c.name ? `${c.name} (${c.company})` : c.name;
}

// Ported from the mockup's New Enquiry modal, including the quick-add customer flow. Create
// actually adds a row (via ProtoDataContext.createEnquiry): uploaded files are saved to this
// browser's storage and nothing else is generated. An enquiry can carry several part types — each
// gets its own name/qty/material/finish/CAD file/drawing, since a drawing is specific to one part.
//
// The "no confirmed order" choice is no longer made here — it's an action on the enquiry itself
// once it exists (see EnquiryDetail's "Produce without a confirmed order" button), so it can be
// decided later rather than guessed at intake.
export default function NewEnquiryModal({ onClose }) {
  const { customers, addCustomer, createEnquiry, materials, finishes, addMaterial, addFinish } = useProtoData();
  const navigate = useNavigate();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [qa, setQa] = useState({ name: '', company: '', email: '', website: '', phone: '' });
  const [parts, setParts] = useState([emptyPart()]);
  const [assemblyName, setAssemblyName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState('');

  const saveQuickAdd = () => {
    const name = qa.name.trim() || 'New customer';
    addCustomer({ name, company: qa.company || name, email: qa.email, website: qa.website, phone: qa.phone });
    setCustomerName(name);
    setShowQuickAdd(false);
  };

  const updatePart = (key, patch) => setParts(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)));
  const addPart = () => setParts(prev => [...prev, emptyPart()]);
  const removePart = (key) => setParts(prev => (prev.length > 1 ? prev.filter(p => p.key !== key) : prev));

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
    try {
      const jobId = await createEnquiry({ customer: customerName, parts, remarks, assemblyName });
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
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn px-btn-primary" disabled={saving} onClick={create}>
          {saving ? 'Creating…' : 'Create enquiry'}
        </button>
      </>}
    >
      <div className="field">
        <label>Customer</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ flex: 1 }} value={customerName} onChange={(e) => setCustomerName(e.target.value)}>
            <option value="">Select a customer…</option>
            {customers.map(c => <option key={c.name} value={c.name}>{customerLabel(c)}</option>)}
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
        <input value={assemblyName} onChange={e => setAssemblyName(e.target.value)} placeholder="e.g. Pump Housing Assembly — leave blank to list parts by name" />
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
            <Dropzone label="CAD file (.step/.stp)" accept=".step,.stp" file={p.cadFile} onChange={(f) => updatePart(p.key, { cadFile: f })} />
            <Dropzone label="Drawing (.pdf)" accept=".pdf" file={p.drawingFile} onChange={(f) => updatePart(p.key, { drawingFile: f })} />
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={addPart}><Icon name="plus" /> Add another part type</button>
      </div>

      <div className="field"><label>Remarks (optional)</label><textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Anything the team should know about this enquiry…" /></div>
      {showErrors && parts.some(missingName) && <p className="field-error" style={{ margin: 0 }}>Not created yet — the fields marked in red above are missing.</p>}
      {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
    </Modal>
  );
}
