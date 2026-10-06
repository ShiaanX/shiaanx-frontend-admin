import React, { useState } from 'react';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';

// Every earlier version of a part's drawing/finish/remarks, oldest first as superseded — never
// deleted, only appended to by UpdatePartModal. Collapsed by default since most parts have none.
export default function RevisionHistory({ part }) {
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
        <div className="tablecard overflow-x" style={{ marginTop: 8, marginBottom: 0 }}>
          <table className="data">
            <thead><tr><th>Received</th><th>Drawing</th><th>Finish</th><th>Remarks</th><th>Note</th></tr></thead>
            <tbody>
              {revisions.map((rv, i) => (
                <tr key={i}>
                  <td className="cell-sub">{fmtDate(rv.at.slice(0, 10))}</td>
                  <td>
                    {rv.drawingFileKey ? (
                      <>
                        <div className="cell-sub">{rv.drawingFileName}</div>
                        <button type="button" className="btn-text" onClick={() => openFile(rv.drawingFileKey)}>View</button>
                        {' '}<button type="button" className="btn-text" onClick={() => downloadFile(rv.drawingFileKey)}>Download</button>
                      </>
                    ) : <span className="cell-sub">—</span>}
                  </td>
                  <td>{rv.finish}</td>
                  <td className="cell-sub">{rv.remarks || '—'}</td>
                  <td className="cell-sub">{rv.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
