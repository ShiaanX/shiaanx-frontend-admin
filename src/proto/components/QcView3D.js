import React, { useEffect, useState, useRef } from 'react';
import Icon from '../icons';
import { openFlowSession } from '../api';

// Where the 3D QC view is served from: the labeling app in the shiaanx-CAPP repo. On the dev server
// it sits behind the same address as this app; REACT_APP_QC_URL points elsewhere for local work.
// It maps each ballooned drawing dimension to the CAD faces it measures and colours the result, so
// the report can be read without knowing the drawing.
const QC_VIEW_URL = (process.env.REACT_APP_QC_URL || '').replace(/\/+$/, '');
// Added to the embedded page's address so a copy cached before an update is never reused.
const PAGE_LOAD = Date.now();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isXlsx = (name) => /\.xlsx$/i.test(name || '');

const SESSION_EXPIRED = 'Your session has expired. Log in again to open the 3D QC view.';
let renewing = null;

// The QC service sits behind nginx's sx_session cookie check. A 401 means the cookie is missing or
// expired: renew it once from the stored token (shared between calls in flight) and retry once.
async function qcFetch(url, opts) {
  let res = await fetch(url, opts);
  if (res.status !== 401) return res;
  renewing = renewing || openFlowSession().finally(() => { renewing = null; });
  await renewing;
  res = await fetch(url, opts);
  if (res.status === 401) throw new Error(SESSION_EXPIRED);
  return res;
}

async function postFile(url, file, name) {
  const body = new FormData();
  body.append('file', file, name);
  const res = await qcFetch(url, { method: 'POST', body });
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
export default function QcView3D({ part, linkedJob, onLink, reportKey, balloonKey, openFile, fetchFile, compact, autoSetup }) {
  const [reach, setReach] = useState(null);     // null checking, true, false, 'expired'
  const [info, setInfo] = useState(null);       // { tagged, total } | { missing: true }
  const [reportState, setReport] = useState(null);   // { blob, name } of the uploaded inspection report
  const [mode, setMode] = useState(null);       // 'result' | 'tag'
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [frameKey, setFrameKey] = useState(0);

  const report = reportState;

  useEffect(() => {
    let dead = false;
    qcFetch(`${QC_VIEW_URL}/api/health`).then(r => { if (!dead) setReach(r.ok && /json/i.test(r.headers.get('content-type') || '')); })   // a dev server that answers every URL with its own page is not the QC service
      .catch(e => { if (!dead) setReach(e.message === SESSION_EXPIRED ? 'expired' : false); });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    let dead = false;
    if (!reportKey) { setReport(null); return undefined; }
    fetchFile(reportKey).then(e => { if (!dead) setReport(e ? { blob: e.blob, name: e.name } : null); });
    return () => { dead = true; };
  }, [reportKey, fetchFile]);

  // autoSetup (order page): as soon as the QC sheet is on the job and the part has its CAD file, build the
  // view once by itself, so nobody has to press anything. Never loops: one attempt per page visit.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoSetup || autoStarted.current || reach !== true || linkedJob || !part.fileKey || busy || error) return;
    if (!report || !isXlsx(report.name)) return;
    autoStarted.current = true;
    setUp(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSetup, reach, linkedJob, report, busy, error]);

  const loadInfo = async (jobId, keepMode) => {
    const res = await qcFetch(`${QC_VIEW_URL}/api/labeling-jobs/${jobId}/dimensions`);
    if (res.status === 404) { setInfo({ missing: true }); return; }
    const d = await res.json();
    const dims = d.dimensions || [];
    const next = { total: dims.length, tagged: dims.filter(x => x.tagged).length };
    setInfo(next);
    if (!keepMode) setMode(next.tagged > 0 ? 'result' : 'tag');
  };

  useEffect(() => {
    if (reach !== true || !linkedJob) { setInfo(null); return; }
    loadInfo(linkedJob).catch(e => (e.message === SESSION_EXPIRED ? setReach('expired') : setInfo({ missing: true })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reach, linkedJob]);

  const sendSheet = async (jobId, seed, rep) => {
    const report = rep || reportState;
    if (!report || !isXlsx(report.name)) return;
    if (seed) {
      setBusy('Reading the balloon list from the QC sheet…');
      const seeded = await postFile(`${QC_VIEW_URL}/api/labeling-jobs/${jobId}/dimensions/seed`, report.blob, report.name);
      const res = await qcFetch(`${QC_VIEW_URL}/api/labeling-jobs/${jobId}/dimensions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dimensions: seeded.dimensions }),
      });
      if (!res.ok) throw new Error('Could not save the balloon list.');
    }
    setBusy('Sending the measured readings…');
    await postFile(`${QC_VIEW_URL}/api/labeling-jobs/${jobId}/qc-results`, report.blob, report.name);
  };

  const setUp = async (rep) => {
    setError('');
    try {
      setBusy('Sending the CAD file…');
      const cad = await fetchFile(part.fileKey);
      if (!cad) throw new Error('The CAD file could not be loaded from the server.');
      let job = await postFile(`${QC_VIEW_URL}/api/labeling-jobs`, cad.blob, cad.name || 'part.step');
      for (let n = 0; n < 400 && job.status !== 'completed' && job.status !== 'failed'; n++) {
        setBusy(`Preparing the 3D model — ${job.phase || job.status}${job.progress ? ` (${job.progress}%)` : ''}`);
        await sleep(1500);
        job = await (await qcFetch(`${QC_VIEW_URL}/api/labeling-jobs/${job.job_id}`)).json();
      }
      if (job.status !== 'completed') throw new Error(`The 3D model could not be prepared${job.error ? `: ${job.error}` : '.'}`);
      await sendSheet(job.job_id, true, rep);
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
  else if (reach === 'expired') body = <div className="empty-hint">{SESSION_EXPIRED}</div>;
  else if (reach === false) body = compact
    ? <div className="cell-sub" style={{ display: 'block' }} data-qc3d-offline>The 3D QC view is not available right now.</div>
    : <div className="empty-hint">The 3D QC service is not reachable right now. Reload the page in a minute; if it stays like this, the service needs restarting on the server.</div>;
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
          <button type="button" className="btn px-btn-primary" disabled={!hasCad || !!busy} onClick={() => setUp()}>{busy || 'Set up 3D QC view'}</button>
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
    <div className="card" data-qc3d id={compact ? 'qc-3d' : undefined}>
      <h2><Icon name="cad" /> {compact ? 'QC - 3D view' : '3D QC view'}</h2>
      {body}
      {error && <p className="field-error" style={{ margin: '10px 0 0' }}>{error}</p>}
    </div>
  );
}
