import React from 'react';
import Icon from '../icons';
import KpiStrip from './KpiStrip';
import { JobStatusBadge } from './Badges';
import {
  buildSchedule, estimateFor, approvedPlansByPart, machineMinutes, fmtWhen, fmtHours,
  VMC_COUNT, HOURS_PER_DAY, SHIFT_START_HOUR, SETUP_MIN_PER_SETUP, WORKING_DAYS,
} from './scheduleModel';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TAG_CLS = { ai: 'src-ai', programmer: 'src-human', quote: '' };

// Where a job's machine time comes from: the approved AI plan, the programmer's time, an
// auto-quote, or nothing yet (shown as such, never as 0).
export function EstimateSource({ est }) {
  if (est.kind === 'none' || est.minutesPerPart === null) return <span className="cell-sub" style={{ display: 'inline' }} title={est.source}>no estimate yet</span>;
  return <span className={`tag ${TAG_CLS[est.kind] || ''}`} title={est.source}>{est.label}</span>;
}

// "Where this job slots in": the machine queue ahead of the focused job, each with its estimated
// machine hours, and the focused job's computed start and finish. Everything is worked out from
// the board's own rows (stage, qty, deadline) and the cycle times in scheduleModel.estimateFor.
// Admin view only.
export default function SchedulePanel({ jobs, focus, onClose, onOpen }) {
  const schedule = buildSchedule(jobs);
  const mine = schedule.find(r => r.job.id === focus.id);

  if (!mine) {
    const est = estimateFor(focus, approvedPlansByPart(jobs));
    return (
      <div className="card" data-schedule-panel>
        <h2><Icon name="calendar" /> Where {focus.partName} slots in <span style={{ flex: 1 }} />
          <button type="button" className="btn-text" onClick={() => onOpen(focus)}>Open {focus.projectNo} →</button>
          <button type="button" className="btn-text" onClick={onClose}>Close</button></h2>
        <p style={{ margin: 0 }}>
          {focus.status === 'QC' || focus.status === 'DISPATCHED'
            ? <>Machining is finished for this job (stage: <JobStatusBadge status={focus.status} />), so it is not in the machine queue.</>
            : 'Partner jobs are not scheduled on our machine.'}
          {est.minutesPerPart !== null && <> Its machine time is {fmtHours(machineMinutes(focus, est))} ({est.minutesPerPart.toFixed(1)} min/part × {focus.qty || 1} + {est.setups} setups × {SETUP_MIN_PER_SETUP} min, from {est.label}).</>}
        </p>
      </div>
    );
  }

  const ahead = schedule.slice(0, mine.position - 1);
  const knownAhead = ahead.filter(r => r.minutes !== null);
  const unknownAhead = ahead.length - knownAhead.length;
  const aheadMin = knownAhead.reduce((s, r) => s + r.minutes, 0);
  const deadline = focus.deadline ? new Date(`${focus.deadline}T23:59:59`) : null;
  const late = deadline && mine.finish && mine.finish > deadline;
  const lowerBound = mine.unestimatedAhead > 0 || mine.minutes === null;
  const rows = schedule.slice(0, mine.position);
  const aheadText = ahead.length === 0
    ? 'Nothing'
    : [knownAhead.length ? `${fmtHours(aheadMin)} known` : null, unknownAhead ? `${unknownAhead} job${unknownAhead === 1 ? '' : 's'} without estimate` : null].filter(Boolean).join(' + ');

  return (
    <div className="card" data-schedule-panel>
      <h2><Icon name="calendar" /> Where {focus.partName} ({focus.projectNo}) slots in <span style={{ flex: 1 }} />
        <button type="button" className="btn-text" onClick={() => onOpen(focus)}>Open {focus.projectNo} →</button>
        <button type="button" className="btn-text" onClick={onClose}>Close</button></h2>
      <KpiStrip items={[
        { n: `#${mine.position} of ${schedule.length}`, l: 'Machine queue position' },
        { n: <span style={{ fontSize: unknownAhead && knownAhead.length ? 15 : undefined }} data-ahead>{aheadText}</span>, l: `Machine time ahead · ${ahead.length} job${ahead.length === 1 ? '' : 's'}` },
        { n: mine.minutes === null ? 'No estimate yet' : fmtHours(mine.minutes), l: <>This job · <EstimateSource est={mine.est} /></>, cls: mine.minutes === null ? 'warn' : undefined },
        { n: fmtWhen(mine.start), l: lowerBound && mine.unestimatedAhead > 0 ? 'Starts (at the earliest)' : 'Starts' },
        { n: mine.finish ? fmtWhen(mine.finish) : 'Not estimated', l: lowerBound ? 'Finishes (at the earliest)' : 'Finishes', cls: late ? 'err' : mine.finish ? 'ok' : 'warn' },
        { n: focus.deadline || '—', l: deadline ? (late ? 'Deadline · will be missed' : mine.finish ? 'Deadline · on track' : 'Deadline') : 'No deadline set', cls: late ? 'err' : '' },
      ]} />
      <div className="tablecard overflow-x" style={{ marginTop: 14, marginBottom: 10 }}>
        <table className="data">
          <thead><tr><th>#</th><th>Part</th><th>Project</th><th>Stage</th><th>Qty</th><th>Min / part</th><th>Setups</th><th>Machine time</th><th>Start</th><th>Finish</th><th>Estimate from</th></tr></thead>
          <tbody>
            {rows.map(r => {
              const me = r.job.id === focus.id;
              const none = r.minutes === null;
              return (
                <tr key={r.job.id} style={me ? { background: 'var(--primary-light)', fontWeight: 600 } : undefined} data-schedule-row={me ? 'focus' : 'ahead'}>
                  <td className="mono">{r.position}</td>
                  <td className="cell-primary">{r.job.partName}</td>
                  <td className="mono">{r.job.projectNo}</td>
                  <td><JobStatusBadge status={r.job.status} /></td>
                  <td className="mono">{r.job.qty || 1}</td>
                  <td className="mono">{none ? '—' : r.est.minutesPerPart.toFixed(1)}</td>
                  <td className="mono">{r.est.setups ?? '—'}</td>
                  <td className={none ? 'cell-sub' : 'mono'}>{none ? 'not counted' : fmtHours(r.minutes)}</td>
                  <td className="mono">{fmtWhen(r.start)}</td>
                  <td className="mono">{fmtWhen(r.finish)}</td>
                  <td><EstimateSource est={r.est} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="page-sub" style={{ margin: 0 }}>
        Order on the machine: in production, then scheduling, then process planning, then queue; earliest deadline first within a stage.
        Machine time = min/part × qty + setups × {SETUP_MIN_PER_SETUP} min changeover. Calendar: {VMC_COUNT} VMC, one {HOURS_PER_DAY}-hour shift from {String(SHIFT_START_HOUR).padStart(2, '0')}:00, {WORKING_DAYS.map(d => DAY_NAMES[d]).join('–').replace(/–(\w+–)+/, '–')}.
        A job in production is counted at full length, because the board does not record how far it has got.
        {lowerBound && ' Jobs with no estimate yet are not counted, so the start and finish are the earliest possible.'}
      </p>
      {mine.est.real && <p className="page-sub" style={{ margin: '6px 0 0' }}><b>{focus.partName} estimate:</b> {mine.est.source}</p>}
    </div>
  );
}
