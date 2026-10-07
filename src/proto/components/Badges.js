import React from 'react';
import { JOB_STATUS_LABEL } from '../fixtures';

const STATUS_CLS = {
  PENDING: 'b-pending', QUOTED: 'b-quoted', ORDERED: 'b-ordered', IN_PRODUCTION: 'b-inprogress',
  DISPATCHED: 'b-done', DELIVERED: 'b-done', CANCELLED: 'b-cancelled',
};
export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_CLS[status] || 'b-neutral'}`}>{status.replace('_', ' ')}</span>;
}

const JOB_STATUS_CLS = { IN_QUEUE: 'b-neutral', PROCESS_PLANNING: 'b-quoted', SCHEDULING: 'b-quoted', PRODUCTION: 'b-inprogress', QC: 'b-near', DISPATCHED: 'b-done' };
export function JobStatusBadge({ status }) {
  return <span className={`badge ${JOB_STATUS_CLS[status] || 'b-neutral'}`}>{JOB_STATUS_LABEL[status] || status}</span>;
}

const VERDICT = { pass: ['b-pass', 'Within tolerance'], near: ['b-near', 'Close to limit'], fail: ['b-fail', 'Out of tolerance'] };
export function VerdictBadge({ v }) {
  const [cls, label] = VERDICT[v] || ['b-neutral', v];
  return <span className={`badge ${cls}`}>{label}</span>;
}

const QC_CLS = { PASS: 'b-pass', FAIL: 'b-fail', unmapped: 'b-neutral' };
export function QcBadge({ qc }) {
  return <span className={`badge ${QC_CLS[qc] || 'b-neutral'}`}>{qc}</span>;
}
export function QcPillGroup({ qc }) {
  return Object.entries(qc).map(([k, v]) => (
    <span key={k} className={`badge ${QC_CLS[k] || 'b-neutral'}`} style={{ marginRight: 4 }}>{k} {v}</span>
  ));
}

export function ConfidenceBadge({ c }) {
  const cls = c.startsWith('high') ? 'b-pass' : c.startsWith('medium') ? 'b-near' : 'b-neutral';
  return <span className={`badge ${cls}`}>{c}</span>;
}
