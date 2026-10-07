import React, { useState } from 'react';
import Icon from '../icons';
import { useProtoData } from '../ProtoDataContext';

// One editable list: rows are arrays of strings, one per column. A row is edited in place; Add
// opens a blank row in edit mode, and a row left completely blank is dropped rather than saved.
function EditableTable({ title, addLabel, columns, rows, onChange }) {
  const [editing, setEditing] = useState(null); // { index, draft, isNew }

  const start = (index) => setEditing({ index, draft: columns.map((_, c) => rows[index][c] || ''), isNew: false });
  const add = () => setEditing({ index: rows.length, draft: columns.map(() => ''), isNew: true });
  const cancel = () => setEditing(null);
  const save = () => {
    const draft = editing.draft.map(v => v.trim());
    if (draft.every(v => !v)) { setEditing(null); return; }
    const next = rows.slice();
    next[editing.index] = draft;
    onChange(next);
    setEditing(null);
  };
  const remove = (index) => {
    if (window.confirm(`Remove ${rows[index][0] || 'this row'}?`)) onChange(rows.filter((_, i) => i !== index));
  };
  const setCell = (c, v) => setEditing(e => ({ ...e, draft: e.draft.map((x, i) => (i === c ? v : x)) }));

  const editRow = (key) => (
    <tr key={key}>
      {columns.map((col, c) => (
        <td key={col.label}>
          <div className="field">
            <input autoFocus={c === 0} value={editing.draft[c]} placeholder={col.placeholder || col.label}
              onChange={e => setCell(c, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }} />
          </div>
        </td>
      ))}
      <td>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-sm primary" onClick={save}>Save</button>
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
          <thead><tr>{columns.map(col => <th key={col.label}>{col.label}</th>)}<th /></tr></thead>
          <tbody>
            {rows.length === 0 && !editing && <tr><td colSpan={columns.length + 1}><div className="empty-hint">Nothing here yet.</div></td></tr>}
            {rows.map((r, i) => (editing && !editing.isNew && editing.index === i ? editRow(i) : (
              <tr key={i}>
                {columns.map((col, c) => <td key={col.label} className={c === 0 ? 'cell-primary' : (col.mono ? 'mono' : '')}>{r[c] || '—'}</td>)}
                <td>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-text" disabled={!!editing} onClick={() => start(i)}>Edit</button>
                    <button type="button" className="btn-text" disabled={!!editing} style={{ color: 'var(--error)' }} onClick={() => remove(i)}>Remove</button>
                  </div>
                </td>
              </tr>
            )))}
            {editing && editing.isNew && editRow('new')}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Settings() {
  const { settingsTables, setSettingsTable } = useProtoData();
  return (
    <div>
      <div className="page-head"><div><h1>Settings</h1><div className="page-sub">The lists the rest of the app draws on. Customers live under Sales.</div></div></div>

      <EditableTable title="Users" addLabel="Add user" rows={settingsTables.users} onChange={r => setSettingsTable('users', r)}
        columns={[{ label: 'Name', placeholder: 'e.g. Priya Sharma' }, { label: 'Designation', placeholder: 'e.g. Process engineer' }]} />

      <EditableTable title="Materials & finishes" addLabel="Add material" rows={settingsTables.materials} onChange={r => setSettingsTable('materials', r)}
        columns={[{ label: 'Material', placeholder: 'e.g. Aluminium 6082' }, { label: 'Rate', placeholder: '₹ 450/kg', mono: true }, { label: 'Finishes available', placeholder: 'As machined, Anodised' }]} />

      <EditableTable title="Tool catalogue" addLabel="Add tool" rows={settingsTables.tools} onChange={r => setSettingsTable('tools', r)}
        columns={[{ label: 'Tool code', placeholder: 'e.g. EM_2FL_8MM' }, { label: 'Type', placeholder: 'End mill, 2-flute' }, { label: 'Diameter', placeholder: '8 mm' }]} />

      <EditableTable title="Machines" addLabel="Add machine" rows={settingsTables.machines} onChange={r => setSettingsTable('machines', r)}
        columns={[{ label: 'Machine', placeholder: 'e.g. VMC-03' }, { label: 'Controller', placeholder: 'Fanuc 0iMD' }, { label: 'Magazine', placeholder: '20 slots' }]} />
    </div>
  );
}
