import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProtoData } from '../ProtoDataContext';
import { isStepFile, view3dPath } from './docLinks';
import { fmtDate } from '../utils';

// Every earlier version of a part — qty, material, finish, CAD file, drawing, remarks — oldest
// first as superseded, never deleted, only appended to by UpdateEnquiryModal. Collapsed by default
// since most parts have none. An earlier STEP file opens in the 3D view as well as downloading.
export default function RevisionHistory({ part }) {
  const navigate = useNavigate();
  const { openFile, downloadFile } = useProtoData();
  const [open, setOpen] = useState(false);
  const revisions = part.revisions || [];
  if (revisions.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="btn-text" onClick={() => setOpen(o => !o)}>
        {open ? 'Hide' : 'Show'} {revisions.length} earlier version{revisions.length === 1 ? '' : 's'}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {revisions.map((rv, i) => (
            <div key={i} className="part-row" style={{ background: 'var(--shell-bg)' }}>
              <div className="part-row-head"><span className="cell-sub">{rv.at ? `Replaced ${fmtDate(String(rv.at).slice(0, 10))}` : 'Replaced'}</span></div>
              <div className="mini-grid">
                <div><span className="ml">Material</span><span className="mv">{rv.material}</span></div>
                <div><span className="ml">Qty</span><span className="mv">{rv.qty}</span></div>
                <div><span className="ml">Finish</span><span className="mv">{rv.finish}</span></div>
                <div>
                  <span className="ml">CAD file</span>
                  <span className="mv">
                    {rv.fileKey ? (
                      <>
                        {rv.file}{' '}
                        {(isStepFile(rv.file) || !rv.file) && <><button type="button" className="btn-text" onClick={() => navigate(view3dPath(rv.fileKey))} data-rev-view3d>View 3D</button>{' '}</>}
                        <button type="button" className="btn-text" onClick={() => downloadFile(rv.fileKey)}>Download</button>
                      </>
                    ) : '—'}
                  </span>
                </div>
                <div>
                  <span className="ml">Drawing</span>
                  <span className="mv">
                    {rv.drawingFileKey ? (
                      <>
                        {rv.drawingFileName}{' '}
                        <button type="button" className="btn-text" onClick={() => openFile(rv.drawingFileKey)}>View</button>{' '}
                        <button type="button" className="btn-text" onClick={() => downloadFile(rv.drawingFileKey)}>Download</button>
                      </>
                    ) : '—'}
                  </span>
                </div>
                <div><span className="ml">Remarks then</span><span className="mv">{rv.remarks || '—'}</span></div>
              </div>
              {rv.note && <div className="cell-sub" style={{ marginTop: 8 }}>Note: {rv.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
