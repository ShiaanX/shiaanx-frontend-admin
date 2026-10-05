import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import KpiStrip from '../components/KpiStrip';
import { QcBadge, QcPillGroup, ConfidenceBadge } from '../components/Badges';
import { CL_PARTS } from '../fixtures';

const DEFAULT_PART = 'PN-1052';
const LIST_STYLE = { margin: 0, paddingLeft: 20, fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 8 };

function num(v) {
  if (v === null || v === undefined) return '—';
  return Number.isInteger(v) ? v : Math.round(v);
}

function Summary({ cl }) {
  const w = cl.window;
  return (
    <>
      <div className="card">
        <h2><Icon name="box" /> {cl.name}</h2>
        <dl className="kv" style={{ marginBottom: 16 }}><dt>Machine</dt><dd>{cl.machine}</dd><dt>Material</dt><dd>{cl.material}</dd></dl>
        {w ? (
          <>
            <KpiStrip items={[
              { n: w.span, l: `Window · ${w.samples.toLocaleString()} samples` },
              { n: `${w.coverage}%`, l: 'Log coverage' },
              { n: `${w.util}%`, l: 'Utilisation', cls: 'ok' },
              { n: w.cutting, l: `Cutting · ${w.cuttingPct}%`, cls: 'ok' },
              { n: w.air, l: 'Air / positioning' },
            ]} />
            <KpiStrip style={{ marginTop: 10 }} items={[
              { n: w.stopped, l: 'Stopped' },
              { n: w.manual, l: 'Manual / MDI' },
              { n: w.setup, l: 'Setup / load' },
              { n: `${w.alarmPct}%`, l: `Alarm flag · ${w.alarmEvents} events`, cls: 'warn' },
            ]} />
          </>
        ) : (
          <p className="page-sub">No operation-level telemetry for this part in the analysed window yet — only the reliability catches.</p>
        )}
      </div>
      {cl.insights && (
        <div className="card">
          <h2><Icon name="info" /> What stands out</h2>
          <ul style={LIST_STYLE}>{cl.insights.map(i => <li key={i}>{i}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function PartByPart({ cl }) {
  const c = cl.closedLoop;
  return (
    <>
      {c && (
        <div className="card">
          <h2><Icon name="part" /> Closed loop — CAM plan vs machine actual vs QC</h2>
          <p className="page-sub" style={{ marginTop: -6 }}>{c.camProject}</p>
          <KpiStrip items={[
            { n: c.outcome, l: 'Part outcome', cls: c.outcome === 'FAIL' ? 'err' : '' },
            { n: c.opsTotal, l: 'Operations total' },
            { n: c.withTelemetry, l: 'With telemetry' },
            { n: c.offWindow, l: 'Off-window', cls: 'warn' },
            { n: c.qcInTol, l: 'QC in tolerance', cls: 'ok' },
          ]} />
          <p className="page-sub" style={{ marginTop: 14 }}>{c.note}</p>
        </div>
      )}
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Operation</th><th>Programmed S / F</th><th>Actual RPM / Feed</th><th>Cutting (actual vs est.)</th><th>QC</th></tr></thead>
          <tbody>
            {cl.ops.map(o => (
              <tr key={o.op}>
                <td className="mono cell-primary">{o.op}</td>
                <td className="mono">{num(o.progS)} / {num(o.progF)}</td>
                <td className="mono">{num(o.actRpm)} / {num(o.actFeed)}</td>
                <td className="mono">{num(o.cutS)}s / {num(o.estS)}s</td>
                <td><QcBadge qc={o.qc} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Steps({ cl }) {
  return (
    <>
      {cl.steps.map(s => (
        <div className="card" key={s.op}>
          <h2>{s.op} <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13 }}>— {s.feature}</span></h2>
          <p style={{ fontWeight: 700, margin: '-4px 0 12px' }}>{s.headline}</p>
          <dl className="kv wide" style={{ margin: 0 }}>
            <dt>CAM program said</dt><dd>{s.said}</dd>
            <dt>Machine did</dt><dd>{s.happened}</dd>
            <dt>What it means</dt><dd>{s.means}</dd>
          </dl>
        </div>
      ))}
      {cl.crossCutting && (
        <div className="card">
          <h2><Icon name="info" /> Patterns across the whole part</h2>
          <ul style={LIST_STYLE}>{cl.crossCutting.map(c => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function Rules({ cl }) {
  return (
    <>
      <p className="page-sub" style={{ marginBottom: 14 }}>What making this part is teaching the shop. With one part the rules are provisional — each firms up as the knowledge base grows a pass-rate behind it.</p>
      <div className="card">
        <h2><Icon name="info" /> Rules emerging from this part</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cl.rules.map(r => (
            <div key={r.rule}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.rule}</div>
              <div className="page-sub" style={{ marginTop: 3 }}>basis — {r.basis} <ConfidenceBadge c={r.confidence} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Material</th><th>Tool</th><th>Feature</th><th>n</th><th>S posted</th><th>S run</th><th>F posted</th><th>F run</th><th>QC</th></tr></thead>
          <tbody>
            {(cl.knowledgeBase || []).map(g => (
              <tr key={g.tool + g.feature}>
                <td className="cell-primary">{g.material}</td><td className="mono">{g.tool}</td><td className="cell-sub">{g.feature}</td>
                <td className="mono">{g.n}</td><td className="mono">{g.sPosted}</td><td className="mono">{g.sRun}</td>
                <td className="mono">{g.fPosted}</td><td className="mono">{g.fRun}</td><td><QcPillGroup qc={g.qc} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Gaps({ cl }) {
  return (
    <>
      <p className="page-sub" style={{ marginBottom: 14 }}>Every field the controller is expected to publish, checked against what actually arrived. These are the gaps to close — on this machine, or by specifying them up front on the next one.</p>
      {cl.gaps.map(g => (
        <div className="card" key={g.field}>
          <h2><code className="mono">{g.field}</code> <span className={`badge ${g.status === 'absent' ? 'b-fail' : 'b-near'}`}>{g.status}</span></h2>
          <p style={{ margin: '0 0 6px' }}>{g.detail}</p>
          <p className="page-sub" style={{ margin: 0 }}><b>Costs us:</b> {g.why}</p>
        </div>
      ))}
    </>
  );
}

function Catches({ cl }) {
  return cl.catches.map(c => (
    <div className="card" key={c.t}><h2><Icon name="info" /> {c.t}</h2><p style={{ margin: 0 }}>{c.d}</p></div>
  ));
}

// Built from the closed-loop repo's real report data. Tabs a part has no data for are disabled.
export default function ClosedLoop() {
  const params = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('summary');
  const partId = CL_PARTS[params.partId] ? params.partId : DEFAULT_PART;
  const cl = CL_PARTS[partId];

  const tabs = [
    ['summary', 'Summary', true, Summary],
    ['parts', 'Part by part', !!cl.closedLoop, PartByPart],
    ['steps', 'Step-by-step', !!cl.steps, Steps],
    ['rules', 'Rules', !!cl.rules, Rules],
    ['gaps', 'Data gaps', !!cl.gaps, Gaps],
    ['catches', 'What this part taught us', true, Catches],
  ];
  const active = tabs.find(([id, , on]) => id === tab && on) || tabs[0];
  const Panel = active[3];

  return (
    <div>
      <div className="page-head">
        <div><h1>Closed Loop</h1><div className="page-sub">Real telemetry joined against the CAM plan and QC — from the closed-loop repo.</div></div>
        <div className="head-actions">
          <select aria-label="Part" value={partId} onChange={e => { setTab('summary'); navigate(`/proto/closed-loop/${e.target.value}`); }}>
            {Object.entries(CL_PARTS).map(([id, p]) => <option key={id} value={id}>{p.name} ({id})</option>)}
          </select>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([id, label, on]) => (
          <button type="button" key={id} disabled={!on} className={`tab ${active[0] === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <Panel cl={cl} />
    </div>
  );
}
