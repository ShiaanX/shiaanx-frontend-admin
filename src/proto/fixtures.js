// Mock data for the admin-flow preview. Every page reads from here, so replacing these exports with
// API calls later is a per-page change. Client names and part numbers are anonymised; the telemetry
// and QC numbers are real.

export const TODAY = new Date('2026-10-05');

// Shared by the Production Board columns and each order's status timeline.
export const JOB_STATUSES = ['IN_QUEUE', 'PROCESS_PLANNING', 'SCHEDULING', 'PRODUCTION', 'QC', 'DISPATCHED'];
export const JOB_STATUS_LABEL = {
  IN_QUEUE: 'In queue', PROCESS_PLANNING: 'Process planning', SCHEDULING: 'Scheduling',
  PRODUCTION: 'Production', QC: 'QC', DISPATCHED: 'Dispatched',
};
// Statuses saved in a browser before the board's stages were renamed.
export const LEGACY_JOB_STATUS = { PLANNED: 'PROCESS_PLANNING', SCHEDULED: 'SCHEDULING', MACHINING: 'PRODUCTION' };

export const INITIAL_CUSTOMERS = [
  { name: 'Client A', company: 'Client A Defence Systems', email: 'procurement@client-a.example', phone: '+91 98xxx xxxxx' },
  { name: 'Client B', company: 'Client B Robotics', email: 'orders@client-b.example', phone: '+91 97xxx xxxxx' },
  { name: 'Client C', company: 'Client C Drones', email: 'supply@client-c.example', phone: '+91 96xxx xxxxx' },
  { name: 'Client D', company: 'Client D Robotics', email: 'hello@client-d.example', phone: '+91 95xxx xxxxx' },
  { name: 'Client E', company: 'Client E Aerospace', email: 'sourcing@client-e.example', phone: '+91 94xxx xxxxx' },
  { name: 'Client F', company: 'Client F Defence', email: 'contact@client-f.example', phone: '+91 93xxx xxxxx' },
];

export const ROWS = [
  { id: 'ENQ-2026-0151', customer: 'Client E', date: '2026-10-04', status: 'PENDING', isOrder: false, parts: [
    { tmpl: 'TMPL-MOUNTPLATE', name: 'Mount Plate', material: 'Aluminium 6061', qty: 2, finish: 'Anodised', file: 'mount_plate.stp' },
  ] },
  { id: 'ENQ-2026-0143', customer: 'Client D', date: '2026-09-29', status: 'QUOTED', isOrder: false, parts: [
    { tmpl: 'TMPL-EXTBRACKET', name: 'Extrusion Bracket', material: 'Aluminium 6061', qty: 5, finish: 'Bead blast', file: 'extrusion_bracket.stp' },
  ] },
  { id: 'ENQ-2026-0138', customer: 'Client A', date: '2026-09-28', status: 'IN_PRODUCTION', isOrder: true, orderId: 'ORD-2026-0091',
    orderDate: '2026-09-30', deadline: '2026-10-12', poValue: '₹ 84,500',
    remarks: 'Rush order — customer flagged this as blocking their own assembly line.', parts: [
      { tmpl: 'TMPL-BASEPLATE', name: 'Heat-Sink Base Plate', material: 'Copper', qty: 1, finish: 'Ni plate 10µm', file: 'base_plate.stp',
        machine: 'STM-01', jobStatus: 'PRODUCTION', inspection: { pass: 16, near: 1, fail: 3, total: 19 } },
    ] },
  { id: 'ENQ-2026-0130', customer: 'Client B', date: '2026-09-20', status: 'IN_PRODUCTION', isOrder: true, orderId: 'ORD-2026-0084',
    orderDate: '2026-09-22', deadline: '2026-10-08', parts: [
      { tmpl: 'TMPL-HUB', name: 'Hub', material: 'Aluminium 6061', qty: 2, finish: 'As machined', file: 'hub.stp',
        machine: 'VMC-02', jobStatus: 'QC', inspection: null },
      { tmpl: 'TMPL-HINGE', name: 'Hinge', material: 'Aluminium 6061', qty: 2, finish: 'As machined', file: 'hinge.stp',
        machine: 'VMC-01', jobStatus: 'PROCESS_PLANNING', inspection: null },
    ] },
  { id: 'ENQ-2026-0125', customer: 'Client C', date: '2026-09-10', status: 'DISPATCHED', isOrder: true, orderId: 'ORD-2026-0077',
    orderDate: '2026-09-12', deadline: '2026-09-29', parts: [
      { tmpl: 'TMPL-MOTORMOUNT', name: 'Motor Mount', material: 'Aluminium 7075', qty: 2, finish: 'As machined', file: 'motor_mount.stp',
        machine: 'VMC-01', jobStatus: 'DISPATCHED', inspection: null },
    ] },
  { id: 'ENQ-2026-0119', customer: 'Client F', date: '2026-08-30', status: 'CANCELLED', isOrder: false, parts: [
    { tmpl: 'TMPL-CAMHOUSING', name: 'Camera Housing', material: 'Aluminium 6061', qty: 1, finish: 'Black anodised', file: 'camera_housing.stp' },
  ] },
  // No customer order behind this one: Order? stays No, but the production record is tracked like an order's.
  { id: 'INT-2026-0004', customer: '— Internal / R&D —', date: '2026-10-01', status: 'IN_PRODUCTION', isOrder: false, jobType: 'TRIAL', parts: [
    { tmpl: 'TMPL-TRIALBLOCK', name: 'Copper Facing Trial Block', material: 'Copper', qty: 1, finish: 'As machined', file: 'trial_block_v1.stp',
      machine: 'STM-01', jobStatus: 'QC', inspection: { pass: 5, near: 0, fail: 0, total: 5 } },
  ] },
];

