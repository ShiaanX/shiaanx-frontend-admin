import React, { useState } from 'react';
import Modal from './Modal';
import CustomerFields from './CustomerFields';
import { useProtoData } from '../ProtoDataContext';

// Nothing on this form is mandatory. With a `customer` prop it edits that customer in place
// (name is locked — see CustomerFields) instead of adding a new one.
export default function AddCustomerModal({ customer, onClose, onSaved }) {
  const { addCustomer, updateCustomer } = useProtoData();
  const editing = !!customer;
  const [form, setForm] = useState(() => (customer
    ? { name: customer.name, company: customer.company || '', email: customer.email || '', website: customer.website || '', phone: customer.phone || '' }
    : { name: '', company: '', email: '', website: '', phone: '' }));

  const save = () => {
    if (editing) {
      updateCustomer(customer.name, { company: form.company || form.name, email: form.email, website: form.website, phone: form.phone });
      onClose();
      onSaved && onSaved(customer.name);
      return;
    }
    const name = form.name.trim() || 'New customer';
    const saved = { name, company: form.company || name, email: form.email, website: form.website, phone: form.phone };
    addCustomer(saved);
    onClose();
    onSaved && onSaved(saved);
  };

  return (
    <Modal title={editing ? `Edit ${customer.name}` : 'Add customer'} maxWidth={460} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn px-btn-primary" onClick={save}>{editing ? 'Save changes' : 'Save customer'}</button>
    </>}>
      <CustomerFields form={form} setForm={setForm} nameDisabled={editing} />
    </Modal>
  );
}
