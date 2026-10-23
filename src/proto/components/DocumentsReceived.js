import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import RevisionHistory from './RevisionHistory';
import { NotOrderedBadge } from './ProcessChips';
import { isStepFile, view3dPath } from './docLinks';
import { useProtoData } from '../ProtoDataContext';

// What the customer sent, grouped under a heading per part: its CAD file, its drawing and any
// reference documents (surface-finish specs and the like), with every earlier version kept
// underneath. Documents for the whole job — and the current manual quote — sit in a "Whole project"
// group. The same card on an enquiry, on the order it becomes, and on a job produced without an
// order, so the drawing history is never lost from view once work starts.
export default function DocumentsReceived({ row }) {
  const navigate = useNavigate();
  const { openFile, downloadFile } = useProtoData();

  const DocRow = ({ icon, name, type, children }) => (
    <div className="doc-row" data-doc-row>
      <div className="doc-icon"><Icon name={icon} /></div>
      <div>
        <div className="doc-name">{name}</div>
        <div className="doc-sub" data-doc-type>{type}</div>
      </div>
      {children && <div className="doc-actions">{children}</div>}
    </div>
  );

  // A reference document: a STEP file opens in the 3D view, anything else in a new tab.
  const RefDoc = ({ d }) => (
    <DocRow icon={isStepFile(d.name) ? 'cad' : 'doc'} name={d.name} type="Reference document">
      {isStepFile(d.name)
        ? <button type="button" className="btn-text" onClick={() => navigate(view3dPath(d.fileKey))}>View 3D</button>
        : <button type="button" className="btn-text" onClick={() => openFile(d.fileKey)}>View</button>}
      <button type="button" className="btn-text" onClick={() => downloadFile(d.fileKey)}>Download</button>
    </DocRow>
  );

  const jobDocs = row.received || [];
  const hasProjectGroup = jobDocs.length > 0 || !!row.manualQuoteFileKey;

  return (
    <div className="card" data-docs-received>
      <h2><Icon name="doc" /> Documents received</h2>
      {row.parts.map(p => (
        <div key={p.tmpl || p.name} data-doc-group={p.name}>
          <div className="doc-part-head"><Icon name="part" size={15} /> {p.name} <NotOrderedBadge part={p} /></div>
          <DocRow icon="cad" name={p.fileKey ? p.file : 'No CAD file uploaded'} type={p.fileKey ? '3D model (CAD)' : '3D model (CAD) · add it with Update'}>
            {p.fileKey && <>
              <button type="button" className="btn-text" onClick={() => navigate(`/proto/parts/${p.tmpl}`)}>View 3D</button>
              <button type="button" className="btn-text" onClick={() => downloadFile(p.fileKey)}>Download</button>
            </>}
          </DocRow>
          <DocRow icon="doc" name={p.drawingFileKey ? p.drawingFileName : 'No drawing uploaded'} type={p.drawingFileKey ? '2D drawing (PDF)' : '2D drawing (PDF) · add it with Update'}>
            {p.drawingFileKey && <>
              <button type="button" className="btn-text" onClick={() => openFile(p.drawingFileKey)}>View</button>
              <button type="button" className="btn-text" onClick={() => downloadFile(p.drawingFileKey)}>Download</button>
            </>}
          </DocRow>
          {(p.received || []).map(d => <RefDoc key={d.fileKey} d={d} />)}
          <RevisionHistory part={p} />
        </div>
      ))}
      {hasProjectGroup && (
        <div data-doc-group="Whole project">
          <div className="doc-part-head"><Icon name="doc" size={15} /> Whole project</div>
          {jobDocs.map(d => <RefDoc key={d.fileKey} d={d} />)}
          {row.manualQuoteFileKey && (
            <DocRow icon="doc" name={row.manualQuoteFileName} type="Manual quote">
              <button type="button" className="btn-text" onClick={() => openFile(row.manualQuoteFileKey)}>View</button>
              <button type="button" className="btn-text" onClick={() => downloadFile(row.manualQuoteFileKey)}>Download</button>
            </DocRow>
          )}
        </div>
      )}
    </div>
  );
}
