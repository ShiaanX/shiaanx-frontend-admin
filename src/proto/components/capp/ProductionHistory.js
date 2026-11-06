import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getProductionHistory } from '../../cappApi';
import { useCappResource, ResourceState, fmtNum, show } from './CappCommon';
import './program.css';

const fmtMin = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : `${fmtNum(v, 1)} min`);

// A link the service gives: an app route (#/proto/… or /proto/…) stays in the app, anything else opens in a new tab.
function DefectsLink({ to }) {
  if (!to) return null;
  const s = String(to);
  const route = s.replace(/^#/, '').replace(/^\/admin\/#/, '');
  if (route.startsWith('/proto')) return <Link to={route} data-history-defects>Why the defects happened →</Link>;
  return <a href={s} target="_blank" rel="noreferrer" data-history-defects>Why the defects happened →</a>;
}

// Text read from the shop's files can arrive UTF-8-decoded-as-Latin-1 ("Ã˜12" for "Ø12"); shown as meant.
const txt = (v) => show(v).replace(/Ã˜/g, 'Ø').replace(/Â/g, '');

function dimResult(d) {
  const r = String(d.verdict || d.result || d.status || '').toLowerCase();
  if (r === 'checked') return ['Checked', 'b-neutral'];
  if (d.in_tolerance === true || r === 'ok' || r === 'in' || r === 'pass' || r === 'in_tol') return ['OK', 'b-pass'];
  if (r.startsWith('close') || r === 'near' || r === 'marginal') return ['Close', 'b-near'];
  if (d.in_tolerance === false || r.startsWith('out') || r === 'fail') return ['Out', 'b-fail'];
  return [r ? show(d.verdict || d.result || d.status) : '—', 'b-neutral'];
}

const pct = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${fmtNum(v, 0)}%`);
const SPLIT = [
  ['running_pct', 'Running', 'run'],
  ['hold_pct', 'Feed hold', 'hold'],
  ['manual_pct', 'JOG / MDI', 'man'],
  ['idle_pct', 'Idle (load/unload)', 'idle'],
];

// "Machine data (controller log)": a few headline facts per setup from the batch's real controller
// telemetry (served from a cached snapshot), same metric definitions as the closed-loop report.
function MachineData({ md }) {
  if (!md || !md.available) return null;
  const setups = md.setups || [];
  const lines = (md.summary && md.summary.headline_lines) || [];
  const later = setups.flatMap(s => (s.sessions || []).filter(x => !x.used_for_headline).map(x => ({ ...x, setup: s.setup })));
  return (
    <div data-history-machine>
      <div className="cx-sec">Machine data (controller log)</div>
      {lines.length > 0 && <ul className="ph-md-lines">{lines.map((l, i) => <li key={i}>{show(l)}</li>)}</ul>}
      <div className="cx-tbl">
        <table className="data ph-md-tbl">
          <thead><tr><th>Setup</th><th>Minutes per cycle<div className="cell-sub">programmed → real</div></th><th>Spindle rpm<div className="cell-sub">programmed → real</div></th><th>Feed override</th><th>Logged time</th></tr></thead>
          <tbody>
            {setups.map(s => {
              if (!s.recorded) {
                return (
                  <tr key={s.setup} data-md-setup={s.setup}>
                    <td className="mono">{show(s.setup)}</td>
                    <td className="mono">{fmtMin(s.programmed_minutes)} → <span className="cell-sub" style={{ display: 'inline' }}>not recorded</span></td>
                    <td colSpan={3} className="cell-sub" style={{ display: 'table-cell' }}>Not in the controller log</td>
                  </tr>
                );
              }
              const sp = s.spindle || {};
              const fo = s.feed_override;
              const st = s.state_split || {};
              const over = Number(s.ratio) > 1;
              return (
                <tr key={s.setup} data-md-setup={s.setup}>
                  <td className="mono">{show(s.setup)}</td>
                  <td className="mono">
                    {fmtNum(s.programmed_minutes, 1)} → <b>{fmtNum(s.actual_machine_minutes, 1)}</b>
                    {s.ratio && <span className={`badge ${over ? 'b-near' : 'b-pass'}`} style={{ marginLeft: 6 }}>{over ? '+' : ''}{fmtNum((s.ratio - 1) * 100, 0)}%</span>}
                    <div className="cell-sub">{show(s.full_cycles)} full cycles</div>
                  </td>
                  <td className="mono">
                    {fmtNum(sp.programmed_rpm, 0)} → {fmtNum(sp.actual_median_rpm, 0)}
                    {sp.at_programmed_pct !== null && sp.at_programmed_pct !== undefined && <div className="cell-sub">at programmed S {pct(sp.at_programmed_pct)} of the time</div>}
                  </td>
                  <td className="mono">
                    {fo ? <>{fo.min_pct === fo.max_pct ? pct(fo.min_pct) : `${fo.min_pct}–${fo.max_pct}%`}<div className="cell-sub">off 100% for {pct(fo.off_default_pct)} of run time</div></> : '—'}
                  </td>
                  <td>
                    <div className="ph-md-bar" title={SPLIT.map(([k, l]) => `${l} ${pct(st[k])}`).join(' · ')}>
                      {SPLIT.map(([k, , c]) => (Number(st[k]) > 0 ? <span key={k} className={c} style={{ width: `${st[k]}%` }} /> : null))}
                    </div>
                    <div className="cell-sub">running {pct(st.running_pct)} · JOG/MDI {pct(st.manual_pct)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="ph-md-legend">
        {SPLIT.map(([k, l, c]) => <span key={k}><i className={c} />{l}</span>)}
      </div>
      {(later.length > 0 || md.summary?.note || md.method) && (
        <details className="ph-det">
          <summary>How this was measured</summary>
          <ul className="pg-notes" style={{ marginTop: 0 }}>
            {md.summary?.note && <li>{show(md.summary.note)}</li>}
            {later.map((x, i) => <li key={i}>Setup {show(x.setup)}, {show(x.label)}: a later run, not in the figures above ({show(x.full_cycles)} full cycles, median {fmtMin(x.median_cycle_minutes)}).</li>)}
            {md.method && <li>{show(md.method)}</li>}
          </ul>
        </details>
      )}
      <div className="ph-md-src" data-history-machine-source>Source: {show(md.source)} · snapshot {show(String(md.fetched_at || '').slice(0, 10))}</div>
    </div>
  );
}

// "Previous production of this part": real past batches from GET /jobs/{id}/production-history —
// machine, parts made, the program that ran and its QC result.
export default function ProductionHistory({ jobId }) {
  const res = useCappResource(() => getProductionHistory(jobId), `${jobId}`);
  const [sel, setSel] = useState(0);
  const d = res.data;
  if (!d) return <ResourceState res={res} runningText="Looking up previous batches of this part…" />;
  const batches = d.batches || [];
  if (!batches.length) {
    return <p className="page-sub" style={{ margin: 0 }} data-history-empty>No previous production of this part on record.</p>;
  }
  const b = batches[Math.min(sel, batches.length - 1)];
  const prog = b.program || {};
  const qc = b.qc || {};
  const ops = prog.ops || [];
  const dims = qc.per_dimension || [];
  return (
    <div data-history>
      <p style={{ margin: '0 0 10px', fontSize: 14 }}>We've made this part before. Here's what we captured.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {batches.length > 1 ? (
          <div className="tabs" style={{ margin: 0 }}>
            {batches.map((x, i) => <button type="button" key={x.id || i} className={`tab ${i === sel ? 'active' : ''}`} onClick={() => setSel(i)} data-history-batch={x.id || i}>{show(x.label || x.id)}</button>)}
          </div>
        ) : <b>{show(b.label || b.id)}</b>}
      </div>
      <dl className="kv" style={{ marginBottom: 12 }}>
        <dt>Machine</dt><dd>{show(b.machine)}</dd>
        {b.program_type && <><dt>Program</dt><dd>{show(b.program_type)}</dd></>}
        {b.setups !== undefined && <><dt>Setups</dt><dd>{Array.isArray(b.setups) ? b.setups.map(show).join(' · ') : show(b.setups)}</dd></>}
        <dt>Parts made</dt><dd>{show(b.parts_made)}</dd>
        <dt>Program time</dt><dd><span className="mono">{fmtMin(prog.total_minutes)}</span>{Number(b.parts_made) > 0 && <span className="cell-sub" style={{ display: 'inline', marginLeft: 6 }}>per part</span>}{prog.minutes_basis && <div className="cell-sub" style={{ marginTop: 2, maxWidth: 640 }} data-history-basis>{show(prog.minutes_basis)}</div>}</dd>
      </dl>
      {qc.dimensions !== undefined && (
        <>
          <div className="cx-sec">QC result</div>
          <div className="ph-qc" data-history-qc>
            <span className="seg ok">{show(qc.in_tol)} of {show(qc.dimensions)} in tolerance</span>
            {Number(qc.close) > 0 && <span className="seg near">{show(qc.close)} close</span>}
            {Number(qc.out) > 0 && <span className="seg out">{show(qc.out)} out</span>}
            {Number(qc.checked_only) > 0 && <span className="cell-sub" style={{ display: 'inline' }}>+ {show(qc.checked_only)} checked visually</span>}
            <DefectsLink to={b.defects_link} />
          </div>
        </>
      )}
      <MachineData md={b.machine_data} />
      {dims.length > 0 && (
        <details className="ph-det">
          <summary>Per-dimension QC ({dims.length})</summary>
          <div className="cx-tbl" style={{ maxHeight: 320 }}>
            <table className="data">
              <thead><tr><th>#</th><th>Dimension</th><th>Nominal</th><th>Tolerance</th><th>Measured</th><th>Instrument</th><th>Result</th></tr></thead>
              <tbody>
                {dims.map((x, i) => {
                  const [resLabel, cls] = dimResult(x);
                  const tol = x.tol_mm ?? x.tolerance ?? x.tol;
                  const rd = Array.isArray(x.readings) ? x.readings.filter(v => typeof v === 'number') : null;
                  const measured = rd && rd.length ? (rd.length === 1 ? fmtNum(rd[0], 3) : `${fmtNum(Math.min(...rd), 3)} – ${fmtNum(Math.max(...rd), 3)} (${rd.length})`) : (Array.isArray(x.measured) ? x.measured.join(' / ') : show(x.measured));
                  return (
                    <tr key={i} className={cls === 'b-fail' ? 'flag' : ''}>
                      <td className="mono">{show(x.sl ?? x.sl_no ?? i + 1)}</td>
                      <td className="mono">{txt(x.dim || x.description || x.name || x.dimension)}</td>
                      <td className="mono">{show(x.nominal)}</td>
                      <td className="mono">{Array.isArray(tol) ? tol.map(v => (v > 0 ? `+${v}` : v)).join(' / ') : show(tol)}</td>
                      <td className="mono">{measured}</td>
                      <td className="cell-sub" style={{ display: 'table-cell' }}>{show(x.instrument)}</td>
                      <td><span className={`badge ${cls}`}>{resLabel}</span>{x.remark && String(x.remark).trim().toLowerCase() !== resLabel.toLowerCase() && <span className="cell-sub" style={{ display: 'inline', marginLeft: 6 }}>{txt(x.remark)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {ops.length > 0 && (
        <details className="ph-det">
          <summary>Program that ran — {ops.length} operations · {fmtMin(prog.total_minutes)}</summary>
          <div className="cx-tbl" style={{ maxHeight: 360 }}>
            <table className="data">
              <thead><tr><th>Operation</th><th>Tool</th><th>Setup</th><th>RPM</th><th>Feed mm/min</th><th style={{ textAlign: 'right' }}>Minutes</th></tr></thead>
              <tbody>
                {ops.map((o, i) => (
                  <tr key={i}>
                    <td className="mono">{txt(o.op || o.name || o.toolpath)}</td>
                    <td className="mono">{txt(o.tool)}</td>
                    <td className="mono">{show(o.setup)}</td>
                    <td className="mono">{fmtNum(o.rpm, 0)}</td>
                    <td className="mono">{fmtNum(o.feed_mm_min, 0)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtMin(o.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {(b.sources || []).length > 0 && (
        <details className="ph-det">
          <summary>Where this came from ({b.sources.length} files)</summary>
          <ul className="pg-notes" style={{ marginTop: 0 }}>{b.sources.map((x, i) => <li key={i}>{show(x)}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
