import React, { useState } from 'react';

// Shared by AddCustomerModal (add/edit) and the New Enquiry modal's inline quick-add, so the two
// forms can't drift apart again — Website or a phone-format change made in one place shows up in
// both. `form` is {name, company, email, website, phone}; phone is split into a country-code box
// and a 10-digit box here and joined back to "cc-number" on every change.
export default function CustomerFields({ form, setForm, nameDisabled }) {
  const [cc, setCc] = useState((form.phone || '+91-').split('-')[0] || '+91');
  const [phoneNum, setPhoneNum] = useState((form.phone || '').split('-')[1] || '');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setPhone = (nextCc, nextNum) => setForm((f) => ({ ...f, phone: nextNum ? `${nextCc || '+91'}-${nextNum}` : '' }));

  return (
    <>
      <div className="field-row">
        <div className="field">
          <label>Customer / contact name</label>
          <input value={form.name} onChange={set('name')} placeholder="e.g. Priya Sharma" disabled={nameDisabled} />
          {nameDisabled && <span className="cell-sub">Used to link existing enquiries — renaming isn't supported in this preview.</span>}
        </div>
        <div className="field"><label>Company</label><input value={form.company} onChange={set('company')} placeholder="e.g. Client A Defence Systems" /></div>
      </div>
      <div className="field-row">
        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} placeholder="name@company.com" /></div>
        <div className="field"><label>Website</label><input type="url" value={form.website} onChange={set('website')} placeholder="https://company.com" /></div>
      </div>
      <div className="field">
        <label>Phone</label>
        <div className="phone-field">
          <input className="phone-cc" value={cc} onChange={(e) => { setCc(e.target.value); setPhone(e.target.value, phoneNum); }} placeholder="+91" maxLength={4} />
          <span className="phone-dash">-</span>
          <input
            className="phone-num"
            value={phoneNum}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setPhoneNum(v); setPhone(cc, v); }}
            placeholder="9876543210"
            inputMode="numeric"
          />
        </div>
      </div>
    </>
  );
}
