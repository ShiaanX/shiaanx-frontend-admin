import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import KpiStrip from '../components/KpiStrip';
import { KINDS, KIND_LABEL, KindBadge, ComplaintStatusBadge } from '../components/ComplaintModal';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';

const PERIOD_LABELS = { 30: 'Last 30 days', 90: 'Last 90 days', fy: 'This financial year', all: 'All time' };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function fyRange(d) {
  // Indian FY: 1 Apr – 31 Mar.
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31`, label: `FY ${y}-${String(y + 1).slice(2)}` };
}
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : (s || ''));

// Every complaint, rejection and feedback across all jobs, built from the jobs already loaded. The
// period goes by the date it was received; the tiles count the period (and customer) before the
// kind and status filters, so they read as a summary of the period.
export default function Complaints() {
  const { rows, customers } = useProtoData();
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState('90');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [customer, setCustomer] = useState('all');

  const companyOf = (r) => { const c = customers.find(x => x.id === r.customerId); return (c && c.company) || r.customer || '—'; };

  const all = useMemo(() => rows.flatMap(r => (r.complaints || []).map(c => ({ c, r, company: companyOf(r) })))
    .sort((a, b) => String(b.c.receivedOn || '').localeCompare(String(a.c.receivedOn || ''))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rows, customers]);

  const companies = useMemo(() => [...new Set(all.map(x => x.company))].sort((a, b) => a.localeCompare(b)), [all]);

  const scoped = useMemo(() => {
    let from = null; let to = ymd(today);
    if (period === 'fy') ({ from, to } = fyRange(today));
    else if (period !== 'all') { const d = new Date(today); d.setDate(d.getDate() - parseInt(period, 10)); from = ymd(d); }
    return all.filter(({ c, company }) => {
      const on = String(c.receivedOn || '').slice(0, 10);
      if (from && on && (on < from || on > to)) return false;
      return customer === 'all' || company === customer;
    });
  }, [all, period, customer, today]);

  const shown = scoped.filter(({ c }) => (kind === 'all' || c.kind === kind) && (status === 'all' || c.status === status));

  const count = (f) => scoped.filter(({ c }) => f(c)).length;
  const tiles = [
    { n: count(c => c.status !== 'RESOLVED'), l: 'Open', cls: 'warn' },
    { n: count(c => c.status === 'RESOLVED'), l: 'Resolved', cls: 'ok' },
    { n: count(c => c.kind === 'COMPLAINT'), l: 'Complaints' },
    { n: count(c => c.kind === 'REJECTION'), l: 'Rejections', cls: 'err' },
    { n: count(c => c.kind === 'FEEDBACK'), l: 'Feedback' },
  ];

  const jobPath = (r) => (r.isOrder ? `/proto/orders/${r.uuid}` : `/proto/enquiries/${r.uuid}`);
  const partNames = (r, ids) => (ids || []).map(id => { const p = r.parts.find(x => x.uuid === id); return p ? p.name : null; }).filter(Boolean);

  return (
    <div data-complaints-page>
      <div className="page-head">
        <div><h1>Complaints &amp; Feedback</h1><div className="page-sub">What customers sent back about delivered work, across every job. Add new ones from the order's page.</div></div>
      </div>

      <div className="period-ctrl">
        <Icon name="calendar" /><span className="period-label">Received</span>
        <select value={period} onChange={e => setPeriod(e.target.value)} data-filter="period">
          {Object.entries(PERIOD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {period === 'fy' && <span className="period-label mono">{fyRange(today).label}</span>}
        <select value={kind} onChange={e => setKind(e.target.value)} data-filter="kind">
          <option value="all">All kinds</option>
          {KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} data-filter="status">
          <option value="all">Open and resolved</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </select>
        <select value={customer} onChange={e => setCustomer(e.target.value)} data-filter="customer">
          <option value="all">All customers</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <KpiStrip items={tiles} style={{ marginBottom: 16 }} />

      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Job</th><th>Customer</th><th>Kind</th><th>Received</th><th>Parts</th><th>Status</th><th>Description</th><th>Resolution</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={8}><div className="empty-hint">Nothing recorded in this period matches these filters.</div></td></tr>}
            {shown.map(({ c, r, company }) => {
              const names = partNames(r, c.partIds);
              return (
                <tr key={c.id} className="rowlink" onClick={() => navigate(jobPath(r))} data-complaint-row={c.id}>
                  <td className="mono cell-primary">
                    <button type="button" className="btn-text mono" onClick={(e) => { e.stopPropagation(); navigate(jobPath(r)); }}>{r.isOrder ? r.orderId : r.id}</button>
                    {r.assemblyName && <div className="cell-sub">{r.assemblyName}</div>}
                  </td>
                  <td>{company}</td>
                  <td><KindBadge kind={c.kind} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.receivedOn ? fmtDate(String(c.receivedOn).slice(0, 10)) : '—'}</td>
                  <td>{names.length ? names.join(', ') : <span className="cell-sub">Whole job</span>}{c.qtyAffected != null && <div className="cell-sub">Qty {c.qtyAffected}</div>}</td>
                  <td><ComplaintStatusBadge status={c.status} /></td>
                  <td title={c.description} style={{ minWidth: 180 }}>{clip(c.description, 90)}</td>
                  <td style={{ minWidth: 160 }}>
                    {c.status === 'RESOLVED'
                      ? <>{clip(c.resolution, 80) || '—'}{c.resolvedOn && <div className="cell-sub">{fmtDate(String(c.resolvedOn).slice(0, 10))}</div>}</>
                      : <span className="cell-sub">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
