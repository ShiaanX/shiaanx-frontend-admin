import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { StatusBadge } from '../components/Badges';
import ClosedLoopCard from '../components/ClosedLoopCard';
import ArtifactChecklist from '../components/ArtifactChecklist';
import DocumentsReceived from '../components/DocumentsReceived';
import UpdateEnquiryModal from '../components/UpdateEnquiryModal';
import PartPickerModal from '../components/PartPickerModal';
import ProcessChips, { NotOrderedBadge, isOrdered } from '../components/ProcessChips';
import RepeatLinks from '../components/RepeatLinks';
import ComplaintsCard from '../components/ComplaintsCard';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';
import { ORDER_STAGES, JOB_STATUS_LABEL } from '../fixtures';


export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { findOrder, revertToEnquiry, patchEnquiry, markDelivered, addPartsToOrder, repeatEnquiry } = useProtoData();
  const r = findOrder(orderId);
  const [showUpdate, setShowUpdate] = useState(false);
  const [picker, setPicker] = useState(null); // 'add' | 'repeat'
  if (!r) return <div className="empty-hint">Order not found.</div>;
  // Parts left out when the enquiry was converted stay on the job but are not being made, so the
  // stage, the delivery check and the production cards only look at the ordered ones.
  const ordered = r.parts.filter(isOrdered);
  const notOrdered = r.parts.filter(p => !isOrdered(p));
  const revert = () => {
    if (!window.confirm(`Turn ${r.orderId} back into enquiry ${r.id}? Nothing uploaded is deleted, and converting again later brings this order back.`)) return;
    revertToEnquiry(r).then(id => navigate(`/proto/enquiries/${id}`)).catch(() => {});
  };
  // The Production Board's statuses plus Delivered; an order sits at the stage of its least-advanced
  // piece. Delivered is the server's call (r.status), made when every piece has been delivered.
  const delivered = r.status === 'DELIVERED';
  const stage = delivered ? ORDER_STAGES.length - 1 : Math.min(...(ordered.length ? ordered : r.parts).map(p => ORDER_STAGES.indexOf(p.jobStatus)));
  const stepDetail = (s, i) => {
    if (s === 'DELIVERED') return delivered ? (r.deliveredDate ? `Delivered · ${fmtDate(r.deliveredDate)}` : 'Done') : 'Pending';
    if (i > stage) return 'Pending';
    return i < stage || delivered || s === 'DISPATCHED' ? 'Done' : 'In progress';
  };
  // Every piece has left the shop, so the customer can be recorded as having the order.
  const allShipped = ordered.length > 0 && ordered.every(p => p.jobStatus === 'DISPATCHED' || p.jobStatus === 'DELIVERED');
  const setDelivered = (on) => {
    const msg = on
      ? `Mark ${r.orderId} as delivered? Every part leaves the Production Board and today is recorded as the delivery date.`
      : `Undo delivery of ${r.orderId}? Its parts go back to Dispatched on the Production Board and the delivery date is cleared.`;
    if (!window.confirm(msg)) return;
    markDelivered(r, on).catch(() => {});
  };

  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate('/proto')}><Icon name="back" /> Back to Enquiries &amp; Orders</button>
      <div className="detail-head">
        <div>
          <div className="detail-title"><h1>{r.orderId}</h1><StatusBadge status={r.status} /></div>
          {r.assemblyName && <div className="page-sub" style={{ marginTop: 2 }}>{r.assemblyName}</div>}
          <RepeatLinks row={r} />
        </div>
        <div className="head-actions">
          {allShipped && !delivered && (
            <button type="button" className="btn px-btn-primary" onClick={() => setDelivered(true)}><Icon name="quality" size={14} /> Mark as delivered</button>
          )}
          {delivered && <button type="button" className="btn btn-ghost" onClick={() => setDelivered(false)}><Icon name="back" size={14} /> Undo delivered</button>}
          {notOrdered.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setPicker('add')} data-add-parts><Icon name="plus" size={14} /> Add parts to order</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => setShowUpdate(true)}><Icon name="upload" size={14} /> Update</button>
          <button type="button" className="btn btn-ghost" onClick={() => setPicker('repeat')} data-repeat-order><Icon name="knowledge" size={14} /> Repeat order</button>
          <button type="button" className="btn btn-ghost" onClick={revert}><Icon name="back" size={14} /> Revert to enquiry</button>
          <button type="button" className="btn btn-ghost"><Icon name="doc" /> Build traceability pack</button>
        </div>
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
              <div className="field"><label>Final PO value</label><input key={`po-${r.poValue}`} defaultValue={r.poValue || ''} placeholder="₹ e.g. 84,500"
                onBlur={e => { if (e.target.value !== (r.poValue || '')) patchEnquiry(r, { poValue: e.target.value }).catch(() => {}); }} /></div>
              <div className="field"><label>Remarks</label><textarea key={`rm-${r.remarks}`} defaultValue={r.remarks || ''} placeholder="Notes about this order…"
                onBlur={e => { if (e.target.value !== (r.remarks || '')) patchEnquiry(r, { remarks: e.target.value }).catch(() => {}); }} /></div>
            </div>
          </div>
          <ClosedLoopCard parts={r.parts} />
          {notOrdered.length > 0 && (
            <div className="card" data-not-ordered-card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}><Icon name="box" /> Parts not ordered</h2>
                <button type="button" className="btn-sm ghost" onClick={() => setPicker('add')}>Add to order</button>
              </div>
              <p className="page-sub" style={{ margin: '0 0 12px' }}>Quoted on this enquiry but not confirmed by the customer. They are not on the Production Board.</p>
              {notOrdered.map(p => (
                <div className="part-row" key={p.uuid || p.name} data-not-ordered-part={p.name}>
                  <div className="part-row-head"><span className="name">{p.name}</span><NotOrderedBadge part={p} /></div>
                  <ProcessChips processes={p.processes} style={{ marginBottom: 10 }} />
                  <div className="mini-grid">
                    <div><span className="ml">Material</span><span className="mv">{p.material}</span></div>
                    <div><span className="ml">Quantity</span><span className="mv">{p.qty}</span></div>
                    <div><span className="ml">Finish</span><span className="mv">{p.finish}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <ArtifactChecklist jobId={r.orderId} row={r} hasOrder />
          <ComplaintsCard row={r} />
        </div>
        <div>
          <DocumentsReceived row={r} />
          <div className="card">
            <h2>Status history</h2>
            <div className="timeline">
              <div className="tl-item"><div className="tl-t">Order placed</div><div className="tl-d">{fmtDate(r.orderDate)}</div></div>
              {ORDER_STAGES.map((s, i) => (
                <div key={s} className={`tl-item ${i > stage || (s === 'DELIVERED' && !delivered) ? 'future' : ''}`}>
                  <div className="tl-t">{JOB_STATUS_LABEL[s]}</div>
                  <div className="tl-d">{stepDetail(s, i)}</div>
                </div>
              ))}
            </div>
            {ordered.length > 1 && <div className="cell-sub" style={{ marginTop: 12 }}>Follows the piece furthest behind.</div>}
          </div>
        </div>
      </div>
      {showUpdate && <UpdateEnquiryModal row={r} onClose={() => setShowUpdate(false)} />}
      {picker === 'add' && (
        <PartPickerModal
          title={`Add parts to ${r.orderId}`}
          intro="Tick the parts the customer has now ordered. They join this order and go on the Production Board."
          parts={notOrdered}
          confirmLabel="Add to order"
          busyLabel="Adding…"
          onClose={() => setPicker(null)}
          onConfirm={(partIds) => addPartsToOrder(r, partIds).then(() => setPicker(null))}
        />
      )}
      {picker === 'repeat' && (
        <PartPickerModal
          title={`Repeat ${r.orderId}`}
          intro={`Starts a new enquiry for the same customer with the ticked parts — quantity, material, finish, processes and their current CAD, drawing and reference files copied over. It is numbered ${String(r.id).replace(/_R\d+$/, '')}_R1, _R2, … in turn.`}
          parts={r.parts}
          confirmLabel="Create repeat enquiry"
          busyLabel="Creating…"
          onClose={() => setPicker(null)}
          onConfirm={(partIds) => repeatEnquiry(r, partIds).then(uid => navigate(`/proto/enquiries/${uid}`))}
        />
      )}
    </div>
  );
}
