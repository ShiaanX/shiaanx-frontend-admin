import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProtoData } from '../ProtoDataContext';
import { JOB_STATUSES, JOB_STATUS_LABEL } from '../fixtures';

// Columns are JOB_STATUSES, the same vocabulary as an order's status timeline. In-house cards are
// derived from the same rows as the list (so the two cannot drift apart) and can be dragged between
// columns — the drop updates that part's jobStatus everywhere it's shown, via
// ProtoDataContext.setPartStatus. Partner-shop cards aren't backed by a row yet, so they're
// view-only for now.
export default function ProductionBoard() {
  const { rows, setPartStatus } = useProtoData();
  const navigate = useNavigate();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const jobs = [];
  rows.forEach(r => r.parts.forEach((p, idx) => {
    if (!p.jobStatus) return;
    jobs.push({
      id: `${r.id}:${idx}`, rowId: r.id, partIndex: idx, draggable: true,
      n: `${p.name} #1`, m: r.customer, tag: 'inhouse', tl: p.machine || '—', status: p.jobStatus,
      to: r.isOrder ? `/proto/orders/${r.uuid}` : `/proto/enquiries/${r.uuid}`,
    });
  }));

  const onDrop = (status) => {
    setOverCol(null);
    if (!dragId) return;
    const job = jobs.find(j => j.id === dragId);
    setDragId(null);
    if (!job || !job.draggable || job.status === status) return;
    setPartStatus(job.rowId, job.partIndex, status);
  };

  return (
    <div>
      <div className="page-head"><div><h1>Production Board</h1><div className="page-sub">Every part in an order or a job being produced, by stage. A new order starts in the queue. Drag a card to change its stage.</div></div></div>
      <div className="board">
        {JOB_STATUSES.map(status => {
          const col = jobs.filter(j => j.status === status);
          return (
            <div
              className={`board-col ${overCol === status ? 'drag-over' : ''}`}
              key={status}
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
                    onDragStart={() => setDragId(j.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onClick={() => !dragId && j.to && navigate(j.to)}
                  >
                    <div className="jn">{j.n}</div>
                    <div className="jm">{j.m}</div>
                    <div className="jt"><span className={`tag ${j.tag}`}>{j.tag === 'inhouse' ? 'In-house' : 'Partner'}</span><span className="tag">{j.tl}</span></div>
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
