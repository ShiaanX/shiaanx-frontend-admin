import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import DownloadLink from '../components/DownloadLink';
import ProtoCadViewer from '../components/ProtoCadViewer';
import { useProtoData } from '../ProtoDataContext';

const TABS = [['overview', 'Overview'], ['datums', 'Datums'], ['fixture', 'Fixture']];
const PLAN_CLS = { APPROVED: 'b-done', DRAFT: 'b-quoted', PENDING: 'b-neutral' };

function Empty({ children }) {
  return <div className="card" style={{ marginBottom: 0 }}><div className="empty-hint">{children}</div></div>;
}

// The tech-generated CAM program for one part: the 3D model, what the CAPP pipeline planned
// (overview), datums and fixture. Not a page of its own in the sidebar — it is opened from a job,
// through View on the part's AI-generated CAM program line (or View 3D on its CAD file).
// Dimensions are quality data and live on the inspection report view instead.
export default function PartWorkspace() {
  const params = useParams();
  const navigate = useNavigate();
  const { partLibrary, rows, artifactState, openFile } = useProtoData();
  const [tab, setTab] = useState('overview');
  const tmplId = params.tmplId;
  const d = partLibrary[tmplId];

  // The job this part belongs to: Back returns there, and its documents hold the program sheet.
  const owner = rows.find(r => r.parts.some(p => p.tmpl === tmplId));
  const backTo = owner ? (owner.isOrder ? `/proto/orders/${owner.uuid}` : `/proto/enquiries/${owner.uuid}`) : null;
  const backLabel = owner ? `Back to ${owner.isOrder ? owner.orderId : owner.id}` : 'Back';
  const back = (
    <button type="button" className="back-link" onClick={() => (backTo ? navigate(backTo) : navigate(-1))}>
      <Icon name="back" /> {backLabel}
    </button>
  );
  if (!d) return <div>{back}<div className="card"><div className="empty-hint">This part was not found.</div></div></div>;

  const partIndex = owner ? owner.parts.findIndex(p => p.tmpl === tmplId) : -1;
  const docs = owner ? (artifactState[owner.orderId] || artifactState[owner.id] || {}) : {};
  const legacyPlan = docs.plan && docs.plan.files ? docs.plan.files.find(f => String(f.fileKey).endsWith(`:plan:${partIndex}`)) : null;
  const sheetKey = (docs[`p${partIndex}.plan`] && docs[`p${partIndex}.plan`].fileKey) || (legacyPlan && legacyPlan.fileKey) || null;

  return (
    <div>
      {back}
      <div className="page-head">
        <div><h1>{d.name}</h1><div className="page-sub">CAM program · {d.customer} · rev {d.rev}</div></div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost" disabled={!sheetKey} onClick={() => openFile(sheetKey)}
            title={sheetKey ? '' : 'Generate the CAM program on the job first'}>
            <Icon name="doc" size={14} /> Program sheet (PDF)
          </button>
        </div>
      </div>
      {d.note && <div className="stub-note"><Icon name="info" /><div>{d.note}</div></div>}
      <div className="grid2">
        <div>
          {d.cadFileKey ? (
            <ProtoCadViewer fileKey={d.cadFileKey} />
          ) : (
            <div className="viewer-shell">
              <div className="viewer-chip">CAD//VIEW · placeholder</div>
              <svg className="part3d" viewBox="0 0 200 160" fill="none" stroke="#9db8d6" strokeWidth="2">
                <path d="M40 20 L160 30 L150 140 L30 130 Z" fill="#1c2636" />
                <path d="M55 30 L55 125 M70 31 L70 126 M85 32 L85 127 M100 33 L100 128 M115 34 L115 129 M130 35 L130 130" stroke="#2a3850" />
                <circle cx="45" cy="35" r="7" stroke="#cfe0ef" /><circle cx="145" cy="45" r="7" stroke="#cfe0ef" />
                <circle cx="40" cy="120" r="7" stroke="#cfe0ef" /><circle cx="140" cy="128" r="7" stroke="#cfe0ef" />
              </svg>
            </div>
          )}
          {d.cadFileKey && (
            <div className="cell-sub" style={{ marginTop: 8 }}>
              <DownloadLink file="Download STEP file" fileKey={d.cadFileKey} />
              {d.drawingFileKey && <> · <DownloadLink file={`Download ${d.drawingFileName || 'drawing'}`} fileKey={d.drawingFileKey} /></>}
            </div>
          )}
        </div>
        <div>
          <div className="tabs">
            {TABS.map(([id, label]) => (
              <button type="button" key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          {tab === 'overview' && (
            <div className="card" style={{ marginBottom: 0 }}>
              <dl className="kv">
                <dt>Setups</dt><dd>{d.setups}</dd>
                <dt>Operations</dt><dd>{d.operations}</dd>
                <dt>Stock</dt><dd>{d.stock}</dd>
                <dt>Program source</dt><dd>{d.programSource}</dd>
                <dt>Plan status</dt><dd><span className={`badge ${PLAN_CLS[d.planStatus] || 'b-neutral'}`}>{d.planStatus}</span></dd>
              </dl>
            </div>
          )}
          {tab === 'datums' && (d.datums ? (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="mini-grid">{d.datums.map(([k, v]) => <div key={k}><span className="ml">{k}</span><span className="mv">{v}</span></div>)}</div>
            </div>
          ) : <Empty>Datums not yet tagged.</Empty>)}
          {tab === 'fixture' && (d.fixture ? (
            <div className="card" style={{ marginBottom: 0 }}>
              <dl className="kv">{d.fixture.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
            </div>
          ) : <Empty>Fixture plan not yet set.</Empty>)}
        </div>
      </div>
    </div>
  );
}
