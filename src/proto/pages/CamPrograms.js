import React, { useState } from 'react';
import DownloadLink from '../components/DownloadLink';
import { CAM_PROGRAMS } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

function CamCell({ entry }) {
  if (!entry) return <span className="art-status">Not yet available</span>;
  return (
    <>
      <DownloadLink file={entry.file} fileKey={entry.fileKey} />
      <div className="art-status" style={{ marginTop: 3 }}>{entry.status}</div>
    </>
  );
}

// Every part gets two columns side by side — what the programmer wrote, what the pipeline
// generated — so the two can be compared directly. For a part on one of your jobs both columns come
// from that part's CAM program lines in the job's documents (the uploaded human file, and the
// program sheet the CAPP pipeline generated); the sample parts use the sample entries.
export default function CamPrograms() {
  const { partLibrary, rows, artifactState } = useProtoData();
  const [onlyWithProgram, setOnlyWithProgram] = useState(false);

  const list = Object.entries(partLibrary).map(([id, p]) => {
    const sample = CAM_PROGRAMS[id] || {};
    const owner = rows.find(r => r.parts.some(x => x.tmpl === id));
    const idx = owner ? owner.parts.findIndex(x => x.tmpl === id) : -1;
    const docs = owner ? (artifactState[owner.orderId] || artifactState[owner.id] || {}) : {};
    const humanDoc = docs[`p${idx}.cam.human`] || (idx === 0 && docs.cam && docs.cam.fileKey ? docs.cam : null);
    const aiDoc = docs[`p${idx}.plan`];
    const human = humanDoc && humanDoc.fileKey
      ? { file: (humanDoc.note || 'Uploaded file').replace(/^Uploaded · /, ''), fileKey: humanDoc.fileKey, status: 'Uploaded on the job' }
      : sample.human;
    const ai = aiDoc && aiDoc.fileKey
      ? { file: `${p.name}_program_sheet.pdf`, fileKey: aiDoc.fileKey, status: aiDoc.note }
      : sample.ai;
    return { id, p, human, ai };
  });
  const shown = onlyWithProgram ? list.filter(x => x.human || x.ai) : list;

  return (
    <div>
      <div className="page-head"><div><h1>CAM Programs</h1><div className="page-sub">Human-programmed and AI-generated, side by side per part — so one can be checked against the other.</div></div></div>
      <div className="toolbar">
        <div className="filter-pills">
          <div className={`pill ${!onlyWithProgram ? 'active' : ''}`} onClick={() => setOnlyWithProgram(false)}>All parts ({list.length})</div>
          <div className={`pill ${onlyWithProgram ? 'active' : ''}`} onClick={() => setOnlyWithProgram(true)}>With at least one program ({list.filter(x => x.human || x.ai).length})</div>
        </div>
      </div>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Part</th><th>Human-programmed</th><th>AI-generated</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={3}><div className="empty-hint">No part has a program yet.</div></td></tr>}
            {shown.map(({ id, p, human, ai }) => (
              <tr key={id}>
                <td className="cell-primary">{p.name}<div className="cell-sub">{p.customer}</div></td>
                <td><CamCell entry={human} /></td>
                <td><CamCell entry={ai} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
