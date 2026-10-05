import React from 'react';
import Icon from '../icons';
import { ARTIFACT_DEFS, SRC_LABEL } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

// Ported from the mockup's renderArtifactRows(). hasOrder=false (a no-order/trial job) hides the
// Customer PO and Quotation rows, since there's nothing commercial behind the job.
export default function ArtifactChecklist({ jobId, hasOrder }) {
  const { artifactState, markArtifactDone, getClientReleased, toggleClientRelease } = useProtoData();
  const state = artifactState[jobId] || {};
  const released = getClientReleased(jobId);
  const defs = hasOrder ? ARTIFACT_DEFS : ARTIFACT_DEFS.filter(a => a.id !== 'po' && a.id !== 'quote');

  return (
    <div className="card">
      <h2><Icon name="info" /> Generated for this {hasOrder ? 'order' : 'job'}</h2>
      <p className="page-sub" style={{ margin: '-8px 0 12px' }}>
        Every artifact a {hasOrder ? 'order' : 'no-order job'} can have. AI/tech items are built by the system; human items need someone to provide the file. Anything already in place can be viewed or replaced.
      </p>
      <div>
        {defs.map((a) => {
          const done = !!state[a.id];
          const verb = a.src === 'human' ? 'Upload' : 'Generate';
          const redoVerb = a.src === 'human' ? 'Replace' : 'Regenerate';
          return (
            <div className="artifact-row" key={a.id}>
              <div className="doc-icon"><Icon name="doc" /></div>
              <div className="art-main">
                <div className="art-name">{a.name}</div>
                <div className="art-meta">
                  <span className={`tag src-${a.src}`}>{SRC_LABEL[a.src]}</span>
                  <span className="art-status">{done ? a.doneStatus : a.pendingStatus}</span>
                </div>
              </div>
              <div className="art-actions">
                {done ? (
                  <>
                    <span className="toggle-label">Client</span>
                    <button type="button" className={`toggle ${released[a.id] ? 'on' : ''}`} onClick={() => toggleClientRelease(jobId, a.id)} aria-label="Release to client" />
                    <button type="button" className="btn-sm text">View</button>
                    <button type="button" className="btn-sm ghost">{redoVerb}</button>
                  </>
                ) : (
                  <button type="button" className="btn-sm primary" onClick={() => markArtifactDone(jobId, a.id)}>{verb}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
