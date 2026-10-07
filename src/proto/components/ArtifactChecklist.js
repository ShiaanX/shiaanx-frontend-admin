import React, { useRef } from 'react';
import Icon from '../icons';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';

// Documents for a job, in two levels.
//
// For the whole job — things issued once for the job, not per part: Customer PO, Quotation,
// Traceability pack, and Other documents (any number: Certificate of Conformance, …).
//
// For EACH part, the same set:
//
//   Process plan         AI
//   CAM program          AI · Human
//   Ballooned drawing    Human
//   Inspection template  AI · Human
//   Inspection report    Human
//   Other documents      Human, any number (material certificate, CoC, …)
//
// Each AI / Human line is its own slot with its own file, so a human-programmed CAM file and an
// AI-generated one sit side by side. Human slots store the real uploaded file. Of the AI slots only
// Process plan is connected (to the CAPP pipeline); the rest are tagged "Not connected yet".
const SRC_LABEL = { ai: 'AI generated', human: 'Human generated', tech: 'Tech-generated' };

const JOB_DOCS = [
  { id: 'po', name: 'Customer PO', src: 'human', orderOnly: true, pending: 'Awaiting customer PO', done: 'Uploaded by sales' },
  { id: 'quote', name: 'Quotation', src: 'ai', pending: 'Not yet generated', done: 'Finalized by admin' },
  { id: 'traceability', name: 'Traceability pack', src: 'tech', pending: 'Not yet built', done: 'Built from the documents below' },
];

// `legacy` is the job-level key the same document used before documents became per-part; a part's
// first slot falls back to it so earlier uploads and the sample jobs keep showing.
const PART_DOCS = [
  { id: 'plan', name: 'Process plan', slots: [{ src: 'ai', real: true, legacy: 'plan', pending: 'Not yet generated' }] },
  { id: 'cam', name: 'CAM program', slots: [
    { src: 'ai', pending: 'Not yet generated' },
    { src: 'human', legacy: 'cam', pending: 'Awaiting programmer', done: 'v1 · programmed in PowerMill' },
  ] },
  { id: 'balloon', name: 'Ballooned drawing', slots: [{ src: 'human', legacy: 'inspPlan', pending: 'Not yet uploaded', done: 'Balloons tagged' }] },
  { id: 'inspTemplate', name: 'Inspection template', slots: [
    { src: 'ai', legacy: 'inspTemplate', pending: 'Not yet generated', done: 'Generated from the ballooned drawing' },
    { src: 'human', pending: 'Not yet uploaded' },
  ] },
  { id: 'inspReport', name: 'Inspection report', slots: [{ src: 'human', legacy: 'inspReport', pending: 'Awaiting QC readings', done: 'Uploaded by QC' }] },
];
const LEGACY_OTHER = [['materialCert', 'Material certificate'], ['coc', 'Certificate of Conformance']];

