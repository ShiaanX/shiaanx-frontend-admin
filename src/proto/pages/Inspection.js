import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import KpiStrip from '../components/KpiStrip';
import { VerdictBadge } from '../components/Badges';
import { INSPECTION_BY_PART } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

// Where the 3D QC view is served from: the labeling app in the shiaanx-CAPP repo. On the dev server
// it sits behind the same address as this app; REACT_APP_QC_URL points elsewhere for local work.
// It maps each ballooned drawing dimension to the CAD faces it measures and colours the result, so
// the report can be read without knowing the drawing.
const QC_VIEW_URL = (process.env.REACT_APP_QC_URL || '').replace(/\/+$/, '');
// Added to the embedded page's address so a copy cached before an update is never reused.
const PAGE_LOAD = Date.now();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isXlsx = (name) => /\.xlsx$/i.test(name || '');

async function postFile(url, file, name) {
  const body = new FormData();
  body.append('file', file, name);
  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `The 3D QC service answered ${res.status}`);
  return data;
}

// The 3D QC view for one part, driven entirely from this part's own documents on the job:
//   - CAD file (STEP)                 -> the 3D model
//   - Inspection report as .xlsx      -> the balloon list, tolerances and measured readings
//   - Ballooned drawing (PDF)         -> opened alongside while tagging
// "Set up" sends the STEP and the sheet across once and remembers the result against the part, so
// from then on the view opens by itself. The one step a person still does is tagging: clicking,
// for each balloon, the face(s) it measures.
function QcView3D({ part, linkedJob, onLink, reportKey, balloonKey, openFile, fetchFile }) {
  const [reach, setReach] = useState(null);     // null checking, true, false
  const [info, setInfo] = useState(null);       // { tagged, total } | { missing: true }
  const [report, setReport] = useState(null);   // { blob, name } of the uploaded inspection report
  const [mode, setMode] = useState(null);       // 'result' | 'tag'
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    let dead = false;
    fetch(`${QC_VIEW_URL}/api/health`).then(r => { if (!dead) setReach(r.ok); }).catch(() => { if (!dead) setReach(false); });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    let dead = false;
    if (!reportKey) { setReport(null); return undefined; }
    fetchFile(reportKey).then(e => { if (!dead) setReport(e ? { blob: e.blob, name: e.name } : null); });
    return () => { dead = true; };
  }, [reportKey, fetchFile]);

  const loadInfo = async (jobId, keepMode) => {
    const res = await fetch(`${QC_VIEW_URL}/api/labeling-jobs/${jobId}/dimensions`);
    if (res.status === 404) { setInfo({ missing: true }); return; }
    const d = await res.json();
    const dims = d.dimensions || [];
    const next = { total: dims.length, tagged: dims.filter(x => x.tagged).length };
    setInfo(next);
    if (!keepMode) setMode(next.tagged > 0 ? 'result' : 'tag');
  };

  useEffect(() => {
    if (!reach || !linkedJob) { setInfo(null); return; }
    loadInfo(linkedJob).catch(() => setInfo({ missing: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reach, linkedJob]);

  const sendSheet = async (jobId, seed) => {
    if (!report || !isXlsx(report.name)) return;
    if (seed) {
      setBusy('Reading the balloon list from the QC sheet…');
      const seeded = await postFile(`${QC_VIEW_URL}/api/labeling-jobs/${jobId}/dimensions/seed`, report.blob, report.name);
      const res = await fetch(`${QC_VIEW_URL}/api/labeling-jobs/${jobId}/dimensions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dimensions: seeded.dimensions }),
      });
      if (!res.ok) throw new Error('Could not save the balloon list.');
    }
    setBusy('Sending the measured readings…');
    await postFile(`${QC_VIEW_URL}/api/labeling-jobs/${jobId}/qc-results`, report.blob, report.name);
  };

  const setUp = async () => {
    setError('');
    try {
      setBusy('Sending the CAD file…');
      const cad = await fetchFile(part.fileKey);
      if (!cad) throw new Error('The CAD file could not be loaded from the server.');
      let job = await postFile(`${QC_VIEW_URL}/api/labeling-jobs`, cad.blob, cad.name || 'part.step');
      for (let n = 0; n < 400 && job.status !== 'completed' && job.status !== 'failed'; n++) {
        setBusy(`Preparing the 3D model — ${job.phase || job.status}${job.progress ? ` (${job.progress}%)` : ''}`);
        await sleep(1500);
        job = await (await fetch(`${QC_VIEW_URL}/api/labeling-jobs/${job.job_id}`)).json();
      }
      if (job.status !== 'completed') throw new Error(`The 3D model could not be prepared${job.error ? `: ${job.error}` : '.'}`);
      await sendSheet(job.job_id, true);
      setBusy('');
      onLink(job.job_id);
    } catch (e) {
      setBusy('');
      setError(e.message || String(e));
    }
  };

  const refreshReadings = async () => {
    setError('');
    try {
      await sendSheet(linkedJob, info && info.total === 0);
      await loadInfo(linkedJob, true);
      setBusy('');
      setFrameKey(k => k + 1);
    } catch (e) { setBusy(''); setError(e.message || String(e)); }
  };

  const Input = ({ ok, label, detail }) => (
    <div className="doc-row">
      <div className="doc-icon" style={ok ? undefined : { background: 'var(--border)', color: 'var(--muted)' }}><Icon name={ok ? 'quality' : 'info'} /></div>
      <div><div className="doc-name">{label}</div><div className="doc-sub">{detail}</div></div>
    </div>
  );

  let body;
  if (reach === null) body = <div className="empty-hint">Looking for the 3D QC view…</div>;
  else if (reach === false) body = <div className="empty-hint">The 3D QC service is not reachable right now. Reload the page in a minute; if it stays like this, the service needs restarting on the server.</div>;
  else if (!linkedJob) {
    const hasCad = !!part.fileKey;
    const sheetOk = !!report && isXlsx(report.name);
    body = (
      <>
        <p className="page-sub" style={{ margin: '0 0 6px' }}>Not set up for this part yet. It is built from this part's own documents on the job:</p>
        <Input ok={hasCad} label="CAD file (STEP)" detail={hasCad ? part.file : 'Missing — attach it with Update on the enquiry. Required.'} />
        <Input ok={sheetOk} label="QC inspection sheet (.xlsx)"
          detail={sheetOk ? report.name : (report ? `${report.name} is not an .xlsx — the readings can only be read from the Excel sheet.` : 'Not uploaded — add it on the Inspection report line of the job. It supplies the balloon list, tolerances and readings.')} />
        <Input ok={!!balloonKey} label="Ballooned drawing (PDF)" detail={balloonKey ? 'Uploaded — opens alongside while tagging.' : 'Not uploaded — optional, used as a reference while tagging.'} />
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn px-btn-primary" disabled={!hasCad || !!busy} onClick={setUp}>{busy || 'Set up 3D QC view'}</button>
        </div>
      </>
    );
  } else if (!info) body = <div className="empty-hint">Opening…</div>;
  else if (info.missing) {
    body = (
      <div className="empty-hint">
        This part's 3D QC data was not found on the QC service.{' '}
        <button type="button" className="btn-text" onClick={() => onLink(null)}>Set it up again</button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <div className="filter-pills">
            <div className={`pill ${mode === 'result' ? 'active' : ''}`} onClick={() => { setMode('result'); loadInfo(linkedJob, true); setFrameKey(k => k + 1); }}>Result</div>
            <div className={`pill ${mode === 'tag' ? 'active' : ''}`} onClick={() => setMode('tag')}>Tag dimensions ({info.tagged} of {info.total} done)</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
            {balloonKey && <button type="button" className="btn-text" onClick={() => openFile(balloonKey)}>Open ballooned drawing</button>}
            {report && isXlsx(report.name) && <button type="button" className="btn-text" disabled={!!busy} onClick={refreshReadings}>{busy || 'Re-read the uploaded QC sheet'}</button>}
          </div>
        </div>
        {mode === 'tag' && (
          <p className="page-sub" style={{ margin: '0 0 10px' }}>
            {info.total === 0 ? 'No balloons listed yet — upload the QC sheet (.xlsx) on the Inspection report line of the job, or use Add dimension. ' : ''}
            For each balloon, click the face or faces it measures on the model, then Save. Switch to Result when you are done.
          </p>
        )}
        {mode === 'result' && info.tagged === 0 && <p className="page-sub" style={{ margin: '0 0 10px' }}>Nothing is tagged yet, so there is nothing to show on the model. Use Tag dimensions first.</p>}
        <iframe key={`${mode}-${frameKey}`} title="3D QC view" src={`${QC_VIEW_URL}/${mode === 'tag' ? 'dimensions' : 'inspection'}?job=${linkedJob}&embed=1&v=${PAGE_LOAD}`}
          style={{ width: '100%', height: 760, border: '1px solid var(--border)', borderRadius: 10 }} />
      </>
    );
  }

  return (
    <div className="card" data-qc3d>
      <h2><Icon name="cad" /> 3D QC view</h2>
      {body}
      {error && <p className="field-error" style={{ margin: '10px 0 0' }}>{error}</p>}
    </div>
  );
}

// The inspection report view for one part — where its dimensions (the quality data) are shown.
// Opened from View on the part's Inspection report line. The uploaded report file itself opens
// from here; dimension-by-dimension results show for parts that have them recorded.
export default function Inspection() {
  const { part } = useParams();
  const navigate = useNavigate();
  const { rows, partLibrary, artifactState, openFile, fetchFile, patchPartLibrary } = useProtoData();
  const back = <button type="button" className="back-link" onClick={() => navigate(-1)}><Icon name="back" /> Back</button>;

  const owner = rows.find(r => r.parts.some(p => p.name === part));
  const partIndex = owner ? owner.parts.findIndex(p => p.name === part) : -1;
  const docs = owner ? (artifactState[owner.orderId] || artifactState[owner.id] || {}) : {};
  const uploaded = docs[`p${partIndex}.inspReport`] || (partIndex === 0 ? docs.inspReport : null);
  const reportKey = uploaded && uploaded.fileKey;
  const balloonDoc = docs[`p${partIndex}.balloon`] || (partIndex === 0 ? docs.inspPlan : null);
  const balloonKey = (balloonDoc && balloonDoc.fileKey) || null;

  const tmpl = owner && partIndex >= 0 ? owner.parts[partIndex].tmpl : null;
  const recorded = INSPECTION_BY_PART[part];
  const dims = recorded ? recorded.dims : (tmpl && partLibrary[tmpl] && partLibrary[tmpl].dims) || null;
  const s = recorded && recorded.summary;
  const linkedQc = tmpl ? (partLibrary[tmpl] || {}).qcJobId || null : null;

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
        <QcView3D part={owner.parts[partIndex]} linkedJob={linkedQc}
          reportKey={reportKey} balloonKey={balloonKey} openFile={openFile} fetchFile={fetchFile}
          onLink={(jobId) => patchPartLibrary(tmpl, { qcJobId: jobId })} />
      )}
      {!linkedQc && <div className="card">
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
      </div>}
    </div>
  );
}
