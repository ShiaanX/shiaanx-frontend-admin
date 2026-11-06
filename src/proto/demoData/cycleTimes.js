import MOTOR_MOUNT_CLOSED_LOOP from './motorMountClosedLoop';

// Known machining times for parts the shop has actually programmed, matched to a board card by part
// name (the backend gives each part a UUID, so a fixed template id cannot be used). A part not
// listed here falls back to its own auto-quote cycle time (see components/scheduleModel.js).
//
// Motor Mount: the programmer's own per-tool machining times from the TS (Sinumerik 828D) program
// headers, summed across its 4 setups. Not typed in: it is read from the generated data module.
const mm = MOTOR_MOUNT_CLOSED_LOOP.cycleTime;

export const CYCLE_TIME_LIBRARY = [
  {
    match: /motor\s*mount/i,
    minutesPerPart: mm.programmerMinutesPerPart,
    setups: mm.setups.length,
    label: 'Programmer cycle time',
    source: `${mm.basis} Files: ${mm.setups.map(s => s.file).join(', ')}.`,
  },
];
