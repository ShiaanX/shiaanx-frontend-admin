import React from 'react';
import KpiStrip from '../KpiStrip';
import { getTracking } from '../../cappApi';
import { useCappResource, ResourceState, fmtNum, show } from './CappCommon';
import ProductionHistory from './ProductionHistory';
import './program.css';

const pv = (o, k) => (o && o[k] !== undefined && o[k] !== null ? fmtNum(o[k], 1) : '—');

function DevChip({ dv }) {
  const pct = Number(dv.pct);
  const cls = Math.abs(pct) >= 15 ? 'err' : 'warn';
  return (
    <span className={`cx-chip ${cls}`}>
      {String(dv.field).replace(/_/g, ' ')} {Number.isNaN(pct) ? show(dv.pct) : `${pct > 0 ? '+' : ''}${fmtNum(pct, 1)}%`}
    </span>
  );
}

// The shop program vs the AI plan vs what the machine did (GET /jobs/{id}/tracking), and the part's
// previous production batches (GET /jobs/{id}/production-history).
function Tracking({ jobId, refreshKey }) {
  const res = useCappResource(() => getTracking(jobId), `${jobId}|${refreshKey || ''}`);
  const d = res.data;
  if (!d) return <ResourceState res={res} runningText="Comparing the program with what the machine did…" />;
  if (d.available === false) {
    return <div className="stub-note" style={{ marginBottom: 0 }}><div><b>No tracking data for this job yet.</b><div style={{ marginTop: 4 }}>{show(d.reason)}</div></div></div>;
  }
  const s = d.summary || {};
  // No telemetry linked: the ops are the program only, never deviations.
  const noMachine = d.actual_available === false || Number(s.ops_with_actual) === 0;
  const ops = d.ops || [];
  return (
    <div data-capp-tracking>
      <KpiStrip items={[
        { n: `${fmtNum(s.planned_minutes, 1)} min`, l: 'Shop program (as run)' },
        ...(s.v3_plan_minutes !== undefined && s.v3_plan_minutes !== null ? [{ n: `${fmtNum(s.v3_plan_minutes, 1)} min`, l: 'AI plan (v3)' }] : []),
        { n: show(s.ops), l: 'Operations' },
        ...(noMachine ? [] : [
          { n: `${fmtNum(s.actual_minutes, 1)} min`, l: 'Actual (machine)', cls: Number(s.actual_minutes) > Number(s.planned_minutes) ? 'warn' : undefined },
          { n: show(s.flagged), l: 'Flagged', cls: Number(s.flagged) > 0 ? 'err' : 'ok' },
        ]),
      ]} />
      {ops.length > 0 && (
        <details className="ph-det">
          <summary>Shop program — {ops.length} operations{noMachine ? '' : ' · program → machine'}</summary>
          {!noMachine && d.thresholds_pct && <div className="cx-sub" style={{ marginBottom: 6 }}>Flag above {Object.entries(d.thresholds_pct).map(([k, v]) => `${k.replace(/_/g, ' ')} ±${v}%`).join(' · ')}</div>}
          <div className="cx-tbl" style={{ maxHeight: 420 }}>
            <table className="data">
              <thead><tr><th>Operation</th><th>RPM</th><th>Feed mm/min</th><th>Minutes</th></tr></thead>
              <tbody>
                {ops.map((o, i) => (
                  <React.Fragment key={i}>
                    <tr className={o.flagged ? 'flag' : ''}>
                      <td><div style={{ fontWeight: 700 }}>{show(o.op)}</div><div className="cell-sub">{show(o.tool)}</div></td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{pv(o.planned, 'rpm')}{o.actual ? ` → ${pv(o.actual, 'rpm')}` : ''}</td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{pv(o.planned, 'feed_mm_min')}{o.actual ? ` → ${pv(o.actual, 'feed_mm_min')}` : ''}</td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{pv(o.planned, 'minutes')}{o.actual ? ` → ${pv(o.actual, 'minutes')}` : ''}</td>
                    </tr>
                    {((o.deviations || []).length > 0 || (o.note && o.actual)) && (
                      <tr className={o.flagged ? 'flag' : ''}>
                        <td colSpan={4} style={{ paddingTop: 0 }}>
                          {(o.deviations || []).map((dv, j) => <DevChip key={j} dv={dv} />)}
                          {o.note && <span className="cell-sub" style={{ display: 'inline', marginLeft: 4 }}>{o.note}</span>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {noMachine && d.source && d.source.planned && <div className="cell-sub" style={{ marginTop: 8 }}>Shop program minutes are worked out from the NC programs sent to the machine; this machine has no telemetry link, so there are no per-operation actuals.</div>}
    </div>
  );
}

export default function TrackingPanel({ jobId, refreshKey }) {
  return (
    <div className="cx">
      <Tracking jobId={jobId} refreshKey={refreshKey} />
      <div className="cx-sec" style={{ marginTop: 22 }}>Previous production of this part</div>
      <ProductionHistory jobId={jobId} />
    </div>
  );
}
