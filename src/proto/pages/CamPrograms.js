import React from 'react';
import DownloadLink from '../components/DownloadLink';
import { PART_LIBRARY, CAM_PROGRAMS } from '../fixtures';

function CamCell({ entry }) {
  if (!entry) return <span className="art-status">Not yet available</span>;
  return (
    <>
      <DownloadLink file={entry.file} />
      <div className="art-status" style={{ marginTop: 3 }}>{entry.status}</div>
    </>
  );
}

// Every part template gets two columns side by side — what the programmer wrote, what the pipeline
// generated — so the two can be compared directly rather than tracked as one "source" field.
export default function CamPrograms() {
  return (
    <div>
      <div className="page-head"><div><h1>CAM Programs</h1><div className="page-sub">Human-programmed and AI-generated, side by side per part — so one can be checked against the other.</div></div></div>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Part template</th><th>Human-programmed</th><th>AI-generated</th></tr></thead>
          <tbody>
            {Object.entries(PART_LIBRARY).map(([id, p]) => {
              const cam = CAM_PROGRAMS[id] || {};
              return (
                <tr key={id}>
                  <td className="cell-primary">{p.name}<div className="cell-sub">{id}</div></td>
                  <td><CamCell entry={cam.human} /></td>
                  <td><CamCell entry={cam.ai} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
