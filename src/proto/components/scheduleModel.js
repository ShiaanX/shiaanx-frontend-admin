import { CYCLE_TIME_LIBRARY } from '../demoData/cycleTimes';

// Shop calendar for the "where this job slots in" schedule. One shift on one VMC: every in-house
// job on the board queues for the same machine.
export const VMC_COUNT = 1;
export const SHIFT_START_HOUR = 9;          // 09:00
export const HOURS_PER_DAY = 8;             // one 8-hour shift
export const WORKING_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat (0 = Sunday)
// Changeover per setup per batch (load fixture, touch off, prove out). Assumption, not measured;
// matches the auto-quote's default setupTimePerSetupMin.
export const SETUP_MIN_PER_SETUP = 30;

// Machining order on the one machine: what is cutting now, then scheduled, then planning, then the
// queue. QC / Dispatched are past machining and are not in the queue.
const STAGE_ORDER = { PRODUCTION: 0, SCHEDULING: 1, PROCESS_PLANNING: 2, IN_QUEUE: 3 };
export const QUEUED_STAGES = Object.keys(STAGE_ORDER);

// Minutes per part and setup count for one board job, with where the number came from. `kind` is
// 'ai' (the approved v3 plan), 'programmer' (the shop's own program), 'quote' (an auto-quote) or
// 'none' — a job with no estimate has minutesPerPart null and is never counted as 0.
export const partKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// The approved AI plan on any order, by part name, so a second order for the same part is
// scheduled from the same plan instead of showing "no estimate". `jobs` are anything with
// { partName, autoQuote, projectNo }. When several orders carry a plan, the most recently approved wins.
export function approvedPlansByPart(jobs) {
  const m = new Map();
  (jobs || []).forEach(j => {
    const ai = j.autoQuote && j.autoQuote.data && j.autoQuote.data.aiPlan;
    if (!ai || !(Number(ai.cycleMinutesPerPart) > 0)) return;
    const k = partKey(j.partName);
    const cur = m.get(k);
    if (!cur || String(ai.approvedAt || '') > String(cur.ai.approvedAt || '')) m.set(k, { ai, projectNo: j.projectNo });
  });
  return m;
}

