import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import Modal from './Modal';
import Dropzone from './Dropzone';
import EditableSelect from './EditableSelect';
import { useProtoData } from '../ProtoDataContext';

// Ported from the mockup's New Enquiry modal, including the quick-add customer flow and the
// "no customer order" checkbox (trial/internal build) that changes what the job gets created as.
// Unlike the mockup, Create actually adds a row (via ProtoDataContext.createEnquiry): uploaded
// files are saved to this browser's storage and nothing else is generated — the new row lands with
// its artifact checklist empty, same as any other enquiry would start out.
export default function NewEnquiryModal({ onClose }) {
  const { customers, addCustomer, createEnquiry, materials, finishes, addMaterial, addFinish } = useProtoData();
  const navigate = useNavigate();
  const [noOrderMode, setNoOrderMode] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [qa, setQa] = useState({ name: '', company: '', email: '', phone: '' });
  const [partName, setPartName] = useState('');
  const [qty, setQty] = useState(1);
  const [material, setMaterial] = useState('Aluminium 6061');
  const [finish, setFinish] = useState('As machined');
  const [cadFile, setCadFile] = useState(null);
  const [drawingFile, setDrawingFile] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const saveQuickAdd = () => {
    const name = qa.name.trim() || 'New customer';
    addCustomer({ name, company: qa.company || name, email: qa.email, phone: qa.phone });
    setCustomerName(name);
    setShowQuickAdd(false);
  };

  const create = async () => {
    setSaving(true);
    const jobId = await createEnquiry({ noOrderMode, customer: customerName, partName, qty, material, finish, cadFile, drawingFile, remarks });
    onClose();
    navigate(`/proto/enquiries/${jobId}`);
  };

  return (
    <Modal
      title={noOrderMode ? 'New job — no customer order' : 'New enquiry'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn px-btn-primary" disabled={saving || !partName} onClick={create}>
          {saving ? 'Creating…' : (noOrderMode ? 'Create job' : 'Create enquiry')}
        </button>
      </>}
    >
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12.5 }}>
        <input type="checkbox" checked={noOrderMode} onChange={(e) => setNoOrderMode(e.target.checked)} style={{ marginTop: 2 }} />
        <span>
          We're manufacturing this without a customer order behind it (trial / internal build).{' '}
          <span style={{ color: 'var(--muted)' }}>Order? stays No in the list, but the full production record — plan, CAM, machine, inspection — is still tracked.</span>
        </span>
      </label>

      {!noOrderMode && (
        <>
          <div className="field">
            <label>Customer</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select style={{ flex: 1 }} value={customerName} onChange={(e) => setCustomerName(e.target.value)}>
                <option value="">Select a customer…</option>
                {customers.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <button type="button" className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowQuickAdd(s => !s)}>
                <Icon name="plus" /> New
              </button>
            </div>
          </div>
          {showQuickAdd && (
            <div className="inline-add">
              <div className="field-row">
                <div className="field"><label>Customer / contact name</label><input value={qa.name} onChange={e => setQa(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Priya Sharma" /></div>
                <div className="field"><label>Company</label><input value={qa.company} onChange={e => setQa(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Client A Defence Systems" /></div>
              </div>
              <div className="field-row">
                <div className="field"><label>Email</label><input type="email" value={qa.email} onChange={e => setQa(f => ({ ...f, email: e.target.value }))} placeholder="name@company.com" /></div>
                <div className="field"><label>Phone</label><input value={qa.phone} onChange={e => setQa(f => ({ ...f, phone: e.target.value }))} placeholder="+91…" /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-sm text" onClick={() => setShowQuickAdd(false)}>Cancel</button>
                <button type="button" className="btn-sm primary" onClick={saveQuickAdd}>Save customer</button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="field-row">
        <div className="field"><label>Part name</label><input value={partName} onChange={e => setPartName(e.target.value)} placeholder="e.g. Bracket, Base Plate" /></div>
        <div className="field"><label>Quantity</label><input type="number" value={qty} onChange={e => setQty(e.target.value)} min={1} /></div>
      </div>
      <div className="field-row">
        <EditableSelect label="Material" options={materials} value={material} onChange={setMaterial} onAdd={addMaterial} placeholder="e.g. Titanium Grade 5" />
        <EditableSelect label="Finish" options={finishes} value={finish} onChange={setFinish} onAdd={addFinish} placeholder="e.g. Chromate conversion" />
      </div>
      <Dropzone label="CAD file (.step/.stp)" accept=".step,.stp" file={cadFile} onChange={setCadFile} />
      <Dropzone label="Drawing (.pdf)" accept=".pdf" file={drawingFile} onChange={setDrawingFile} />
      <div className="field"><label>Remarks (optional)</label><textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Anything the team should know about this enquiry…" /></div>
      {!partName && <p className="page-sub" style={{ margin: 0 }}>Part name is required to create the enquiry.</p>}
    </Modal>
  );
}