export const PARTNER_JOBS = [
  { n: 'Camera Housing #1', m: 'Client F', tag: 'partner', tl: 'Partner shop 1', status: 'SCHEDULING' },
];

// src decides the action verb: ai/tech → Generate, human → Upload.
export const ARTIFACT_DEFS = [
  { id: 'po', name: 'Customer PO', src: 'human', doneStatus: 'Uploaded by sales', pendingStatus: 'Awaiting customer PO' },
  { id: 'quote', name: 'Quotation', src: 'ai', doneStatus: 'Finalized by admin', pendingStatus: 'Not yet generated' },
  { id: 'plan', name: 'Process plan', src: 'ai', doneStatus: 'v2 · approved by engineer', pendingStatus: 'Not yet generated' },
  { id: 'inspPlan', name: 'Inspection plan (balloon tagging)', src: 'tech', doneStatus: 'Balloons tagged', pendingStatus: 'Not yet tagged' },
  { id: 'cam', name: 'CAM program', src: 'human', doneStatus: 'v1 · programmed in PowerMill', pendingStatus: 'Awaiting programmer' },
  { id: 'inspTemplate', name: 'Inspection template', src: 'tech', doneStatus: 'Generated from inspection plan', pendingStatus: 'Not yet generated' },
  { id: 'inspReport', name: 'Inspection report', src: 'tech', doneStatus: 'Generated from QC readings', pendingStatus: 'Awaiting QC readings' },
  { id: 'materialCert', name: 'Material certificate', src: 'human', doneStatus: 'Uploaded', pendingStatus: 'Not yet uploaded' },
  { id: 'coc', name: 'Certificate of Conformance', src: 'human', doneStatus: 'Signed by QC lead', pendingStatus: 'Not yet uploaded' },
  { id: 'traceability', name: 'Traceability pack', src: 'tech', doneStatus: 'Built from the items above', pendingStatus: 'Not yet built' },
];
export const SRC_LABEL = { ai: 'AI-generated', human: 'Human', tech: 'Tech-generated' };

// Keyed by the job that owns the checklist: an order id or a no-order job id.
export const INITIAL_ARTIFACT_STATE = {
  'ORD-2026-0091': { po: true, quote: true, plan: true, inspPlan: true, cam: true, inspTemplate: true, inspReport: true },
  'ORD-2026-0084': { po: true, quote: true, plan: true },
  'ORD-2026-0077': { po: true, quote: true, plan: true, inspPlan: true, cam: true, inspTemplate: true, inspReport: true, materialCert: true, coc: true, traceability: true },
  'INT-2026-0004': { plan: true, inspPlan: true, cam: true, inspTemplate: true, inspReport: true },
};

