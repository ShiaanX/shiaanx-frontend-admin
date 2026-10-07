import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { StatusBadge } from '../components/Badges';
import NewEnquiryModal from '../components/NewEnquiryModal';
import { useProtoData } from '../ProtoDataContext';
import { TODAY } from '../fixtures';
import { fmtDate } from '../utils';

const PERIOD_LABELS = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'This quarter', fy: 'This financial year', all: 'All time', custom: 'Custom range' };

function fyRange(d) {
  // Indian FY: 1 Apr – 31 Mar.
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31`, label: `FY ${y}-${String(y + 1).slice(2)}` };
}

export default function EnquiriesOrders() {
  const { rows } = useProtoData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [period, setPeriod] = useState('30');
  const [customFrom, setCustomFrom] = useState('2026-09-01');
  const [customTo, setCustomTo] = useState('2026-10-05');
  const [showNewEnquiry, setShowNewEnquiry] = useState(false);

  const scoped = useMemo(() => {
    if (period === 'all') return rows;
    if (period === 'fy') { const { from, to } = fyRange(TODAY); return rows.filter(r => r.date >= from && r.date <= to); }
    if (period === 'custom') return rows.filter(r => r.date >= customFrom && r.date <= customTo);
    const cutoff = new Date(TODAY); cutoff.setDate(cutoff.getDate() - parseInt(period, 10));
    return rows.filter(r => new Date(r.date) >= cutoff);
  }, [rows, period, customFrom, customTo]);

  const filtered = useMemo(() => {
    if (filter === 'orders') return rows.filter(r => r.isOrder);
    if (filter === 'enq') return rows.filter(r => !r.isOrder);
    return rows;
  }, [rows, filter]);

  const stats = {
    total: scoped.length,
    orders: scoped.filter(r => r.isOrder).length,
    awaiting: scoped.filter(r => r.status === 'PENDING' || r.status === 'QUOTED').length,
    inProduction: scoped.filter(r => r.status === 'IN_PRODUCTION').length,
  };

  const openRow = (r) => navigate(r.isOrder ? `/proto/orders/${r.orderId}` : `/proto/enquiries/${r.id}`);

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
        <Icon name="calendar" /><span className="period-label">Stats below for</span>
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
        {period === 'fy' && <span className="period-label mono">{fyRange(TODAY).label} · {fmtDate(fyRange(TODAY).from)} – {fmtDate(fyRange(TODAY).to)}</span>}
      </div>

      <div className="stats-row">
        <div className="px-stat-card"><div className="n">{stats.total}</div><div className="l">Total enquiries</div></div>
        <div className="px-stat-card accent"><div className="n">{stats.orders}</div><div className="l">Converted to orders</div></div>
        <div className="px-stat-card"><div className="n">{stats.awaiting}</div><div className="l">Awaiting quote/PO</div></div>
        <div className="px-stat-card"><div className="n">{stats.inProduction}</div><div className="l">In production</div></div>
      </div>

      <div className="toolbar">
        <div className="search"><Icon name="search" /><input placeholder="Search enquiry #, customer, part…" /></div>
        <div className="filter-pills">
          <div className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</div>
          <div className={`pill ${filter === 'orders' ? 'active' : ''}`} onClick={() => setFilter('orders')}>Orders only</div>
          <div className={`pill ${filter === 'enq' ? 'active' : ''}`} onClick={() => setFilter('enq')}>Enquiries only</div>
        </div>
      </div>

      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Enquiry #</th><th>Customer</th><th>Parts</th><th>Status</th><th>Order?</th><th /></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6}><div className="empty-hint">No rows match this filter.</div></td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="rowlink" onClick={() => openRow(r)}>
                <td className="mono cell-primary">{r.id}{r.isOrder && <div className="cell-sub mono">{r.orderId}</div>}</td>
                <td>{r.customer}</td>
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
