import React from 'react';
import { SETTINGS } from '../fixtures';

const RUN_CLS = { Running: 'b-inprogress', Idle: 'b-neutral', Active: 'b-done', Invited: 'b-neutral' };

export default function Settings() {
  return (
    <div>
      <div className="page-head"><div><h1>Settings</h1><div className="page-sub">Admin config only — customers live under Sales; machine tool slots and a partner directory are parked for now.</div></div></div>

      <h3 style={{ marginTop: 0 }}>Users &amp; roles</h3>
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