export const DIMENSIONS = [
  { b: 1, label: '78 +0/−0.25', v: 'fail' }, { b: 2, label: '12 ±0.1', v: 'pass' }, { b: 3, label: '12 ±0.1', v: 'pass' },
  { b: 4, label: '108 +0/−0.25', v: 'fail' }, { b: 5, label: '1 ±0.1', v: 'pass' }, { b: 8, label: 'Ø9 ±0.1', v: 'pass' },
  { b: 9, label: '60 ±0.1', v: 'pass' }, { b: 11, label: 'Ø6.2 ±0.1', v: 'near' }, { b: 17, label: '54 ±0.1', v: 'pass' },
  { b: 19, label: '5 ±0.1', v: 'fail' },
];

const TRIAL_DIMENSIONS = [
  { b: 1, label: 'Facing flatness, 0.05 TIR', v: 'pass' }, { b: 2, label: '60 ±0.1', v: 'pass' }, { b: 3, label: '15 ±0.1', v: 'pass' },
];

export const INSPECTION_BY_PART = {
  'Heat-Sink Base Plate': { job: 'PJ-0091-1', dims: DIMENSIONS, summary: { pass: 16, near: 1, fail: 3, total: 19 }, ncr: 'NCR-0014' },
  'Copper Facing Trial Block': { job: 'PJ-INT4-1', dims: TRIAL_DIMENSIONS, summary: { pass: 5, near: 0, fail: 0, total: 5 }, ncr: null },
};

const PENDING_PART = { setups: 'Not yet planned', operations: '—', stock: '—', planStatus: 'PENDING', datums: null, dims: null, fixture: null };

export const PART_LIBRARY = {
  'TMPL-BASEPLATE': { name: 'Heat-Sink Base Plate', customer: 'Client A', rev: 'A',
    setups: '2 — G54 top face, G55 flip', operations: '14, across both setups', stock: '112 × 82 × 10 mm copper billet',
    programSource: 'HUMAN_PROGRAMMED · v1 · ACTIVE', planStatus: 'APPROVED',
    datums: [['Datum A', 'Bottom face'], ['Datum B', 'Long edge'], ['Datum C', 'Ø9 hole']], dims: DIMENSIONS,
    fixture: [['Workholding', 'Step-jaw vise'], ['Clamp faces', 'Two long edges'], ['Jaw opening', '84 mm']] },
  'TMPL-HUB': { name: 'Hub', customer: 'Client B', rev: '1',
    setups: '1 — G54 only', operations: '6', stock: '60 × 40 × 20 mm aluminium billet',
    programSource: 'AI_GENERATED · v1 · DRAFT', planStatus: 'DRAFT', datums: null, dims: null, fixture: null },
  'TMPL-HINGE': { name: 'Hinge', customer: 'Client B', rev: '1',
    setups: '1 — G54 only', operations: '4', stock: '50 × 30 × 15 mm aluminium billet',
    programSource: 'Not yet run', planStatus: 'DRAFT', datums: null, dims: null, fixture: null },
  'TMPL-MOTORMOUNT': { name: 'Motor Mount', customer: 'Client C', rev: '1',
    setups: '3 — G54 / G55 / G56', operations: '18', stock: '95 × 70 × 40 mm 7075 billet',
    programSource: 'HUMAN_PROGRAMMED · v1 · ACTIVE', planStatus: 'APPROVED',
    datums: [['Datum A', 'Base face'], ['Datum B', 'Bore axis']], dims: null,
    fixture: [['Workholding', 'Fixture plate'], ['Clamp faces', 'Base + two bosses']],
    note: 'Baseline accuracy check against the real programmer’s plan: tool selection matched on 12.8% of operations — the gap that motivated tightening the tool-selection rules.' },
  'TMPL-MOUNTPLATE': { name: 'Mount Plate', customer: 'Client E', rev: '—', programSource: 'Enquiry stage', ...PENDING_PART },
  'TMPL-EXTBRACKET': { name: 'Extrusion Bracket', customer: 'Client D', rev: '—', programSource: 'Enquiry stage', ...PENDING_PART },
  'TMPL-CAMHOUSING': { name: 'Camera Housing', customer: 'Client F', rev: '—', programSource: 'Enquiry cancelled', ...PENDING_PART },
  'TMPL-TRIALBLOCK': { name: 'Copper Facing Trial Block', customer: '— Internal / R&D —', rev: '1',
    setups: '1 — G54 only', operations: '5', stock: '60 × 60 × 15 mm copper billet',
    programSource: 'HUMAN_PROGRAMMED · v1 · ACTIVE', planStatus: 'APPROVED', datums: null, dims: TRIAL_DIMENSIONS,
    fixture: [['Workholding', 'Step-jaw vise'], ['Clamp faces', 'Two long edges']],
    note: 'No customer order behind this part — an internal trial testing the copper facing feed found in Closed Loop before using it on a real order.' },
};

