import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import RevisionHistory from './RevisionHistory';
import { useProtoData } from '../ProtoDataContext';

// What the customer sent for each part — CAD file and drawing — with every earlier version kept
// underneath, plus a manual quote if one was uploaded. The same card on an enquiry, on the order
// it becomes, and on a job produced without an order, so the drawing history is never lost from
// view once work starts.
export default function DocumentsReceived({ row }) {
  const navigate = useNavigate();
  const { openFile, downloadFile } = useProtoData();
  return (
    <div className="card" data-docs-received>
      <h2><Icon name="doc" /> Documents received</h2>
      {row.parts.map(p => (
        <React.Fragment key={p.tmpl || p.name}>
          <div className="doc-row">
            <div className="doc-icon"><Icon name="cad" /></div>
            <div>
              <div className="doc-name">{p.fileKey ? p.file : 'No CAD file uploaded'}</div>
              <div className="doc-sub">{p.fileKey ? `3D model (CAD) · ${p.name}` : `3D model (CAD) · ${p.name} · add it with Update`}</div>
            </div>
            {p.fileKey && (
              <div className="doc-actions">
                <button type="button" className="btn-text" onClick={() => navigate(`/proto/parts/${p.tmpl}`)}>View 3D</button>
                <button type="button" className="btn-text" onClick={() => downloadFile(p.fileKey)}>Download</button>
              </div>
            )}
          </div>
          <div className="doc-row">
            <div className="doc-icon"><Icon name="doc" /></div>
            <div>
              <div className="doc-name">{p.drawingFileKey ? p.drawingFileName : 'No drawing uploaded'}</div>
              <div className="doc-sub">{p.drawingFileKey ? `2D drawing (PDF) · ${p.name}` : `2D drawing (PDF) · ${p.name} · add it with Update`}</div>
            </div>
            {p.drawingFileKey && (
              <div className="doc-actions">
                <button type="button" className="btn-text" onClick={() => openFile(p.drawingFileKey)}>View</button>
                <button type="button" className="btn-text" onClick={() => downloadFile(p.drawingFileKey)}>Download</button>
              </div>
            )}
          </div>
          <RevisionHistory part={p} />
        </React.Fragment>
      ))}
      {row.manualQuoteFileKey && (
        <div className="doc-row">
          <div className="doc-icon"><Icon name="doc" /></div>
          <div>
            <div className="doc-name">{row.manualQuoteFileName}</div>
            <div className="doc-sub">Manual quote</div>
          </div>
          <div className="doc-actions">
            <button type="button" className="btn-text" onClick={() => openFile(row.manualQuoteFileKey)}>View</button>
            <button type="button" className="btn-text" onClick={() => downloadFile(row.manualQuoteFileKey)}>Download</button>
          </div>
        </div>
      )}
    </div>
  );
}
