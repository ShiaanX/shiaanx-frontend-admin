import React from 'react';
import Icon from '../icons';
import { SETTINGS } from '../fixtures';

// Plant-level data, linked from the sidebar rather than nested in the order flow.
export default function Factory() {
  return (
    <div>
      <div className="page-head"><div><h1>Factory</h1><div className="page-sub">Machine utilization and process rules — plant-level, not tied to one order.</div></div></div>
      <div className="stub-note"><Icon name="info" /><div>Placeholder for the existing telemetry dashboard. Per-part rules live in Closed Loop.</div></div>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Machine</th><th>Status</th><th>Utilization (7d)</th></tr></thead>
          <tbody>
            {SETTINGS.machines.map(([machine, , , status, util]) => (
              <tr key={machine}>
                <td className="cell-primary">{machine}</td>
                <td><span className={`badge ${status === 'Running' ? 'b-inprogress' : 'b-neutral'}`}>{status}</span></td>
                <td>{util}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
