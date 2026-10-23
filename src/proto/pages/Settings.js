import React, { useState } from 'react';
import Icon from '../icons';
import { useProtoData } from '../ProtoDataContext';

// One editable list. Each row is saved to the server on its own: Add opens a blank row in edit
// mode, Save sends it, Remove deletes it. A `secret` column (a password) is never shown; left blank
// while editing, it stays as it was.
function EditableTable({ title, addLabel, columns, items, onSave, onRemove, removeLabel = (it) => it[columns[0].key] }) {
  const [editing, setEditing] = useState(null); // { id, draft, isNew }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const start = (it) => { setError(''); setEditing({ id: it.id, draft: Object.fromEntries(columns.map(c => [c.key, c.secret ? '' : String(it[c.key] ?? '')])), isNew: false }); };
  const add = () => { setError(''); setEditing({ id: null, draft: Object.fromEntries(columns.map(c => [c.key, ''])), isNew: true }); };
  const cancel = () => { setEditing(null); setError(''); };
  const save = async () => {
    const draft = Object.fromEntries(Object.entries(editing.draft).map(([k, v]) => [k, v.trim()]));
    if (Object.values(draft).every(v => !v)) { setEditing(null); return; }
    columns.filter(c => c.secret && !draft[c.key]).forEach(c => delete draft[c.key]);
    setSaving(true); setError('');
    try {
      await onSave(editing.id, draft);
      setEditing(null);
    } catch (e) { setError(e.message || String(e)); }
    setSaving(false);
  };
  const remove = async (it) => {
    if (!window.confirm(`Remove ${removeLabel(it) || 'this row'}?`)) return;
    try { await onRemove(it.id); } catch (e) { /* shown in the banner */ }
  };
  const setCell = (k, v) => setEditing(e => ({ ...e, draft: { ...e.draft, [k]: v } }));

  const editRow = (key) => (
    <tr key={key}>
      {columns.map((col, c) => (
        <td key={col.key}>
          <div className="field">
            <input autoFocus={c === 0} type={col.secret ? 'password' : (col.type || 'text')} autoComplete={col.secret ? 'new-password' : 'off'}
              value={editing.draft[col.key]} placeholder={col.secret && !editing.isNew ? 'Unchanged' : (col.placeholder || col.label)}
              onChange={e => setCell(col.key, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }} />
          </div>
        </td>
      ))}
      <td>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-sm primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn-sm text" onClick={cancel}>Cancel</button>
        </div>
      </td>
    </tr>
  );

  return (
    <div data-table={title}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '26px 0 12px' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button type="button" className="btn-sm ghost" disabled={!!editing} onClick={add}><Icon name="plus" size={12} /> {addLabel}</button>
      </div>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}<th /></tr></thead>
          <tbody>
            {items.length === 0 && !editing && <tr><td colSpan={columns.length + 1}><div className="empty-hint">Nothing here yet.</div></td></tr>}
            {items.map((it) => (editing && !editing.isNew && editing.id === it.id ? editRow(it.id) : (
              <tr key={it.id}>
                {columns.map((col, c) => (
                  <td key={col.key} className={c === 0 ? 'cell-primary' : (col.mono ? 'mono' : '')}>
                    {col.secret ? '••••••' : (it[col.key] !== undefined && it[col.key] !== '' && it[col.key] !== null ? String(it[col.key]) : '—')}
                  </td>
                ))}
                <td>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-text" disabled={!!editing} onClick={() => start(it)}>Edit</button>
                    {onRemove && <button type="button" className="btn-text" disabled={!!editing} style={{ color: 'var(--error)' }} onClick={() => remove(it)}>Remove</button>}
                  </div>
                </td>
              </tr>
            )))}
            {editing && editing.isNew && editRow('new')}
          </tbody>
        </table>
      </div>
      {error && <p className="field-error" style={{ margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}

export default function Settings() {
  const { settings, saveSetting, removeSetting } = useProtoData();
  const table = (kind) => ({ items: settings[kind] || [], onSave: (id, values) => saveSetting(kind, id, values), onRemove: (id) => removeSetting(kind, id) });
  return (
    <div>
      <div className="page-head"><div><h1>Settings</h1><div className="page-sub">The lists the rest of the app draws on. Customers live under Sales.</div></div></div>

      <EditableTable title="Users" addLabel="Add user" {...table('users')}
        columns={[
          { key: 'name', label: 'Name', placeholder: 'e.g. Priya Sharma' },
          { key: 'designation', label: 'Designation', placeholder: 'e.g. Process engineer' },
          { key: 'email', label: 'Login email', placeholder: 'name@shiaanx.com', type: 'email' },
          { key: 'password', label: 'Password', placeholder: 'At least 8 characters', secret: true },
        ]} />
      <p className="cell-sub" style={{ marginTop: 8 }}>Everyone listed here can log in to this app with their email and password.</p>

      <EditableTable title="Materials & finishes" addLabel="Add material" {...table('materials')}
        columns={[{ key: 'name', label: 'Material', placeholder: 'e.g. Aluminium 6082' }, { key: 'rate', label: 'Rate (₹/kg)', placeholder: '450', mono: true }, { key: 'finishes', label: 'Finishes available', placeholder: 'As machined, Anodised' }]} />

      <EditableTable title="Processes" addLabel="Add process" {...table('processes')}
        columns={[{ key: 'name', label: 'Process', placeholder: 'e.g. CNC turning' }]} />
      <p className="cell-sub" style={{ marginTop: 8 }}>The processes a part can need (a part can need several). Picked per part on New enquiry and Update; Enquiries and CAM Programs filter by them.</p>

      <EditableTable title="Tool catalogue" addLabel="Add tool" {...table('tools')}
        columns={[{ key: 'code', label: 'Tool code', placeholder: 'e.g. EM_2FL_8MM' }, { key: 'type', label: 'Type', placeholder: 'End mill, 2-flute' }, { key: 'diameter', label: 'Diameter', placeholder: '8 mm' }]} />

      <EditableTable title="Machines" addLabel="Add machine" {...table('machines')}
        columns={[{ key: 'name', label: 'Machine', placeholder: 'e.g. VMC-03' }, { key: 'controller', label: 'Controller', placeholder: 'Fanuc 0iMD' }, { key: 'magazine', label: 'Magazine', placeholder: '20 slots' }]} />
    </div>
  );
}
