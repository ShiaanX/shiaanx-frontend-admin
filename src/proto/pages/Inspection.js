import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import KpiStrip from '../components/KpiStrip';
import { VerdictBadge } from '../components/Badges';
import { INSPECTION_BY_PART } from '../fixtures';

export default function Inspection() {
  const { part } = useParams();
  const navigate = useNavigate();
  const insp = INSPECTION_BY_PART[part];
  const back = <button type="button" className="back-link" onClick={() => navigate(-1)}><Icon name="back" /> Back</button>;

  if (!insp) return <div>{back}<div className="card"><div className="empty-hint">No inspection recorded for {part} yet.</div></div></div>;

  const s = insp.summary;
  return (
    <div>
      {back}
      <div className="page-head"><div><h1>Inspection</h1><div className="page-sub">Lives under Closed Loop — not a separate top-level area. Rolled up from the tagged drawing.</div></div></div>
      <div className="card">
        <h2><Icon name="box" /> {part} — part_job {insp.job}</h2>
        <KpiStrip style={{ marginBottom: 16 }} items={[
          { n: `${s.pass}/${s.total}`, l: 'Within tolerance', cls: 'ok' },
          { n: s.near, l: 'Close to limit', cls: 'warn' },
          { n: s.fail, l: 'Out of tolerance', cls: 'err' },
          { n: insp.ncr ? 1 : 0, l: 'NCR raised' },
        ]} />
        <div className="dim-list">
          {insp.dims.map(d => (
            <div className="dim-row" key={d.b}>
              <div className={`dim-ball ${d.v}`}>{d.b}</div>
              <div className="dim-main"><b>{d.label}</b><span>Balloon {d.b}{d.v === 'fail' && insp.ncr ? ` · ${insp.ncr} raised` : ''}</span></div>
              <VerdictBadge v={d.v} />
            </div>
          ))}
        </div>
        {insp.dims.length < s.total && <div className="cell-sub" style={{ marginTop: 10 }}>Showing {insp.dims.length} of {s.total} dimensions.</div>}
        <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }}>Open full 3D inspection report</button>
      </div>
    </div>
  );
}
