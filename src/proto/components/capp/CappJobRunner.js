import React, { useEffect, useRef, useState } from 'react';
import Icon from '../../icons';
import { useProtoData } from '../../ProtoDataContext';
import { createCappJob, getCappJob, CAPP_BASE } from '../../cappApi';
import { useCappJob, partKeyOf } from '../../cappJobStore';
import { CappError, Spinner, POLL_MS } from './CappCommon';

// The material string capp_service's pipeline understands, from the part's free-text material.
export function cappMaterialOf(material) {
  const m = String(material || '').toLowerCase();
  if (/7075/.test(m)) return 'aluminium_7075';
  if (/6082/.test(m)) return 'aluminium_6082';
  if (/6061/.test(m)) return 'aluminium_6061';
  if (/al/.test(m)) return 'aluminium_6061';
  return 'aluminium';
}

// Polls GET /jobs/{id} every 3 s until the pipeline is COMPLETE or FAILED.
export function useCappPipeline(jobId) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!jobId) { setJob(null); setError(null); return undefined; }
    let dead = false;
    let t = null;
    const tick = () => {
      getCappJob(jobId).then((j) => {
        if (dead) return;
        setJob(j); setError(null);
        if (j.status !== 'COMPLETE' && j.status !== 'FAILED') t = setTimeout(tick, POLL_MS);
      }).catch((e) => { if (!dead) { setError(e.message); t = setTimeout(tick, POLL_MS * 2); } });
    };
    tick();
    return () => { dead = true; clearTimeout(t); };
  }, [jobId]);
  return { job, error };
}

const STATUS_CLS = { COMPLETE: 'b-done', FAILED: 'b-fail', RUNNING: 'b-inprogress' };

// Runs the live CAPP pipeline for one part and remembers the job id against it. The STEP comes from
// the part's attached CAD file when it has one; a STEP can always be picked from disk instead.
// Renders `children(jobId, job)` once there is a job.
export default function CappJobRunner({ part, children, runLabel = 'Click here for DFM' }) {
  const { fetchFile } = useProtoData();
  const partKey = partKeyOf(part);
  const { entry, setEntry } = useCappJob(partKey);
  const jobId = entry && entry.jobId;
  const { job, error: pollError } = useCappPipeline(jobId);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [linkId, setLinkId] = useState('');
  const [showLink, setShowLink] = useState(false);
  const fileInput = useRef(null);

  const start = async (blob, name) => {
    setBusy(`Sending ${name} for the manufacturability check…`); setError('');
    try {
      const out = await createCappJob(blob, name, part.name, cappMaterialOf(part.material));
      if (!out || !out.job_id) throw new Error('The analysis service did not return a reference for this file');
      setEntry({ jobId: out.job_id, fileName: name });
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusy(''); }
  };

  const runAttached = async () => {
    setBusy('Fetching the attached STEP file…'); setError('');
    const f = await fetchFile(part.fileKey);
    if (!f) { setBusy(''); setError('Could not fetch the STEP file attached to this part. Choose it from disk instead.'); return; }
    start(f.blob, f.name && f.name !== 'download' ? f.name : `${part.name}.step`);
  };

  const onPicked = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) start(f, f.name);
  };

  const status = job ? job.status : null;
  const actions = (
    <div className="cx-runner">
      <input ref={fileInput} type="file" accept=".step,.stp,.STEP,.STP" style={{ display: 'none' }} onChange={onPicked} />
      {part.fileKey && <button type="button" className="btn-sm primary" disabled={!!busy} onClick={runAttached}>{jobId ? 'Re-run on the attached STEP' : runLabel}</button>}
      <button type="button" className={`btn-sm ${part.fileKey ? 'ghost' : 'primary'}`} disabled={!!busy} onClick={() => fileInput.current.click()}>
        <Icon name="upload" size={13} /> {part.fileKey ? 'Choose STEP from disk' : (jobId ? 'Re-run with a STEP from disk' : 'Choose a STEP file')}
      </button>
      <button type="button" className="btn-sm text" onClick={() => setShowLink(s => !s)}>Use an existing reference</button>
      {jobId && <button type="button" className="btn-sm text" onClick={() => setEntry(null)}>Forget</button>}
    </div>
  );

  return (
    <div className="cx">
      {jobId ? (
        <div className="cx-jobline" style={{ marginBottom: 10 }}>
          <span>Reference <b className="mono">{jobId.slice(0, 8)}</b></span>
          {entry.fileName && <span>STEP <b>{entry.fileName}</b></span>}
          {status && <span className={`badge ${STATUS_CLS[status] || 'b-quoted'}`}>{status === 'COMPLETE' ? 'Upload processed' : status === 'FAILED' ? 'Upload processing failed' : `Running · ${job.stage_name || 'queued'}`}</span>}
          {!status && !pollError && <span className="badge b-neutral">Checking…</span>}
        </div>
      ) : (
        <p className="page-sub" style={{ margin: '0 0 10px', fontSize: 14 }}>
          Click below to check the part's manufacturability from its STEP file. The quote and the client reply drafts use the same check.
        </p>
      )}
      {actions}
      {showLink && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div className="field" style={{ flex: 1 }}><input value={linkId} onChange={e => setLinkId(e.target.value)} placeholder="reference id (uuid)" /></div>
          <button type="button" className="btn-sm ghost" disabled={!linkId.trim()} onClick={() => { setEntry({ jobId: linkId.trim(), fileName: '' }); setShowLink(false); setLinkId(''); }}>Use</button>
        </div>
      )}
      {busy && <div className="cx-state" style={{ marginTop: 10 }}><Spinner /> {busy}</div>}
      {error && <div style={{ marginTop: 10 }}><CappError message={error} /></div>}
      {pollError && !job && <div style={{ marginTop: 10 }}><CappError message={`${pollError} (${CAPP_BASE})`} /></div>}
      {job && job.status === 'FAILED' && job.error && <div style={{ marginTop: 10 }}><CappError message={job.error} /></div>}
      {jobId && children && <div style={{ marginTop: 16 }}>{children(jobId, job)}</div>}
    </div>
  );
}
