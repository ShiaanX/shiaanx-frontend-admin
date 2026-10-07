import React from 'react';
import { SETTINGS } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

const RUN_CLS = { Running: 'b-inprogress', Idle: 'b-neutral', Active: 'b-done', Invited: 'b-neutral' };

export default function Settings() {
  const { cappUrl, setCappUrl } = useProtoData();
  const [urlDraft, setUrlDraft] = React.useState(cappUrl);
  const [health, setHealth] = React.useState('');
  React.useEffect(() => { setUrlDraft(cappUrl); }, [cappUrl]);
  const test = async () => {
    setHealth('Checking…');
    try {
      const res = await fetch(`${urlDraft.replace(/\/+$/, '')}/openapi.json`);
      setHealth(res.ok ? 'Connected — the CAPP service is answering.' : `Reached it, but it answered ${res.status}.`);
    } catch (e) {
      setHealth('Not reachable. The service is not running at this address.');
    }
  };
  return (
    <div>
      <div className="page-head"><div><h1>Settings</h1><div className="page-sub">Admin config only — customers live under Sales; machine tool slots and a partner directory are parked for now.</div></div></div>

      <h3 style={{ marginTop: 0 }}>CAPP service</h3>
      <div className="card">
        <p className="page-sub" style={{ margin: '0 0 12px' }}>
          Generate on a part's <b>CAM program</b> (AI generated) sends the part's STEP file here and gets the real program sheet back from the CAPP pipeline. It runs on your own computer, so it only works in a browser on the machine where it is running.
        </p>
        <div className="field">
          <label>Service address</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="http://localhost:8001" />
            <button type="button" className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }} onClick={test}>Test</button>
            <button type="button" className="btn px-btn-primary" onClick={() => setCappUrl(urlDraft)}>Save</button>
          </div>
        </div>
        {health && <p className="page-sub" style={{ margin: '10px 0 0' }}>{health}</p>}
        <p className="page-sub" style={{ margin: '12px 0 4px' }}>To start it, run this in a terminal from the <span className="mono">ShiaanX\capp_service</span> folder and leave the window open:</p>
        <pre className="mono" style={{ margin: 0, padding: 12, background: 'var(--shell-bg)', borderRadius: 8, overflowX: 'auto' }}>{'& "C:\\Users\\Siddhant Gupta\\miniconda3\\envs\\occ\\python.exe" -m uvicorn main:app --port 8001'}</pre>
      </div>

      <h3>Users &amp; roles</h3>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {SETTINGS.users.map(([name, role, status]) => (
              <tr key={name}><td className="cell-primary">{name}</td><td>{role}</td><td><span className={`badge ${RUN_CLS[status] || 'b-neutral'}`}>{status}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Materials &amp; finishes</h3>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Material</th><th>Rate</th><th>Finishes available</th></tr></thead>
          <tbody>
            {SETTINGS.materials.map(([material, rate, finishes]) => (
              <tr key={material}><td className="cell-primary">{material}</td><td className="mono">{rate}</td><td>{finishes}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Tool catalogue</h3>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Tool code</th><th>Type</th><th>Diameter</th><th>Source</th></tr></thead>
          <tbody>
            {SETTINGS.tools.map(([code, type, dia]) => (
              <tr key={code}><td className="mono cell-primary">{code}</td><td>{type}</td><td>{dia}</td><td className="cell-sub">tool_database.json</td></tr>
            ))}
            <tr><td colSpan={4} className="empty-hint">42 tools total</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Machines</h3>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Machine</th><th>Controller</th><th>Magazine</th><th>Status</th></tr></thead>
          <tbody>
            {SETTINGS.machines.map(([machine, controller, magazine, status]) => (
              <tr key={machine}><td className="cell-primary">{machine}</td><td>{controller}</td><td>{magazine}</td><td><span className={`badge ${RUN_CLS[status] || 'b-neutral'}`}>{status}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
