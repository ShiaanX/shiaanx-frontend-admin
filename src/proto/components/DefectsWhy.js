import React, { useMemo } from 'react';
import Icon from '../icons';
import KpiStrip from './KpiStrip';
import { VerdictBadge, ConfidenceBadge } from './Badges';

// "Defects & why": every inspected dimension of a part, graded from its raw readings, linked to the
// toolpath(s) and tool that cut that feature, with the likely cause worked out from the data.
// Nothing here is a typed-in verdict or cause — data comes from demoData/motorMountClosedLoop.js
// (generated from the real inspection reports and NC programs), and the grading and cause rules
// below run on it at render time.

const EPS = 1e-6;
const NEAR_FRACTION = 0.8; // a reading using ≥80% of its tolerance band is "close to limit"
const r3 = (v) => Math.round(v * 1000) / 1000;
const fmt = (v, d = 2) => (v === null || v === undefined ? '—' : Number(v).toFixed(d));
const sgn = (v) => (v > 0 ? `+${fmt(v)}` : fmt(v));
const span = (a, b) => (fmt(a) === fmt(b) ? fmt(a) : `${fmt(a)}–${fmt(b)}`);
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// One reading against nominal ± tol.
function gradeReading(value, nominal, tolPlus, tolMinus) {
  const dev = r3(value - nominal);
  const tol = dev >= 0 ? tolPlus : tolMinus;
  if (dev > tolPlus + EPS || dev < -tolMinus - EPS) return { dev, v: 'fail', use: Math.abs(dev) / tol };
  if (tol > 0 && Math.abs(dev) >= NEAR_FRACTION * tol - EPS) return { dev, v: 'near', use: Math.abs(dev) / tol };
  return { dev, v: 'pass', use: tol > 0 ? Math.abs(dev) / tol : 0 };
}

const RANK = { fail: 3, near: 2, pass: 1, checked: 0 };

export function gradeDim(d) {
  const readings = [];
  Object.entries(d.readings || {}).forEach(([piece, vals]) => vals.forEach(value => {
    if (d.nominal === null || d.tolPlus === null) return;
    readings.push({ piece, value, ...gradeReading(value, d.nominal, d.tolPlus, d.tolMinus) });
  }));
  if (!readings.length) return { ...d, readings: [], verdict: 'checked', worst: null, failPieces: [], pieces: Object.keys(d.notes || {}) };
  const worst = readings.reduce((a, b) => (b.use > a.use ? b : a));
  const verdict = readings.reduce((a, b) => (RANK[b.v] > RANK[a] ? b.v : a), 'pass');
  const pieces = [...new Set(readings.map(r => r.piece))];
  const failPieces = [...new Set(readings.filter(r => r.v === 'fail').map(r => r.piece))];
  const values = readings.map(r => r.value);
  // How much of its tolerance each part uses at its worst reading: tells one bad part from a batch offset.
  const pieceUse = pieces.map(p => Math.max(...readings.filter(r => r.piece === p).map(r => r.use)));
  const meanDev = r3(readings.reduce((a, r) => a + r.dev, 0) / readings.length);
  return { ...d, readings, verdict, worst, pieces, failPieces, pieceUse, medianUse: median(pieceUse), meanDev, min: Math.min(...values), max: Math.max(...values) };
}

// The toolpaths that cut a dimension's feature, finishing/drilling first (they set the size).
function cuttersOf(run, sl) {
  const byName = new Map(run.toolpaths.map(t => [t.name, t]));
  const links = (run.links[sl] || []).map(l => ({ ...byName.get(l.toolpath), evidence: l.evidence })).filter(t => t.name);
  const order = { finish: 0, drill: 1, rough: 2 };
  return links.sort((a, b) => order[a.role] - order[b.role] || a.setup - b.setup);
}

