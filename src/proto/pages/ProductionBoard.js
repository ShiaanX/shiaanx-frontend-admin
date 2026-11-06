import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProtoData } from '../ProtoDataContext';
import { JOB_STATUSES, JOB_STATUS_LABEL } from '../fixtures';
import { EstimateSource } from '../components/SchedulePanel';
import { estimateFor, approvedPlansByPart, machineMinutes, fmtHours, buildSchedule, queueRankOf, fmtDay, fmtWhen, MACHINE_SLOTS, MACHINE_NAME } from '../components/scheduleModel';

const SELECT_STYLE = { border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--ink)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5 };

// Columns are JOB_STATUSES, the same vocabulary as an order's status timeline. In-house cards are
// derived from the same rows as the list (so the two cannot drift apart) and can be dragged between
// columns — the drop updates that part's jobStatus everywhere it's shown, via
// ProtoDataContext.setPartStatus. Delivered is past the last column: a part the customer has
// received leaves the board, marked from its Dispatched card or for the whole order on the order page.
//
// Only parts being made are on the board: parts of an order or of a job produced without one
// (TRIAL), and of those only the parts that were ordered (a partial convert marks the rest
// ordered === false). A reverted or plain enquiry's parts can still carry an old stage, so the row
// itself decides, not the part's stage.
//
// Clicking a card highlights it (?focus=<part uuid>, or a part name such as ?focus=motor-mount). The
// schedule panel (components/SchedulePanel.js) is no longer shown here; the dates are on the cards.
//
// Cards in the Scheduled column can be reordered, by dragging one onto another or with the arrow
// buttons. The order is saved as a numeric queueRank per part (ProtoDataContext.saveQueueRank) and
// buildSchedule sorts by it, so the dates on every card follow.
// The two machine columns are named for the machine; the stage vocabulary underneath is unchanged.
const COLUMN_LABEL = { SCHEDULING: 'Scheduled' };
const COLUMN_SUB = { PRODUCTION: `on ${MACHINE_NAME}`, SCHEDULING: `for ${MACHINE_NAME}` };
const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function ProductionBoard() {
  const { rows, customers, setPartStatus, saveQueueRank } = useProtoData();
  const navigate = useNavigate();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [project, setProject] = useState('');
  const [gate, setGate] = useState(null); // { job, status }: a drop waiting on "no plan yet"
  const [search, setSearch] = useSearchParams();
  const focusKey = search.get('focus') || '';

  const companyOf = (r) => { const c = (customers || []).find(x => x.id === r.customerId); return (c && c.company) || r.customer; };

  const allJobs = [];
  rows.forEach(r => {
    if (!(r.isOrder || r.jobType === 'TRIAL')) return;
    const projectNo = r.orderId || r.id;
    r.parts.forEach((p, idx) => {
      if (p.ordered === false || !p.jobStatus || p.jobStatus === 'DELIVERED') return;
      allJobs.push({
        id: `${r.id}:${idx}`, rowId: r.id, partIndex: idx, draggable: true,
        partName: p.name, projectNo, projectKey: r.uuid, company: companyOf(r), contact: r.customer,
        tag: 'inhouse', tl: p.machine || '—', status: p.jobStatus,
        partUuid: p.uuid, qty: p.qty, autoQuote: p.autoQuote, deadline: r.deadline, orderDate: r.orderDate || r.date,
        to: r.isOrder ? `/proto/orders/${r.uuid}` : `/proto/enquiries/${r.uuid}`,
      });
    });
  });

  // Every project that has a card, for the filter; a chosen project that has since left the board
  // falls back to showing everything.
  const projects = useMemo(() => {
    const m = new Map();
    allJobs.forEach(j => { if (!m.has(j.projectKey)) m.set(j.projectKey, `${j.projectNo} · ${j.company || ''}`.replace(/ · $/, '')); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, customers]);
  const activeProject = projects.some(([k]) => k === project) ? project : '';
  const jobs = activeProject ? allJobs.filter(j => j.projectKey === activeProject) : allJobs;
  // The schedule always uses every job on the board (the filter only changes what is shown).
  // Start and end for every job on the one machine, from the same schedule the panel uses.
  const plans = approvedPlansByPart(allJobs);
  const slotById = new Map(buildSchedule(allJobs).map(s => [s.job.id, s]));
  const focus = focusKey ? (allJobs.find(j => j.partUuid === focusKey || j.id === focusKey) || allJobs.find(j => slug(j.partName) === slug(focusKey))) : null;
  const setFocus = (j) => setSearch(prev => { const n = new URLSearchParams(prev); if (j) n.set('focus', j.partUuid || j.id); else n.delete('focus'); return n; });

  // Scheduled column in machine order (every project, whatever the filter shows). Reordering puts a
  // job at another job's place and renumbers the column 1..n; only ranks that changed are saved.
  const scheduledAll = allJobs.filter(j => j.status === 'SCHEDULING')
    .sort((a, b) => ((slotById.get(a.id) || {}).position || 0) - ((slotById.get(b.id) || {}).position || 0));
  const reorderTo = (job, target) => {
    if (!job || !target || job.id === target.id || job.status !== 'SCHEDULING' || target.status !== 'SCHEDULING') return;
    const ids = scheduledAll.map(j => j.id);
    ids.splice(ids.indexOf(job.id), 1);
    ids.splice(ids.indexOf(target.id) + (scheduledAll.findIndex(j => j.id === job.id) < scheduledAll.findIndex(j => j.id === target.id) ? 1 : 0), 0, job.id);
    Promise.all(ids.map((id, i) => {
      const j = scheduledAll.find(x => x.id === id);
      return queueRankOf(j) === i + 1 ? null : saveQueueRank(j.rowId, j.partIndex, i + 1);
    })).catch(() => {});
  };
  const onCardDrop = (e, target) => {
    const job = allJobs.find(j => j.id === dragId);
    if (!job || job.status !== 'SCHEDULING' || target.status !== 'SCHEDULING') return; // let the column handle a stage change
    e.preventDefault(); e.stopPropagation();
    setOverCol(null); setDragId(null);
    reorderTo(job, target);
  };

  const onDrop = (status) => {
    setOverCol(null);
    if (!dragId) return;
    const job = jobs.find(j => j.id === dragId);
    setDragId(null);
    if (!job || !job.draggable || job.status === status) return;
    // Scheduling and Production come after process planning, so a part with no plan and no cycle
    // time cannot be given dates. Ask first; "Move anyway" stays available for the team.
    if ((status === 'SCHEDULING' || status === 'PRODUCTION') && estimateFor(job, plans).kind === 'none') { setGate({ job, status }); return; }
    setPartStatus(job.rowId, job.partIndex, status);
  };

  // Stops the click there, or the card would also be selected.
  const markDelivered = (e, job) => {
    e.stopPropagation();
    if (!window.confirm(`Mark ${job.partName} on ${job.projectNo} as delivered? It leaves the Production Board.`)) return;
    setPartStatus(job.rowId, job.partIndex, 'DELIVERED');
  };

  return (
    <div>
      <div className="page-head"><div><h1>Production Board</h1><div className="page-sub">Every ordered part in an order or a job being produced, by stage. A new order starts in the queue. Each card shows when it is expected to start and finish on the machine; its “Open” link goes to the order. Drag a card to change its stage, and reorder the Scheduled column by dragging or with the arrows. Once the customer has a part, mark it delivered (on its Dispatched card, or for the whole order on the order page) and it leaves the board.</div></div></div>
      <div className="toolbar">
        <select aria-label="Project" data-testid="board-project-filter" style={SELECT_STYLE} value={activeProject} onChange={e => setProject(e.target.value)}>
          <option value="">All projects ({allJobs.length} part{allJobs.length === 1 ? '' : 's'})</option>
          {projects.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      {gate && (
        <div className="card" data-testid="plan-gate" style={{ borderLeft: '4px solid var(--warn)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{gate.job.partName} ({gate.job.projectNo}) has no process plan yet</div>
          <div className="cell-sub" style={{ marginBottom: 10 }}>
            It has no approved plan and no cycle time, so the board cannot give it a start and end date. Generate and approve its plan first; it then moves to Scheduling by itself.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {gate.job.to && <button type="button" className="btn px-btn-primary" onClick={() => navigate(gate.job.to)}>Open {gate.job.projectNo} to generate the plan</button>}
            <button type="button" className="btn-sm ghost" onClick={() => { setPartStatus(gate.job.rowId, gate.job.partIndex, gate.status); setGate(null); }}>Move to {JOB_STATUS_LABEL[gate.status]} anyway</button>
            <button type="button" className="btn-sm text" onClick={() => setGate(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="board">
        {JOB_STATUSES.map(status => {
          const col = status === 'SCHEDULING' ? scheduledAll.filter(j => jobs.includes(j)) : jobs.filter(j => j.status === status);
          const cap = MACHINE_SLOTS[status];
          const over = cap !== undefined && col.length > cap;
          return (
            <div
              className={`board-col ${overCol === status ? 'drag-over' : ''}`}
              key={status}
              data-status={status}
              onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
              onDragLeave={() => setOverCol(c => (c === status ? null : c))}
              onDrop={(e) => { e.preventDefault(); onDrop(status); }}
            >
              <div className="board-col-head">
                <span>{COLUMN_LABEL[status] || JOB_STATUS_LABEL[status]}{COLUMN_SUB[status] && <span style={{ display: 'block', fontWeight: 500, fontSize: 11, color: 'var(--muted)' }}>{COLUMN_SUB[status]}</span>}</span>
                <span className="count" data-testid="col-count" title={cap !== undefined ? `${MACHINE_NAME} takes ${cap} here${over ? ' - over capacity' : ''}` : undefined}
                  style={over ? { background: 'var(--warn-bg)', color: 'var(--warn-ink)' } : undefined}>{cap !== undefined ? `${col.length} / ${cap}` : col.length}</span>
              </div>
              <div className="board-col-body">
                {col.length === 0 && <div className="empty-hint">{overCol === status ? 'Drop here' : 'Empty'}</div>}
                {col.map((j, ci) => (
                  <div
                    className={`job-card ${j.draggable ? 'draggable' : ''} ${dragId === j.id ? 'dragging' : ''}`}
                    key={j.id}
                    draggable={j.draggable}
                    title={`Show where ${j.partName} slots in`}
                    data-focused={focus && focus.id === j.id ? 'true' : undefined}
                    style={focus && focus.id === j.id ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 2px var(--primary-light)' } : undefined}
                    onDragStart={() => setDragId(j.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onDrop={(e) => onCardDrop(e, j)}
                    onClick={() => !dragId && setFocus(focus && focus.id === j.id ? null : j)}
                  >
                    <div className="jn">{j.partName}</div>
                    <div className="jm mono" data-testid="card-project">{j.projectNo}</div>
                    <div className="jm" data-testid="card-company" title={j.contact}>{j.company}</div>
                    <div className="jt"><span className={`tag ${j.tag}`}>{j.tag === 'inhouse' ? 'In-house' : 'Partner'}</span><span className="tag">{j.tl}</span></div>
                    {(() => { const est = estimateFor(j, plans); const m = machineMinutes(j, est); return (
                      <div className="jm" data-testid="card-estimate" style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <EstimateSource est={est} />{m !== null && <span className="mono">{fmtHours(m)}</span>}
                      </div>
                    ); })()}
                    {(() => {
                      const s = slotById.get(j.id);
                      if (!s) return null;
                      const committed = j.status === 'PRODUCTION' || j.status === 'SCHEDULING';
                      if (!s.finish) return committed ? <div className="jm" data-testid="card-dates" style={{ marginTop: 5 }}>Start / end: needs an estimate</div> : null;
                      const dl = j.deadline ? new Date(`${j.deadline}T23:59:59`) : null;
                      const late = dl && s.finish > dl;
                      return (
                        <div className="jm" data-testid="card-dates" title={`${fmtWhen(s.start)} → ${fmtWhen(s.finish)}`}
                          style={{ marginTop: 5, color: late ? 'var(--error-ink)' : undefined, opacity: committed ? 1 : 0.75 }}>
                          {committed ? 'Start' : 'Earliest start'} <b>{fmtDay(s.start)}</b> → End <b>{fmtDay(s.finish)}</b>{late ? ' · after deadline' : ''}
                        </div>
                      );
                    })()}
                    {j.to && (
                      <button type="button" className="btn-text" style={{ marginTop: 6, fontSize: 11.5 }} data-testid="card-open"
                        onClick={(e) => { e.stopPropagation(); navigate(j.to); }}>Open {j.projectNo} →</button>
                    )}
                    {j.status === 'SCHEDULING' && col.length > 1 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }} data-testid="card-reorder">
                        <button type="button" className="btn-sm ghost" aria-label={`Move ${j.partName} up`} title="Earlier on the machine" disabled={ci === 0}
                          onClick={(e) => { e.stopPropagation(); reorderTo(j, col[ci - 1]); }}>↑</button>
                        <button type="button" className="btn-sm ghost" aria-label={`Move ${j.partName} down`} title="Later on the machine" disabled={ci === col.length - 1}
                          onClick={(e) => { e.stopPropagation(); reorderTo(j, col[ci + 1]); }}>↓</button>
                      </div>
                    )}
                    {j.status === 'DISPATCHED' && (
                      <button type="button" className="btn-sm ghost" style={{ marginTop: 8 }} onClick={(e) => markDelivered(e, j)}>Mark delivered</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
