import { CL_PARTS } from '../fixtures';

// The closed-loop rules library: what making parts has taught the shop, each rule with its evidence and
// status. "proposed" = seen in the data, not yet confirmed by the team. A rule with `match` is the
// reason the "Why" panel gives for a defect (the panel picks the rule whose pattern fits the cause).
// Rules from the Bottom Plate run are read from its closed-loop record, not retyped here.
const STATUS_NOTE = 'proposed';

export const DEFECT_RULES = [
  { id: 'R-01', match: /drawing and cad disagree/i, title: 'When the drawing and CAD disagree, machine to the CAD and correct the drawing',
    rule: 'If every reading is within tolerance against the CAD value but not against the drawing callout, the toolpath is fine: fix the drawing before it is flagged as a defect.', part: 'Motor Mount', status: STATUS_NOTE },
  { id: 'R-02', match: /small-cutter deflection/i, title: 'Interpolating a hole with a cutter much smaller than the hole leaves it undersize',
    rule: 'Where the end mill is 70% of the hole diameter or less and long for its size, expect the hole to come out small. Size it with a drill or a stiffer finishing pass.', part: 'Motor Mount', status: 'confirmed by batch 2',
    evidence: 'Motor Mount balloons 4 and 5 (Ø3.2): a Ø2 end mill at F1000 (auto-plan F90) gave 3.02-3.03 in batch 1; batch 2 drilled them with a Ø3.2 drill and measured 3.15-3.20.' },
  { id: 'R-03', match: /overrode the auto-plan/i, title: 'Programmer overrides of spindle or feed add to deflection',
    rule: 'A higher chip load than the auto-plan on a small tool raises cutting force. Review the override before the next batch.', part: 'Motor Mount', status: STATUS_NOTE },
  { id: 'R-04', match: /drilled without a finishing pass/i, title: 'A twist drill alone cannot hold a tight diameter band',
    rule: 'Twist drills cut slightly oversize. For a hole tolerance of about +/-0.05 or tighter, add a reaming or boring pass.', part: 'Motor Mount', status: STATUS_NOTE },
  { id: 'R-05', match: /thickness made across settings/i, title: 'A thickness cut across two settings inherits the datum transfer error',
    rule: 'Z-zero error after flipping the part shows directly in the thickness. Touch off the second setting on the finished face, and check it first.', part: 'Motor Mount', status: STATUS_NOTE },
  { id: 'R-06', match: /only \d+ of \d+ parts out/i, title: 'One bad part under a common program is a part problem, not a toolpath problem',
    rule: 'Check clamping, distortion and burrs on that part, or re-measure, before changing the program.', part: 'Motor Mount', status: STATUS_NOTE },
  { id: 'R-07', match: /whole batch is offset/i, title: 'A whole batch at one edge of the band needs one offset correction',
    rule: 'When every part sits at the same edge of its band, apply a single tool or datum offset to recentre it.', part: 'Motor Mount', status: STATUS_NOTE },
  { id: 'R-08', match: /out in both batches/i, title: 'Out in two batches with different programs means the cause is outside the toolpath',
    rule: 'Look at the drawing value, the fixturing datum, or how it is measured before changing programs again.', part: 'Motor Mount', status: STATUS_NOTE },
];

export const ruleFor = (causeTitle) => DEFECT_RULES.find(r => r.match.test(causeTitle || '')) || null;

// Rules written up from the Bottom Plate run (checked against its telemetry): same library, own ids.
const BP = CL_PARTS['PN-1052'] || {};
export const RUN_RULES = (BP.rules || []).map((r, i) => ({
  id: `B-${String(i + 1).padStart(2, '0')}`, title: r.rule, rule: r.rule, evidence: r.basis, confidence: r.confidence,
  part: BP.name, status: STATUS_NOTE,
}));

export const ALL_RULES = [...DEFECT_RULES, ...RUN_RULES];
