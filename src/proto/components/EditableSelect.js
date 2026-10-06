import React, { useState } from 'react';

const ADD_NEW = '__add_new__';

// A <select> with a trailing "+ Add new…" option. Picking it opens an inline text box; Add both
// selects the new value for this form and calls onAdd so the caller can remember it for next time.
export default function EditableSelect({ label, options, value, onChange, onAdd, placeholder }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const pick = (e) => {
    if (e.target.value === ADD_NEW) { setAdding(true); setDraft(''); return; }
    onChange(e.target.value);
  };
  const confirmAdd = () => {
    const name = draft.trim();
    if (!name) { setAdding(false); return; }
    onAdd(name);
    onChange(name);
    setAdding(false);
  };

  return (
    <div className="field">
      <label>{label}</label>
      {adding ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd(); } if (e.key === 'Escape') setAdding(false); }}
          />
          <button type="button" className="btn-sm primary" onClick={confirmAdd}>Add</button>
          <button type="button" className="btn-sm text" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : (
        <select value={value} onChange={pick}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          <option value={ADD_NEW}>+ Add new…</option>
        </select>
      )}
    </div>
  );
}
