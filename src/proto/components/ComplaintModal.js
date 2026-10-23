import React, { useRef, useState } from 'react';
import Modal from './Modal';
import Icon from '../icons';

export const KINDS = ['COMPLAINT', 'REJECTION', 'FEEDBACK'];
export const KIND_LABEL = { COMPLAINT: 'Complaint', REJECTION: 'Rejection', FEEDBACK: 'Feedback' };
const KIND_CLS = { COMPLAINT: 'b-near', REJECTION: 'b-fail', FEEDBACK: 'b-quoted' };

export function KindBadge({ kind }) {
  return <span className={`badge ${KIND_CLS[kind] || 'b-neutral'}`} data-kind={kind}>{KIND_LABEL[kind] || kind}</span>;
}
export function ComplaintStatusBadge({ status }) {
  return <span className={`badge ${status === 'RESOLVED' ? 'b-done' : 'b-pending'}`} data-cstatus={status}>{status === 'RESOLVED' ? 'Resolved' : 'Open'}</span>;
}

export const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Several files at once, any type. Picked files are listed and can be taken off again before saving;
// nothing is uploaded until the form is saved.
export function MultiFileField({ label, files, onChange }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const add = (list) => { const arr = Array.from(list || []); if (arr.length) onChange([...files, ...arr]); };
  return (
    <div className="field">
      <label>{label}</label>
      <div className={`dropzone ${over ? 'over' : ''}`} onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        <Icon name="upload" />
        <div className="dz-sub">Drag files here, or click to browse (any number)</div>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} data-complaint-files
          onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <Icon name="doc" size={14} /><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
          <button type="button" className="btn-sm text" onClick={() => onChange(files.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// Add or edit a complaint / rejection / feedback against a job. `complaint` set means edit; new
// attachments picked while editing are added beside the ones already there.
export default function ComplaintModal({ row, complaint, onSave, onClose }) {
  const editing = !!complaint;
  const [kind, setKind] = useState(complaint ? complaint.kind : 'COMPLAINT');
  const [receivedOn, setReceivedOn] = useState(complaint ? (complaint.receivedOn || '').slice(0, 10) : todayYmd());
  const [description, setDescription] = useState(complaint ? complaint.description || '' : '');
  const [partIds, setPartIds] = useState(() => new Set(complaint ? complaint.partIds || [] : []));
  const [qty, setQty] = useState(complaint && complaint.qtyAffected != null ? String(complaint.qtyAffected) : '');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const togglePart = (id) => setPartIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async () => {
    if (!description.trim()) { setError('Describe what the customer said.'); return; }
    if (!receivedOn) { setError('Give the date it was received.'); return; }
    if (qty !== '' && !(Number(qty) >= 0)) { setError('Quantity affected must be a number.'); return; }
    setError('');
    setSaving(true);
    const data = {
      kind, receivedOn, description: description.trim(),
      partIds: row.parts.filter(p => partIds.has(p.uuid)).map(p => p.uuid),
      qtyAffected: qty === '' ? null : Number(qty),
    };
    try {
      await onSave(data, files);
      onClose();
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit complaint / feedback' : 'Add complaint / feedback'} maxWidth={560} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn px-btn-primary" disabled={saving} onClick={save} data-complaint-save>{saving ? 'Saving…' : (editing ? 'Save changes' : 'Add')}</button>
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-complaint-form>
        <div className="field-row">
          <div className="field">
            <label>Kind</label>
            <select value={kind} onChange={e => setKind(e.target.value)} data-field="kind">
              {KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Date received</label>
            <input type="date" value={receivedOn} onChange={e => setReceivedOn(e.target.value)} data-field="receivedOn" />
          </div>
        </div>
        <div className="field">
          <label>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What the customer reported…" data-field="description" />
        </div>
        <div className="field">
          <label>Affected parts (optional)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {row.parts.map(p => (
              <label key={p.uuid} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 500, color: 'var(--ink)', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 15, height: 15 }} checked={partIds.has(p.uuid)} onChange={() => togglePart(p.uuid)} data-complaint-part={p.name} />
                {p.name}
              </label>
            ))}
          </div>
        </div>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Quantity affected (optional)</label>
          <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} data-field="qty" />
        </div>
        <MultiFileField label={editing ? 'Add attachments' : 'Attachments'} files={files} onChange={setFiles} />
        {error && <div className="field-error">{error}</div>}
      </div>
    </Modal>
  );
}

// Close a complaint with what was done about it.
export function ResolveModal({ complaint, onSave, onClose }) {
  const [resolution, setResolution] = useState(complaint.resolution || '');
  const [resolvedOn, setResolvedOn] = useState(todayYmd());
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await onSave({ status: 'RESOLVED', resolution: resolution.trim(), resolvedOn }); onClose(); } catch (e) { setSaving(false); }
  };
  return (
    <Modal title="Mark resolved" maxWidth={480} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn px-btn-primary" disabled={saving} onClick={save} data-resolve-save>{saving ? 'Saving…' : 'Mark resolved'}</button>
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-resolve-form>
        <div className="field">
          <label>Resolution</label>
          <textarea value={resolution} onChange={e => setResolution(e.target.value)} placeholder="What was done — rework, replacement, credit note…" data-field="resolution" />
        </div>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Resolved on</label>
          <input type="date" value={resolvedOn} onChange={e => setResolvedOn(e.target.value)} data-field="resolvedOn" />
        </div>
      </div>
    </Modal>
  );
}
