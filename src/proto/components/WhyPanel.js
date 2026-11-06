import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../icons';
import { VerdictBadge, ConfidenceBadge } from './Badges';
import { gradeDim, causesFor, cuttersOf, Readings, CutterTable, RANK } from './DefectsWhy';
import MOTOR_MOUNT_CLOSED_LOOP from '../demoData/motorMountClosedLoop';
import { ruleFor } from '../demoData/rulesLibrary';

// "Why" under the QC 3D view: each out-of-tolerance or close-to-limit dimension with its likely cause,
// the toolpath that cut it, and the rule in the library it matches. Same grading and cause logic as the
// Closed Loop page (DefectsWhy), so the two always agree. Motor Mount only: that is the part with data.
export const hasWhyData = (part) => !!part && /motor\s*mount/i.test(part.name || '');

export default function WhyPanel() {
  const data = MOTOR_MOUNT_CLOSED_LOOP;
  const [runId, setRunId] = useState(data.runs[data.runs.length - 1].id);
  const [open, setOpen] = useState(null);
  const gradedByRun = useMemo(() => Object.fromEntries(data.runs.map(r => [r.id, r.dims.map(gradeDim)])), [data]);
  const run = data.runs.find(r => r.id === runId);
  const issues = gradedByRun[run.id].filter(g => g.verdict === 'fail' || g.verdict === 'near')
    .sort((a, b) => RANK[b.verdict] - RANK[a.verdict] || b.worst.use - a.worst.use);

  return (
    <div data-why-panel style={{ marginTop: 18 }}>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Why defects happen</h3>
        <select aria-label="Batch" value={run.id} onChange={e => { setRunId(e.target.value); setOpen(null); }}
          style={{ marginLeft: 'auto', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--ink)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5 }}>
          {data.runs.map(r => <option key={r.id} value={r.id}>{r.label} · {r.pieces.length} parts</option>)}
        </select>
      </div>
      {issues.length === 0 && <p className="page-sub">Every measured dimension is within tolerance in this batch.</p>}
      {issues.map(g => {
        const feat = data.features[g.sl];
        const causes = causesFor(g, feat, cuttersOf(run, g.sl), run, data, gradedByRun);
        const isOpen = open === g.sl;
        const top = causes[0];
        const rule = top && ruleFor(top.title);
        return (
          <div key={g.sl} className="card" style={{ marginBottom: 10 }} data-why={g.sl}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : g.sl)}>
              <Icon name="quality" /> <b>#{g.sl} {g.label} ±{g.tolPlus}</b> <VerdictBadge v={g.verdict} />
              <span className="cell-sub" style={{ flex: 1, minWidth: 180 }}>{top ? top.title : ''}</span>
              {rule && <Link to={`/proto/factory?tab=rules&rule=${rule.id}`} className="badge b-quoted" onClick={e => e.stopPropagation()}>Rule {rule.id}</Link>}
              <span className="cell-sub">{isOpen ? 'Hide' : 'Show why'}</span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12 }}>
                <dl className="kv wide" style={{ marginBottom: 12 }}>
                  <dt>Readings</dt><dd><Readings g={g} /></dd>
                  {feat && <><dt>Feature</dt><dd>{feat.feature}</dd></>}
                </dl>
                <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>Cut by</h4>
                <CutterTable cutters={cuttersOf(run, g.sl)} />
                <h4 style={{ fontSize: 13, margin: '14px 0 8px' }}>Likely cause</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {causes.map(c => {
                    const rl = ruleFor(c.title);
                    return (
                      <div key={c.title}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.title} {c.confidence !== 'none' && <ConfidenceBadge c={c.confidence} />}
                          {rl && <Link to={`/proto/factory?tab=rules&rule=${rl.id}`} className="badge b-quoted" style={{ marginLeft: 6 }}>Rule {rl.id}</Link>}</div>
                        <div className="page-sub" style={{ marginTop: 3 }}>{c.detail}</div>
                        {rl && <div className="cell-sub" style={{ marginTop: 3 }}>Rule {rl.id}: {rl.rule}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
