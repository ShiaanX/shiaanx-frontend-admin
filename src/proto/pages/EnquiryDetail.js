import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { StatusBadge } from '../components/Badges';
import ClosedLoopCard from '../components/ClosedLoopCard';
import ArtifactChecklist from '../components/ArtifactChecklist';
import AutoQuoteModal from '../components/AutoQuoteModal';
import UpdateEnquiryModal from '../components/UpdateEnquiryModal';
import DocumentsReceived from '../components/DocumentsReceived';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';

function TrialJobDetail({ r }) {
  const navigate = useNavigate();
  const { convertToOrder } = useProtoData();
  const linkToOrder = () => convertToOrder(r.uuid).then(id => navigate(`/proto/orders/${id}`)).catch(() => {});
  const [showUpdate, setShowUpdate] = useState(false);
  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate('/proto')}><Icon name="back" /> Back to Enquiries &amp; Orders</button>
      <div className="detail-head">
        <div className="detail-title"><h1>{r.id}</h1><StatusBadge status={r.status} /><span className="badge b-neutral">NO CUSTOMER ORDER</span></div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setShowUpdate(true)}><Icon name="upload" size={14} /> Update</button>
          <button type="button" className="btn btn-ghost"><Icon name="doc" /> Build traceability pack</button>
          <button type="button" className="btn px-btn-primary" onClick={linkToOrder}>Link to a customer order</button>
        </div>
      </div>
      <div className="stub-note">
        <Icon name="info" />
        <div>Tracked as a trial / internal build — same production record as an order, just with nothing to bill. If a customer order shows up for this part later, link it above instead of re-entering the work.</div>
      </div>
      <div className="grid2">
        <div>
          <div className="card">
            <h2><Icon name="info" /> Job details</h2>
            <dl className="kv"><dt>Customer</dt><dd>{r.customer}</dd><dt>Started</dt><dd>{fmtDate(r.date)}</dd><dt>Parts</dt><dd>{r.parts.length}</dd></dl>
          </div>
          <ClosedLoopCard parts={r.parts} />
          <ArtifactChecklist jobId={r.id} row={r} hasOrder={false} />
        </div>
        <div>
          <DocumentsReceived row={r} />
          <div className="card">
            <h2>Status history</h2>
            <div className="timeline">
              <div className="tl-item"><div className="tl-t">Job started</div><div className="tl-d">{fmtDate(r.date)}</div></div>
              <div className="tl-item"><div className="tl-t">Plan approved</div><div className="tl-d">Done</div></div>
              <div className="tl-item"><div className="tl-t">Machining</div><div className="tl-d">Done</div></div>
              <div className="tl-item"><div className="tl-t">QC</div><div className="tl-d">In progress</div></div>
            </div>
          </div>
        </div>
      </div>
      {showUpdate && <UpdateEnquiryModal row={r} onClose={() => setShowUpdate(false)} />}
    </div>
  );
}

export default function EnquiryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { findRow, convertToOrder, markNoOrderJob, uploadManualQuote } = useProtoData();
  const r = findRow(id);
  const [quotingPart, setQuotingPart] = useState(null); // part index, or null
  const [showUpdate, setShowUpdate] = useState(false);
  const manualQuoteInput = useRef(null);

  // Once converted this id belongs under /orders/:orderId — if something still links to the old
  // /enquiries/:id (e.g. a bookmark, or clicking Convert to order from here), follow it there.
  useEffect(() => {
    if (r && r.isOrder) navigate(`/proto/orders/${r.uuid}`, { replace: true });
  }, [r, navigate]);

  if (!r) return <div className="empty-hint">Enquiry not found.</div>;
  if (r.isOrder) return null;
  if (r.jobType === 'TRIAL') return <TrialJobDetail r={r} />;

  const convert = () => convertToOrder(r.uuid).then(uid => navigate(`/proto/orders/${uid}`)).catch(() => {});
  const onManualQuoteChosen = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) uploadManualQuote(r.id, file);
  };

  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate('/proto')}><Icon name="back" /> Back to Enquiries &amp; Orders</button>
      <div className="detail-head">
        <div>
          <div className="detail-title"><h1>{r.id}</h1><StatusBadge status={r.status} /></div>
          {r.assemblyName && <div className="page-sub" style={{ marginTop: 2 }}>{r.assemblyName}</div>}
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setShowUpdate(true)}><Icon name="upload" size={14} /> Update</button>
          <button type="button" className="btn btn-ghost" onClick={() => markNoOrderJob(r.uuid).catch(() => {})}>Produce without a confirmed order</button>
          <button type="button" className="btn px-btn-primary" onClick={convert}>Convert to order</button>
        </div>
      </div>
      <div className="grid2">
        <div>
          <div className="card">
            <h2><Icon name="info" /> Enquiry details</h2>
            <dl className="kv">
              {r.assemblyName && <><dt>Assembly / job name</dt><dd>{r.assemblyName}</dd></>}
              <dt>Customer</dt><dd>{r.customer}</dd>
              <dt>Received</dt><dd>{fmtDate(r.date)}</dd>
              <dt>Parts</dt><dd>{r.parts.length}</dd>
              <dt>Quote status</dt><dd><StatusBadge status={r.status} /></dd>
            </dl>
            {r.remarks && <dl className="kv" style={{ marginTop: 10 }}><dt>Remarks</dt><dd>{r.remarks}</dd></dl>}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <input ref={manualQuoteInput} type="file" accept=".xlsx,.xls,.csv,.pdf" style={{ display: 'none' }} onChange={onManualQuoteChosen} />
              <button type="button" className="btn-text" onClick={() => manualQuoteInput.current.click()}>
                <Icon name="upload" size={14} /> {r.manualQuoteFileKey ? `Replace manual quote (${r.manualQuoteFileName})` : 'Upload a manual quote (Excel/PDF) instead'}
              </button>
            </div>
          </div>
          <div className="card">
            <h2><Icon name="box" /> Parts</h2>
            {r.parts.map((p, i) => (
              <div className="part-row" key={p.tmpl || p.name}>
                <div className="part-row-head">
                  <span className="name">{p.name}</span>
                  <button type="button" className="btn-text" onClick={() => setQuotingPart(i)}><Icon name="quote" size={14} /> Auto-quote</button>
                </div>
                <div className="mini-grid">
                  <div><span className="ml">Material</span><span className="mv">{p.material}</span></div>
                  <div><span className="ml">Quantity</span><span className="mv">{p.qty}</span></div>
                  <div><span className="ml">Finish</span><span className="mv">{p.finish}</span></div>
                </div>
              </div>
            ))}
            <div className="cell-sub" style={{ marginTop: 4 }}>CAD files and the drawing are in Documents received →</div>
          </div>
        </div>
        <div>
          <DocumentsReceived row={r} />
          <div className="card">
            <h2>Status history</h2>
            <div className="timeline">
              <div className="tl-item"><div className="tl-t">Enquiry received</div><div className="tl-d">{fmtDate(r.date)}</div></div>
              <div className={`tl-item ${r.status === 'PENDING' ? 'future' : ''}`}><div className="tl-t">Quote finalized</div><div className="tl-d">{r.status === 'PENDING' ? 'Pending' : 'Done'}</div></div>
            </div>
          </div>
        </div>
      </div>
      {quotingPart !== null && <AutoQuoteModal row={r} partIndex={quotingPart} onClose={() => setQuotingPart(null)} />}
      {showUpdate && <UpdateEnquiryModal row={r} onClose={() => setShowUpdate(false)} />}
    </div>
  );
}
