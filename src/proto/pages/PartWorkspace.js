import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { VerdictBadge } from '../components/Badges';
import DownloadLink from '../components/DownloadLink';
import { useProtoData } from '../ProtoDataContext';

const TABS = [['overview', 'Overview'], ['datums', 'Datums'], ['dims', 'Dimensions'], ['fixture', 'Fixture']];
const PLAN_CLS = { APPROVED: 'b-done', DRAFT: 'b-quoted', PENDING: 'b-neutral' };

function Empty({ children }) {
  return <div className="card" style={{ marginBottom: 0 }}><div className="empty-hint">{children}</div></div>;
}

// One part template at a time, picked from the selector. The 3D pane is a placeholder until the
// labeling_app viewer is wired in.
export default function PartWorkspace() {
  const params = useParams();
  const navigate = useNavigate();
  const { partLibrary } = useProtoData();
  const [tab, setTab] = useState('overview');
  const tmplId = partLibrary[params.tmplId] ? params.tmplId : 'TMPL-BASEPLATE';
  const d = partLibrary[tmplId];

  return (
    <div>
      <div className="page-head">
        <div><h1>{d.name}</h1><div className="page-sub">{tmplId} · rev {d.rev} · {d.customer}</div></div>
        <div className="head-actions">
          <select aria-label="Part" value={tmplId} onChange={e => { setTab('overview'); navigate(`/proto/parts/${e.target.value}`); }}>
            {Object.entries(partLibrary).map(([id, p]) => <option key={id} value={id}>{p.name} — {p.customer}</option>)}
          </select>
          <button type="button" className="btn btn-ghost">Request changes</button>
          <button type="button" className="btn px-btn-primary">Approve plan</button>
        </div>
      </div>
      {d.note && <div className="stub-note"><Icon name="info" /><div>{d.note}</div></div>}
      <div className="grid2">
        <div>
          <div className="viewer-shell">
            <div className="viewer-chip">CAD//VIEW · placeholder</div>
            <svg className="part3d" viewBox="0 0 200 160" fill="none" stroke="#9db8d6" strokeWidth="2">
              <path d="M40 20 L160 30 L150 140 L30 130 Z" fill="#1c2636" />
              <path d="M55 30 L55 125 M70 31 L70 126 M85 32 L85 127 M100 33 L100 128 M115 34 L115 129 M130 35 L130 130" stroke="#2a3850" />
              <circle cx="45" cy="35" r="7" stroke="#cfe0ef" /><circle cx="145" cy="45" r="7" stroke="#cfe0ef" />
              <circle cx="40" cy="120" r="7" stroke="#cfe0ef" /><circle cx="140" cy="128" r="7" stroke="#cfe0ef" />
            </svg>
            <div className="viewer-tools"><button type="button">Shaded</button><button type="button">Wireframe</button><button type="button">Fit all</button></div>
          </div>
          {d.cadFileKey && (
            <div className="cell-sub" style={{ marginTop: 8 }}>
              Uploaded CAD: <DownloadLink file="View uploaded STEP file" fileKey={d.cadFileKey} />
              {d.drawingFileKey && <> · <DownloadLink file="View drawing" fileKey={d.drawingFileKey} /></>}
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
          {tab === 'dims' && (d.dims ? (
            <div className="dim-list">
              {d.dims.map(dm => (
                <div className="dim-row" key={dm.b}>
                  <div className={`dim-ball ${dm.v}`}>{dm.b}</div>
                  <div className="dim-main"><b>{dm.label}</b><span>Balloon {dm.b}</span></div>
                  <VerdictBadge v={dm.v} />
                </div>
              ))}
            </div>
          ) : <Empty>Ballooned drawing not yet tagged.</Empty>)}
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
