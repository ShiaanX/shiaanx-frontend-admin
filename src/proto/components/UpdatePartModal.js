import React, { useState } from 'react';
import Modal from './Modal';
import Dropzone from './Dropzone';
import EditableSelect from './EditableSelect';
import { useProtoData } from '../ProtoDataContext';

// For when the client sends a revised drawing, or the finish/remarks change, after the enquiry was
// already created. Saving never overwrites what's there — the current drawing/finish/remarks move
// into the part's revision history and the new values become current (ProtoDataContext.updatePartRevision).
export default function UpdatePartModal({ row, partIndex, onClose }) {
  const { finishes, addFinish, updatePartRevision } = useProtoData();
  const part = row.parts[partIndex];
  const [drawingFile, setDrawingFile] = useState(null);
  const [finish, setFinish] = useState(part.finish);
  const [remarks, setRemarks] = useState(row.remarks || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const hasChange = !!drawingFile || finish !== part.finish || remarks !== (row.remarks || '');

  const save = async () => {
    setSaving(true);
    await updatePartRevision(row, partIndex, { drawingFile, finish, remarks, note });
    onClose();
  };

  return (
    <Modal
      title={`Update ${part.name}`}
      maxWidth={520}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn px-btn-primary" disabled={!hasChange || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save as new version'}
        </button>
      </>}
    >
      <p className="page-sub" style={{ margin: 0 }}>
        Use this when the client sends a revised drawing, or something about the part changes. The current drawing, finish and remarks are kept in this part's revision history, not replaced.
      </p>
      <Dropzone label="Revised drawing (.pdf, optional)" accept=".pdf" file={drawingFile} onChange={setDrawingFile} />
      <EditableSelect label="Finish" options={finishes} value={finish} onChange={setFinish} onAdd={addFinish} placeholder="e.g. Chromate conversion" />
      <div className="field"><label>Remarks</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Anything the team should know…" /></div>
      <div className="field"><label>What changed (optional note)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Client sent Rev B drawing with updated tolerances" /></div>
    </Modal>
  );
}
