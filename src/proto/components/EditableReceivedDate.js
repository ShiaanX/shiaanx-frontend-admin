import React, { useState } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// The date an enquiry came in, with a pencil to change it in place — mainly for older enquiries
// entered after the fact. The server refuses an invalid or future date and logs the change.
export default function EditableReceivedDate({ row }) {
  const { patchEnquiry, clearActionError } = useProtoData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const open = () => { setDraft(row.date || ''); setError(''); setEditing(true); };
  const cancel = () => { if (!saving) { setEditing(false); setError(''); } };
  const canSave = !saving && !!draft && draft !== row.date;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await patchEnquiry(row, { receivedDate: draft });
      setEditing(false);
    } catch (e) {
      // Shown here, next to the box, rather than in the page-wide banner as well.
      if (clearActionError) clearActionError();
      setError((e && e.message) || 'The date could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <>
        {row.date ? fmtDate(row.date) : '—'}{' '}
        <button type="button" className="btn-text" onClick={open} title="Edit date" aria-label="Edit date">
          <FiEdit2 size={13} className="icon" /> Edit
        </button>
      </>
    );
  }

  return (
    <div className="field" style={{ gap: 4, margin: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          autoFocus
          value={draft}
          max={todayYmd()}
          disabled={saving}
          aria-label="Received date"
          className={error ? 'invalid' : ''}
          style={{ width: 170 }}
          onChange={(e) => { setDraft(e.target.value); if (error) setError(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
        />
        <button type="button" className="btn-sm primary" onClick={save} disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn-sm text" onClick={cancel} disabled={saving}>Cancel</button>
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
