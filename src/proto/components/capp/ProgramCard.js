import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../icons';
import KpiStrip from '../KpiStrip';
import { useProtoData } from '../../ProtoDataContext';
import { getProgram, approveProgram, openV3Console, CONSOLE_HELP } from '../../cappApi';
import { useCappJob, useAutoState, partKeyOf } from '../../cappJobStore';
import { useCappResource, CappError, Spinner, fmtNum, show, POLL_MS } from './CappCommon';
import { isOrdered } from '../ProcessChips';
import CappJobRunner from './CappJobRunner';
import V3RunSync from './V3RunSync';
import PowerMillButtons from './PowerMillButtons';
import './program.css';

// Process plan & CAM program (AI, v3) for one part of an order: GET /jobs/{id}/program on
// "Generate", then Approve → POST /jobs/{id}/program/approve, the part moves to Scheduling and the
// plan's cycle time is saved for the Production Board (ProtoDataContext.saveApprovedPlan).
// Every number shown is the service's; on an error the error is shown.

// Jobs whose program has been asked for in this browser, so coming back to the order page (or from
// the program page) shows it again without another click.
const GEN_KEY = 'sx_program_generated_v1';
function generatedJobs() { try { return JSON.parse(localStorage.getItem(GEN_KEY) || '[]') || []; } catch (e) { return []; } }
export function markGenerated(jobId) {
  const all = generatedJobs();
  if (all.includes(jobId)) return;
  try { localStorage.setItem(GEN_KEY, JSON.stringify([...all, jobId].slice(-50))); } catch (e) { /* storage blocked */ }
}

export const dirLabel = (d) => String(d || '—').replace(/^-/, '−');
export const toolName = (t) => (t && typeof t === 'object' ? (t.tool || t.name || t.id || show(t)) : show(t));
export const fmtMin = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : `${fmtNum(v, 1)} min`);
const fmtWhen = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : show(iso); };
// What the setup is held in: the live run's vise (grip axis, jaw gap, grip depth), or whatever text it gives.
export function holdingOf(s) {
  if (!s) return null;
  const v = s.vise;
  if (v && typeof v === 'object') {
    const bits = [v.grip_axis && `grip ${v.grip_axis}`, v.jaw_gap_mm !== undefined && `jaw gap ${fmtNum(v.jaw_gap_mm, 1)} mm`, v.grip_depth_mm !== undefined && `${fmtNum(v.grip_depth_mm, 1)} mm deep`].filter(Boolean);
    return `Vise${bits.length ? ` · ${bits.join(', ')}` : ''}`;
  }
  return s.workholding || v || s.fixture || s.holding || null;
}
// The stock block a setup starts from, as X × Y × Z mm.
export function billetOf(s) {
  const b = s && s.stock_block_mm;
  if (b && b.XMax !== undefined) return `${fmtNum(b.XMax - b.XMin, 1)} × ${fmtNum(b.YMax - b.YMin, 1)} × ${fmtNum(b.ZMax - b.ZMin, 1)} mm`;
  return (s && (s.billet || s.stock)) || null;
}
// The live PowerMill run's setup for a plan setup (same direction), if there is one.
export const liveSetupFor = (live, s, i) => {
  const ls = (live && live.setups) || [];
  return ls.find(x => x && (x.direction || x.dir) === s.dir) || (ls[i] && !(ls[i].direction || ls[i].dir) ? ls[i] : null);
};

export function programFacts(p) {
  const plan = (p && p.plan) || {};
  const live = p && p.live_program && p.live_program.available !== false ? p.live_program : null;
  const setups = plan.setups || [];
  const tools = new Set((plan.tools || []).map(toolName));
  if (!tools.size) setups.forEach(s => (s.tools || []).forEach(t => tools.add(toolName(t))));
  if (!tools.size && live) (live.toolpaths || []).forEach(tp => tp.tool && tools.add(toolName(tp.tool)));
  return { plan, live, setups, toolCount: tools.size, tools: [...tools], toolpathCount: live ? (live.toolpaths || []).length : null, cycle: plan.cycle_minutes_atc };
}

// Programs already fetched in this tab, by job id, so moving between the order page and the
// program page shows them at once instead of asking the service again (it can take a while).
const programCache = new Map();