// Cause rules. Each returns null or { title, detail, confidence }.
function causesFor(g, feat, cutters, run, allRuns, gradedByRun) {
  const out = [];
  if (g.verdict === 'pass' || g.verdict === 'checked') return out;
  const sizing = cutters.filter(c => c.role !== 'rough');
  const under = g.worst && g.worst.dev < 0;

  // 1. Drawing and CAD disagree; QC accepted the part against CAD.
  if (feat && feat.cad !== null && Math.abs(feat.cad - g.nominal) > 0.01) {
    const vsCad = g.readings.map(r => r3(r.value - feat.cad));
    const within = vsCad.every(v => v <= g.tolPlus + EPS && v >= -g.tolMinus - EPS);
    if (within) {
      out.push({
        title: 'Drawing and CAD disagree — the part was machined to the CAD',
        detail: `Drawing calls ${g.label}; the CAD gives ${feat.cad} (${feat.cadBasis}). Against the CAD value every reading is within ±${g.tolPlus} (worst ${sgn(vsCad.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)))}).${g.remark && /cad/i.test(g.remark) ? ` QC remark on the report: “${g.remark}”.` : ''} The toolpath is not at fault; the drawing callout needs correcting.`,
        confidence: 'high — CAD value computed from the STEP file',
      });
      return out; // nothing else to explain
    }
  }

  // 2. A hole interpolated with a cutter much smaller than the hole came out undersize.
  const interp = sizing.find(c => /END ?MILL|ENDMILL/i.test(c.toolType || '') && c.toolDia && g.isDia && c.toolDia / g.nominal <= 0.7);
  if (interp && under) {
    const expected = interp.stockMm !== undefined ? r3(g.nominal - 2 * interp.stockMm) : null;
    const ld = interp.toolLength && interp.toolDia ? (interp.toolLength / interp.toolDia).toFixed(1) : null;
    out.push({
      title: `Small-cutter deflection: Ø${g.nominal} hole interpolated with a Ø${interp.toolDia} end mill`,
      detail: `${interp.name} (setting ${interp.setup}) cut this hole by circling a Ø${interp.toolDia} end mill${ld ? ` ${interp.toolLength} mm long (L/D ${ld})` : ''}${interp.spindleRpm ? ` at ${interp.spindleRpm} rpm / ${interp.cuttingFeed || interp.mainFeed} mm/min` : ''}.${expected !== null ? ` The program left ${interp.stockMm} mm stock, so it aimed for Ø${fmt(expected, 2)}; measured ${span(g.min, g.max)}, ${span(expected - g.max, expected - g.min)} mm short.` : ''} A slender cutter bends away from the wall and leaves the hole small; a drill or a stiffer finishing pass sizes it.`,
      confidence: 'medium — consistent with every reading, not yet confirmed on the machine',
    });
  }

  // 3. Programmed parameters on the implicated cutter differ from what CAPP recommended (override_log).
  (interp && under ? [interp] : []).forEach(c => {
    const notes = [];
    (c.overrides || []).filter(o => o.type === 'rpm_delta').forEach(o => notes.push(`spindle ${o.actualRpm} rpm vs auto-plan ${o.predictedRpm}`));
    if (c.cappFeed) notes.push(`feed ${c.cappFeed.actual} mm/min vs auto-plan ${c.cappFeed.predicted} (${(c.cappFeed.actual / c.cappFeed.predicted).toFixed(1)}×)`);
    if (notes.length) {
      out.push({
        title: `Programmer overrode the auto-plan's parameters on ${c.name}`,
        detail: `${notes.join('; ')}. A higher chip load on a Ø${c.toolDia} tool raises cutting force, which adds to deflection. From override_log.json and the baseline accuracy check.`,
        confidence: 'low — contributing factor',
      });
    }
  });

  // 4. Drilled hole oversize: twist drill, no finishing pass.
  const drill = sizing.filter(c => c.role === 'drill' && /DRILL/i.test(c.toolType || '') && !/CENTER/i.test(c.name) && c.toolDia)
    .sort((x, y) => y.toolDia - x.toolDia)[0]; // the largest drill is the one that sizes the hole
  if (drill && g.isDia && g.worst && g.worst.dev > 0 && !interp) {
    out.push({
      title: `Drilled without a finishing pass (${drill.name}, Ø${drill.toolDia} drill)`,
      detail: `${drill.name} drills straight to size at ${drill.spindleRpm} rpm. Twist drills cut slightly oversize, and a ±${g.tolPlus} band on Ø${g.nominal} leaves almost no margin. Measured up to ${fmt(g.max)} (${sgn(g.worst.dev)}).`,
      confidence: 'medium',
    });
  }

  // 5. A thickness made across two settings.
  const setups = [...new Set(sizing.map(c => c.setup))];
  if (feat && feat.crossSetup && setups.length > 1) {
    const siblings = Object.entries(allRuns.features).filter(([sl, f]) => f.crossSetup && Number(sl) !== g.sl)
      .map(([sl]) => gradedByRun[run.id].find(x => x.sl === Number(sl))).filter(Boolean);
    const sib = siblings.map(s => `${s.label} measured ${s.verdict === 'pass' ? 'in tolerance' : s.verdict === 'near' ? 'close to limit' : 'out of tolerance'} (${fmt(s.min)}–${fmt(s.max)})`).join('; ');
    const sibPass = siblings.length > 0 && siblings.every(s => s.verdict === 'pass');
    out.push({
      title: `Thickness made across settings ${setups.slice(0, -1).join(', ')} and ${setups[setups.length - 1]} — datum transfer on the flip`,
      detail: `The two faces are cut in different settings (${sizing.map(c => `${c.name} · S${c.setup}`).join(', ')}). Any Z-zero error after flipping the part shows up directly in this thickness.${sib ? ` For comparison, ${sib}, which shares the setting-1 face${sibPass ? ', so the error points at the setting-2 floor' : ''}.` : ''}`,
      confidence: 'medium — face-to-dimension link read off the drawing side view',
    });
  }

  // 6. Only some parts out: the program is the same for every part, so the cause is per part.
  if (g.pieces.length >= 3 && g.failPieces.length && g.failPieces.length < g.pieces.length / 2 && g.medianUse < NEAR_FRACTION) {
    out.push({
      title: `Only ${g.failPieces.length} of ${g.pieces.length} parts out (${g.failPieces.join(', ')})`,
      detail: 'Every part ran the same program, so a toolpath cannot explain one part being out. Look at clamping or distortion on that part, burrs, or a re-measure.',
      confidence: 'medium',
    });
  }

  // 6b. The whole batch sits at one edge of the band: a systematic offset, not one bad part.
  if (g.pieces.length >= 3 && g.medianUse >= NEAR_FRACTION) {
    out.push({
      title: `The whole batch is offset ${g.meanDev > 0 ? 'oversize' : 'undersize'} (mean ${sgn(g.meanDev)} mm)`,
      detail: `The typical part uses ${Math.round(g.medianUse * 100)}% of the ±${g.tolPlus} band at its worst reading, and ${g.failPieces.length} of ${g.pieces.length} go over. That is a fixed offset from the tool size, the program or the datum, not part-to-part scatter, so one offset correction would recentre the batch.`,
      confidence: 'high — every part shows it',
    });
  }

  // 7. Recurring across batches with different programs and machines.
  const other = allRuns.runs.find(r => r.id !== run.id);
  const og = other && gradedByRun[other.id].find(x => x.sl === g.sl);
  if (og && og.verdict === 'fail' && g.verdict === 'fail' && og.nominal === g.nominal) {
    out.push({
      title: 'Out in both batches, with different programs and machines',
      detail: `${other.label}: ${span(og.min, og.max)}. Changing the program did not fix it, so the cause sits outside one toolpath: the drawing value, the fixturing datum, or how it is measured.`,
      confidence: 'high — two independent batches',
    });
  }
  if (!out.length) out.push({ title: 'No cause identified from the data available', detail: 'The linked toolpaths show nothing unusual. Needs machine telemetry or a re-measure.', confidence: 'none' });
  return out;
}

