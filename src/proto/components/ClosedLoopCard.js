import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { JobStatusBadge } from './Badges';
import DownloadLink from './DownloadLink';

// Shared by order detail and a no-order (trial/internal) job — the production record looks
// identical either way. Ported from the mockup's partsClosedLoopCard().
export default function ClosedLoopCard({ parts }) {
  const navigate = useNavigate();
  return (
    <div className="card">
      <h2><Icon name="part" /> Closed-loop details — per piece</h2>
      {parts.map((p) => (
        <div className="part-row" key={p.name}>
          <div className="part-row-head">
            <button type="button" className="btn-text" style={{ fontSize: 14.5 }} onClick={() => navigate(`/proto/parts/${p.tmpl}`)}>
              {p.name} <Icon name="part" size={14} />
            </button>
            <JobStatusBadge status={p.jobStatus} />
          </div>
          <div className="mini-grid">
            <div><span className="ml">Material</span><span className="mv">{p.material}</span></div>
            <div><span className="ml">Quantity</span><span className="mv">{p.qty}</span></div>
            <div><span className="ml">Finish</span><span className="mv">{p.finish}</span></div>
            <div><span className="ml">CAD file</span><span className="mv"><DownloadLink file={p.file} fileKey={p.fileKey} /></span></div>
          </div>
          {p.inspection ? (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div className="kpi-strip">
                <div className="kpi ok"><div className="n">{p.inspection.pass}/{p.inspection.total}</div><div className="l">Within tol.</div></div>
                <div className="kpi warn"><div className="n">{p.inspection.near}</div><div className="l">Close to limit</div></div>
                <div className="kpi err"><div className="n">{p.inspection.fail}</div><div className="l">Out of tol.</div></div>
              </div>
              <button type="button" className="btn-text" style={{ marginTop: 10 }} onClick={() => navigate(`/proto/inspection/${encodeURIComponent(p.name)}`)}>
                Open 3D inspection report →
              </button>
            </div>
          ) : (
            <div className="empty-hint" style={{ padding: '10px 0 0', textAlign: 'left' }}>Not yet inspected.</div>
          )}
        </div>
      ))}
    </div>
  );
}
