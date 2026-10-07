import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import KpiStrip from '../components/KpiStrip';
import { VerdictBadge } from '../components/Badges';
import { INSPECTION_BY_PART } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

// Where the 3D QC view is served from: the labeling app in the shiaanx-CAPP repo, running on this
// computer. It maps each ballooned drawing dimension to the CAD faces it measures and colours the
// result, so the report can be read without knowing the drawing.
const QC_VIEW_URL = 'http://localhost:8780';

function QcView3D({ tmpl, linkedJob, onLink }) {
  const [jobs, setJobs] = useState(null); // null = loading, false = not reachable, [] = none tagged
  const [pick, setPick] = useState('');
  useEffect(() => {
    let dead = false;
    fetch(`${QC_VIEW_URL}/api/dimension-jobs`).then(r => r.json())
      .then(d => { if (!dead) setJobs(d.jobs || []); })
      .catch(() => { if (!dead) setJobs(false); });
    return () => { dead = true; };
  }, []);

  return (
    <div className="card" data-qc3d>
      <h2><Icon name="cad" /> 3D QC view</h2>
      {jobs === null && <div className="empty-hint">Looking for the 3D QC view…</div>}
      {jobs === false && (
        <div className="empty-hint">
          The 3D QC view is not running on this computer. It is the labeling app — start it with run.bat in the labeling_app folder, then reload this page.
        </div>
      )}
      {jobs && linkedJob && (
        <>
          <div className="cell-sub" style={{ marginBottom: 10 }}>
            Showing tagged part {(jobs.find(j => j.job_id === linkedJob) || {}).original_name || linkedJob}.{' '}
            <button type="button" className="btn-text" onClick={() => onLink(null)}>Change</button>
          </div>
          <iframe title="3D QC view" src={`${QC_VIEW_URL}/inspection?job=${linkedJob}`}
            style={{ width: '100%', height: 760, border: '1px solid var(--border)', borderRadius: 10 }} />
        </>
      )}
      {jobs && !linkedJob && (jobs.length === 0 ? (
        <div className="empty-hint">No part has its drawing dimensions tagged to the CAD yet. Tag one in the labeling app (Dimensions page) and it will be offered here.</div>
      ) : (
        <>
          <p className="page-sub" style={{ margin: '0 0 12px' }}>
            Pick the tagged part that corresponds to this one. Tagging is done once per part in the labeling app, with its ballooned drawing and QC sheet.
          </p>
          <div className="field">
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Tagged part">
                <option value="">Select a tagged part…</option>
                {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.original_name} — {j.tagged_count} of {j.dimension_count} dimensions tagged</option>)}
              </select>
              <button type="button" className="btn px-btn-primary" disabled={!pick} onClick={() => onLink(pick)}>Show</button>
            </div>
          </div>
        </>
      ))}
    </div>
  );
}

// The inspection report view for one part — where its dimensions (the quality data) are shown.
// Opened from View on the part's Inspection report line. The uploaded report file itself opens
// from here; dimension-by-dimension results show for parts that have them recorded.
export default function Inspection() {
  const { part } = useParams();
  const navigate = useNavigate();
  const { rows, partLibrary, artifactState, openFile, patchPartLibrary } = useProtoData();
  const back = <button type="button" className="back-link" onClick={() => navigate(-1)}><Icon name="back" /> Back</button>;

  const owner = rows.find(r => r.parts.some(p => p.name === part));
  const partIndex = owner ? owner.parts.findIndex(p => p.name === part) : -1;
  const docs = owner ? (artifactState[owner.orderId] || artifactState[owner.id] || {}) : {};
  const uploaded = docs[`p${partIndex}.inspReport`] || (partIndex === 0 ? docs.inspReport : null);
  const reportKey = uploaded && uploaded.fileKey;

  const tmpl = owner && partIndex >= 0 ? owner.parts[partIndex].tmpl : null;
  const recorded = INSPECTION_BY_PART[part];
  const dims = recorded ? recorded.dims : (tmpl && partLibrary[tmpl] && partLibrary[tmpl].dims) || null;
  const s = recorded && recorded.summary;

  return (
    <div>
      {back}
      <div className="page-head">
        <div><h1>Inspection report</h1><div className="page-sub">{part}{recorded ? ` · part_job ${recorded.job}` : ''}</div></div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost" disabled={!reportKey} onClick={() => openFile(reportKey)}
            title={reportKey ? '' : 'No report file has been uploaded for this part'}>
            <Icon name="doc" size={14} /> Open uploaded report
          </button>
        </div>
      </div>
      {tmpl && (
        <QcView3D tmpl={tmpl} linkedJob={(partLibrary[tmpl] || {}).qcJobId || null}
          onLink={(jobId) => patchPartLibrary(tmpl, { qcJobId: jobId })} />
      )}
      <div className="card">
        <h2><Icon name="box" /> Dimensions</h2>
        {s && (
          <KpiStrip style={{ marginBottom: 16 }} items={[
            { n: `${s.pass}/${s.total}`, l: 'Within tolerance', cls: 'ok' },
            { n: s.near, l: 'Close to limit', cls: 'warn' },
            { n: s.fail, l: 'Out of tolerance', cls: 'err' },
            { n: recorded.ncr ? 1 : 0, l: 'NCR raised' },
          ]} />
        )}
        {dims ? (
          <>
            <div className="dim-list">
              {dims.map(d => (
                <div className="dim-row" key={d.b}>
                  <div className={`dim-ball ${d.v}`}>{d.b}</div>
                  <div className="dim-main"><b>{d.label}</b><span>Balloon {d.b}{d.v === 'fail' && recorded && recorded.ncr ? ` · ${recorded.ncr} raised` : ''}</span></div>
                  <VerdictBadge v={d.v} />
                </div>
              ))}
            </div>
            {s && dims.length < s.total && <div className="cell-sub" style={{ marginTop: 10 }}>Showing {dims.length} of {s.total} dimensions.</div>}
          </>
        ) : (
          <div className="empty-hint">
            No dimension results are recorded for this part yet. {reportKey ? 'The uploaded report opens from the button above; its readings are not read into this view yet.' : 'Upload the inspection report on the job first.'}
          </div>
        )}
      </div>
    </div>
  );
}
