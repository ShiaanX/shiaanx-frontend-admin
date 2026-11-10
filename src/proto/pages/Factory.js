import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../icons';
import KpiStrip from '../components/KpiStrip';
import { CL_PARTS } from '../fixtures';
import { ALL_RULES } from '../demoData/rulesLibrary';
import MOTOR_MOUNT_CLOSED_LOOP from '../demoData/motorMountClosedLoop';

// Factory page: how the machines are being used, and the rules library the closed loop is building.
// Utilization here is a saved snapshot of the telemetry windows captured so far (not live): each
// window states its span and coverage. Time shares come from the machine-state distribution.

const toSec = (s) => {
  const m = /(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/.exec(s || '') || [];
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
};
const STATES = [
  ['cutting', 'Cutting', 'var(--green, #16a34a)'], ['air', 'Air / positioning', 'var(--amber, #d97706)'],
  ['manual', 'Manual / MDI', '#6366f1'], ['setup', 'Setup / idle', '#94a3b8'], ['stopped', 'Stopped', 'var(--red, #dc2626)'],
];

function Utilization() {
  const rows = Object.entries(CL_PARTS).filter(([, p]) => p.window).map(([id, p]) => ({ id, ...p }));
  const mm = MOTOR_MOUNT_CLOSED_LOOP.cycleTime;
  return (
    <div>
      <p className="page-sub" style={{ marginBottom: 14 }}>
        A saved snapshot of the machine telemetry captured so far, not a live feed. Time is split by what the machine was doing, from its state signal.
      </p>
      {rows.map(r => {
        const w = r.window;
        const total = STATES.reduce((a, [k]) => a + toSec(w[k]), 0) || 1;
        return (
          <div className="card" key={r.id}>
            <h2><Icon name="board" /> {r.machine} <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13 }}>— {r.name} · {r.material} · window {w.span}</span></h2>
            <KpiStrip items={[
              { n: `${w.util}%`, l: 'Machine in use', cls: w.util >= 80 ? 'ok' : 'warn' },
              { n: w.cutting, l: 'Cutting' },
              { n: w.air, l: 'Air / positioning' },
              { n: w.setup, l: 'Setup / idle' },
              { n: `${w.coverage}%`, l: 'Telemetry coverage' },
            ]} />
            <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', margin: '14px 0 8px', border: '1px solid var(--border)' }}>
              {STATES.map(([k, label, col]) => <div key={k} title={`${label} ${w[k]}`} style={{ width: `${(toSec(w[k]) / total) * 100}%`, background: col }} />)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }} className="cell-sub">
              {STATES.map(([k, label, col]) => <span key={k}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, background: col, marginRight: 5 }} />{label} {w[k]}</span>)}
            </div>
            {r.insights && r.insights.length > 0 && <p className="page-sub" style={{ marginTop: 12 }}>{r.insights[0]}</p>}
          </div>
        );
      })}
      <div className="card">
        <h2><Icon name="info" /> Motor Mount — planned cycle time</h2>
        <p className="page-sub" style={{ margin: 0 }}>
          Programmer's cycle time {mm.programmerMinutesPerPart} min per part across {mm.setups.length} setups. Machine telemetry for the Motor Mount batches is not in the collector yet, so utilization for those machines is not shown; planned against actual cycle time is on the order page under "Earlier production".
        </p>
      </div>
    </div>
  );
}

function Rules() {
  const [search] = useSearchParams();
  const focus = search.get('rule');
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`rule-${focus}`);
    if (el) el.scrollIntoView({ block: 'center' });
  }, [focus]);
  return (
    <div>
      <p className="page-sub" style={{ marginBottom: 14 }}>
        What making parts has taught the shop. Every rule here was seen in real data and is marked <b>proposed</b> until the team confirms it. The QC "Why defects happen" panel points to these rules.
      </p>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Rule</th><th>What it says</th><th>Evidence</th><th>From</th><th>Status</th></tr></thead>
          <tbody>
            {ALL_RULES.map(r => (
              <tr key={r.id} id={`rule-${r.id}`} style={focus === r.id ? { background: 'var(--highlight, rgba(99,102,241,.12))' } : undefined}>
                <td className="mono cell-primary" style={{ whiteSpace: 'nowrap' }}>{r.id}</td>
                <td style={{ minWidth: 280 }}><div style={{ fontWeight: 600 }}>{r.title}</div>{r.title !== r.rule && <div className="cell-sub">{r.rule}</div>}</td>
                <td className="cell-sub" style={{ minWidth: 200 }}>{r.evidence || 'Cause found by the Defects & why logic on the Motor Mount readings and programs.'}{r.confidence ? ` (${r.confidence})` : ''}</td>
                <td className="cell-sub">{r.part}</td>
                <td><span className={`badge ${/^confirmed/.test(r.status) ? "b-pass" : "b-near"}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Factory() {
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') === 'rules' ? 'rules' : 'util';
  const go = (t) => setSearch(t === 'rules' ? { tab: 'rules' } : {});
  return (
    <div>
      <div className="page-head"><div><h1>Factory</h1><div className="page-sub">How the machines are used, and the rules the closed loop is learning.</div></div></div>
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'util' ? 'active' : ''}`} onClick={() => go('util')}>Machine utilization</button>
        <button type="button" className={`tab ${tab === 'rules' ? 'active' : ''}`} onClick={() => go('rules')}>Rules library ({ALL_RULES.length})</button>
      </div>
      {tab === 'rules' ? <Rules /> : <Utilization />}
    </div>
  );
}
