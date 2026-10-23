import React, { useState } from 'react';
import Icon from '../icons';

const chip = (on) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 16,
  border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
  background: on ? 'var(--primary)' : 'var(--card-bg)', color: on ? '#fff' : 'var(--ink)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
});

// Which processes a part needs — any number of them (a part can need turning AND 5-axis). Every
// known process is a chip to tick on or off; "+ New process" adds one to the shared list (Settings
// → Processes) the same way a new material is added, and ticks it for this part.
export default function ProcessPicker({ label = 'Processes', options, value, onChange, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const selected = value || [];
  // A name just added (or one that has since been removed from Settings) still shows while ticked.
  const all = [...(options || []), ...selected.filter(s => !(options || []).includes(s))];

  const toggle = (name) => onChange(selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]);
  const confirmAdd = () => {
    const name = draft.trim();
    setAdding(false);
    setDraft('');
    if (!name) return;
    const known = all.find(o => o.toLowerCase() === name.toLowerCase());
    if (known) { if (!selected.includes(known)) onChange([...selected, known]); return; }
    if (onAdd) onAdd(name);
    onChange([...selected, name]);
  };

  return (
    <div className="field" data-process-picker>
      <label>{label}{selected.length ? ` (${selected.length} selected)` : ''}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {all.map(o => {
          const on = selected.includes(o);
          return (
            <button key={o} type="button" aria-pressed={on} style={chip(on)} onClick={() => toggle(o)}>
              {on ? '✓ ' : ''}{o}
            </button>
          );
        })}
        {!adding && (
          <button type="button" style={{ ...chip(false), borderStyle: 'dashed', color: 'var(--primary)' }} onClick={() => { setAdding(true); setDraft(''); }}>
            <Icon name="plus" size={12} /> New process
          </button>
        )}
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            autoFocus value={draft} placeholder="e.g. Laser cutting"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd(); } if (e.key === 'Escape') setAdding(false); }}
          />
          <button type="button" className="btn-sm primary" onClick={confirmAdd}>Add</button>
          <button type="button" className="btn-sm text" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
