import React, { useState } from 'react';
import Icon from '../../icons';
import CappJobRunner from './CappJobRunner';
import DfmPanel from './DfmPanel';
import ReplyAssistantPanel from './ReplyAssistantPanel';
import TrackingPanel from './TrackingPanel';
import CmmPanel from './CmmPanel';

const PANELS = {
  dfm: ['DFM check', DfmPanel],
  reply: ['Client feedback & comments', ReplyAssistantPanel],
  tracking: ['Program vs machine', TrackingPanel],
  cmm: ['CMM program', CmmPanel],
};

// One card holding the live CAPP run for a job's parts and the panels that read from it.
// `panels` picks which (e.g. ['dfm','reply'] at the enquiry, ['tracking'] on an order).
export default function LiveAnalysisCard({ title, parts, panels, onQuote, runLabel }) {
  const [pi, setPi] = useState(0);
  const [tab, setTab] = useState(panels[0]);
  const part = parts[Math.min(pi, parts.length - 1)];
  if (!part) return null;

  return (
    <div className="card" data-capp-live>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}><Icon name="cam" /> {title}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {parts.length > 1 && (
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <label style={{ whiteSpace: 'nowrap' }}>Part</label>
              <select value={pi} onChange={e => setPi(Number(e.target.value))}>
                {parts.map((p, i) => <option key={p.tmpl || p.name} value={i}>{p.name}</option>)}
              </select>
            </div>
          )}
          {onQuote && <button type="button" className="btn-sm primary" onClick={() => onQuote(parts.indexOf(part))}><Icon name="quote" size={12} /> Open auto-quote</button>}
        </div>
      </div>
      <CappJobRunner key={part.tmpl || part.name} part={part} runLabel={runLabel}>
        {(jobId, job) => {
          const Panel = PANELS[tab][1];
          return (
            <>
              {panels.length > 1 && (
                <div className="tabs">
                  {panels.map(k => <button type="button" key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{PANELS[k][0]}</button>)}
                </div>
              )}
              <Panel jobId={jobId} part={part} refreshKey={job ? job.status : ''} />
            </>
          );
        }}
      </CappJobRunner>
    </div>
  );
}
