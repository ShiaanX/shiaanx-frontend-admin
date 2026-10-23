import React, { useState } from 'react';
import Modal from './Modal';
import ProcessChips from './ProcessChips';

// Pick some of a job's parts: used by Convert to order, Add parts to order and Repeat order. Every
// listed part starts ticked; at least one must stay ticked. onConfirm gets the ticked part ids and
// returns a promise — the dialog stays open (and shows nothing extra, the banner has the error) if
// it rejects.
export default function PartPickerModal({ title, intro, parts, confirmLabel, busyLabel, onConfirm, onClose }) {
  const [ticked, setTicked] = useState(() => new Set(parts.map(p => p.uuid)));
  const [saving, setSaving] = useState(false);
  const none = ticked.size === 0;

  const toggle = (id) => setTicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allOn = ticked.size === parts.length;
  const toggleAll = () => setTicked(allOn ? new Set() : new Set(parts.map(p => p.uuid)));

  const confirm = async () => {
    if (none) return;
    setSaving(true);
    try {
      await onConfirm(parts.filter(p => ticked.has(p.uuid)).map(p => p.uuid));
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} maxWidth={560} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn px-btn-primary" disabled={saving || none} onClick={confirm} data-picker-confirm>
        {saving ? (busyLabel || 'Saving…') : confirmLabel}
      </button>
    </>}>
      <div data-part-picker>
        {intro && <p className="page-sub" style={{ margin: '0 0 12px' }}>{intro}</p>}
        {parts.length > 1 && (
          <button type="button" className="btn-text" style={{ marginBottom: 8 }} onClick={toggleAll}>{allOn ? 'Untick all' : 'Tick all'}</button>
        )}
        {parts.map(p => (
          <label key={p.uuid} className="part-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 8, padding: '12px 14px' }}>
            <input type="checkbox" checked={ticked.has(p.uuid)} onChange={() => toggle(p.uuid)} style={{ marginTop: 3, width: 16, height: 16 }} data-part-name={p.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="cell-sub">Qty {p.qty}{p.material ? ` · ${p.material}` : ''}{p.finish ? ` · ${p.finish}` : ''}</div>
              <ProcessChips processes={p.processes} style={{ marginTop: 6 }} />
            </div>
          </label>
        ))}
        {none && <div className="field-error" style={{ marginTop: 6 }} data-picker-none>Tick at least one part.</div>}
      </div>
    </Modal>
  );
}