export default function ArtifactChecklist({ jobId, row, hasOrder }) {
  const {
    artifactState, artifactProgress, markArtifactDone, generateProcessPlan, addOtherDocument, removeOtherDocument,
    openFile, downloadFile, getClientReleased, toggleClientRelease,
  } = useProtoData();
  const released = getClientReleased(jobId);
  const state = artifactState[jobId] || {};
  const fileInputRef = useRef(null);
  const pending = useRef(null); // what the open file picker is for

  const pick = (target) => { pending.current = target; fileInputRef.current.click(); };
  const onFileChosen = (e) => {
    const file = e.target.files[0];
    const target = pending.current;
    e.target.value = '';
    if (!file || !target) return;
    if (target.other !== undefined) addOtherDocument(jobId, target.other, file);
    else markArtifactDone(jobId, target.key, { src: 'human', file });
  };

  // The stored entry for a slot, falling back to the pre-per-part key for the first part.
  const lookup = (key, legacy, partIndex) => {
    if (state[key] !== undefined) return state[key];
    if (!legacy) return undefined;
    const old = state[legacy];
    // A plan generated before plans were per-part holds one PDF per part, keyed by part index.
    if (legacy === 'plan' && old && old.files) {
      const f = old.files.find(x => String(x.fileKey).endsWith(`:plan:${partIndex}`));
      return f ? { done: true, fileKey: f.fileKey, note: 'CAPP pipeline · generated earlier' } : undefined;
    }
    return partIndex === 0 ? old : undefined;
  };

  const Slot = ({ name, slotKey, slot, partIndex, sub }) => {
    const entry = slot.legacy !== undefined || partIndex !== undefined ? lookup(slotKey, slot.legacy, partIndex) : state[slotKey];
    const done = entry === true || !!(entry && entry.done);
    const progress = artifactProgress[`${jobId}:${slotKey}`];
    const running = !!(progress && progress.text);
    const human = slot.src === 'human';
    const connected = human || slot.real;
    const status = entry && entry.note ? entry.note : (done ? (slot.done || 'Done') : slot.pending);
    const fileKey = entry && entry.fileKey;
    const act = () => {
      if (human) return pick({ key: slotKey });
      if (slot.real && row) return generateProcessPlan(jobId, row, partIndex);
      return markArtifactDone(jobId, slotKey, { src: slot.src, label: name });
    };
    return (
      <div className={`artifact-row ${sub ? 'sub' : ''}`} data-slot={slotKey}>
        {!sub && <div className="doc-icon"><Icon name="doc" /></div>}
        <div className="art-main">
          {!sub && <div className="art-name">{name}</div>}
          <div className="art-meta">
            <span className={`tag src-${slot.src}`}>{SRC_LABEL[slot.src]}</span>
            {!connected && <span className="tag">Not connected yet</span>}
            <span className="art-status">{running ? progress.text : status}</span>
          </div>
          {progress && progress.error && <div className="field-error" style={{ marginTop: 6 }}>{progress.error}</div>}
        </div>
        <div className="art-actions">
          {done ? (
            <>
              <span className="toggle-label">Client</span>
              <button type="button" className={`toggle ${released[slotKey] ? 'on' : ''}`} onClick={() => toggleClientRelease(jobId, slotKey)} aria-label="Release to client" />
              <button type="button" className="btn-sm text" disabled={!fileKey} onClick={() => openFile(fileKey)}>View</button>
              <button type="button" className="btn-sm ghost" disabled={running} onClick={act}>{running ? 'Running…' : (human ? 'Replace' : 'Regenerate')}</button>
            </>
          ) : (
            <button type="button" className="btn-sm primary" disabled={running} onClick={act}>{running ? 'Running…' : (human ? 'Upload' : 'Generate')}</button>
          )}
        </div>
      </div>
    );
  };

  // scope is 'job' or `p${partIndex}`. Certificates recorded before this list existed show at job
  // level.
  const otherItems = (scope) => {
    const own = (state[`${scope}.other`] && state[`${scope}.other`].items) || [];
    if (scope !== 'job') return own;
    const old = LEGACY_OTHER.filter(([k]) => state[k]).map(([k, label]) => {
      const e = state[k];
      return { legacy: true, fileKey: e && e.fileKey, name: e && e.note ? e.note.replace(/^Uploaded · /, '') : label };
    });
    return [...old, ...own];
  };

  const OtherDocs = ({ scope, hint }) => (
    <>
      <div className="artifact-row" data-slot={`${scope}.other`}>
        <div className="doc-icon"><Icon name="doc" /></div>
        <div className="art-main">
          <div className="art-name">Other documents</div>
          <div className="art-meta">
            <span className="tag src-human">{SRC_LABEL.human}</span>
            <span className="art-status">{hint}</span>
          </div>
        </div>
        <div className="art-actions"><button type="button" className="btn-sm primary" onClick={() => pick({ other: scope })}>Add document</button></div>
      </div>
      {otherItems(scope).map((it, n) => (
        <div className="artifact-row sub" key={it.fileKey || n}>
          <div className="art-main">
            <div className="art-meta">
              <span className="art-name" style={{ fontWeight: 500 }}>{it.name}</span>
              {it.at && <span className="art-status">added {fmtDate(it.at.slice(0, 10))}</span>}
            </div>
          </div>
          <div className="art-actions">
            <button type="button" className="btn-sm text" disabled={!it.fileKey} onClick={() => openFile(it.fileKey)}>View</button>
            <button type="button" className="btn-sm text" disabled={!it.fileKey} onClick={() => downloadFile(it.fileKey)}>Download</button>
            {!it.legacy && <button type="button" className="btn-sm text" onClick={() => removeOtherDocument(jobId, scope, it.fileKey)}>Remove</button>}
          </div>
        </div>
      ))}
    </>
  );

  const parts = row ? row.parts : [];

  return (
    <div className="card">
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileChosen} />
      <h2><Icon name="info" /> Documents for this {hasOrder ? 'order' : 'job'}</h2>
      <p className="page-sub" style={{ margin: '-8px 0 12px' }}>
        Some documents are for the whole job, the rest are kept per part. "Human generated" lines take a file you upload. Of the "AI generated" lines only Process plan is connected so far — it runs the CAPP pipeline on the part's STEP file.
      </p>

      <div className="doc-group-label">For the whole {hasOrder ? 'order' : 'job'}</div>
      {JOB_DOCS.filter(d => hasOrder || !d.orderOnly).map(d => (
        <Slot key={d.id} name={d.name} slotKey={d.id} slot={{ src: d.src, pending: d.pending, done: d.done }} />
      ))}
      <OtherDocs scope="job" hint="Common to the whole job — Certificate of Conformance and the like. Add as many as needed" />

      {parts.map((p, i) => (
        <div key={p.tmpl || p.name} data-part={p.name}>
          <div className="doc-part-head"><Icon name="part" size={15} /> {p.name} <span className="cell-sub">· part {i + 1} of {parts.length}</span></div>
          {PART_DOCS.map(d => d.slots.map((slot, si) => (
            <Slot key={`${d.id}.${slot.src}`} name={d.name} slotKey={d.slots.length > 1 ? `p${i}.${d.id}.${slot.src}` : `p${i}.${d.id}`}
              slot={slot} partIndex={i} sub={si > 0} />
          )))}
          <OtherDocs scope={`p${i}`} hint="Specific to this part — material certificate and the like. Add as many as needed" />
        </div>
      ))}
    </div>
  );
}