function Readings({ g }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {g.readings.map((r, i) => (
        <span key={i} className={`badge ${r.v === 'fail' ? 'b-fail' : r.v === 'near' ? 'b-near' : 'b-pass'}`} style={{ textTransform: 'none' }} title={`${r.piece}: ${r.value} (${sgn(r.dev)})`}>
          {r.piece} {fmt(r.value)} <span style={{ opacity: .75 }}>{sgn(r.dev)}</span>
        </span>
      ))}
    </div>
  );
}

function CutterTable({ cutters }) {
  if (!cutters.length) return <p className="cell-sub" style={{ margin: 0 }}>No toolpath linked: the geometric scan found no cutter on this feature.</p>;
  return (
    <div className="overflow-x">
      <table className="data">
        <thead><tr><th>Toolpath</th><th>Role</th><th>Setting</th><th>Tool</th><th>S / F</th><th>Stock</th><th>Why linked</th></tr></thead>
        <tbody>
          {cutters.map(c => (
            <tr key={c.name}>
              <td className="mono cell-primary">{c.name}</td>
              <td><span className={`badge ${c.role === 'rough' ? 'b-neutral' : 'b-quoted'}`}>{c.role}</span></td>
              <td className="mono">{c.setup}</td>
              <td className="mono">{c.toolType} Ø{c.toolDia}{c.toolLength ? ` · L${c.toolLength}` : ''}</td>
              <td className="mono">{c.spindleRpm ?? '—'} / {c.cuttingFeed ?? c.mainFeed ?? '—'}</td>
              <td className="mono">{c.stockMm !== undefined ? c.stockMm : '—'}</td>
              <td className="cell-sub" style={{ minWidth: 200 }}>{c.evidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DefectsWhy({ data, runId, onRunChange }) {
  const gradedByRun = useMemo(() => Object.fromEntries(data.runs.map(r => [r.id, r.dims.map(gradeDim)])), [data]);
  const run = data.runs.find(r => r.id === runId) || data.runs[0];
  const graded = gradedByRun[run.id];
  const measured = graded.filter(g => g.verdict !== 'checked');
  const issues = graded.filter(g => g.verdict === 'fail' || g.verdict === 'near')
    .sort((a, b) => RANK[b.verdict] - RANK[a.verdict] || b.worst.use - a.worst.use);
  const passing = graded.filter(g => g.verdict === 'pass' || g.verdict === 'checked');
  const count = (v) => measured.filter(g => g.verdict === v).length;
  const other = data.runs.find(r => r.id !== run.id);

  return (
    <div data-defects-why>
      <div className="toolbar">
        <select aria-label="Batch" value={run.id} onChange={e => onRunChange(e.target.value)}
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--ink)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5 }}>
          {data.runs.map(r => <option key={r.id} value={r.id}>{r.label} · {r.pieces.length} parts</option>)}
        </select>
        <span className="cell-sub">{data.part} · {data.partNumber} · {data.material}</span>
      </div>
      <KpiStrip items={[
        { n: run.pieces.length, l: 'Parts inspected' },
        { n: measured.length, l: 'Dimensions measured' },
        { n: count('pass'), l: 'Within tolerance', cls: 'ok' },
        { n: count('near'), l: 'Close to limit', cls: 'warn' },
        { n: count('fail'), l: 'Out of tolerance', cls: count('fail') ? 'err' : 'ok' },
      ]} />
      <p className="page-sub" style={{ margin: '10px 0 18px' }}>
        Graded here from the raw readings (any reading outside ±tol = out; ≥{NEAR_FRACTION * 100}% of tol = close to limit), not from the remark column.
        Inspection: <span className="mono">{run.inspectionSource}</span> · CAM: <span className="mono">{run.camSource}</span>
      </p>

      {issues.length === 0 && <div className="card"><p style={{ margin: 0 }}>Every measured dimension is within tolerance in this batch.</p></div>}
      {issues.map(g => {
        const feat = data.features[g.sl];
        const cutters = cuttersOf(run, g.sl);
        const causes = causesFor(g, feat, cutters, run, data, gradedByRun);
        const og = other && gradedByRun[other.id].find(x => x.sl === g.sl);
        return (
          <div className="card" key={g.sl} data-defect={g.sl}>
            <h2 style={{ flexWrap: 'wrap' }}>
              <Icon name="quality" /> #{g.sl} {g.label} ±{g.tolPlus}
              <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13 }}>— {feat ? feat.feature : ''}</span>
              <VerdictBadge v={g.verdict} />
            </h2>
            <dl className="kv wide" style={{ marginBottom: 14 }}>
              <dt>Readings</dt><dd><Readings g={g} /></dd>
              <dt>Worst</dt><dd className="mono">{fmt(g.worst.value)} ({sgn(g.worst.dev)} on ±{g.tolPlus}, {g.worst.piece}){g.failPieces.length ? ` · ${g.failPieces.length}/${g.pieces.length} parts out` : ''}</dd>
              {g.remark && <><dt>QC remark</dt><dd>“{g.remark}”</dd></>}
              {og && <><dt>{other.id === 'run1' ? 'Batch 1' : 'Batch 2'}</dt><dd>{og.label} → {og.verdict === 'checked' ? 'not measured numerically' : span(og.min, og.max)} <VerdictBadge v={og.verdict === 'checked' ? 'pass' : og.verdict} />
                {og.verdict === 'pass' && g.verdict === 'fail' && other.id === 'run2' && <span className="cell-sub"> fixed there by {cuttersOf(other, g.sl).filter(c => c.role !== 'rough').map(c => c.name).join(', ') || 'a different program'}</span>}</dd></>}
            </dl>
            <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Cut by <span className="cell-sub">· link confidence: {feat ? feat.linkConfidence : '—'}</span></h3>
            <CutterTable cutters={cutters} />
            <h3 style={{ fontSize: 13, margin: '16px 0 8px' }}>Likely cause</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {causes.map(c => (
                <div key={c.title}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.title} {c.confidence !== 'none' && <ConfidenceBadge c={c.confidence} />}</div>
                  <div className="page-sub" style={{ marginTop: 3 }}>{c.detail}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>#</th><th>Dimension</th><th>Feature</th><th>Readings</th><th>Worst dev.</th><th>Result</th><th>Finished by</th></tr></thead>
          <tbody>
            {passing.map(g => {
              const feat = data.features[g.sl];
              const fin = cuttersOf(run, g.sl).filter(c => c.role !== 'rough');
              return (
                <tr key={g.sl}>
                  <td className="mono">{g.sl}</td>
                  <td className="mono cell-primary">{g.label}{g.tolPlus !== null ? ` ±${g.tolPlus}` : ''}</td>
                  <td className="cell-sub">{feat ? feat.feature : g.instrument}</td>
                  <td className="mono">{g.verdict === 'checked' ? Object.values(g.notes)[0] || '—' : span(g.min, g.max)}</td>
                  <td className="mono">{g.worst ? sgn(g.worst.dev) : '—'}</td>
                  <td>{g.verdict === 'checked' ? <span className="badge b-neutral">{g.remark || 'checked'}</span> : <VerdictBadge v="pass" />}</td>
                  <td className="mono cell-sub">{fin.length ? fin.map(c => c.name).join(', ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="page-sub">{data.telemetry}</p>
      <p className="page-sub">How toolpaths are linked: {data.frames} Wall and floor links (widths and thicknesses) are lower confidence than hole links.</p>
    </div>
  );
}
