import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Icon from '../icons';
import KpiStrip from '../components/KpiStrip';
import { useProtoData } from '../ProtoDataContext';
import { programImageUrl, openV3Console, isLocalHost } from '../cappApi';
import { useCappJob, partKeyOf } from '../cappJobStore';
import { CappError, Spinner, show, fmtNum } from '../components/capp/CappCommon';
import {
  useProgram, useApproveProgram, programFacts, dirLabel, toolName, fmtMin, holdingOf, billetOf, liveSetupFor,
  Planning, FlowSteps, ApprovedLine,
} from '../components/capp/ProgramCard';
import '../components/capp/program.css';

// The full AI process plan & CAM program for one part of an order (#/proto/program/:orderId/:partIdx):
// setups, the PowerMill toolpaths grouped by setup, the tools and the program's images, all from
// GET {CAPP}/jobs/{id}/program. The toolpaths themselves are in the PowerMill project it names.
export default function ProgramPage() {
  const { orderId, partIdx } = useParams();
  const navigate = useNavigate();
  const { findRow } = useProtoData();
  const row = findRow(orderId);
  const partIndex = Number(partIdx) || 0;
  const part = row && row.parts[partIndex];
  const { entry } = useCappJob(partKeyOf(part));
  const jobId = entry && entry.jobId;
  const savedPlan = part && part.autoQuote && part.autoQuote.data && part.autoQuote.data.aiPlan;
  const { res, asked, generate } = useProgram(jobId, { approvedBefore: savedPlan && savedPlan.jobId === jobId });
  const [approvedNow, setApprovedNow] = useState(null);
  const { approve, busy, error, done } = useApproveProgram(row || { parts: [] }, partIndex, jobId, (out) => setApprovedNow((out && out.approved) || null));

  if (!row || !part) return <div className="empty-hint">Order or part not found.</div>;
  const back = row.isOrder ? `/proto/orders/${row.uuid}` : `/proto/enquiries/${row.uuid}`;
  const head = (
    <>
      <button type="button" className="back-link" onClick={() => navigate(back)}><Icon name="back" /> Back to {row.orderId || row.id}</button>
      <div className="detail-head">
        <div>
          <div className="detail-title"><h1>{part.name} — process plan &amp; CAM program</h1></div>
          <div className="page-sub" style={{ marginTop: 2 }}>{row.orderId || row.id} · {row.customer} · qty {part.qty || 1} · {part.material || '—'} · AI planner v3</div>
        </div>
      </div>
    </>
  );
  if (!jobId) {
    return <div>{head}<div className="card"><p style={{ margin: 0 }}>No analysis run for this part yet. <Link to={`/proto/enquiries/${row.uuid}`}>Run it on the attached STEP from the enquiry →</Link></p></div></div>;
  }
  if (!asked) {
    return <div>{head}<div className="card cx"><button type="button" className="btn px-btn-primary" onClick={generate}><Icon name="cam" size={14} /> Generate with AI (v3)</button></div></div>;
  }
  const p = res.data;
  if (!p) return <div>{head}<div className="card cx">{res.error ? <CappError message={res.error} onRetry={res.reload} /> : <Planning res={res} />}</div></div>;

  const { setups, tools, toolpathCount, cycle, live, plan } = programFacts(p);
  const approved = (done && done.approved) || approvedNow || p.approved || null;
  const scheduled = !!approved && ['SCHEDULING', 'PRODUCTION', 'QC', 'DISPATCHED', 'DELIVERED'].includes(part.jobStatus);
  const liveSetups = (live && live.setups) || [];
  // Setup cards: the plan's setups, with the live PowerMill run's setup for the same direction
  // (vise, stock block, PowerMill minutes, tools).
  const cards = (setups.length ? setups : liveSetups).map((s, i) => {
    const l = (setups.length ? liveSetupFor(live, s, i) : s) || {};
    const planTools = [...new Set((plan.tools || []).filter(t => t && t.setup === s.dir).map(toolName))];
    return {
      dir: s.dir || l.direction, workplane: s.workplane || l.workplane, name: l.name,
      holding: holdingOf(l) || holdingOf(s), billet: billetOf(l) || billetOf(s), heldOn: l.vise && l.vise.held_on,
      planMinutes: setups.length ? s.minutes : null, pmMinutes: l.powermill_minutes,
      tools: Array.isArray(l.tools) && l.tools.length ? l.tools : planTools,
    };
  });
  const tpMinutes = (t) => Number(t.powermill_minutes ?? t.minutes) || 0;
  const toolpaths = (live && live.toolpaths) || [];
  const groups = [];
  toolpaths.forEach(tp => {
    const k = tp.setup === undefined || tp.setup === null ? '—' : String(tp.setup);
    let g = groups.find(x => x.k === k);
    if (!g) {
      const ls = liveSetups.find(x => String(x.setup) === k);
      g = { k, dir: tp.direction || (ls && ls.direction), name: tp.setup_name || (ls && ls.name), items: [] };
      groups.push(g);
    }
    g.items.push(tp);
  });
  const images = (live && live.images) || [];
  // A note that only says the image list is empty adds nothing once the gallery is left out.
  const notes = (p.notes || []).filter(n => !(images.length === 0 && String(n).includes('images[]')));

  return (
    <div data-program-page>
      {head}
      <div className="card cx">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <FlowSteps generated={setups.length > 0} approved={!!approved} scheduled={scheduled} />
          <div className="pg-actions" style={{ marginTop: 0 }}>
            <ApprovedLine approved={approved} />
            {isLocalHost() && <button type="button" className="btn btn-ghost" onClick={openV3Console} data-program-console>Open v3 console (drives PowerMill) ↗</button>}
            {!approved && <button type="button" className="btn px-btn-primary" disabled={!!busy} onClick={() => approve(p)} data-program-approve><Icon name="quality" size={14} /> {busy ? 'Approving…' : 'Approve plan'}</button>}
            {approved && <Link className="btn px-btn-primary" to={`/proto/board?focus=${encodeURIComponent(part.uuid || part.name)}`}>See it on the production board →</Link>}
          </div>
        </div>
        {busy && <div className="cx-state" style={{ marginTop: 10 }}><Spinner /> {busy}</div>}
        {error && <div style={{ marginTop: 10 }}><CappError message={error} /></div>}
        <KpiStrip style={{ marginTop: 14 }} items={[
          { n: setups.map(s => dirLabel(s.dir)).join(' / ') || '—', l: `${setups.length} setup${setups.length === 1 ? '' : 's'}` },
          { n: tools.length || '—', l: 'Tools' },
          { n: toolpathCount === null ? '—' : toolpathCount, l: 'Toolpaths' },
          { n: fmtMin(cycle), l: 'AI cycle time / part' },
          ...(live && live.powermill_cutting_minutes_total !== undefined ? [{ n: fmtMin(live.powermill_cutting_minutes_total), l: 'PowerMill toolpath time' }] : []),
        ]} />
        {notes.length > 0 && <ul className="pg-notes">{notes.map((n, i) => <li key={i}>{show(n)}</li>)}</ul>}
      </div>

      <div className="card cx">
        <h2><Icon name="box" /> Setups</h2>
        {cards.length === 0 ? <p className="page-sub" style={{ margin: 0 }}>No setups in the plan.</p> : (
          <div className="pg-setups">
            {cards.map((s, i) => (
              <div className="pg-setup" key={i} data-program-setup>
                <div className="cell-sub">Setup {i + 1}{s.workplane ? ` · ${s.workplane}` : ''}</div>
                <div className="dir">{dirLabel(s.dir || s.name)}</div>
                <dl>
                  <dt>Held in</dt><dd>{show(s.holding)}{s.heldOn && <div className="cell-sub">on the {String(s.heldOn).split(' (')[0]}</div>}</dd>
                  <dt>Billet</dt><dd className="mono">{show(s.billet)}</dd>
                  {s.planMinutes !== null && s.planMinutes !== undefined && <><dt>AI plan</dt><dd className="mono">{fmtMin(s.planMinutes)}</dd></>}
                  {s.pmMinutes !== undefined && <><dt>PowerMill</dt><dd className="mono">{fmtMin(s.pmMinutes)}</dd></>}
                  {s.tools.length > 0 && <><dt>Tools</dt><dd style={{ fontSize: 12 }}>{s.tools.map(toolName).join(', ')}</dd></>}
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card cx">
        <h2><Icon name="cam" /> Toolpaths</h2>
        {!live ? <p className="page-sub" style={{ margin: 0 }}>No live PowerMill program for this part yet{(p.live_program && p.live_program.reason) ? `: ${show(p.live_program.reason)}` : '.'}</p> : toolpaths.length === 0 ? <p className="page-sub" style={{ margin: 0 }}>The live program has no toolpaths.</p> : (
          <div className="cx-tbl" style={{ maxHeight: 560 }}>
            <table className="data">
              <thead><tr><th>Toolpath</th><th>Tool</th><th>Role</th><th>Strategy</th><th>RPM</th><th>Feed mm/min</th><th style={{ textAlign: 'right' }}>Minutes</th></tr></thead>
              <tbody>
                {groups.map(g => (
                  <React.Fragment key={g.k}>
                    <tr className="pg-group"><td colSpan={6}>Setup {g.k}{g.dir ? ` · ${dirLabel(g.dir)}` : ''}{g.name ? ` (${g.name})` : ''} · {g.items.length} toolpath{g.items.length === 1 ? '' : 's'}</td><td className="mono" style={{ textAlign: 'right' }}>{fmtMin(g.items.reduce((s, t) => s + tpMinutes(t), 0))}</td></tr>
                    {g.items.map((tp, i) => (
                      <tr key={i}>
                        <td className="mono">{show(tp.name)}</td>
                        <td className="mono">{toolName(tp.tool)}</td>
                        <td>{show(tp.role)}</td>
                        <td className="cell-sub" style={{ display: 'table-cell' }}>{show(tp.strategy)}</td>
                        <td className="mono">{fmtNum(tp.rpm, 0)}</td>
                        <td className="mono">{fmtNum(tp.feed_mm_min, 0)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMin(tp.powermill_minutes ?? tp.minutes)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {live && live.powermill_minutes_basis && <div className="cell-sub" style={{ marginTop: 8 }}>{live.powermill_minutes_basis}</div>}
        {live && live.project_path && <div className="pg-pm" data-program-pm><b>Full toolpaths:</b> PowerMill project <span className="mono">{live.project_path}</span></div>}
      </div>

      <div className="card cx">
        <h2><Icon name="settings" /> Tools</h2>
        {tools.length === 0 ? <p className="page-sub" style={{ margin: 0 }}>No tools in the plan.</p> : (
          <div className="cx-tbl">
            <table className="data">
              <thead><tr><th>Tool</th><th>Used in setups</th><th style={{ textAlign: 'right' }}>Plan minutes</th></tr></thead>
              <tbody>
                {tools.map(t => {
                  const rows = (plan.tools || []).filter(x => toolName(x) === t);
                  const inSetups = [...new Set([...rows.map(x => x && x.setup).filter(Boolean), ...setups.filter(s => (s.tools || []).some(x => toolName(x) === t)).map(s => s.dir)])];
                  const mins = rows.reduce((s, x) => s + (Number(x && x.minutes) || 0), 0);
                  return <tr key={t}><td className="mono">{t}</td><td className="mono">{inSetups.map(dirLabel).join(' · ') || '—'}</td><td className="mono" style={{ textAlign: 'right' }}>{mins ? fmtMin(mins) : '—'}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="card cx">
          <h2><Icon name="cad" /> Program images</h2>
          <div className="pg-images">
            {images.map((im, i) => {
              const name = typeof im === 'string' ? im : (im.name || im.file);
              const cap = typeof im === 'string' ? im : (im.caption || im.label || im.name);
              return <figure key={i}><img src={programImageUrl(jobId, name)} alt={cap} loading="lazy" /><figcaption>{cap}</figcaption></figure>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
