import React, { useState } from 'react';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';
import { ORDER_STAGES, JOB_STATUS_LABEL } from '../fixtures';
import { estimateFor, approvedPlansByPart } from './scheduleModel';
import './capp/program.css';

// An order's status timeline (the Production Board's stages, then Delivered). Clicking a stage asks
// inline, then moves the part(s) there with the same setPartStatus the board's drag uses, so the
// board and the order stay in step. Delivered for the whole order goes through markDelivered, which
// also stamps the delivery date.
export default function StatusTimeline({ row: r, ordered, stage, delivered, stepDetail }) {
  const { rows, setPartStatus, markDelivered } = useProtoData();
  const [pending, setPending] = useState(null); // stage key being confirmed
  const [which, setWhich] = useState('all'); // 'all' or a part index (in r.parts)
  const [busy, setBusy] = useState(false);
  const targets = ordered.length ? ordered : r.parts;
  const currentKey = ORDER_STAGES[stage];

  // Parts that would go to Scheduling / Production with no plan and no cycle time (the same rule as
  // the board's drop). Reuses an approved plan from another order for the same part.
  const plans = approvedPlansByPart((rows || []).flatMap(x => x.parts.map(p => ({ partName: p.name, autoQuote: p.autoQuote, projectNo: x.orderId || x.id }))));
  const missingPlan = (s) => {
    if (s !== 'SCHEDULING' && s !== 'PRODUCTION') return [];
    const idxs = which === 'all' ? targets.map(p => r.parts.indexOf(p)) : [Number(which)];
    return idxs.map(i => r.parts[i]).filter(p => p && estimateFor({ partName: p.name, autoQuote: p.autoQuote, qty: p.qty }, plans).kind === 'none');
  };

  const open = (s) => { if (busy) return; setPending(p => (p === s ? null : s)); setWhich('all'); };
  const apply = async () => {
    const s = pending;
    setBusy(true);
    try {
      const idxs = which === 'all' ? targets.map(p => r.parts.indexOf(p)) : [Number(which)];
      if (s === 'DELIVERED' && which === 'all') await markDelivered(r, true);
      else await Promise.all(idxs.map(i => setPartStatus(r.id, i, s)));
      setPending(null);
    } catch (e) { /* shown in the banner */ } finally { setBusy(false); }
  };

  return (
    <div className="card" data-status-timeline>
      <h2>Status history</h2>
      <div className="timeline">
        <div className="tl-item"><div className="tl-t">Order placed</div><div className="tl-d">{fmtDate(r.orderDate)}</div></div>
        {ORDER_STAGES.map((s, i) => {
          const current = s === currentKey;
          const future = i > stage || (s === 'DELIVERED' && !delivered);
          return (
            <div key={s} className={`tl-item tl-click ${future ? 'future' : ''} ${current ? 'tl-current' : ''}`} data-stage={s}
              role="button" tabIndex={0} title={current ? 'Current stage' : `Move to ${JOB_STATUS_LABEL[s]}`}
              onClick={() => open(s)} onKeyDown={e => { if (e.key === 'Enter') open(s); }}>
              <div className="tl-t">{JOB_STATUS_LABEL[s]}{current && <span className="tl-now">Now</span>}</div>
              <div className="tl-d">{stepDetail(s, i)}</div>
              {pending === s && (
                <div className="tl-confirm" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} data-stage-confirm>
                  <div>
                    {current && targets.every(p => p.jobStatus === s) ? <>Already at <b>{JOB_STATUS_LABEL[s]}</b>.</> : <>Move {targets.length > 1 && which === 'all' ? 'every ordered part' : <b>{which === 'all' ? targets[0].name : r.parts[Number(which)].name}</b>} to <b>{JOB_STATUS_LABEL[s]}</b>? The Production Board updates too.</>}
                  </div>
                  {targets.length > 1 && (
                    <select value={which} onChange={e => setWhich(e.target.value)} aria-label="Which part">
                      <option value="all">All {targets.length} ordered parts</option>
                      {targets.map(p => <option key={p.uuid || p.name} value={r.parts.indexOf(p)}>{p.name} (now {JOB_STATUS_LABEL[p.jobStatus] || '—'})</option>)}
                    </select>
                  )}
                  {missingPlan(s).length > 0 && (
                    <div data-plan-gate style={{ background: 'var(--warn-bg)', color: 'var(--warn-ink)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, fontWeight: 600 }}>
                      {missingPlan(s).map(p => p.name).join(', ')} has no process plan or cycle time yet, so it gets no start and end date on the board. Generate and approve the plan first (the Process plan &amp; CAM program card on this page); approving moves it to Scheduling by itself.
                    </div>
                  )}
                  <div className="row">
                    <button type="button" className="btn-sm primary" disabled={busy} onClick={apply} data-stage-apply>{busy ? 'Saving…' : `${missingPlan(s).length > 0 ? 'Move anyway to' : 'Move to'} ${JOB_STATUS_LABEL[s]}`}</button>
                    <button type="button" className="btn-sm text" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="cell-sub" style={{ marginTop: 12 }}>{ordered.length > 1 ? 'Follows the piece furthest behind. ' : ''}Click a stage to move the part there.</div>
    </div>
  );
}
