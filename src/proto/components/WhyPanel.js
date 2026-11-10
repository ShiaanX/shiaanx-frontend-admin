import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../icons';
import { VerdictBadge, ConfidenceBadge } from './Badges';
import { gradeDim, causesFor, cuttersOf, Readings, CutterTable } from './DefectsWhy';
import MOTOR_MOUNT_CLOSED_LOOP from '../demoData/motorMountClosedLoop';
import { ruleFor } from '../demoData/rulesLibrary';

// "Why defects happen" under the QC 3D view. The list of dimensions comes from the SAME QC sheet results
// the 3D view colours (so a red or amber balloon is here, a green one is not). For each, the causes come
// from the closed-loop analysis of the batch(es) that actually produced the out-of-tolerance readings:
// the sheet pools every part measured, the closed loop keeps the batches apart (different programs and
// machines), so the cause is looked up per batch. Motor Mount only: that is the part with that data.
export const hasWhyData = (part) => !!part && /motor\s*mount/i.test(part.name || '');

const SHEET_VERDICT = { fail: 'fail', near_limit: 'near' };
const RANK = { fail: 2, near: 1 };
const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(2));

export default function WhyPanel({ results }) {
  const data = MOTOR_MOUNT_CLOSED_LOOP;
  const [open, setOpen] = useState(null);
  const gradedByRun = useMemo(() => Object.fromEntries(data.runs.map(r => [r.id, r.dims.map(gradeDim)])), [data]);
  if (!results) return null;

  const issues = results.filter(r => SHEET_VERDICT[r.verdict])
    .sort((a, b) => RANK[SHEET_VERDICT[b.verdict]] - RANK[SHEET_VERDICT[a.verdict]] || a.balloon - b.balloon);

  return (
    <div data-why-panel style={{ marginTop: 18 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Why defects happen</h3>
      <p className="page-sub" style={{ margin: '0 0 10px' }}>
        The dimensions marked red or amber above, with the likely cause for each, worked out per production batch. Rules link to the Factory rules library.
      </p>
      {issues.length === 0 && <p className="page-sub">Every measured dimension is within tolerance.</p>}
      {issues.map(row => {
        const sl = row.balloon;
        const feat = data.features[sl];
        const verdict = SHEET_VERDICT[row.verdict];
        const perBatch = data.runs.map(run => {
          const g = gradedByRun[run.id].find(x => x.sl === sl);
          if (!g || (g.verdict !== 'fail' && g.verdict !== 'near')) return null;
          return { run, g, cutters: cuttersOf(run, sl), causes: causesFor(g, feat, cuttersOf(run, sl), run, data, gradedByRun) };
        }).filter(Boolean);
        const top = perBatch[0] && perBatch[0].causes[0];
        const rule = top && ruleFor(top.title);
        const isOpen = open === sl;
        const label = (data.runs[0].dims.find(d => d.sl === sl) || {}).label || `${row.nominal}`;
        return (
          <div key={sl} className="card" style={{ marginBottom: 10 }} data-why={sl}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : sl)}>
              <Icon name="quality" /> <b>#{sl} {label} ±{row.tol_plus}</b> <VerdictBadge v={verdict} />
              <span className="cell-sub" style={{ flex: 1, minWidth: 180 }}>{top ? top.title : 'No cause identified from the data available'}</span>
              {rule && <Link to={`/proto/factory?tab=rules&rule=${rule.id}`} className="badge b-quoted" onClick={e => e.stopPropagation()}>Rule {rule.id}</Link>}
              <span className="cell-sub">{isOpen ? 'Hide' : 'Show why'}</span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12 }}>
                <dl className="kv wide" style={{ marginBottom: 12 }}>
                  <dt>Readings (QC sheet)</dt>
                  <dd className="mono">{(row.readings || []).map(fmt).join(' · ') || '—'} <span className="cell-sub">· nominal {fmt(row.nominal)} ±{row.tol_plus}</span></dd>
                  {feat && <><dt>Feature</dt><dd>{feat.feature}</dd></>}
                </dl>
                {perBatch.length === 0 && (
                  <p className="page-sub" style={{ margin: 0 }}>
                    Each production batch graded on its own is within tolerance for this dimension, so no toolpath cause can be pointed to. The sheet pools parts from different batches; check the individual readings above.
                  </p>
                )}
                {perBatch.map(({ run, g, cutters, causes }) => (
                  <div key={run.id} style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>{run.label} <VerdictBadge v={g.verdict} /></h4>
                    <div style={{ marginBottom: 8 }}><Readings g={g} /></div>
                    <CutterTable cutters={cutters} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
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
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