export function estimateFor(job, plans) {
  const aq = job.autoQuote && job.autoQuote.data;
  // Approved AI plan (Process plan & CAM program card → ProtoDataContext.saveApprovedPlan).
  const ai = aq && aq.aiPlan;
  if (ai && Number(ai.cycleMinutesPerPart) > 0) {
    const when = ai.approvedAt ? new Date(ai.approvedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return {
      minutesPerPart: Number(ai.cycleMinutesPerPart), setups: Number(ai.setups) || 1, label: 'AI plan (v3)', kind: 'ai', real: true,
      source: `Approved AI plan (v3): ${Number(ai.cycleMinutesPerPart).toFixed(1)} min per part including tool changes${ai.approvedBy ? `, approved by ${ai.approvedBy}` : ''}${when ? ` on ${when}` : ''}.`,
    };
  }
  // Same part, approved on another order: reuse that plan (labelled, so it is never mistaken for this
  // order's own approval).
  const shared = plans && plans.get(partKey(job.partName));
  if (shared && Number(shared.ai.cycleMinutesPerPart) > 0) {
    return {
      minutesPerPart: Number(shared.ai.cycleMinutesPerPart), setups: Number(shared.ai.setups) || 1, label: 'AI plan (v3)', kind: 'ai', real: true, reused: true,
      source: `Reused from the approved plan on ${shared.projectNo || 'another order'} (same part): ${Number(shared.ai.cycleMinutesPerPart).toFixed(1)} min per part including tool changes.`,
    };
  }
  const lib = CYCLE_TIME_LIBRARY.find(c => c.match.test(job.partName || ''));
  if (lib) return { minutesPerPart: lib.minutesPerPart, setups: lib.setups, label: 'Programmer time', kind: 'programmer', source: lib.source, real: true };
  // capp_service snapshot (AutoQuoteModal): { _source: 'capp_service', quote: <GET /quote response> }
  const cq = aq && aq._source === 'capp_service' && aq.quote;
  if (cq && Number(cq.machining && cq.machining.total_minutes) > 0) {
    return { minutesPerPart: Number(cq.machining.total_minutes), setups: Number(cq.setups) || 1, label: `Auto-quote · v3 plan (${job.autoQuote.status || 'DRAFT'})`, kind: 'quote', source: 'This part’s auto-quote: v3 machining plan minutes.', real: true };
  }
  if (aq && Number(aq.cycleTimeMin) > 0 && aq._source !== 'placeholder') {
    return { minutesPerPart: Number(aq.cycleTimeMin), setups: Number(aq.setupCount) || 1, label: `Auto-quote (${job.autoQuote.status || 'DRAFT'})`, kind: 'quote', source: 'This part’s auto-quote cycle time.', real: true };
  }
  return { minutesPerPart: null, setups: null, label: 'No estimate yet', kind: 'none', source: 'Not counted: no approved AI plan, programmer time or finished auto-quote for this part yet.', real: false };
}

export function machineMinutes(job, est) {
  if (est.minutesPerPart === null) return null;
  return est.minutesPerPart * (Number(job.qty) || 1) + (est.setups || 0) * SETUP_MIN_PER_SETUP;
}

// One machine, so the board's two machine columns have a fixed number of places: one job cutting,
// up to two scheduled behind it. Soft limit: a column over its places is flagged, not refused.
export const MACHINE_NAME = 'machine 1';
export const MACHINE_SLOTS = { PRODUCTION: 1, SCHEDULING: 2 };

const isWorkDay = (d) => WORKING_DAYS.includes(d.getDay());
function dayStart(d) { const x = new Date(d); x.setHours(SHIFT_START_HOUR, 0, 0, 0); return x; }
function dayEnd(d) { const x = dayStart(d); x.setMinutes(x.getMinutes() + HOURS_PER_DAY * 60); return x; }
function nextDay(d) { const x = new Date(d); x.setDate(x.getDate() + 1); return dayStart(x); }

// The first moment at or after `t` that falls inside a shift.
export function nextWorkingInstant(t) {
  let x = new Date(t);
  for (let i = 0; i < 14; i += 1) {
    if (isWorkDay(x)) {
      if (x < dayStart(x)) return dayStart(x);
      if (x < dayEnd(x)) return x;
    }
    x = nextDay(x);
  }
  return x;
}

// Walks the shift calendar forward by `minutes` of machine time.
export function addWorkingMinutes(t, minutes) {
  let x = nextWorkingInstant(t);
  let left = minutes;
  while (left > 0) {
    const room = (dayEnd(x) - x) / 60000;
    if (left <= room) return new Date(x.getTime() + left * 60000);
    left -= room;
    x = nextWorkingInstant(nextDay(x));
  }
  return x;
}

// Orders the board's queued jobs for the machine and gives each a start and finish.
export function buildSchedule(jobs, now = new Date()) {
  const queued = jobs.filter(j => j.tag === 'inhouse' && QUEUED_STAGES.includes(j.status)).slice().sort((a, b) =>
    STAGE_ORDER[a.status] - STAGE_ORDER[b.status]
    || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'))
    || String(a.orderDate || '').localeCompare(String(b.orderDate || ''))
    || String(a.projectNo).localeCompare(String(b.projectNo))
    || a.partIndex - b.partIndex);
  let t = nextWorkingInstant(now);
  let unestimatedAhead = 0;
  const plans = approvedPlansByPart(jobs);
  return queued.map((job, i) => {
    const est = estimateFor(job, plans);
    const mins = machineMinutes(job, est);
    const start = t;
    const finish = mins === null ? null : addWorkingMinutes(start, mins);
    const row = { job, position: i + 1, est, minutes: mins, start, finish, unestimatedAhead };
    if (finish) t = finish; else unestimatedAhead += 1;
    return row;
  });
}

export const fmtWhen = (d) => (d ? d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtDay = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
export const fmtHours = (m) => (m === null || m === undefined ? '—' : `${(m / 60).toFixed(1)} h`);