// Loads the program once it has been asked for (or was approved before); polls while running.
export function useProgram(jobId, { approvedBefore } = {}) {
  const cached = jobId ? programCache.get(jobId) : null;
  const [asked, setAsked] = useState(() => !!jobId && (generatedJobs().includes(jobId) || !!approvedBefore));
  // Always HTTP 200: status "ok" with the plan, or the v3 state with plan null. Any state other than
  // unavailable / failed is still being worked out, so it is polled like "running".
  const fetcher = () => getProgram(jobId).then(d => { if (d && d.status === 'ok') programCache.set(jobId, d); return d; }).then(d => (d && d.status !== 'ok' && !d.plan && !['unavailable', 'failed'].includes(d.status) ? { ...d, status: 'running' } : d));
  const live = useCappResource(fetcher, `${jobId}`, { enabled: !!jobId && asked && !cached });
  const res = !live.data && !live.loading && !live.running && !live.error && cached ? { ...live, data: cached } : live;
  // A job started for this part elsewhere (the automatic planner) was already marked as asked for.
  useEffect(() => { if (jobId && !asked && generatedJobs().includes(jobId)) setAsked(true); }, [jobId, asked]);
  const generate = () => { markGenerated(jobId); if (asked) live.reload(); else setAsked(true); };
  return { res, asked: asked && !!jobId, generate };
}

// Approve: the service records who approved it, then the part goes to Scheduling and the plan's
// cycle time is saved for the board. Returns {approve, busy, error, done}.
export function useApproveProgram(row, partIndex, jobId, onApproved) {
  const { me, setPartStatus, saveApprovedPlan } = useProtoData();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { movedTo, at }
  const approve = async (program) => {
    const part = row.parts[partIndex];
    const by = (me && (me.name || me.email)) || 'Unknown user';
    setError('');
    try {
      setBusy('Recording the approval…');
      const out = await approveProgram(jobId, by);
      const approved = (out && out.approved) || { by, at: new Date().toISOString() };
      programCache.set(jobId, { ...program, approved });
      const { setups, cycle } = programFacts(out && out.plan ? out : program);
      setBusy('Saving the plan time for the production schedule…');
      await saveApprovedPlan(row.id, partIndex, {
        source: 'v3', jobId, cycleMinutesPerPart: Number(cycle) || null, setups: setups.length || null,
        totalMinutes: (program.plan && program.plan.total_minutes) || null, approvedBy: approved.by, approvedAt: approved.at,
      });
      const before = ['IN_QUEUE', 'PROCESS_PLANNING'].includes(part.jobStatus) || !part.jobStatus;
      if (before) {
        setBusy('Moving the part to Scheduling…');
        await setPartStatus(row.id, partIndex, 'SCHEDULING');
      }
      setDone({ movedTo: before ? 'SCHEDULING' : null, approved });
      if (onApproved) onApproved(out);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy('');
    }
  };
  return { approve, busy, error, done };
}

export function Planning({ res, auto }) {
  const ago = res.progress && res.progress.started_s_ago;
  return (
    <div className="cx-state" data-program-planning>
      <Spinner />
      <div>
        <div>{auto ? 'Planning started automatically…' : 'AI is planning this part…'}</div>
        <div className="cx-sub">Setups, tools and toolpaths from the STEP file{res.running ? ` · ${ago ? `started ${Math.round(ago)} s ago · ` : ''}checking every ${POLL_MS / 1000} s` : ''}</div>
      </div>
    </div>
  );
}

