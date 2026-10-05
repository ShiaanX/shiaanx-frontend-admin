import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProtoData } from '../ProtoDataContext';
import { JOB_STATUSES, PARTNER_JOBS } from '../fixtures';

// Columns are JOB_STATUSES, the same vocabulary as an order's status timeline, and the cards are
// derived from the same rows as the list, so the two cannot drift apart.
export default function ProductionBoard() {
  const { rows } = useProtoData();
  const navigate = useNavigate();

  const jobs = [];
  rows.forEach(r => r.parts.forEach(p => {
    if (!p.jobStatus) return;
    jobs.push({ n: `${p.name} #1`, m: r.customer, tag: 'inhouse', tl: p.machine || '—', status: p.jobStatus,
      to: r.isOrder ? `/proto/orders/${r.orderId}` : `/proto/enquiries/${r.id}` });
  }));
  PARTNER_JOBS.forEach(j => jobs.push(j));

  return (
    <div>
      <div className="page-head"><div><h1>Production Board</h1><div className="page-sub">Every physical piece, by status. Each card is one part_job. Same five statuses as an order's timeline.</div></div></div>
      <div className="board">
        {JOB_STATUSES.map(status => {
          const col = jobs.filter(j => j.status === status);
          return (
            <div className="board-col" key={status}>
              <div className="board-col-head"><span>{status}</span><span className="count">{col.length}</span></div>
              <div className="board-col-body">
                {col.length === 0 && <div className="empty-hint">Empty</div>}
                {col.map(j => (
                  <div className="job-card" key={j.n + j.m} onClick={() => j.to && navigate(j.to)}>
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
