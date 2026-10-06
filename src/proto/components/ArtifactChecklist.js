import React, { useRef } from 'react';
import Icon from '../icons';
import { ARTIFACT_DEFS, SRC_LABEL } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

// Ported from the mockup's renderArtifactRows(). hasOrder=false (a no-order/trial job) hides the
// Customer PO and Quotation rows, since there's nothing commercial behind the job.
//
// Human-sourced items (po, cam, materialCert, coc) take a real file through "Upload" — it's stored
// in this browser (see db.js) and "View" opens that exact file. AI/tech items (quote, plan, …) only
// get marked done when you click "Generate" — there's no backend yet, so what opens is a small
// placeholder, not a real computed document; the status line says when it was generated.
export default function ArtifactChecklist({ jobId, hasOrder }) {
  const { artifactState, markArtifactDone, openArtifactFile, getClientReleased, toggleClientRelease } = useProtoData();
  const released = getClientReleased(jobId);
  const state = artifactState[jobId] || {};
  const fileInputRef = useRef(null);
  const pendingArtifact = useRef(null);
  const defs = hasOrder ? ARTIFACT_DEFS : ARTIFACT_DEFS.filter(a => a.id !== 'po' && a.id !== 'quote');

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
  const generate = (a) => markArtifactDone(jobId, a.id, { src: a.src, label: a.name });

  return (
    <div className="card">
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileChosen} />
      <h2><Icon name="info" /> Generated for this {hasOrder ? 'order' : 'job'}</h2>
      <p className="page-sub" style={{ margin: '-8px 0 12px' }}>
        Every artifact a {hasOrder ? 'order' : 'no-order job'} can have. Human items need a real file from you; AI/tech items only appear once you click Generate — nothing fills in on its own.
      </p>
      <div>
        {defs.map((a) => {
          const entry = state[a.id];
          const done = entry === true || !!(entry && entry.done);
          const status = entry && entry.note ? entry.note : (done ? a.doneStatus : a.pendingStatus);
          const canOpen = done && entry && entry.fileKey;
          const verb = a.src === 'human' ? 'Upload' : 'Generate';
          const redoVerb = a.src === 'human' ? 'Replace' : 'Regenerate';
          return (
            <div className="artifact-row" key={a.id}>
              <div className="doc-icon"><Icon name="doc" /></div>
              <div className="art-main">
                <div className="art-name">{a.name}</div>
                <div className="art-meta">
                  <span className={`tag src-${a.src}`}>{SRC_LABEL[a.src]}</span>
                  <span className="art-status">{status}</span>
                </div>
              </div>
              <div className="art-actions">
                {done ? (
                  <>
                    <span className="toggle-label">Client</span>
                    <button type="button" className={`toggle ${released[a.id] ? 'on' : ''}`} onClick={() => toggleClientRelease(jobId, a.id)} aria-label="Release to client" />
                    <button type="button" className="btn-sm text" disabled={!canOpen} onClick={() => openArtifactFile(jobId, a.id)}>View</button>
                    {a.src === 'human' ? (
                      <button type="button" className="btn-sm ghost" onClick={() => triggerUpload(a.id)}>{redoVerb}</button>
                    ) : (
                      <button type="button" className="btn-sm ghost" onClick={() => generate(a)}>{redoVerb}</button>
                    )}
                  </>
                ) : (
                  <button type="button" className="btn-sm primary" onClick={() => a.src === 'human' ? triggerUpload(a.id) : generate(a)}>{verb}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
