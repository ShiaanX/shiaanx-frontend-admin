import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProtoData } from '../ProtoDataContext';
import { JOB_STATUSES, JOB_STATUS_LABEL } from '../fixtures';

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
export default function ProductionBoard() {
  const { rows, customers, setPartStatus } = useProtoData();
  const navigate = useNavigate();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [project, setProject] = useState('');

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

  const onDrop = (status) => {
    setOverCol(null);
    if (!dragId) return;
    const job = jobs.find(j => j.id === dragId);
    setDragId(null);
    if (!job || !job.draggable || job.status === status) return;
    setPartStatus(job.rowId, job.partIndex, status);
  };

  // Stops the click there, or the card would also open its order.
  const markDelivered = (e, job) => {
    e.stopPropagation();
    if (!window.confirm(`Mark ${job.partName} on ${job.projectNo} as delivered? It leaves the Production Board.`)) return;
    setPartStatus(job.rowId, job.partIndex, 'DELIVERED');
  };

  return (
    <div>
      <div className="page-head"><div><h1>Production Board</h1><div className="page-sub">Every ordered part in an order or a job being produced, by stage. A new order starts in the queue. Drag a card to change its stage. Once the customer has a part, mark it delivered (on its Dispatched card, or for the whole order on the order page) and it leaves the board.</div></div></div>
      <div className="toolbar">
        <select aria-label="Project" data-testid="board-project-filter" style={SELECT_STYLE} value={activeProject} onChange={e => setProject(e.target.value)}>
          <option value="">All projects ({allJobs.length} part{allJobs.length === 1 ? '' : 's'})</option>
          {projects.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      <div className="board">
        {JOB_STATUSES.map(status => {
          const col = jobs.filter(j => j.status === status);
          return (
            <div
              className={`board-col ${overCol === status ? 'drag-over' : ''}`}
              key={status}
              data-status={status}
              onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
              onDragLeave={() => setOverCol(c => (c === status ? null : c))}
              onDrop={(e) => { e.preventDefault(); onDrop(status); }}
            >
              <div className="board-col-head"><span>{JOB_STATUS_LABEL[status]}</span><span className="count">{col.length}</span></div>
              <div className="board-col-body">
                {col.length === 0 && <div className="empty-hint">{overCol === status ? 'Drop here' : 'Empty'}</div>}
                {col.map(j => (
                  <div
                    className={`job-card ${j.draggable ? 'draggable' : ''} ${dragId === j.id ? 'dragging' : ''}`}
                    key={j.id}
                    draggable={j.draggable}
                    title={`Open ${j.projectNo}`}
                    onDragStart={() => setDragId(j.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onClick={() => !dragId && j.to && navigate(j.to)}
                  >
                    <div className="jn">{j.partName}</div>
                    <div className="jm mono" data-testid="card-project">{j.projectNo}</div>
                    <div className="jm" data-testid="card-company" title={j.contact}>{j.company}</div>
                    <div className="jt"><span className={`tag ${j.tag}`}>{j.tag === 'inhouse' ? 'In-house' : 'Partner'}</span><span className="tag">{j.tl}</span></div>
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