export const CAM_PROGRAMS = {
  'TMPL-BASEPLATE': { human: { file: 'base_plate_v1.tap', status: 'v1 · ACTIVE' }, ai: { file: 'base_plate_ai_v1.nc', status: 'v1 · reference only' } },
  'TMPL-HUB': { human: null, ai: { file: 'hub_ai_v1.nc', status: 'v1 · SUBMITTED' } },
  'TMPL-HINGE': { human: null, ai: null },
  'TMPL-MOTORMOUNT': { human: { file: 'motor_mount_v1.tap', status: 'v1 · ACTIVE' }, ai: { file: 'motor_mount_ai_v1.nc', status: 'v1 · 12.8% tool match vs human' } },
  'TMPL-MOUNTPLATE': { human: null, ai: null },
  'TMPL-EXTBRACKET': { human: null, ai: null },
  'TMPL-CAMHOUSING': { human: null, ai: null },
  'TMPL-TRIALBLOCK': { human: { file: 'trial_block_v1.tap', status: 'v1 · ACTIVE' }, ai: null },
};

// Closed-loop report data: real telemetry, CAM and QC figures for one machined part.
export const CL_PARTS = {
  'PN-1052': { name: 'Heat-Sink Base Plate', machine: 'STM-01', material: 'Copper',
    window: { span: '2h 6m', samples: 5784, coverage: 93.3, util: 88.8, cutting: '80m 12s', cuttingPct: 88, air: '11m 28s',
      stopped: '1m 0s', manual: '10m 47s', setup: '12m 47s', alarmPct: 3.15, alarmEvents: 133 },
    insights: [
      'In-program time splits 80 min cutting / 11 min air-positioning — 13% of running time the spindle is in a program but not removing metal. Plus 1 min stopped and 8 min the collector was not sampling.',
      'A further 13 min went on inter-operation setup — program loaded on the controller but cycle not started. That is on top of the in-program time above.',
      'Cutting share ranges from 73% (7_4END_FLAT) to 94% (2_10END_OUTER_FIN). The low end is where cycle time is being lost.',
      '2 programs ran more than one cycle — 10END_FLAT ran 4 times. Repeat cycles of the same program are the cleanest run-to-run consistency check available.',
      'Spindle RPM spans 799 (4_3.2DRILL) to 5000 (2_10END_OUTER_FIN) — compare against the CAM-programmed S once the full program set is linked.',
      '5 of 8 operations carry an alarm flag for over 1% of samples (highest: 4_3.2DRILL). Alarm semantics are unconfirmed — treat as provisional (see Rules).',
    ],
    closedLoop: { opsTotal: 16, withTelemetry: 8, offWindow: 8, qcInTol: '16/19', outcome: 'FAIL', camProject: 'PN-1052.pmlprj · workplanes 1, 2',
      note: 'The inspection report has 19 measured dimensions, 16 in tolerance — but only 11 of 16 operations are linked to a specific dimension yet, so the other 5 cannot be graded PASS/FAIL individually even though the part overall reads FAIL (3 dimensions out of tolerance, 1 close to the limit).' },
    ops: [
      { op: '10END_FLAT', progS: 4500, progF: 1000, actRpm: 4499, actFeed: 849, cutS: 631, estS: 202.3, qc: 'unmapped' },
      { op: '1_10end_outer', progS: 4500, progF: 1000, actRpm: 4999, actFeed: 1399, cutS: 351, estS: 1221.4, qc: 'FAIL' },
      { op: '1_10end_ruf', progS: 4000, progF: 1500, actRpm: null, actFeed: null, cutS: null, estS: 1440.8, qc: 'unmapped' },
      { op: '2_10end_outer_fin', progS: 4500, progF: 1000, actRpm: 5000, actFeed: 799, cutS: 1454, estS: 1219.5, qc: 'FAIL' },
      { op: '2_4end_rest', progS: 5000, progF: 1000, actRpm: null, actFeed: null, cutS: null, estS: 1451.2, qc: 'FAIL' },
      { op: '3_1cd', progS: 1000, progF: null, actRpm: 999, actFeed: 8, cutS: 197, estS: null, qc: 'unmapped' },
      { op: '3_4end_fin', progS: 5000, progF: 500, actRpm: null, actFeed: null, cutS: null, estS: 266.8, qc: 'PASS' },
      { op: '4_3.2drill', progS: 1000, progF: null, actRpm: 799, actFeed: 20, cutS: 758, estS: null, qc: 'PASS' },
      { op: '4_4end_flat', progS: 5500, progF: 500, actRpm: null, actFeed: null, cutS: null, estS: 519.2, qc: 'FAIL' },
      { op: '5_4boll_fin', progS: 5900, progF: 500, actRpm: null, actFeed: null, cutS: null, estS: 7794.2, qc: 'PASS' },
      { op: '5_6end', progS: 4500, progF: 1000, actRpm: 4499, actFeed: 684, cutS: 689, estS: 434.3, qc: 'PASS' },
      { op: '6_2end_fin', progS: 5000, progF: 500, actRpm: null, actFeed: null, cutS: null, estS: 207.4, qc: 'unmapped' },
      { op: '6_4end', progS: 4500, progF: 1000, actRpm: 4499, actFeed: 599, cutS: 652, estS: 489.5, qc: 'PASS' },
      { op: '7_2end_fin_1', progS: 5000, progF: 500, actRpm: null, actFeed: null, cutS: null, estS: 148.5, qc: 'unmapped' },
      { op: '7_4end_flat', progS: 4500, progF: 1000, actRpm: 4499, actFeed: 299, cutS: 80, estS: 28.7, qc: 'PASS' },
      { op: '8_2end_fi', progS: 5000, progF: 500, actRpm: null, actFeed: null, cutS: null, estS: 269, qc: 'PASS' },
    ],
    steps: [
      { op: '1_10end_outer', feature: 'outer profile, roughing pass with a 10 mm end mill',
        headline: 'Feed ran 40% faster than programmed, spindle 11% faster, both held rock-steady — but only the second half was recorded.',
        said: 'Feed 1000 mm/min for the cutting moves, a slow 500 lead-in, spindle 4500 rpm. One long contour ramping gradually down to 10 mm deep.',
        happened: 'For the entire logged stretch the feed sat at exactly 1399 mm/min and the spindle at about 5000 rpm — never moving, not once, with zero alarms.',
        means: 'The operator turned the feed dial to 140% and the spindle up about 11% at the start and left them there — a confident, deliberate choice, not drift.' },
      { op: '2_10end_outer_fin', feature: 'outer profile, finishing pass, 10 mm end mill',
        headline: 'Feed ran 20% slower than programmed, spindle 11% faster, held steady the whole way.',
        said: 'Feed 1000 mm/min, 500 lead-in, spindle 4500 rpm. A single finishing lap around the outside, full depth.',
        happened: 'Feed sat at 799 mm/min for essentially the whole operation (brief dips to 530–620 at tight corners), spindle at about 5000 rpm.',
        means: 'On the finishing pass the operator backed the feed off to 80% — the opposite dial direction from the roughing pass just before it.' },
      { op: '4_3.2drill', feature: '8 holes, Ø3.2 mm at about 5× diameter depth, peck cycle',
        headline: 'Spindle run about 20% slow, peck feed about 33% slow, 61 alarm transitions — none of which mean a fault.',
        said: 'Spindle 1000 rpm, peck feed implied by the drill cycle, 8 holes.',
        happened: 'Spindle sat at about 799 rpm, feed at about 20 mm/min, 8 holes took about 16 minutes with 61 alarm-flag transitions.',
        means: 'This machine raises its alarm flag on every peck retract, not just on a real fault — see Rules for why alarm count alone cannot gate QC.' },
    ],
    crossCutting: [
      'Every feed deviation this shift was a constant dial setting held for the whole operation, not the operator riding the knob mid-cut — each operation carries one clean decision worth recording.',
      'The direction is consistent with good practice: the big roughing end mill was pushed faster (+40%), while finishing passes, small end mills and small drills were all backed off (−20% to −60%).',
      'alarm_active is not a fault signal on this machine — 61 alarms on a drilling operation that passed inspection. Keep the count for reference, never let it raise a flag alone.',
      'Hand-jog / MDI sessions between operations are being counted inside the next operation on 3 ops, inflating their setup time and dragging their feed numbers toward zero.',
      'The recorded window covers only the first 21% of the job, and the first operation starts about 57% of the way in — a partial recording should never read as a fast one.',
    ],
    rules: [
      { rule: 'Ø10 flat end mill, roughing a profile: S5000 / F1400 (about 140% of the programmed 4500/1000) ran clean with zero alarms. Usable as an aggressive roughing point for this tool and material.', basis: '1_10end_outer — feed and spindle held flat the whole cut', confidence: 'low — one part' },
      { rule: 'Finishing and small-tool passes are run 20–40% below the programmed feed on this machine; treat programmed finish feeds as an upper bound, not a target.', basis: '2_10end_outer_fin −20%, 5_6end −30%, 6_4end about −10%, all held constant', confidence: 'low — one part' },
      { rule: 'Deep small drills (Ø3.2 at about 5× diameter): expect the operator to drop spindle about 20% and peck feed about 33% below programmed. Plan cycle time around 2 min/hole, not the CAM number.', basis: '4_3.2drill — S 800 vs 1000, feed 20 vs 30, 8 holes in about 16 min', confidence: 'medium' },
      { rule: 'alarm_active on this controller is not a fault signal — it toggles on every canned-cycle retract and feed-hold. Never gate QC or flags on alarm count alone.', basis: '4_3.2drill 61 events, 3_1cd 10 events (about 1 per hole), all on cycle-abort stops', confidence: 'high for this machine' },
      { rule: 'A single-pass facing program may be re-run 2–4 times as skim-to-thickness. Count physical passes from cycle-starts; the last completed cycle is the one that set the dimension.', basis: '10END_FLAT — 2 aborted starts plus 2 full passes', confidence: 'low — one part' },
    ],
    knowledgeBase: [
      { material: 'Copper', tool: 'endmill Ø4', feature: 'face', n: '2/1', sPosted: '4500, 5500', sRun: '4499', fPosted: '500, 1000', fRun: '299', qc: { FAIL: 1, PASS: 1 } },
      { material: 'Copper', tool: 'endmill Ø10', feature: 'outer profile (rough)', n: '1/1', sPosted: '4500', sRun: '4999', fPosted: '1000', fRun: '1399', qc: { FAIL: 1 } },
      { material: 'Copper', tool: 'endmill Ø10', feature: 'outer profile (finish)', n: '1/1', sPosted: '4500', sRun: '5000', fPosted: '1000', fRun: '799', qc: { FAIL: 1 } },
      { material: 'Copper', tool: 'endmill Ø4', feature: 'rest machining', n: '1/1', sPosted: '5000', sRun: '—', fPosted: '1000', fRun: '—', qc: { FAIL: 1 } },
      { material: 'Copper', tool: 'drill Ø1', feature: 'spot/centre drill', n: '1/1', sPosted: '1000', sRun: '999', fPosted: '—', fRun: '8', qc: { unmapped: 1 } },
      { material: 'Copper', tool: 'drill Ø1', feature: 'drilled holes', n: '1/1', sPosted: '1000', sRun: '799', fPosted: '—', fRun: '20', qc: { PASS: 1 } },
      { material: 'Copper', tool: 'endmill Ø6', feature: 'milling', n: '1/1', sPosted: '4500', sRun: '4499', fPosted: '1000', fRun: '684', qc: { PASS: 1 } },
      { material: 'Copper', tool: 'ballnosed Ø4', feature: '3D / ball-nose', n: '1/1', sPosted: '5900', sRun: '—', fPosted: '500', fRun: '—', qc: { PASS: 1 } },
    ],
    gaps: [
      { field: 'production_count', status: 'misleading', detail: 'Increments on program completion (M30), not per physical part — 10 steps across this window.', why: 'Would bound one physical part’s telemetry so a QC result can be attached to it.' },
      { field: 'rapid_override', status: 'constant', detail: 'Present, but never changes — every one of 5,784 samples reads 25.', why: 'Rapid-traverse knob. Currently stands in for feed_override.' },
      { field: 'spindle_override', status: 'constant', detail: 'Present, but never changes — every one of 5,784 samples reads 100.', why: 'Operator’s spindle-speed knob — same role as feed override, for RPM.' },
      { field: 'feed_override', status: 'absent', detail: 'Not sent by this controller at all.', why: 'The operator’s cutting-feed knob — the single richest closed-loop signal, i.e. where the shop disagreed with the programmed feed.' },
      { field: 'program_runtime', status: 'absent', detail: 'Not sent by this controller at all.', why: 'Controller’s own program elapsed time — a cross-check on wall-clock.' },
    ],
    catches: [
      { t: 'The QC report can get swapped without anyone noticing — and it did', d: 'This part’s inspection file changed mid-project: the material label flipped from Aluminium to Copper, and the 78 and 108 dimensions went from passing comfortably to reading 0.04–0.05 mm over. Nobody flagged it — it surfaced only because the closed loop compares every run against the exact file it last saw.' },
      { t: 'An hour-plus of real machine time was invisible until we checked', d: 'Three separate stretches of logged machine activity — 26, 46 and 8 minutes, with real cutting in them — did not match any program name in the CAM folder and would have silently vanished from every report.' },
      { t: '“Stopped” was quietly including time the operator was working by hand', d: 'Whenever an operator jogged the machine manually — positioning, touching off, hand-feeding a cut — the machine’s own status flag reads the same as a plain pause, so it was being counted as dead time.' },
    ] },
  'PN-1053': { name: 'Heat-Sink Top Plate', machine: 'STM-01', material: 'Copper',
    window: null, insights: null, closedLoop: null, ops: [], steps: null, crossCutting: null, rules: null, knowledgeBase: null, gaps: null,
    catches: [
      { t: 'A tapped hole was about to be logged as a scary failure — it is not one', d: 'One dimension (“Ø4.4, tapped hole”) measured 3.57–3.60 mm against a 4.4 mm nominal — an 0.8 mm miss that reads like a wrecked hole. But the drawing note says “tapped hole”: 4.4 is very likely the thread’s major diameter, not something a twist drill should ever reach.' },
      { t: 'Telemetry from a different job was about to be blamed on this part', d: 'Late in the day, two programs ran again — but that was a different part, reusing the same program names hours after this one was actually finished.' },
    ] },
};

