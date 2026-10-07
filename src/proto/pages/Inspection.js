import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import KpiStrip from '../components/KpiStrip';
import { VerdictBadge } from '../components/Badges';
import { INSPECTION_BY_PART } from '../fixtures';
import { useProtoData } from '../ProtoDataContext';

// The inspection report view for one part — where its dimensions (the quality data) are shown.
// Opened from View on the part's Inspection report line. The uploaded report file itself opens
// from here; dimension-by-dimension results show for parts that have them recorded.
export default function Inspection() {
  const { part } = useParams();
  const navigate = useNavigate();
  const { rows, partLibrary, artifactState, openFile } = useProtoData();
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
