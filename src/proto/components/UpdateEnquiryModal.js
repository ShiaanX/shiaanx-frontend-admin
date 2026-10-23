import React, { useState } from 'react';
import Icon from '../icons';
import Modal from './Modal';
import Dropzone from './Dropzone';
import EditableSelect from './EditableSelect';
import ProcessPicker from './ProcessPicker';
import { useProtoData } from '../ProtoDataContext';

const onFile = (list) => (list && list.length ? ` — ${list.length} already on file` : '');

const existingPartForm = (p, i) => ({
  key: `existing-${i}`, existing: true, originalIndex: i,
  partName: p.name, qty: p.qty, material: p.material, finish: p.finish, processes: [...(p.processes || [])],
  cadFile: null, drawingFile: null, receivedFiles: [],
});
const newPartForm = () => ({
  key: Math.random().toString(36).slice(2), existing: false,
  partName: '', qty: 1, material: 'Aluminium 6061', finish: 'As machined', processes: [],
  cadFile: null, drawingFile: null, receivedFiles: [],
});

// The same form as New Enquiry, pre-filled with this enquiry's current values — for when the
// client sends updates: a new drawing, a different quantity or material, or an extra part type
// altogether. Only what's actually changed moves; nothing on an existing part is deleted — the
// current qty/material/finish/CAD/drawing it's replacing is kept in that part's revision history
// (ProtoDataContext.applyEnquiryUpdate).
export default function UpdateEnquiryModal({ row, onClose }) {
  const { materials, finishes, addMaterial, addFinish, processes, addProcess, applyEnquiryUpdate } = useProtoData();
  const [parts, setParts] = useState(row.parts.map(existingPartForm));
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [assemblyName, setAssemblyName] = useState(row.assemblyName || '');
  const [remarks, setRemarks] = useState(row.remarks || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState('');

  const updatePart = (key, patch) => setParts(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)));
  const addPart = () => setParts(prev => [...prev, newPartForm()]);
  const removePart = (key) => setParts(prev => prev.filter(p => p.key !== key));

  // The button is never silently disabled: clicking it with something missing marks the field in
  // red and scrolls to it, and a failed save says so instead of leaving the modal sitting there.
  const missingName = (p) => !p.existing && !p.partName.trim();
  const save = async () => {
    if (parts.some(missingName)) {
      setShowErrors(true);
      setTimeout(() => document.querySelector('.proto-app .invalid')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await applyEnquiryUpdate(row, { remarks, assemblyName, parts, note, receivedFiles });
      onClose();
    } catch (e) {
      console.error('Update failed:', e);
      setError(`Could not save this update: ${e.message || e}`);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Update ${row.isOrder ? row.orderId : row.id}`}
      maxWidth={640}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn px-btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save update'}
        </button>
      </>}
    >
      <p className="page-sub" style={{ margin: 0 }}>
        Edit whatever's changed below — a revised drawing, a different quantity or material, or add a new part type entirely. Anything you replace on an existing part is kept in that part's revision history, not deleted.
      </p>

      <div className="field">
        <label>Assembly / job name (optional)</label>
        <input value={assemblyName} onChange={e => setAssemblyName(e.target.value)} placeholder="e.g. Pump Housing Assembly — leave blank to list parts by name" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {parts.map((p, i) => (
          <div className="inline-add" key={p.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: 12.5 }}>{p.existing ? row.parts[p.originalIndex].name : `New part ${i + 1}`}</b>
              {!p.existing && <button type="button" className="btn-sm text" onClick={() => removePart(p.key)}>Remove</button>}
            </div>
            {!p.existing && (
              <div className="field">
                <label>Part name</label>
                <input className={showErrors && missingName(p) ? 'invalid' : ''} value={p.partName} onChange={e => updatePart(p.key, { partName: e.target.value })} placeholder="e.g. Bracket, Base Plate" />
                {showErrors && missingName(p) && <span className="field-error">Give this new part a name, or remove it.</span>}
              </div>
            )}
            <div className="field-row">
              <div className="field"><label>Quantity</label><input type="number" value={p.qty} onChange={e => updatePart(p.key, { qty: e.target.value })} min={1} /></div>
              <EditableSelect label="Material" options={materials} value={p.material} onChange={(v) => updatePart(p.key, { material: v })} onAdd={addMaterial} placeholder="e.g. Titanium Grade 5" />
            </div>
            <EditableSelect label="Finish" options={finishes} value={p.finish} onChange={(v) => updatePart(p.key, { finish: v })} onAdd={addFinish} placeholder="e.g. Chromate conversion" />
            <ProcessPicker options={processes || []} value={p.processes} onChange={(v) => updatePart(p.key, { processes: v })} onAdd={addProcess} />
            <Dropzone
              label={`CAD file (.step/.stp)${p.existing && row.parts[p.originalIndex].fileKey ? ` — current: ${row.parts[p.originalIndex].file}` : ''}`}
              accept=".step,.stp" file={p.cadFile} onChange={(f) => updatePart(p.key, { cadFile: f })}
            />
            <Dropzone
              label={`Drawing (.pdf)${p.existing && row.parts[p.originalIndex].drawingFileKey ? ` — current: ${row.parts[p.originalIndex].drawingFileName}` : ''}`}
              accept=".pdf" file={p.drawingFile} onChange={(f) => updatePart(p.key, { drawingFile: f })}
            />
            <Dropzone
              multiple files={p.receivedFiles} onChange={(fs) => updatePart(p.key, { receivedFiles: fs })}
              label={`Other documents (any number)${onFile(p.existing ? row.parts[p.originalIndex].received : null)}`}
              hint="added alongside what's already there"
            />
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={addPart}><Icon name="plus" /> Add another part type</button>
      </div>

      <Dropzone
        multiple files={receivedFiles} onChange={setReceivedFiles}
        label={`Project documents (any number)${onFile(row.received)}`}
        hint="for the whole job, not one part"
      />
      <div className="field"><label>Remarks</label><textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Anything the team should know about this enquiry…" /></div>
      <div className="field"><label>What changed (optional note)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Client sent Rev B drawings and dropped Part B's quantity to 3" /></div>
      {showErrors && parts.some(missingName) && <p className="field-error" style={{ margin: 0 }}>Not saved yet — the fields marked in red above are missing.</p>}
      {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
    </Modal>
  );
}
