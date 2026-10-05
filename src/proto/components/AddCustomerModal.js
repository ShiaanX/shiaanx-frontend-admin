import React, { useState } from 'react';
import Modal from './Modal';
import { useProtoData } from '../ProtoDataContext';

export default function AddCustomerModal({ onClose, onSaved }) {
  const { addCustomer } = useProtoData();
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = () => {
    const name = form.name.trim() || 'New customer';
    const customer = { name, company: form.company || name, email: form.email, phone: form.phone };
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
        <div className="field"><label>Phone</label><input value={form.phone} onChange={set('phone')} placeholder="+91…" /></div>
      </div>
    </Modal>
  );
}
