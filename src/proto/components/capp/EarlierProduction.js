import React, { useEffect, useState } from 'react';
import Icon from '../../icons';
import { useProtoData } from '../../ProtoDataContext';
import { createCappJob, getProductionHistory } from '../../cappApi';
import { useCappJob, partKeyOf } from '../../cappJobStore';
import { useCappResource, fmtNum } from './CappCommon';
import { cappMaterialOf } from './CappJobRunner';
import MOTOR_MOUNT_CLOSED_LOOP from '../../demoData/motorMountClosedLoop';
import './earlier.css';

const tried = new Set(); // part keys whose analysis was started from here once

const signed = (r) => `${r >= 0 ? '+' : ''}${fmtNum(r * 100, 0)}%`;
const chipCls = (r) => (Math.abs(r) >= 0.15 ? 'b-fail' : Math.abs(r) >= 0.05 ? 'b-near' : 'b-pass');
const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));

function CycleCell({ s, max }) {
  const p = Number(s.programmed_minutes);
  const a = Number(s.actual_machine_minutes);
  const r = a / p - 1;
  return (
    <div className="ep-cell">
      <div className="ep-line">{fmtNum(p, 1)} → <b>{fmtNum(a, 1)}</b> min <span className={`badge ${chipCls(r)}`}>{signed(r)}</span></div>
      <div className="ep-bars" aria-hidden="true">
        <span className="plan" style={{ width: `${(p / max) * 100}%` }} />
        <span className={`real ${r > 0.05 ? 'over' : ''}`} style={{ width: `${(a / max) * 100}%` }} />
      </div>
    </div>
  );
}

function SpindleCell({ sp }) {
  if (!sp || !isNum(sp.programmed_rpm) || !isNum(sp.actual_median_rpm)) return <span className="ep-muted">not recorded</span>;
  const r = Number(sp.actual_median_rpm) / Number(sp.programmed_rpm) - 1;
  return <div className="ep-line">{fmtNum(sp.programmed_rpm, 0)} → <b>{fmtNum(sp.actual_median_rpm, 0)}</b> rpm <span className={`badge ${chipCls(r)}`}>{signed(r)}</span></div>;
}

// Gauge 50-150 %, tick at 100 %, the bar spans the override range the operator actually used.
function FeedCell({ fo }) {
  if (!fo || !isNum(fo.min_pct) || !isNum(fo.max_pct)) return <span className="ep-muted">not recorded</span>;
  const lo = Number(fo.min_pct); const hi = Number(fo.max_pct);
  const pos = (v) => Math.max(0, Math.min(100, v - 50));
  return (
    <div className="ep-cell">
      <div className="ep-line"><b>{lo === hi ? `${lo}%` : `${lo}–${hi}%`}</b></div>
      <div className="ep-gauge" aria-hidden="true">
        <span className="range" style={{ left: `${pos(lo)}%`, width: `${Math.max(2, pos(hi) - pos(lo))}%` }} />
        <span className="mid" />
      </div>
    </div>
  );
}

