import React, { useEffect, useMemo, useState } from 'react';
import {
  MdClose, MdSave, MdCheckCircle, MdOutlinePrecisionManufacturing, MdInventory2, MdCalculate,
  MdSchedule, MdEdit, MdOutlineInfo,
} from 'react-icons/md';
import '../../components/enquiry/AutoQuoteModal.css';
import { useProtoData } from '../ProtoDataContext';
import { getQuote, getDfm, postQuotePdf } from '../cappApi';
import { queueWaitDays } from './scheduleModel';
import { getDfmSnapshot } from './capp/dfmSnapshotStore';
import { ensureDfmSnapshot } from './capp/dfmOffscreen';
import { useCappJob, partKeyOf } from '../cappJobStore';
import CappJobRunner, { cappMaterialOf } from './capp/CappJobRunner';
import { useCappResource, ResourceState, fmtINR, fmtNum, show } from './capp/CappCommon';

// Auto-quote for one part, computed live by capp_service from the part's machining plan:
// GET /jobs/{id}/quote?qty=&material= — machining minutes per tool, machine rate, margin, stock
// and lead time. The calculated numbers come from that response; the quoted price, lead time,
// validity, payment terms and notes are editable. Save draft keeps them editable; Finalize locks
// them, makes the client PDF (POST /jobs/{id}/quote-pdf), downloads it and attaches it to the
// enquiry. Stored on the part's auto-quote as
//   { _source:'capp_service', cappJobId, quote:<GET /quote>, edits:{unit_price_inr, total_inr,
//     lead_days, validity_days, payment_terms, notes, qty, material}, finalizedAt }
// with status DRAFT | FINALIZED (data.aiPlan is kept by saveAutoQuote).
const MATERIALS = ['aluminium_6061', 'aluminium_6082', 'aluminium_7075'];

const numOrNull = (v) => { const n = Number(v); return v !== '' && v !== null && Number.isFinite(n) ? n : null; };

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function Row({ label, value, cls }) {
  return <div className={`cx-row ${cls || ''}`}><span>{label}</span><span className="v">{value}</span></div>;
}

// "4 days" for an actual lead time; "1–4 days (estimate, upper end used: 4)" for a directory estimate.
function leadText(sup) {
  if (!sup) return '—';
  const r = sup.lead_range || [];
  if (sup.lead_basis === 'actual' || r[0] === r[1]) return `${show(sup.lead_days)} days`;
  return `${show(r[0])}–${show(r[1])} days (estimate; ${show(sup.lead_days)} used)`;
}

