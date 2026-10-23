import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { StatusBadge } from '../components/Badges';
import NewEnquiryModal from '../components/NewEnquiryModal';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';

const PERIOD_LABELS = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'This quarter', fy: 'This financial year', all: 'All time', custom: 'Custom range' };

// Matches the period control's select, for the process filter in the toolbar.
const SELECT_STYLE = { border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--ink)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5 };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function fyRange(d) {
  // Indian FY: 1 Apr – 31 Mar.
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31`, label: `FY ${y}-${String(y + 1).slice(2)}` };
}

export default function EnquiriesOrders() {
  const { rows, customers, processes = [] } = useProtoData();
  // The table names the customer by company; the contact person is kept for the tooltip and search.
  const companyOf = (r) => { const c = customers.find(x => x.id === r.customerId); return (c && c.company) || r.customer; };
  const today = useMemo(() => new Date(), []);
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [process, setProcess] = useState('');
  const [period, setPeriod] = useState('30');
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return ymd(d); });
  const [customTo, setCustomTo] = useState(() => ymd(new Date()));
  const [showNewEnquiry, setShowNewEnquiry] = useState(false);

  // The period scopes both the stats and the list, by the date the enquiry came in (r.date,
  // YYYY-MM-DD). A row with no date is kept rather than silently hidden.
  const scoped = useMemo(() => {
    if (period === 'all') return rows;
    let from; let to = ymd(today);
    if (period === 'fy') ({ from, to } = fyRange(today));
    else if (period === 'custom') { from = customFrom; to = customTo; }
    else { const d = new Date(today); d.setDate(d.getDate() - parseInt(period, 10)); from = ymd(d); }
    return rows.filter(r => !r.date || (r.date >= from && r.date <= to));
  }, [rows, period, customFrom, customTo, today]);

  // Pills: All, Orders only (every converted job, delivered or not), Enquiries only, Delivered.
  // The process filter keeps jobs where any part needs that process. Search matches enquiry #,
  // order #, customer, assembly name, part names and process names; every word typed must appear
  // somewhere in the row, in any order, ignoring case. All of them combine with the period.
  const filtered = useMemo(() => {
    let list = scoped;
    if (filter === 'orders') list = list.filter(r => r.isOrder);
    if (filter === 'enq') list = list.filter(r => !r.isOrder);
    if (filter === 'delivered') list = list.filter(r => r.status === 'DELIVERED');
    if (process) list = list.filter(r => (r.processes || []).includes(process));
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return list;
    return list.filter(r => {
      const hay = [r.id, r.orderId, r.customer, companyOf(r), r.assemblyName, ...(r.parts || []).map(p => p.name), ...(r.processes || [])]
        .filter(Boolean).join(' ').toLowerCase();
      return words.every(w => hay.includes(w));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, filter, process, query, customers]);

  // A process that is no longer in Settings but still on a job stays choosable.
  const processOptions = useMemo(() => {
    const extra = new Set();
    rows.forEach(r => (r.processes || []).forEach(n => { if (!processes.includes(n)) extra.add(n); }));
    return [...processes, ...[...extra].sort()];
  }, [processes, rows]);

  const stats = {
    total: scoped.length,
    orders: scoped.filter(r => r.isOrder).length,
    awaiting: scoped.filter(r => r.status === 'PENDING' || r.status === 'QUOTED').length,
    inProduction: scoped.filter(r => r.status === 'IN_PRODUCTION').length,
    delivered: scoped.filter(r => r.status === 'DELIVERED').length,
  };

  const openRow = (r) => navigate(r.isOrder ? `/proto/orders/${r.uuid}` : `/proto/enquiries/${r.uuid}`);

  return (
    <div>
      <div className="page-head">
        <div><h1>Enquiries &amp; Orders</h1><div className="page-sub">Every enquiry, one list. Converted ones carry the full production record.</div></div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/proto/customers')}><Icon name="users" /> Customers</button>
          <button type="button" className="btn px-btn-primary" onClick={() => setShowNewEnquiry(true)}><Icon name="plus" /> New enquiry</button>
        </div>
      </div>

      <div className="period-ctrl">
        <Icon name="calendar" /><span className="period-label">Showing</span>
        <select value={period} onChange={e => setPeriod(e.target.value)}>
          {Object.entries(PERIOD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {period === 'custom' && (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span className="period-label">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </span>
        )}
        {period === 'fy' && <span className="period-label mono">{fyRange(today).label} · {fmtDate(fyRange(today).from)} – {fmtDate(fyRange(today).to)}</span>}
      </div>

      <div className="stats-row">
        <div className="px-stat-card"><div className="n">{stats.total}</div><div className="l">Total enquiries</div></div>
        <div className="px-stat-card accent"><div className="n">{stats.orders}</div><div className="l">Converted to orders</div></div>
        <div className="px-stat-card"><div className="n">{stats.awaiting}</div><div className="l">Awaiting quote/PO</div></div>
        <div className="px-stat-card"><div className="n">{stats.inProduction}</div><div className="l">In production</div></div>
        <div className="px-stat-card"><div className="n">{stats.delivered}</div><div className="l">Delivered</div></div>
      </div>

      <div className="toolbar">
        <div className="search"><Icon name="search" /><input placeholder="Search enquiry #, customer, part, process…" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select aria-label="Process" data-testid="process-filter" style={SELECT_STYLE} value={process} onChange={e => setProcess(e.target.value)}>
          <option value="">All processes</option>
          {processOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="filter-pills">
          <div className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</div>
          <div className={`pill ${filter === 'orders' ? 'active' : ''}`} onClick={() => setFilter('orders')}>Orders only</div>
          <div className={`pill ${filter === 'enq' ? 'active' : ''}`} onClick={() => setFilter('enq')}>Enquiries only</div>
          <div className={`pill ${filter === 'delivered' ? 'active' : ''}`} onClick={() => setFilter('delivered')}>Delivered</div>
        </div>
      </div>

      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Enquiry #</th><th>Customer</th><th>Parts</th><th>Status</th><th>Order?</th><th /></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6}><div className="empty-hint">No enquiries in this period match this filter.</div></td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="rowlink" onClick={() => openRow(r)}>
                <td className="mono cell-primary">{r.id}{r.isOrder && <div className="cell-sub mono">{r.orderId}</div>}</td>
                <td title={r.customer}>{companyOf(r)}</td>
                <td>
                  {r.assemblyName
                    ? <>{r.assemblyName} <span className="cell-sub">({r.parts.length} part{r.parts.length === 1 ? '' : 's'})</span></>
                    : `${r.parts.length}: ${r.parts.map(p => p.name).join(', ')}`}
                </td>
                <td><StatusBadge status={r.status} /></td>
                <td>
                  {r.isOrder ? <span className="order-yes">Yes</span> : (
                    <><span className="order-no">No</span>{r.jobType === 'TRIAL' && <span className="tag" style={{ marginLeft: 4 }}>Trial</span>}</>
                  )}
                </td>
                <td><button type="button" className="btn-text">Details →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewEnquiry && <NewEnquiryModal onClose={() => setShowNewEnquiry(false)} />}
    </div>
  );
}