// Batch 1 (PowerMill program, no controller data): what the programmer ran against what the auto-plan
// would have recommended for the same tool. From the real program headers and the override log.
function Batch1Programs() {
  const run = MOTOR_MOUNT_CLOSED_LOOP.runs.find(r => r.id === 'run1');
  const rows = run.toolpaths.map(t => {
    const rpm = (t.overrides || []).find(o => o.type === 'rpm_delta');
    const feed = t.cappFeed;
    return rpm || feed ? { t, rpm, feed } : null;
  }).filter(Boolean);
  const ratios = rows.filter(r => r.feed).map(r => r.feed.actual / r.feed.predicted);
  const worst = rows.filter(r => r.feed).sort((a, b) => b.feed.actual / b.feed.predicted - a.feed.actual / a.feed.predicted)[0];
  const times = (v) => `${v >= 10 ? Math.round(v) : v.toFixed(1)}×`;
  return (
    <>
      <div className="ep-headline">
        Programmed feed ran <b>{times(Math.min(...ratios))} to {times(Math.max(...ratios))}</b> the auto-plan's on {rows.filter(r => r.feed).length} milling tools
        {worst && <> — most on the <b>Ø{worst.t.toolDia}</b> ({worst.feed.predicted} → {worst.feed.actual} mm/min)</>}
      </div>
      <div className="cx-tbl">
        <table className="data ep-tbl">
          <thead><tr><th>Setup</th><th>Toolpath</th><th>Tool</th><th>Spindle: auto-plan → programmed</th><th>Feed: auto-plan → programmed</th></tr></thead>
          <tbody>
            {rows.map(({ t, rpm, feed }) => {
              const fr = feed ? feed.actual / feed.predicted : null;
              const rr = rpm ? rpm.actualRpm / rpm.predictedRpm - 1 : null;
              return (
                <tr key={t.name} data-ep-b1={t.name}>
                  <td className="mono">Setup {t.setup}</td>
                  <td className="mono">{t.name}</td>
                  <td className="mono">{t.toolType === 'BALLNOSED' ? 'Ball' : 'End mill'} Ø{t.toolDia}</td>
                  <td>{rpm ? <div className="ep-line">{fmtNum(rpm.predictedRpm, 0)} → <b>{fmtNum(rpm.actualRpm, 0)}</b> rpm <span className={`badge ${chipCls(rr)}`}>{signed(rr)}</span></div> : <span className="ep-muted">—</span>}</td>
                  <td>{feed ? <div className="ep-line">{fmtNum(feed.predicted, 0)} → <b>{fmtNum(feed.actual, 0)}</b> mm/min <span className={`badge ${fr >= 2 ? 'b-fail' : 'b-near'}`}>{times(fr)}</span></div> : <span className="ep-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="page-sub" style={{ margin: '8px 0 0' }}>{run.label}. This batch has no controller recording, so only programmed values are compared with the auto-plan.</p>
    </>
  );
}

// Compact "earlier production" view of an ordered part: time spent vs planned, per setup, from the
// controller data of the part's earlier batch. Renders nothing when the part has no such history.
export default function EarlierProduction({ part }) {
  const { fetchFile, saveCappJobLink, rows } = useProtoData();
  const key = partKeyOf(part);
  const { entry, setEntry } = useCappJob(key);
  const jobId = entry && entry.jobId;
  const [view, setView] = useState('run2');   // run2 = batch 2 against its plan; run1 = batch 1 against the auto-plan

  useEffect(() => {
    if (jobId || !key || tried.has(key)) return;
    const server = part.autoQuote && part.autoQuote.data && part.autoQuote.data.cappJob;
    if (server && server.jobId) { setEntry({ jobId: server.jobId, fileName: server.fileName || '' }); return; }
    if (!part.fileKey) return;
    tried.add(key);
    (async () => {
      try {
        const f = await fetchFile(part.fileKey);
        if (!f) return;
        const name = f.name && f.name !== 'download' ? f.name : `${part.name}.step`;
        const out = await createCappJob(f.blob, name, part.name, cappMaterialOf(part.material));
        if (!out || !out.job_id) return;
        setEntry({ jobId: out.job_id, fileName: name });
        const owner = rows.find(r => r.parts.includes(part));
        if (owner) saveCappJobLink(owner.uuid, owner.parts.indexOf(part), { jobId: out.job_id, fileName: name }).catch(() => {});
      } catch (e) { tried.delete(key); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, key]);

  const res = useCappResource(() => getProductionHistory(jobId), `${jobId}`, { enabled: !!jobId });
  const batches = (res.data && res.data.batches) || [];
  const withData = batches.filter(b => b.machine_data && b.machine_data.available);
  const b = withData.find(x => x.id === 'run2') || null;
  if (!b) return null;

  const setups = (b.machine_data.setups || []);
  const rec = setups.filter(s => s.recorded && isNum(s.programmed_minutes) && isNum(s.actual_machine_minutes));
  if (!rec.length) return null;
  const plan = rec.reduce((t, s) => t + Number(s.programmed_minutes), 0);
  const real = rec.reduce((t, s) => t + Number(s.actual_machine_minutes), 0);
  const total = real / plan - 1;
  const max = Math.max(...rec.map(s => Math.max(Number(s.programmed_minutes), Number(s.actual_machine_minutes))));

  return (
    <div className="card" data-earlier-production>
      <h2><Icon name="cam" /> Earlier production of this part</h2>
      {/motor\s*mount/i.test(part.name || '') && (
        <div className="filter-pills" style={{ marginBottom: 10 }}>
          <div className={`pill ${view === 'run1' ? 'active' : ''}`} onClick={() => setView('run1')}>Batch 1 · as first made</div>
          <div className={`pill ${view === 'run2' ? 'active' : ''}`} onClick={() => setView('run2')}>Batch 2 · after the change</div>
        </div>
      )}
      {view === 'run1' ? <Batch1Programs /> : <>
      <div className="ep-headline">
        <b>{fmtNum(real, 0)} min</b> per part against <b>{fmtNum(plan, 0)}</b> planned <span className={`badge ${chipCls(total)}`}>{signed(total)}</span>
      </div>
      <div className="cx-tbl">
        <table className="data ep-tbl">
          <thead><tr><th>Setup</th><th>Cycle time</th><th>Spindle speed</th><th>Operator feed override</th></tr></thead>
          <tbody>
            {setups.map(s => (s.recorded && isNum(s.programmed_minutes) && isNum(s.actual_machine_minutes) ? (
              <tr key={s.setup} data-ep-setup={s.setup}>
                <td className="mono">Setup {s.setup}</td>
                <td><CycleCell s={s} max={max} /></td>
                <td><SpindleCell sp={s.spindle} /></td>
                <td><FeedCell fo={s.feed_override} /></td>
              </tr>
            ) : (
              <tr key={s.setup} data-ep-setup={s.setup}>
                <td className="mono">Setup {s.setup}</td>
                <td colSpan={3} className="ep-muted">not recorded</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <p className="page-sub" style={{ margin: '8px 0 0' }}>Feed override is the operator's knob on the machine (100% = the programmed feed), not the programmed feed itself.</p>
      </>}
    </div>
  );
}
