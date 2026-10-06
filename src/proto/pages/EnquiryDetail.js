import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { StatusBadge } from '../components/Badges';
import DownloadLink from '../components/DownloadLink';
import ClosedLoopCard from '../components/ClosedLoopCard';
import ArtifactChecklist from '../components/ArtifactChecklist';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';

function TrialJobDetail({ r }) {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate('/proto')}><Icon name="back" /> Back to Enquiries &amp; Orders</button>
      <div className="detail-head">
        <div className="detail-title"><h1>{r.id}</h1><StatusBadge status={r.status} /><span className="badge b-neutral">NO CUSTOMER ORDER</span></div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost"><Icon name="doc" /> Build traceability pack</button>
          <button type="button" className="btn px-btn-primary">Link to a customer order</button>
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
          <ArtifactChecklist jobId={r.id} hasOrder={false} />
        </div>
        <div>
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
    </div>
  );
}

export default function EnquiryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { findRow, openFile } = useProtoData();
  const r = findRow(id);
  if (!r) return <div className="empty-hint">Enquiry not found.</div>;
  if (r.jobType === 'TRIAL') return <TrialJobDetail r={r} />;
  const part = r.parts[0];

  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate('/proto')}><Icon name="back" /> Back to Enquiries &amp; Orders</button>
      <div className="detail-head">
        <div className="detail-title"><h1>{r.id}</h1><StatusBadge status={r.status} /></div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost">Edit quote</button>
          <button type="button" className="btn px-btn-primary">Convert to order</button>
        </div>
      </div>
      <div className="grid2">
        <div>
          <div className="card">
            <h2><Icon name="info" /> Enquiry details</h2>
            <dl className="kv">
              <dt>Customer</dt><dd>{r.customer}</dd>
              <dt>Received</dt><dd>{fmtDate(r.date)}</dd>
              <dt>Parts</dt><dd>{r.parts.length}</dd>
              <dt>Quote status</dt><dd><StatusBadge status={r.status} /></dd>
            </dl>
          </div>
          <div className="card">
            <h2><Icon name="box" /> Parts</h2>
            {r.parts.map(p => (
              <div className="part-row" key={p.name}>
                <div className="part-row-head"><span className="name">{p.name}</span><button type="button" className="btn-text" onClick={() => navigate(`/proto/parts/${p.tmpl}`)}>View 3D <Icon name="cad" size={14} /></button></div>
                <div className="mini-grid">
                  <div><span className="ml">Material</span><span className="mv">{p.material}</span></div>
                  <div><span className="ml">Quantity</span><span className="mv">{p.qty}</span></div>
                  <div><span className="ml">Finish</span><span className="mv">{p.finish}</span></div>
                  <div><span className="ml">CAD file</span><span className="mv"><DownloadLink file={p.file} fileKey={p.fileKey} /></span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="card">
            <h2><Icon name="doc" /> Documents received</h2>
            <div className="doc-row"><div className="doc-icon"><Icon name="cad" /></div><div><div className="doc-name">{part.fileKey ? part.file : 'STEP file'}</div><div className="doc-sub">{part.fileKey ? 'Uploaded by you' : '99.7 KB · uploaded by customer'}</div></div><div className="doc-actions"><button type="button" className="btn-text" disabled={!part.fileKey} onClick={() => openFile(part.fileKey)}>View</button></div></div>
            <div className="doc-row"><div className="doc-icon"><Icon name="doc" /></div><div><div className="doc-name">{r.drawingFileKey ? 'Drawing.pdf' : 'Ballooned drawing.pdf'}</div><div className="doc-sub">{r.drawingFileKey ? 'Uploaded by you' : '1 page'}</div></div><div className="doc-actions"><button type="button" className="btn-text" disabled={!r.drawingFileKey} onClick={() => openFile(r.drawingFileKey)}>View</button></div></div>
          </div>
          <div className="card">
            <h2>Status history</h2>
            <div className="timeline">
              <div className="tl-item"><div className="tl-t">Enquiry received</div><div className="tl-d">{fmtDate(r.date)}</div></div>
              <div className={`tl-item ${r.status === 'PENDING' ? 'future' : ''}`}><div className="tl-t">Quote finalized</div><div className="tl-d">{r.status === 'PENDING' ? 'Pending' : 'Done'}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
