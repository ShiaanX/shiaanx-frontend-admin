import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { JobStatusBadge } from './Badges';
import DownloadLink from './DownloadLink';
import ProcessChips from './ProcessChips';

// Shared by order detail and a no-order (trial/internal) job — the production record looks
// identical either way. Ported from the mockup's partsClosedLoopCard(). Only parts being made are
// here: a part left out when the enquiry was converted ("Not ordered") has no production record.
export default function ClosedLoopCard({ parts }) {
  const navigate = useNavigate();
  const made = parts.filter(p => p.ordered !== false);
  return (
    <div className="card" data-closed-loop>
      <h2><Icon name="part" /> Closed-loop details — per piece</h2>
      {made.map((p) => (
        <div className="part-row" key={p.name} data-cl-part={p.name}>
          <div className="part-row-head">
            <button type="button" className="btn-text" style={{ fontSize: 14.5 }} onClick={() => navigate(`/proto/parts/${p.tmpl}`)}>
              {p.name} <Icon name="part" size={14} />
            </button>
            <JobStatusBadge status={p.jobStatus} />
          </div>
          <ProcessChips processes={p.processes} style={{ marginBottom: 10 }} />
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
                Inspection report and 3D QC view →
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <span className="cell-sub">Not yet inspected. </span>
              <button type="button" className="btn-text" onClick={() => navigate(`/proto/inspection/${encodeURIComponent(p.name)}`)}>
                Inspection report and 3D QC view →
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