// Plan → Approve → Scheduled, as one line.
export function FlowSteps({ generated, approved, scheduled }) {
  const steps = [['AI plan', generated], ['Approved', approved], ['Scheduled on the board', scheduled]];
  return (
    <div className="pg-steps" data-program-steps>
      {steps.map(([l, on], i) => (
        <React.Fragment key={l}>
          {i > 0 && <span className={`pg-step-line ${on ? 'on' : ''}`} />}
          <span className={`pg-step ${on ? 'on' : ''}`}><span className="dot">{on ? '✓' : i + 1}</span>{l}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function ApprovedLine({ approved }) {
  if (!approved) return null;
  return <div className="pg-approved" data-program-approved><Icon name="quality" size={14} /> Approved by <b>{show(approved.by)}</b> at {fmtWhen(approved.at)}</div>;
}

// Per setup: direction, the vise it is held in (from the live run), its tools and the AI plan minutes.
export function SetupMiniTable({ setups, live, planTools }) {
  if (!setups.length) return null;
  const toolsIn = (s, ls) => {
    const fromPlan = new Set((planTools || []).filter(t => t && t.setup === s.dir).map(toolName));
    if (fromPlan.size) return fromPlan.size;
    if (Array.isArray(s.tools)) return s.tools.length;
    return ls && Array.isArray(ls.tools) ? ls.tools.length : null;
  };
  return (
    <div className="cx-tbl">
      <table className="data">
        <thead><tr><th>Setup</th><th>Direction</th><th>Held in</th><th>Tools</th><th style={{ textAlign: 'right' }}>AI plan min</th></tr></thead>
        <tbody>
          {setups.map((s, i) => {
            const ls = liveSetupFor(live, s, i);
            const n = toolsIn(s, ls);
            return (
              <tr key={i}>
                <td className="mono">{i + 1}</td>
                <td className="mono" style={{ fontWeight: 700 }}>{dirLabel(s.dir)} <span className="cell-sub" style={{ display: 'inline', fontWeight: 400 }}>{s.workplane || ''}</span></td>
                <td>{show(holdingOf(ls) || holdingOf(s))}</td>
                <td className="mono">{n === null ? '—' : n}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{fmtMin(s.minutes)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PartProgram({ row, partIndex }) {
  const part = row.parts[partIndex];
  const { entry } = useCappJob(partKeyOf(part));
  const autoState = useAutoState(partKeyOf(part));
  const jobId = entry && entry.jobId;
  const savedPlan = part.autoQuote && part.autoQuote.data && part.autoQuote.data.aiPlan;
  const approvedBefore = savedPlan && savedPlan.jobId === jobId ? savedPlan : null;
  const { res, asked, generate } = useProgram(jobId, { approvedBefore });
  const [approvedNow, setApprovedNow] = useState(null);
  const { approve, busy, error, done } = useApproveProgram(row, partIndex, jobId, (out) => setApprovedNow((out && out.approved) || null));

  if (!jobId) {
    if (autoState && autoState.state === 'starting') {
      return <div className="cx-state" data-program-planning><Spinner /><div><div>Planning started automatically…</div><div className="cx-sub">Reading the STEP file attached to {part.name}</div></div></div>;
    }
    return (
      <div data-program-nojob>
        {autoState && autoState.state === 'error' && (
          <div className="stub-note" style={{ margin: '0 0 12px' }} data-program-auto-error><Icon name="info" /><div><b>Planning could not be started automatically.</b><div style={{ marginTop: 4 }}>{autoState.text}</div></div></div>
        )}
        <p className="page-sub" style={{ margin: '0 0 10px', fontSize: 14 }}><b>No plan for {part.name} yet.</b> The AI plans from the part's STEP file. It starts by itself once the part is in Process planning; you can also start it here.</p>
        <CappJobRunner part={part} runLabel="Start planning from the attached STEP" />
      </div>
    );
  }

  const p = res.data;
  const approved = (done && done.approved) || approvedNow || (p && p.approved) || null;
  const scheduled = !!approved && ['SCHEDULING', 'PRODUCTION', 'QC', 'DISPATCHED', 'DELIVERED'].includes(part.jobStatus);

  if (!asked) {
    return (
      <div data-program-idle>
        <FlowSteps generated={false} approved={false} scheduled={false} />
        <p className="page-sub" style={{ margin: '10px 0 12px', fontSize: 14 }}>The AI works out the setups, tools, toolpaths and cycle time for {part.name} from its STEP file.</p>
        <button type="button" className="btn px-btn-primary" onClick={generate} data-program-generate><Icon name="cam" size={14} /> Generate with AI</button>
      </div>
    );
  }
  if (res.error) return <CappError message={res.error} onRetry={res.reload} />;
  if (!p) return <Planning res={res} auto={!!(entry && entry.auto)} />;

  const { setups, toolCount, toolpathCount, cycle, live, plan } = programFacts(p);
  const hasPlan = !!p.plan && (setups.length > 0 || cycle !== undefined);
  return (
    <div data-program-summary>
      <FlowSteps generated={hasPlan} approved={!!approved} scheduled={scheduled} />
      {!hasPlan && (
        <div className="stub-note" style={{ margin: '12px 0 0' }}><Icon name="info" /><div><b>{p.status === 'unavailable' ? 'A plan is not available for this part right now.' : p.status === 'failed' ? 'A plan could not be made for this part.' : `No plan came back${p.status ? ` (${show(p.status)})` : ''}.`}</b>{[p.error, p.reason, p.detail].filter(Boolean).map((n, i) => <div key={`e${i}`} style={{ marginTop: 4 }}>{show(n)}</div>)}{(p.notes || []).map((n, i) => <div key={i} style={{ marginTop: 4 }}>{show(n)}</div>)}</div></div>
      )}
      {hasPlan && (
        <>
          <KpiStrip style={{ marginTop: 14 }} items={[
            { n: setups.map(s => dirLabel(s.dir)).join(' / ') || '—', l: `${setups.length} setup${setups.length === 1 ? '' : 's'}` },
            { n: toolCount || '—', l: 'Tools' },
            { n: toolpathCount === null ? '—' : toolpathCount, l: live ? 'Toolpaths (PowerMill)' : 'Toolpaths · no live program' },
            { n: fmtMin(cycle), l: 'AI cycle time / part' },
          ]} />
          <div style={{ marginTop: 12 }}><SetupMiniTable setups={setups} live={live} planTools={plan.tools} /></div>
          {!live && <div className="cell-sub" style={{ marginTop: 8 }}>No live PowerMill program for this part yet — the plan above is the AI planner's.</div>}
        </>
      )}
      <V3RunSync jobId={jobId} partName={part.name} live={live} onDone={res.reload} />
      <PowerMillButtons />
      <div className="pg-actions">
        <Link className="btn btn-ghost" to={`/proto/program/${row.uuid}/${partIndex}`} data-program-view><Icon name="doc" size={14} /> View program</Link>
        <button type="button" className="btn btn-ghost" onClick={openV3Console} data-program-console>Open ShiaanX planner console (PowerMill) ↗</button>
        {!approved && hasPlan && (
          <button type="button" className="btn px-btn-primary" disabled={!!busy} onClick={() => approve(p)} data-program-approve>
            <Icon name="quality" size={14} /> {busy ? 'Approving…' : 'Approve plan'}
          </button>
        )}
        {!approved && <button type="button" className="btn-sm text" onClick={generate} disabled={!!busy}>Re-generate</button>}
        <ApprovedLine approved={approved} />
      </div>
      <div className="cell-sub" style={{ marginTop: 6 }} data-program-console-help>{CONSOLE_HELP}</div>
      {busy && <div className="cx-state" style={{ marginTop: 10 }}><Spinner /> {busy}</div>}
      {error && <div style={{ marginTop: 10 }}><CappError message={error} /></div>}
      {approved && (
        <div className="pg-success" data-program-success>
          <div>
            <b>{done && done.movedTo ? `Plan approved — ${part.name} is now in Scheduling.` : scheduled ? `Plan approved — ${part.name} is scheduled.` : 'Plan approved.'}</b>
            <div className="cx-sub">The production schedule now uses the AI plan's {fmtMin(cycle)} per part for this job.</div>
          </div>
          <Link className="btn px-btn-primary" to={`/proto/board?focus=${encodeURIComponent(part.uuid || part.name)}`} data-program-board>See it on the production board →</Link>
        </div>
      )}
    </div>
  );
}

export default function ProgramCard({ row, prominent }) {
  const parts = row.parts.map((p, i) => ({ p, i })).filter(({ p }) => isOrdered(p));
  const list = parts.length ? parts : row.parts.map((p, i) => ({ p, i }));
  const planning = list.findIndex(({ p }) => p.jobStatus === 'PROCESS_PLANNING');
  const [sel, setSel] = useState(planning >= 0 ? planning : 0);
  const cur = list[Math.min(sel, list.length - 1)];
  if (!cur) return null;
  return (
    <div className={`card ${prominent ? 'pg-prominent' : ''}`} data-program-card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}><Icon name="cam" /> Process plan &amp; CAM program (AI)</h2>
        {list.length > 1 && (
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <label style={{ whiteSpace: 'nowrap' }}>Part</label>
            <select value={sel} onChange={e => setSel(Number(e.target.value))}>
              {list.map(({ p }, k) => <option key={p.uuid || p.name} value={k}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="cx"><PartProgram key={cur.p.uuid || cur.p.name} row={row} partIndex={cur.i} /></div>
    </div>
  );
}