export default function AutoQuoteModal({ row, partIndex, onClose }) {
  const { rows, getAutoQuote, saveAutoQuote, uploadManualQuote } = useProtoData();
  const part = row.parts[partIndex];
  const existing = getAutoQuote(row.id, partIndex);
  const { entry } = useCappJob(partKeyOf(part));
  const jobId = entry && entry.jobId;

  const [activeTab, setActiveTab] = useState('summary');
  const [status, setStatus] = useState(existing ? existing.status : null);
  const saved = (existing && existing.data && existing.data._source === 'capp_service' && existing.data.edits) || null;
  const startQty = (saved && Number(saved.qty)) || Number(part.qty) || 1;
  const [qtyInput, setQtyInput] = useState(String(startQty));
  const [qty, setQty] = useState(startQty);
  const initialMat = (saved && saved.material) || cappMaterialOf(part.material);
  const [material, setMaterial] = useState(MATERIALS.includes(initialMat) ? initialMat : 'aluminium_6061');
  // Editable terms. '' for price / lead time = use the calculated value.
  const [priceInput, setPriceInput] = useState(saved && saved.unit_price_inr !== undefined ? String(saved.unit_price_inr) : '');
  const [leadInput, setLeadInput] = useState(saved && saved.lead_days !== undefined && saved.lead_days !== null ? String(saved.lead_days) : '');
  const [validity, setValidity] = useState(saved && saved.validity_days ? String(saved.validity_days) : '30');
  const [terms, setTerms] = useState((saved && saved.payment_terms) || '');
  const [notes, setNotes] = useState((saved && saved.notes) || '');
  const [busy, setBusy] = useState(null); // 'finalize' while the PDF is being made
  const [msg, setMsg] = useState(null);   // { ok, text }
  const locked = status === 'FINALIZED';

  // How long the machine is busy with the jobs already cutting or scheduled (same list and schedule
  // as the Production Board). Only jobs with a plan or time estimate can be counted.
  const wait = useMemo(() => {
    const jobs = [];
    (rows || []).forEach((r) => {
      if (!(r.isOrder || r.jobType === 'TRIAL')) return;
      r.parts.forEach((p, idx) => {
        if (r.id === row.id && idx === partIndex) return;
        if (p.ordered === false || !p.jobStatus || p.jobStatus === 'DELIVERED') return;
        jobs.push({
          id: `${r.id}:${idx}`, rowId: r.id, partIndex: idx, partName: p.name, projectNo: r.orderId || r.id,
          tag: 'inhouse', status: p.jobStatus, qty: p.qty, autoQuote: p.autoQuote, deadline: r.deadline, orderDate: r.orderDate || r.date,
        });
      });
    });
    return queueWaitDays(jobs, new Date());
  }, [rows, row.id, partIndex]);

  useEffect(() => {
    const n = parseInt(qtyInput, 10);
    if (!n || n < 1) return undefined;
    const t = setTimeout(() => setQty(n), 500);
    return () => clearTimeout(t);
  }, [qtyInput]);

  const res = useCappResource(() => getQuote(jobId, { qty, material }), `${jobId}|${qty}|${material}`, { enabled: !!jobId });
  const d = res.data;

  if (!jobId) {
    return (
      <div className="aq-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="aq-modal" style={{ height: 'auto', maxWidth: 620 }}>
          <div className="aq-generating" style={{ alignItems: 'stretch', textAlign: 'left' }}>
            <h2 className="aq-generating-title">Quote {part.name}</h2>
            <p className="aq-generating-sub">The quote is calculated from the part's machining plan (machining time per tool, stock, setups). Run the analysis on its STEP file first.</p>
            <div style={{ marginTop: 14 }}><CappJobRunner part={part} /></div>
            <button className="aq-btn aq-btn-ghost" style={{ marginTop: 16, alignSelf: 'flex-start' }} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const cost = (d && d.cost) || {};
  const lead = (d && d.lead_time_days) || {};
  const mat = (d && d.material) || {};
  const byTool = (d && d.machining && d.machining.by_tool) || [];
  const bySetup = (d && d.machining && d.machining.by_setup) || [];
  const maxMin = Math.max(1, ...byTool.map(t => Number(t.minutes) || 0));

  const calcUnit = Number(cost.unit_price_inr);
  const typedPrice = numOrNull(priceInput);
  const unitPrice = typedPrice !== null ? typedPrice : (d ? calcUnit : null);
  const diffPct = d && unitPrice !== null && calcUnit > 0 ? ((unitPrice - calcUnit) / calcUnit) * 100 : 0;
  const quotedTotal = unitPrice !== null ? Math.round(unitPrice * qty * 100) / 100 : null;
  const leadDefault = lead.total === null || lead.total === undefined ? null : Number(lead.total) + wait.days;
  const typedLead = numOrNull(leadInput);
  const leadDays = typedLead !== null ? typedLead : leadDefault;
  const validityDays = numOrNull(validity);
  const problem = !d ? 'Waiting for the calculated quote.'
    : (unitPrice === null || unitPrice <= 0) ? 'Enter a unit price above 0.'
    : (leadDays === null || leadDays < 0 || !Number.isInteger(leadDays)) ? 'Lead time must be a whole number of days.'
    : (validityDays === null || validityDays < 1 || !Number.isInteger(validityDays)) ? 'Validity must be a whole number of days.' : null;

  const buildData = (finalize) => ({
    _source: 'capp_service', cappJobId: jobId, quantity: qty, material, quote: d,
    edits: {
      unit_price_inr: unitPrice, total_inr: quotedTotal, lead_days: leadDays, validity_days: validityDays,
      payment_terms: terms.trim(), notes: notes.trim(), qty, material,
    },
    savedAt: new Date().toISOString(),
    ...(finalize ? { finalizedAt: new Date().toISOString() } : {}),
  });

  const handleSave = () => {
    if (!d || problem) { setMsg({ ok: false, text: problem }); return; }
    saveAutoQuote(row.id, partIndex, buildData(false), false);
    setStatus('DRAFT');
    setMsg({ ok: true, text: 'Draft saved. You can keep editing.' });
  };

  const handleFinalize = async () => {
    if (!d || problem) { setMsg({ ok: false, text: problem }); return; }
    setBusy('finalize'); setMsg(null);
    try {
      // 3D picture: the one the viewer already rendered, else render it offscreen (20 s limit); no picture is fine.
      let snap = getDfmSnapshot(jobId);
      if (!snap) {
        let dfmData = null;
        try { dfmData = await getDfm(jobId); } catch (e) { dfmData = null; }
        snap = await ensureDfmSnapshot(jobId, dfmData);
      }
      const data = buildData(true);
      const blob = await postQuotePdf(jobId, {
        customer: row.customer, enquiry_number: row.id, part_name: part.name, qty, material,
        edits: data.edits, prepared_by: '', dfm_snapshot_png_base64: snap ? snap.split(',')[1] : undefined,
      });
      const fileName = `Quotation ${row.id} - ${part.name}.pdf`.replace(/[\\/:*?"<>|]+/g, '-');
      downloadBlob(blob, fileName);
      let attached = true;
      try { await uploadManualQuote(row.id, new File([blob], fileName, { type: 'application/pdf' })); } catch (e) { attached = false; }
      await saveAutoQuote(row.id, partIndex, data, true);
      setStatus('FINALIZED');
      setMsg({ ok: true, text: `Quote finalized. The PDF was downloaded${attached ? ' and attached to the enquiry' : ' (it could not be attached to the enquiry, upload it by hand)'}.` });
    } catch (e) {
      setMsg({ ok: false, text: `Could not make the PDF: ${e.message}. The quote was not finalized.` });
    } finally {
      setBusy(null);
    }
  };

  const handleEditAgain = () => {
    saveAutoQuote(row.id, partIndex, buildData(false), false);
    setStatus('DRAFT');
    setMsg({ ok: true, text: 'Reopened as a draft.' });
  };

  const tabs = [
    ['summary', 'Summary', MdCalculate, unitPrice],
    ['machining', 'Machining', MdOutlinePrecisionManufacturing, cost.machining_inr],
    ['material', 'Material & stock', MdInventory2, cost.material_inr],
    ['lead', 'Lead time', MdSchedule, null],
  ];

  return (
    <div className="aq-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="aq-modal">
        <header className="aq-header">
          <div className="aq-header-left">
            <div>
              <p className="aq-header-eyebrow">Auto-Quote · calculated from the part's machining plan</p>
              <h1 className="aq-header-title">{part.name}</h1>
              <p className="aq-header-sub">{row.id} · analysis job {jobId.slice(0, 8)}</p>
            </div>
          </div>
          <div className="aq-header-actions">
            <div className={`aq-pipeline-badge ${status === 'FINALIZED' ? 'online' : 'offline'}`}><div className="aq-badge-dot"></div>{status === 'FINALIZED' ? 'Finalized' : status === 'DRAFT' ? 'Draft saved' : 'Not saved'}</div>
            <button className="aq-btn aq-btn-ghost" onClick={onClose}><MdClose /></button>
          </div>
        </header>

        <div className="aq-body">
          <aside className="aq-sidebar">
            <div className="aq-grand-total-pill">
              <p className="aq-grand-total-label">Quoted unit price</p>
              <div className="aq-grand-total-value">{d ? fmtINR(unitPrice) : '…'}</div>
              <p className="aq-unit-price">{d ? `Total ${fmtINR(quotedTotal)} · ${qty} pcs · ${show(leadDays)} days` : 'Calculating…'}</p>
            </div>
            <div style={{ padding: '14px 20px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="aq-field"><label>Quantity</label><input type="number" min="1" value={qtyInput} disabled={locked} onChange={e => setQtyInput(e.target.value)} /></div>
              <div className="aq-field"><label>Material</label>
                <select value={material} disabled={locked} onChange={e => setMaterial(e.target.value)}>
                  {MATERIALS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <nav className="aq-nav">
              {tabs.map(([id, label, Ico, amt]) => (
                <button key={id} className={`aq-nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
                  <span><Ico style={{ marginRight: 8 }} /> {label}</span>
                  {d && amt !== null && amt !== undefined && <span className="aq-nav-section-amount">{fmtINR(amt)}</span>}
                </button>
              ))}
            </nav>
          </aside>

          <main className="aq-content cx">
            {!d && <ResourceState res={res} runningText="The machining plan is being worked out — the quote appears when it finishes…" />}

            {d && activeTab === 'summary' && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card" style={{ gridColumn: '1 / -1' }}>
                  <div className="aq-card-head"><h3>Your quote</h3><span>{locked ? 'Finalized - locked' : 'Editable'}</span></div>
                  <div className="aq-card-body">
                    <div className="aq-grid aq-grid-2" style={{ gap: 12 }}>
                      <div className="aq-field"><label>Quoted unit price (INR)</label>
                        <input type="number" min="0" step="0.01" disabled={locked} value={priceInput} placeholder={String(calcUnit)} onChange={e => setPriceInput(e.target.value)} />
                        <div className="cell-sub">
                          Calculated {fmtINR(calcUnit)}
                          {typedPrice !== null && Math.abs(diffPct) >= 0.05 ? ` · your price is ${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}% vs calculated` : ''}
                          {typedPrice !== null && !locked && <> · <button type="button" className="btn-text" onClick={() => setPriceInput('')}>Reset to calculated</button></>}
                        </div>
                      </div>
                      <div className="aq-field"><label>Order total ({qty} pcs)</label>
                        <input type="text" disabled readOnly value={fmtINR(quotedTotal)} />
                        <div className="cell-sub">Quantity x quoted unit price</div>
                      </div>
                      <div className="aq-field"><label>Lead time (days)</label>
                        <input type="number" min="0" step="1" disabled={locked} value={leadInput} placeholder={leadDefault === null ? '' : String(leadDefault)} onChange={e => setLeadInput(e.target.value)} />
                        <div className="cell-sub">
                          Calculated {show(leadDefault)} days incl. {wait.days} day(s) waiting for the machine
                          {typedLead !== null && !locked && <> · <button type="button" className="btn-text" onClick={() => setLeadInput('')}>Reset</button></>}
                        </div>
                      </div>
                      <div className="aq-field"><label>Validity (days)</label>
                        <input type="number" min="1" step="1" disabled={locked} value={validity} onChange={e => setValidity(e.target.value)} />
                      </div>
                      <div className="aq-field"><label>Payment terms</label>
                        <input type="text" disabled={locked} value={terms} placeholder="As per PO" onChange={e => setTerms(e.target.value)} />
                      </div>
                      <div className="aq-field" style={{ gridColumn: '1 / -1' }}><label>Notes</label>
                        <textarea disabled={locked} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Shown on the quote PDF" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Calculated cost per unit</h3><span>{qty} pcs</span></div>
                  <div className="aq-card-body">
                    <Row label="Material" value={fmtINR(cost.material_inr)} />
                    <Row label={`Machining · ${fmtNum(d.machining && d.machining.total_minutes, 1)} min @ ${fmtINR(d.rates && d.rates.machine_inr_per_hr)}/hr`} value={fmtINR(cost.machining_inr)} />
                    <Row label={`Setup · ${fmtNum(d.setup_minutes, 0)} min, shared over the batch`} value={fmtINR(cost.setup_inr)} />
                    <Row label="Subtotal" value={fmtINR(cost.subtotal_inr)} cls="muted" />
                    <Row label={`Margin · ${show(d.rates && d.rates.margin_pct)}%`} value={fmtINR(cost.margin_inr)} cls="muted" />
                    <Row label="Calculated unit price" value={fmtINR(cost.unit_price_inr)} cls="total" />
                    <Row label={`Calculated total · ${qty} pcs`} value={fmtINR(cost.total_inr)} cls="total" />
                    {Array.isArray(cost.excludes) && cost.excludes.length > 0 && <div className="cell-sub">Excludes {cost.excludes.join(', ')}</div>}
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>At a glance</h3></div>
                  <div className="aq-card-body">
                    <Row label="Lead time" value={`${show(leadDefault)} days`} />
                    <Row label="Stock" value={<>{mat.in_stock ? `In stock · ${show(mat.inventory_item && mat.inventory_item.id)}` : mat.supplier ? `${mat.supplier.name} · ${leadText(mat.supplier)}` : 'Not in stock'}{((mat.in_stock && mat.inventory_item && mat.inventory_item.sample) || (!mat.in_stock && mat.supplier && mat.supplier.lead_basis !== 'actual')) && <span className="badge b-near" style={{ marginLeft: 6 }}>{mat.in_stock ? 'sample data' : 'estimate'}</span>}</>} />
                    <Row label="Machining time / part" value={`${fmtNum(d.machining && d.machining.total_minutes, 1)} min`} />
                    <Row label="Setups" value={show((d.machining && d.machining.by_setup && d.machining.by_setup.length) || d.setups)} />
                    <div className="cell-sub" style={{ marginTop: 10 }}>Calculated live from this part's machining plan. Change quantity or material to re-price.</div>
                    {(d.assumptions || []).length > 0 && (
                      <details style={{ marginTop: 14 }}>
                        <summary className="cx-sec" style={{ cursor: 'pointer' }}>Assumptions ({d.assumptions.length})</summary>
                        <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>{d.assumptions.map((a, i) => <li key={i}>{show(a)}</li>)}</ul>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {d && activeTab === 'machining' && (
              <div className="aq-card">
                <div className="aq-card-head"><h3>Machining time by tool</h3><span>{fmtNum(d.machining && d.machining.total_minutes, 1)} min / part</span></div>
                <div className="aq-card-body">
                  {byTool.map((t, i) => (
                    <div key={i} className="cx-bar">
                      <div className="nm" title={`${show(t.tool)} ${t.role || ''} ${t.setup || ''}`}><b>{show(t.tool)}</b>{t.role ? <span style={{ color: 'var(--muted)' }}> · {t.role}</span> : null}{t.setup ? <span style={{ color: 'var(--muted)' }}> · {t.setup}</span> : null}</div>
                      <div className="track"><div className="fill" style={{ width: `${Math.max(2, ((Number(t.minutes) || 0) / maxMin) * 100)}%` }} /></div>
                      <div className="v mono">{fmtNum(t.minutes, 1)} min</div>
                    </div>
                  ))}
                  {bySetup.length > 0 && (
                    <>
                      <div className="cx-sec" style={{ marginTop: 18 }}>By setup</div>
                      {bySetup.map((s, i) => {
                        // Same basis as the total: v3 cutting + this setup's tool changes at the shop ATC time.
                        const m = d.machining || {};
                        const atc = m.tool_change_basis === 'atc' && s.cutting_minutes !== undefined && s.cutting_minutes !== null;
                        const mins = atc ? Number(s.cutting_minutes) + (Number(s.tool_changes) || 0) * Number(m.tool_change_s) / 60 : s.minutes;
                        return <Row key={i} label={<span className="mono">{show(s.dir)}</span>} value={`${fmtNum(mins, 1)} min`} />;
                      })}
                      {d.machining && d.machining.tool_change_basis === 'atc' && (
                        <div className="cell-sub" style={{ marginTop: 6 }}>
                          {fmtNum(d.machining.cutting_minutes, 1)} min cutting + {show(d.machining.tool_changes)} tool changes × {show(d.machining.tool_change_s)} s (ATC).
                          The plan's own total is {fmtNum(d.machining.v3_total_minutes, 1)} min because it assumes 15 min per manual tool change.
                        </div>
                      )}
                    </>
                  )}
                  <div className="aq-formula" style={{ marginTop: 16 }}>
                    <p className="aq-formula-title">Machine rate</p>
                    <p className="aq-formula-code">{fmtINR(d.rates && d.rates.machine_inr_per_hr)}/hr · setup {fmtNum(d.setup_minutes, 0)} min · margin {show(d.rates && d.rates.margin_pct)}%</p>
                  </div>
                </div>
              </div>
            )}

            {d && activeTab === 'material' && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Stock</h3></div>
                  <div className="aq-card-body">
                    <Row label="Grade" value={show(mat.grade)} />
                    <Row label="Required stock (mm)" value={Array.isArray(mat.required_stock_mm) ? mat.required_stock_mm.map(v => fmtNum(v, 1)).join(' × ') : show(mat.required_stock_mm)} />
                    <Row label="Inventory item" value={mat.inventory_item && typeof mat.inventory_item === 'object'
                      ? <span style={{ display: 'block', textAlign: 'right', whiteSpace: 'normal' }}>
                          <b>{show(mat.inventory_item.id)}</b>
                          <span className="cell-sub" style={{ display: 'block' }}>
                            {[mat.inventory_item.size ? `${mat.inventory_item.shape} ${mat.inventory_item.size}` : null,
                              mat.inventory_item.location ? `rack ${mat.inventory_item.location}` : null,
                              mat.inventory_item.items_needed ? `${mat.inventory_item.items_needed} of ${show(mat.inventory_item.qty)} on hand` : null].filter(Boolean).join(' · ')}
                          </span>
                          {mat.inventory_item.sample && <span className="badge b-near">sample data</span>}
                        </span>
                      : show(mat.inventory_item)} />
                    <Row label="Material cost / part" value={fmtINR(cost.material_inr)} cls="total" />
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Availability</h3><span className={`badge ${mat.in_stock ? 'b-pass' : 'b-near'}`}>{mat.in_stock ? 'In stock' : 'From supplier'}</span></div>
                  <div className="aq-card-body">
                    {mat.in_stock ? <p style={{ margin: 0 }}>Matching stock is in inventory — no material wait.</p>
                      : mat.supplier ? (
                        <>
                          <Row label="Supplier" value={<>{show(mat.supplier.name)}{!mat.supplier.verified && <span className="badge b-near" style={{ marginLeft: 6 }}>not yet verified</span>}</>} />
                          <Row label="City" value={show(mat.supplier.city)} />
                          <Row label="Lead time" value={leadText(mat.supplier)} />
                          {mat.supplier.shape && <Row label="Supplied as" value={`${mat.supplier.shape} · ${show(mat.supplier.confidence)} confidence listing`} />}
                          <Row label="Price" value={`${fmtINR(mat.supplier.price_inr_per_kg)}/kg`} />
                        </>
                      ) : <p style={{ margin: 0, color: 'var(--error-ink)' }}>Not in inventory and no supplier was found for this grade and size.</p>}
                  </div>
                </div>
              </div>
            )}

            {d && activeTab === 'lead' && (
              <div className="aq-card">
                <div className="aq-card-head"><h3>Lead time</h3><span>{show(leadDefault)} days total</span></div>
                <div className="aq-card-body">
                  <Row label="Material" value={`${show(lead.material)} days`} />
                  <Row label="Wait for machine (queue)" value={`${wait.days} days`} />
                  <Row label="Machining" value={`${show(lead.machining)} days`} />
                  <Row label="QC" value={`${show(lead.qc)} days`} />
                  <Row label="Dispatch" value={`${show(lead.dispatch)} days`} />
                  <Row label="Total" value={`${show(leadDefault)} days`} cls="total" />
                  <div className="cell-sub" style={{ marginTop: 10 }}>
                    Working days on a 12-hour shift, Monday to Saturday. The queue wait comes from the jobs now cutting or scheduled on the board.
                  </div>
                  {wait.partial && <div className="aq-notice" style={{ marginTop: 10 }}><MdOutlineInfo style={{ fontSize: '1.2rem', flexShrink: 0 }} /><span>Queue wait counts only jobs with a plan; a job ahead without an estimate is not included, so the real wait may be longer.</span></div>}
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="aq-footer">
          <div className="aq-footer-left">
            <span style={{ fontSize: '0.8rem', color: 'var(--aq-muted)' }}>Status: <strong>{status || 'NOT SAVED'}</strong></span>
            {msg && <span style={{ marginLeft: 12, fontSize: '0.8rem', color: msg.ok ? 'var(--aq-muted)' : '#b00020' }}>{msg.text}</span>}
          </div>
          <div className="aq-footer-right">
            {locked ? (
              <button className="aq-btn aq-btn-secondary" onClick={handleEditAgain}><MdEdit /> Edit again</button>
            ) : (
              <>
                <button className="aq-btn aq-btn-secondary" disabled={!d || !!busy} onClick={handleSave}><MdSave /> Save Draft</button>
                <button className="aq-btn aq-btn-primary" disabled={!d || !!busy} onClick={handleFinalize}><MdCheckCircle /> {busy === 'finalize' ? 'Making the PDF…' : 'Finalize Quote'}</button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
