import React, { useState } from 'react';
import Modal from './Modal';
import { useProtoData } from '../ProtoDataContext';

// Nothing on this form is mandatory — Save works even with every field blank.
export default function AddCustomerModal({ onClose, onSaved }) {
  const { addCustomer } = useProtoData();
  const [form, setForm] = useState({ name: '', company: '', email: '', website: '' });
  const [cc, setCc] = useState('+91');
  const [phoneNum, setPhoneNum] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = () => {
    const name = form.name.trim() || 'New customer';
    const phone = phoneNum.trim() ? `${cc.trim() || '+91'}-${phoneNum.trim()}` : '';
    const customer = { name, company: form.company || name, email: form.email, phone, website: form.website };
    addCustomer(customer);
    onClose();
    onSaved && onSaved(customer);
  };
  return (
    <Modal title="Add customer" maxWidth={460} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn px-btn-primary" onClick={save}>Save customer</button>
    </>}>
      <div className="field-row">
        <div className="field"><label>Customer / contact name</label><input value={form.name} onChange={set('name')} placeholder="e.g. Priya Sharma" /></div>
        <div className="field"><label>Company</label><input value={form.company} onChange={set('company')} placeholder="e.g. Client A Defence Systems" /></div>
      </div>
      <div className="field-row">
        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} placeholder="name@company.com" /></div>
        <div className="field"><label>Website</label><input type="url" value={form.website} onChange={set('website')} placeholder="https://company.com" /></div>
      </div>
      <div className="field">
        <label>Phone</label>
        <div className="phone-field">
          <input className="phone-cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="+91" maxLength={4} />
          <span className="phone-dash">-</span>
          <input
            className="phone-num"
            value={phoneNum}
            onChange={(e) => setPhoneNum(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="9876543210"
            inputMode="numeric"
          />
        </div>
      </div>
    </Modal>
  );
}
