import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DownloadLink from '../components/DownloadLink';
import { CAM_PROGRAMS } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

const SELECT_STYLE = { border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--ink)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5 };

function CamCell({ entry }) {
  if (!entry) return <span className="art-status">Not yet available</span>;
  return (
    <>
      <DownloadLink file={entry.file} fileKey={entry.fileKey} />
      <div className="art-status" style={{ marginTop: 3 }}>{entry.status}</div>
    </>
  );
}

// Every part being made gets two columns side by side — what the programmer wrote, what the
// pipeline generated — so the two can be compared directly. Both come from that part's CAM program
// lines in the job's documents (the uploaded human file, and the program sheet the CAPP pipeline
// generated). Only parts being made are listed: the ordered parts of an order, or of a job produced
// without one (TRIAL). Plain enquiries' parts, and parts left out of a partial order, are not.
// Rows are grouped by project, with a header row per project.
export default function CamPrograms() {
  const { rows, customers, artifactState, processes = [] } = useProtoData();
  const [onlyWithProgram, setOnlyWithProgram] = useState(false);
  const [process, setProcess] = useState('');
  const [project, setProject] = useState('');

  const companyOf = (r) => { const c = (customers || []).find(x => x.id === r.customerId); return (c && c.company) || r.customer; };

  const list = [];
  rows.forEach(r => {
    if (!(r.isOrder || r.jobType === 'TRIAL')) return;
    const docs = artifactState[r.orderId] || artifactState[r.id] || {};
    r.parts.forEach((p, idx) => {
      if (p.ordered === false) return;
      const sample = CAM_PROGRAMS[p.tmpl] || {};
      const humanDoc = docs[`p${idx}.cam.human`] || (idx === 0 && docs.cam && docs.cam.fileKey ? docs.cam : null);
      const aiDoc = docs[`p${idx}.plan`];
      const human = humanDoc && humanDoc.fileKey
        ? { file: (humanDoc.note || 'Uploaded file').replace(/^Uploaded · /, ''), fileKey: humanDoc.fileKey, status: 'Uploaded on the job' }
        : sample.human;
      const ai = aiDoc && aiDoc.fileKey
        ? { file: `${p.name}_program_sheet.pdf`, fileKey: aiDoc.fileKey, status: aiDoc.note }
        : sample.ai;
      list.push({
        key: `${r.uuid}:${idx}`, p, human, ai,
        projectKey: r.uuid, projectNo: r.orderId || r.id, company: companyOf(r), contact: r.customer,
        to: r.isOrder ? `/proto/orders/${r.uuid}` : `/proto/enquiries/${r.uuid}`,
        processes: p.processes || [],
      });
    });
  });

  const projects = useMemo(() => {
    const m = new Map();
    list.forEach(x => { if (!m.has(x.projectKey)) m.set(x.projectKey, `${x.projectNo}${x.company ? ` · ${x.company}` : ''}`); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, customers]);
  const activeProject = projects.some(([k]) => k === project) ? project : '';

  // A process no longer in Settings but still on a listed part stays choosable.
  const processOptions = [...processes];
  list.forEach(x => x.processes.forEach(n => { if (!processOptions.includes(n)) processOptions.push(n); }));

  // Pill counts follow the process and project filters, so they match what each pill shows.
  const scoped = list.filter(x => (!process || x.processes.includes(process)) && (!activeProject || x.projectKey === activeProject));
  const withProgram = scoped.filter(x => x.human || x.ai);
  const shown = (onlyWithProgram ? withProgram : scoped)
    .slice()
    .sort((a, b) => a.projectNo.localeCompare(b.projectNo, undefined, { numeric: true }));

  const body = [];
  shown.forEach((x, i) => {
    if (i === 0 || shown[i - 1].projectKey !== x.projectKey) {
      body.push(
        <tr key={`h:${x.projectKey}`} className="cam-project-head" data-testid="cam-project-head">
          <td colSpan={4} style={{ background: 'var(--bg, transparent)', fontWeight: 700, fontSize: 12.5 }}>
            <Link to={x.to} className="mono" data-testid="cam-project-link">{x.projectNo}</Link>
            <span className="cell-sub" style={{ marginLeft: 8, display: 'inline' }} title={x.contact}>{x.company}</span>
          </td>
        </tr>,
      );
    }
    body.push(
      <tr key={x.key} data-testid="cam-row">
        <td className="cell-primary">
          {x.p.name}
          <div className="cell-sub"><Link to={x.to} className="mono">{x.projectNo}</Link> · <span title={x.contact}>{x.company}</span></div>
        </td>
        <td>
          {x.processes.length === 0
            ? <span className="cell-sub">—</span>
            : <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{x.processes.map(n => <span key={n} className="tag">{n}</span>)}</span>}
        </td>
        <td><CamCell entry={x.human} /></td>
        <td><CamCell entry={x.ai} /></td>
      </tr>,
    );
  });

  return (
    <div>
      <div className="page-head"><div><h1>CAM Programs</h1><div className="page-sub">Human-programmed and AI-generated, side by side per part — so one can be checked against the other. Lists the ordered parts of orders and of jobs being produced without one.</div></div></div>
      <div className="toolbar">
        <div className="filter-pills">
          <div className={`pill ${!onlyWithProgram ? 'active' : ''}`} onClick={() => setOnlyWithProgram(false)}>All parts ({scoped.length})</div>
          <div className={`pill ${onlyWithProgram ? 'active' : ''}`} onClick={() => setOnlyWithProgram(true)}>With at least one program ({withProgram.length})</div>
        </div>
        <select aria-label="Process" data-testid="cam-process-filter" style={SELECT_STYLE} value={process} onChange={e => setProcess(e.target.value)}>
          <option value="">All processes</option>
          {processOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select aria-label="Project" data-testid="cam-project-filter" style={SELECT_STYLE} value={activeProject} onChange={e => setProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Part</th><th>Processes</th><th>Human-programmed</th><th>AI-generated</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={4}><div className="empty-hint">{list.length === 0 ? 'No ordered part yet. Parts appear here once their enquiry becomes an order or a job.' : 'No part matches these filters.'}</div></td></tr>}
            {body}
          </tbody>
        </table>
      </div>
    </div>
  );
}
