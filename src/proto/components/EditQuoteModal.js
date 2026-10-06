import React, { useState } from 'react';
import Modal from './Modal';
import { useProtoData } from '../ProtoDataContext';

const STATUSES = ['PENDING', 'QUOTED', 'CANCELLED'];

export default function EditQuoteModal({ row, onClose }) {
  const { updateQuote } = useProtoData();
  const [status, setStatus] = useState(row.status);
  const [remarks, setRemarks] = useState(row.remarks || '');

  const save = () => {
    updateQuote(row.id, { status, remarks });
    onClose();
  };

  return (
    <Modal title="Edit quote" maxWidth={460} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn px-btn-primary" onClick={save}>Save</button>
    </>}>
      <div className="field">
        <label>Quote status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="field"><label>Remarks</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes about this quote…" /></div>
    </Modal>
  );
}