// Base options for the New Enquiry form. Anything typed into "+ Add new…" there is appended to
// these (persisted in this browser) so it shows up as a normal option next time.
export const MATERIAL_OPTIONS = ['Aluminium 6061', 'Aluminium 7075', 'Copper', 'Mild Steel'];
export const FINISH_OPTIONS = ['As machined', 'Anodised', 'Bead blast', 'Ni plate'];

export const SETTINGS = {
  users: [['Anita Kumar', 'Admin', 'Active'], ['Ravi Shah', 'Process engineer', 'Active'], ['Meera Joshi', 'QC lead', 'Active'], ['Sanjay Rao', 'Production planner', 'Invited']],
  materials: [['Aluminium 6061', '₹ 420/kg', 'As machined, Anodised, Bead blast'], ['Aluminium 7075', '₹ 610/kg', 'As machined, Anodised'], ['Copper', '₹ 980/kg', 'As machined, Ni plate']],
  tools: [['EM_2FL_6MM', 'End mill, 2-flute', '6 mm'], ['DRILL_1.8MM', 'Jobber drill', '1.8 mm']],
  machines: [['STM-01', 'Mitsubishi', '24 slots', 'Running', '71%'], ['VMC-01', 'Fanuc 0iMD', '20 slots', 'Idle', '44%'], ['VMC-02', 'Fanuc 0iMD', '20 slots', 'Running', '58%']],
};
