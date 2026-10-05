import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { StatusBadge } from '../components/Badges';
import ClosedLoopCard from '../components/ClosedLoopCard';
import ArtifactChecklist from '../components/ArtifactChecklist';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';
import { JOB_STATUSES } from '../fixtures';

const STAGE_LABEL = { PLANNED: 'Plan approved', SCHEDULED: 'Scheduled', MACHINING: 'Machining', QC: 'QC', DISPATCHED: 'Dispatched' };

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { findOrder } = useProtoData();
  const r = findOrder(orderId);
  if (!r) return <div className="empty-hint">Order not found.</div>;
  // Same statuses as the Production Board; an order sits at the stage of its least-advanced piece.
  const stage = Math.min(...r.parts.map(p => JOB_STATUSES.indexOf(p.jobStatus)));

  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate('/proto')}><Icon name="back" /> Back to Enquiries &amp; Orders</button>
      <div className="detail-head">
        <div className="detail-title"><h1>{r.orderId}</h1><StatusBadge status={r.status} /></div>
        <div className="head-actions"><button type="button" className="btn btn-ghost"><Icon name="doc" /> Build traceability pack</button></div>
      </div>
      <div className="grid2">
        <div>
          <div className="card">
            <h2><Icon name="info" /> Enquiry-level details</h2>
            <dl className="kv">
              <dt>Customer</dt><dd>{r.customer}</dd>
              <dt>From enquiry</dt><dd className="mono">{r.id}</dd>
              <dt>Ordered</dt><dd>{fmtDate(r.orderDate)}</dd>
              <dt>Deadline</dt><dd>{fmtDate(r.deadline)}</dd>
            </dl>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field"><label>Final PO value</label><input defaultValue={r.poValue || ''} placeholder="₹ e.g. 84,500" /></div>
              <div className="field"><label>Remarks</label><textarea defaultValue={r.remarks || ''} placeholder="Notes about this order…" /></div>
            </div>
          </div>
          <ClosedLoopCard parts={r.parts} />
          <ArtifactChecklist jobId={r.orderId} hasOrder />
        </div>
        <div>
          <div className="card">
            <h2>Status history</h2>
            <div className="timeline">
              <div className="tl-item"><div className="tl-t">Order placed</div><div className="tl-d">{fmtDate(r.orderDate)}</div></div>
              {JOB_STATUSES.map((s, i) => (
                <div key={s} className={`tl-item ${i > stage ? 'future' : ''}`}>
                  <div className="tl-t">{STAGE_LABEL[s]}</div>
                  <div className="tl-d">{i > stage ? 'Pending' : i < stage || s === 'DISPATCHED' ? 'Done' : 'In progress'}</div>
                </div>
              ))}
            </div>
            {r.parts.length > 1 && <div className="cell-sub" style={{ marginTop: 12 }}>Follows the piece furthest behind.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
