import React, { useState } from 'react';
import Icon from '../icons';
import Modal from './Modal';
import { useProtoData } from '../ProtoDataContext';

// Ported from the mockup's New Enquiry modal, including the quick-add customer flow and the
// "no customer order" checkbox (trial/internal build) that changes what the job gets created as.
export default function NewEnquiryModal({ onClose }) {
  const { customers, addCustomer } = useProtoData();
  const [noOrderMode, setNoOrderMode] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [qa, setQa] = useState({ name: '', company: '', email: '', phone: '' });

  const saveQuickAdd = () => {
    const name = qa.name.trim() || 'New customer';
    addCustomer({ name, company: qa.company || name, email: qa.email, phone: qa.phone });
    setCustomerName(name);
    setShowQuickAdd(false);
  };

  return (
    <Modal
      title={noOrderMode ? 'New job — no customer order' : 'New enquiry'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn px-btn-primary" onClick={onClose}>{noOrderMode ? 'Create job' : 'Create enquiry'}</button>
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
        <div className="field"><label>Part name</label><input placeholder="e.g. Bracket, Base Plate" /></div>
        <div className="field"><label>Quantity</label><input type="number" defaultValue={1} min={1} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label>Material</label>
          <select><option>Aluminium 6061</option><option>Aluminium 7075</option><option>Copper</option><option>Mild Steel</option></select>
        </div>
        <div className="field"><label>Finish</label>
          <select><option>As machined</option><option>Anodised</option><option>Bead blast</option><option>Ni plate</option></select>
        </div>
      </div>
      <div className="field"><label>CAD file (.step/.stp)</label><input type="file" /></div>
      <div className="field"><label>Drawing (.pdf)</label><input type="file" /></div>
      <div className="field"><label>Remarks (optional)</label><textarea placeholder="Anything the team should know about this enquiry…" /></div>
    </Modal>
  );
}
