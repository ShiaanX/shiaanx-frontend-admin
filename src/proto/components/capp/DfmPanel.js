import React, { useRef } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiXOctagon } from 'react-icons/fi';
import { getDfm } from '../../cappApi';
import { useCappResource, ResourceState, fmtNum, show } from './CappCommon';
import DfmViewer from './DfmViewer';
import './dfmViewer.css';

const RANK = { ok: 0, warn: 1, block: 2 };
const VERDICT_ICON = { ok: FiCheckCircle, warn: FiAlertTriangle, block: FiXOctagon };
const VERDICT_TITLE = {
  ok: 'Manufacturable as designed',
  warn: 'Manufacturable — review the warnings',
  block: 'Not manufacturable without a design change',
};

// Blocker / warning counts: the service's summary.counts when present, else counted from findings.
function countsOf(d) {
  const c = d.summary && typeof d.summary === 'object' && d.summary.counts;
  if (c && (Number.isFinite(c.block) || Number.isFinite(c.warn))) return { block: Number(c.block) || 0, warn: Number(c.warn) || 0 };
  const f = d.findings || [];
  return { block: f.filter(x => x.severity === 'block').length, warn: f.filter(x => x.severity === 'warn').length };
}

// Design-for-manufacturing check from the v3 planner: GET /jobs/{id}/dfm, shown as a 3D model with its
// faces coloured by issue category (DfmViewer) under a one-line verdict.
export default function DfmPanel({ jobId, refreshKey }) {
  // Retry after a failed v3 run asks the service to re-run it (?retry=true), once.
  const retryNext = useRef(false);
  const res = useCappResource(() => {
    const retry = retryNext.current;
    retryNext.current = false;
    return getDfm(jobId, { retry });
  }, `${jobId}|${refreshKey || ''}`);
  const d = res.data;
  if (!d) {
    return (
      <div className="cx">
        <ResourceState res={res} runningText="v3 planner analysing the part…" onRetry={() => { retryNext.current = true; res.reload(); }} />
      </div>
    );
  }

  const counts = countsOf(d);
  const worstFinding = (d.findings || []).reduce((w, f) => ((RANK[f.severity] || 0) > RANK[w] ? f.severity : w), 'ok');
  const worst = counts.block > 0 ? 'block' : counts.warn > 0 ? 'warn' : worstFinding;
  const Icon = VERDICT_ICON[worst] || FiCheckCircle;
  const verdictText = (d.summary && typeof d.summary === 'object' && d.summary.verdict) || VERDICT_TITLE[worst] || VERDICT_TITLE.ok;
  const summaryText = d.summary && typeof d.summary === 'object' ? d.summary.text : d.summary;

  return (
    <div className="cx" data-capp-dfm>
      <div className={`dv-verdict ${worst}`} title={summaryText || undefined}>
        <span className="t"><Icon size={17} /> {verdictText}</span>
        <span className="chips">
          <span className={`chip ${counts.block ? 'err' : ''}`}><b>{counts.block}</b> blocker{counts.block === 1 ? '' : 's'}</span>
          <span className={`chip ${counts.warn ? 'warn' : ''}`}><b>{counts.warn}</b> warning{counts.warn === 1 ? '' : 's'}</span>
          <span className="chip"><b>{show(d.setups_needed)}</b> setup{Number(d.setups_needed) === 1 ? '' : 's'}</span>
          {d.source && <span className="chip">{d.source} planner</span>}
        </span>
      </div>

      <DfmViewer jobId={jobId} dfm={d} />

      {((d.directions || []).length > 0 || (d.holes || []).length > 0) && (
        <details className="dv-more">
          <summary>Planner details: machining directions{(d.holes || []).length ? ` and ${d.holes.length} holes` : ''}</summary>
          {(d.directions || []).length > 0 && (
            <div className="cx-tbl" style={{ marginTop: 8 }}>
              <table className="data">
                <thead><tr><th>Direction</th><th>Workplane</th><th>Machinable mm³</th><th>Clamp area mm²</th><th>Best tool</th><th>Setup</th></tr></thead>
                <tbody>
                  {d.directions.map((r, i) => (
                    <tr key={i} className={r.recommended ? 'rec' : ''}>
                      <td className="mono" style={{ fontWeight: 700 }}>{show(r.dir)}</td>
                      <td>{show(r.workplane)}</td>
                      <td className="mono">{fmtNum(r.machinable_mm3, 0)}</td>
                      <td className="mono">{fmtNum(r.clamp_area_mm2, 0)}</td>
                      <td className="mono">{show(r.best_tool)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.setup_order ? <b>#{r.setup_order}</b> : <span style={{ color: 'var(--muted)' }}>—</span>}
                        {r.recommended && <span className="badge b-ordered" style={{ marginLeft: 6 }}>Recommended</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(d.holes || []).length > 0 && (
            <div className="cx-tbl" style={{ maxHeight: 260, marginTop: 8 }}>
              <table className="data">
                <thead><tr><th>Ø mm</th><th>Depth mm</th><th>Direction</th><th>Drill</th></tr></thead>
                <tbody>
                  {d.holes.map((h, i) => (
                    <tr key={i}><td className="mono">{fmtNum(h.dia_mm, 2)}</td><td className="mono">{fmtNum(h.depth_mm, 2)}</td><td className="mono">{show(h.dir)}</td><td>{show(h.drill)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
