import React from 'react';
import Icon from '../../icons';
import { getCmm } from '../../cappApi';
import { useCappResource, ResourceState, CappError, show } from './CappCommon';

function fmtTol(t) {
  if (t === null || t === undefined) return '—';
  if (typeof t === 'object') {
    const up = t.upper ?? t.upper_tol_mm ?? t.plus;
    const lo = t.lower ?? t.lower_tol_mm ?? t.minus;
    if (up !== undefined || lo !== undefined) return `+${show(up)} / −${show(lo)}`;
    return JSON.stringify(t);
  }
  return String(t);
}
function fmtNominal(n) {
  if (n && typeof n === 'object') return Object.entries(n).map(([k, v]) => `${k} ${show(v)}`).join(', ');
  return show(n);
}
const datumLabel = (x) => (x && typeof x === 'object' ? (x.label || x.name || x.id || JSON.stringify(x)) : String(x));
const EXT = { 'pc-dmis': 'prg', pcdmis: 'prg', dmis: 'dmi', calypso: 'txt' };

// CMM inspection program generated from datums + tolerances: GET /jobs/{id}/cmm.
export default function CmmPanel({ jobId, refreshKey }) {
  const res = useCappResource(() => getCmm(jobId), `${jobId}|${refreshKey || ''}`);
  const d = res.data;
  if (!d) return <div className="cx"><ResourceState res={res} runningText="Generating the CMM program…" /></div>;

  if (d.status === 'error') return <div className="cx"><CappError message={d.error || 'CMM program could not be generated'} onRetry={res.reload} /></div>;
  if (d.status === 'needs_tolerances' || d.needs_tolerances) {
    return (
      <div className="cx">
        <div className="stub-note" style={{ marginBottom: 0 }}>
          <Icon name="info" />
          <div>
            <b>Tolerances are needed before a CMM program can be written.</b>
            <div style={{ marginTop: 4 }}>{d.reason || d.message || 'The program measures each toleranced feature from datums A/B/C.'}</div>
            {Array.isArray(d.missing) && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{d.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>}
            <div style={{ marginTop: 6 }}>Upload the inspection report (.xlsx) on the job's Inspection report line, or tag the dimensions in the 3D QC view above, then reload.</div>
            <button type="button" className="btn-sm ghost" style={{ marginTop: 10 }} onClick={res.reload}>Reload</button>
          </div>
        </div>
      </div>
    );
  }

  const download = () => {
    const ext = EXT[String(d.program_format || '').toLowerCase()] || 'txt';
    const url = URL.createObjectURL(new Blob([d.program_text || ''], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = `cmm_program_${jobId.slice(0, 8)}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const features = d.features || [];

  return (
    <div className="cx" data-capp-cmm>
      <div className="cx-jobline" style={{ marginBottom: 12 }}>
        <span>Features <b>{show(d.count ?? features.length)}</b></span>
        <span>Datums <b className="mono">{Array.isArray(d.datums) ? d.datums.map(datumLabel).join(' · ') : show(d.datums)}</b></span>
        {d.matched_count !== undefined && <span>Matched to CAD <b>{d.matched_count}/{show(d.count ?? features.length)}</b></span>}
        {d.total_points !== undefined && <span>Touch points <b>{d.total_points}</b></span>}
        {d.program_format && <span className="cx-src">format: {d.program_format}</span>}
      </div>
      {(d.tolerance_source || d.datum_source) && (
        <dl className="kv" style={{ marginBottom: 12 }}>
          {d.tolerance_source && <><dt>Tolerances from</dt><dd>{d.tolerance_source}</dd></>}
          {d.datum_source && <><dt>Datums from</dt><dd>{d.datum_source}</dd></>}
        </dl>
      )}
      <div className="cx-sec">Features to inspect</div>
      <div className="cx-tbl" style={{ maxHeight: 300 }}>
        <table className="data">
          <thead><tr><th>ID</th><th>Characteristic</th><th>Type</th><th>Nominal</th><th>Tolerance</th><th>Probe strategy</th><th>Points</th></tr></thead>
          <tbody>
            {features.map((f, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontWeight: 700 }}>{show(f.id)}</td>
                <td>{show(f.characteristic)}</td>
                <td>{show(f.type)}{f.matched === false && <span className="cx-chip warn" style={{ marginLeft: 6 }}>not matched to CAD</span>}{f.cad_nominal_mismatch && <span className="cx-chip err" style={{ marginLeft: 6 }}>CAD ≠ drawing</span>}</td>
                <td className="mono">{fmtNominal(f.nominal)}</td>
                <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtTol(f.tolerance)}</td>
                <td>{show(f.probe_strategy)}</td>
                <td className="mono">{Array.isArray(f.points) ? f.points.length : show(f.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cx-sec">
        <span>Program</span>
        <button type="button" className="btn-sm primary" disabled={!d.program_text} onClick={download}><Icon name="download" size={12} /> Download</button>
      </div>
      <pre className="cx-code">{d.program_text || '(empty)'}</pre>
    </div>
  );
}
