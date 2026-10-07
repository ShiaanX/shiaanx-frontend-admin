import React, { useRef } from 'react';
import Icon from '../icons';
import { ARTIFACT_DEFS, SRC_LABEL } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

// Ported from the mockup's renderArtifactRows(). hasOrder=false (a job produced without a
// confirmed order) hides only the Customer PO row — there is no PO, but it is still quoted.
//
// Three kinds of row:
//  - Human items (po, cam, materialCert, coc): "Upload" stores the real file in this browser
//    (db.js) and "View" opens that exact file.
//  - Process plan: "Generate" really runs — the part's STEP file goes to the CAPP service and the
//    program sheet PDF comes back (ProtoDataContext.generateProcessPlan).
//  - The other AI/tech items: "Generate" only marks the item done and stores a placeholder page;
//    nothing is connected behind them yet, and the row says so.
const REAL_GENERATORS = ['plan'];

export default function ArtifactChecklist({ jobId, row, hasOrder }) {
  const {
    artifactState, artifactProgress, markArtifactDone, generateProcessPlan, openArtifactFile, openFile,
    getClientReleased, toggleClientRelease,
  } = useProtoData();
  const released = getClientReleased(jobId);
  const state = artifactState[jobId] || {};
  const fileInputRef = useRef(null);
  const pendingArtifact = useRef(null);
  const defs = hasOrder ? ARTIFACT_DEFS : ARTIFACT_DEFS.filter(a => a.id !== 'po');

  const triggerUpload = (artifactId) => {
    pendingArtifact.current = artifactId;
    fileInputRef.current.click();
  };
  const onFileChosen = (e) => {
    const file = e.target.files[0];
    const artifactId = pendingArtifact.current;
    e.target.value = '';
    if (!file || !artifactId) return;
    markArtifactDone(jobId, artifactId, { src: 'human', file });
  };
  const generate = (a) => {
    if (a.id === 'plan' && row) return generateProcessPlan(jobId, row);
    return markArtifactDone(jobId, a.id, { src: a.src, label: a.name });
  };

  return (
    <div className="card">
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileChosen} />
      <h2><Icon name="info" /> Generated for this {hasOrder ? 'order' : 'job'}</h2>
      <p className="page-sub" style={{ margin: '-8px 0 12px' }}>
        Human items need a real file from you. Process plan is generated for real by the CAPP pipeline from the STEP file. The other AI/tech items are not connected yet — Generate there only marks them done.
      </p>
      <div>
        {defs.map((a) => {
          const entry = state[a.id];
          const done = entry === true || !!(entry && entry.done);
          const progress = artifactProgress[`${jobId}:${a.id}`];
          const running = !!(progress && progress.text);
          const real = a.src === 'human' || REAL_GENERATORS.includes(a.id);
          const status = entry && entry.note ? entry.note : (done ? a.doneStatus : a.pendingStatus);
          const files = entry && entry.files && entry.files.length > 1 ? entry.files : null;
          const canOpen = done && entry && entry.fileKey;
          const verb = a.src === 'human' ? 'Upload' : 'Generate';
          const redoVerb = a.src === 'human' ? 'Replace' : 'Regenerate';
          const act = () => (a.src === 'human' ? triggerUpload(a.id) : generate(a));
          return (
            <div className="artifact-row" key={a.id}>
              <div className="doc-icon"><Icon name="doc" /></div>
              <div className="art-main">
                <div className="art-name">{a.name}</div>
                <div className="art-meta">
                  <span className={`tag src-${a.src}`}>{SRC_LABEL[a.src]}</span>
                  {!real && <span className="tag">Not connected yet</span>}
                  <span className="art-status">{running ? progress.text : status}</span>
                </div>
                {progress && progress.error && <div className="field-error" style={{ marginTop: 6 }}>{progress.error}</div>}
              </div>
              <div className="art-actions">
                {done ? (
                  <>
                    <span className="toggle-label">Client</span>
                    <button type="button" className={`toggle ${released[a.id] ? 'on' : ''}`} onClick={() => toggleClientRelease(jobId, a.id)} aria-label="Release to client" />
                    {files ? files.map(f => (
                      <button type="button" key={f.fileKey} className="btn-sm text" onClick={() => openFile(f.fileKey)}>View {f.label}</button>
                    )) : (
                      <button type="button" className="btn-sm text" disabled={!canOpen} onClick={() => openArtifactFileOrKey(entry, jobId, a.id, openFile, openArtifactFile)}>View</button>
                    )}
                    <button type="button" className="btn-sm ghost" disabled={running} onClick={act}>{running ? 'Running…' : redoVerb}</button>
                  </>
                ) : (
                  <button type="button" className="btn-sm primary" disabled={running} onClick={act}>{running ? 'Running…' : verb}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// An entry's own fileKey wins (the process plan stores its PDF under a per-part key); older
// entries fall back to the `${jobId}:${artifactId}` convention.
function openArtifactFileOrKey(entry, jobId, artifactId, openFile, openArtifactFile) {
  if (entry && entry.fileKey) return openFile(entry.fileKey);
  return openArtifactFile(jobId, artifactId);
}
