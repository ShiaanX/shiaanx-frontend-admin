import React, { useState } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import { useProtoData } from '../ProtoDataContext';

// The enquiry number as the page heading, with a pencil to rename it in place. The server trims it,
// refuses an empty or already-used number (and says why), and renames the order to match if there
// is one. Pages address the row by its uuid, so the page stays put when the number changes.
export default function EditableEnquiryNumber({ row }) {
  const { patchEnquiry, clearActionError } = useProtoData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const open = () => { setDraft(row.id || ''); setError(''); setEditing(true); };
  const cancel = () => { if (!saving) { setEditing(false); setError(''); } };

  const value = draft.trim().replace(/\s+/g, ' ');
  const canSave = !saving && value !== '' && value !== row.id;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await patchEnquiry(row, { enquiryNumber: value });
      setEditing(false);
    } catch (e) {
      // Shown here, next to the box, rather than in the page-wide banner as well.
      if (clearActionError) clearActionError();
      setError((e && e.message) || 'The number could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <>
        <h1>{row.id}</h1>
        <button type="button" className="btn-text" onClick={open} title="Edit enquiry number" aria-label="Edit enquiry number">
          <FiEdit2 size={14} className="icon" /> Edit
        </button>
      </>
    );
  }

  return (
    <div className="field" style={{ gap: 4 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          autoFocus
          value={draft}
          maxLength={64}
          disabled={saving}
          aria-label="Enquiry number"
          className={error ? 'invalid' : ''}
          style={{ width: 260, fontSize: 18, fontWeight: 700, padding: '6px 10px' }}
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
