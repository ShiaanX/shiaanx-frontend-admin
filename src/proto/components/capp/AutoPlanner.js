import { useEffect } from 'react';
import { useProtoData } from '../../ProtoDataContext';
import { createCappJob, getProgram } from '../../cappApi';
import { getCappJobFor, setCappJobFor, setAutoState, partKeyOf } from '../../cappJobStore';
import { cappMaterialOf } from './CappJobRunner';
import { markGenerated } from './ProgramCard';

// Runs the planning steps that used to need a click, whichever page the person is on:
//  - a part waiting in the queue whose plan is ready moves to Process planning (once);
//  - a part that reaches Process planning (from the board, the timeline, anywhere) with a STEP file
//    and no analysis yet gets its analysis and plan started from that STEP, exactly as the Run
//    button does. The Process plan card then polls the plan and shows the result or the reason it
//    is unavailable.
// Guards: each part is looked at once per page session (module-level sets), and a part that already
// has a linked job never gets another. Nothing here approves a plan.
const started = new Set();   // part uuids whose analysis start was attempted
const checked = new Set();   // part uuids whose queue -> planning check was done

const hasPlan = (p) => {
  const data = p.autoQuote && p.autoQuote.data;
  const s = p.planSummary;
  return !!(data && data.aiPlan) || !!(s && s.planStatus && s.planStatus !== 'PENDING');
};

export default function AutoPlanner() {
  const { rows, fetchFile, setPartStatus, saveCappJobLink } = useProtoData();

  useEffect(() => {
    rows.forEach((r) => {
      if (!(r.isOrder || r.jobType === 'TRIAL')) return;
      r.parts.forEach((p, idx) => {
        if (p.ordered === false || !p.uuid) return;
        const key = partKeyOf(p);
        const server = p.autoQuote && p.autoQuote.data && p.autoQuote.data.cappJob;
        // The job another browser started: remember it here too.
        if (server && server.jobId && !getCappJobFor(key)) setCappJobFor(key, { jobId: server.jobId, fileName: server.fileName || '' });
        const linked = getCappJobFor(key);

        // In the queue and a plan is ready -> Process planning.
        if (p.jobStatus === 'IN_QUEUE' && !checked.has(p.uuid)) {
          if (hasPlan(p)) { checked.add(p.uuid); setPartStatus(r.id, idx, 'PROCESS_PLANNING'); return; }
          if (linked && linked.jobId) {
            checked.add(p.uuid);
            getProgram(linked.jobId)
              .then((d) => { if (d && d.status === 'ok' && d.plan) setPartStatus(r.id, idx, 'PROCESS_PLANNING'); })
              .catch(() => { /* not ready or not reachable: stays in the queue */ });
          }
          return;
        }

        // Reached Process planning with a STEP file and no analysis yet -> start it.
        if (p.jobStatus === 'PROCESS_PLANNING' && p.fileKey && !(linked && linked.jobId) && !started.has(p.uuid)) {
          started.add(p.uuid);
          setAutoState(key, { state: 'starting', text: 'Planning started automatically…' });
          (async () => {
            try {
              const f = await fetchFile(p.fileKey);
              if (!f) throw new Error('Could not fetch the STEP file attached to this part.');
              if (getCappJobFor(key) && getCappJobFor(key).jobId) { setAutoState(key, null); return; }
              const name = f.name && f.name !== 'download' ? f.name : `${p.name}.step`;
              const out = await createCappJob(f.blob, name, p.name, cappMaterialOf(p.material));
              if (!out || !out.job_id) throw new Error('The analysis service did not return a reference for this file.');
              setCappJobFor(key, { jobId: out.job_id, fileName: name, auto: true });
              markGenerated(out.job_id);
              setAutoState(key, { state: 'started', text: 'Planning started automatically…' });
              saveCappJobLink(r.uuid, idx, { jobId: out.job_id, fileName: name }).catch(() => { /* link stays in this browser */ });
            } catch (e) {
              setAutoState(key, { state: 'error', text: e.message || String(e) });
            }
          })();
        }
      });
    });
  }, [rows, fetchFile, setPartStatus, saveCappJobLink]);

  return null;
}
