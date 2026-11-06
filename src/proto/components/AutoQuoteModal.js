import React, { useEffect, useState } from 'react';
import {
  MdClose, MdSave, MdCheckCircle, MdOutlinePrecisionManufacturing, MdInventory2, MdCalculate,
  MdSchedule, MdCompareArrows, MdOutlineInfo,
} from 'react-icons/md';
import '../../components/enquiry/AutoQuoteModal.css';
import { useProtoData } from '../ProtoDataContext';
import { getQuote } from '../cappApi';
import { useCappJob, partKeyOf } from '../cappJobStore';
import CappJobRunner, { cappMaterialOf } from './capp/CappJobRunner';
import { useCappResource, ResourceState, fmtINR, fmtNum, show } from './capp/CappCommon';

// Auto-quote for one part, computed live by capp_service from the part's CAPP run:
// GET /jobs/{id}/quote?qty=&material= — machining minutes per tool from the v3 planner, machine
// rate, margin, stock (in inventory or from a supplier, with lead time) and the previous manual
// quote when there is one. Every number on this sheet comes from that response; change quantity or
// material and it is asked again. Save / Finalize store a snapshot of the response on the part.
const MATERIALS = ['aluminium_6061', 'aluminium_6082', 'aluminium_7075'];

function Row({ label, value, cls }) {
  return <div className={`cx-row ${cls || ''}`}><span>{label}</span><span className="v">{value}</span></div>;
}

export default function AutoQuoteModal({ row, partIndex, onClose }) {
  const { getAutoQuote, saveAutoQuote } = useProtoData();
  const part = row.parts[partIndex];
  const existing = getAutoQuote(row.id, partIndex);
  const { entry } = useCappJob(partKeyOf(part));
  const jobId = entry && entry.jobId;

  const [activeTab, setActiveTab] = useState('summary');
  const [status, setStatus] = useState(existing ? existing.status : null);
  const [qtyInput, setQtyInput] = useState(String(part.qty || 1));
  const [qty, setQty] = useState(Number(part.qty) || 1);
  const initialMat = cappMaterialOf(part.material);
  const [material, setMaterial] = useState(MATERIALS.includes(initialMat) ? initialMat : 'aluminium_6061');

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
            <p className="aq-generating-sub">The quote is calculated from the part's v3 planner run (machining time per tool, stock, setups). Run the analysis on its STEP file first.</p>
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
  const prev = d && d.previous_manual_quote;

  const handleSave = (finalize) => {
    if (!d) return;
    saveAutoQuote(row.id, partIndex, { _source: 'capp_service', cappJobId: jobId, quantity: qty, material, quote: d, savedAt: new Date().toISOString() }, finalize);
    setStatus(finalize ? 'FINALIZED' : 'DRAFT');
    if (finalize) onClose();
  };

  const tabs = [
    ['summary', 'Summary', MdCalculate, cost.unit_price_inr],
    ['machining', 'Machining', MdOutlinePrecisionManufacturing, cost.machining_inr],
    ['material', 'Material & stock', MdInventory2, cost.material_inr],
    ['lead', 'Lead time', MdSchedule, null],
  ];
  if (prev) tabs.push(['manual', 'vs manual quote', MdCompareArrows, null]);

  return (
    <div className="aq-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="aq-modal">
        <header className="aq-header">
          <div className="aq-header-left">
            <div>
              <p className="aq-header-eyebrow">Auto-Quote · calculated from the v3 planner</p>
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
              <p className="aq-grand-total-label">Unit price</p>
              <div className="aq-grand-total-value">{d ? fmtINR(cost.unit_price_inr) : '…'}</div>
              <p className="aq-unit-price">{d ? `Total ${fmtINR(cost.total_inr)} · ${qty} pcs · ${show(lead.total)} days` : 'Calculating…'}</p>
            </div>
            <div style={{ padding: '14px 20px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="aq-field"><label>Quantity</label><input type="number" min="1" value={qtyInput} onChange={e => setQtyInput(e.target.value)} /></div>
              <div className="aq-field"><label>Material</label>
                <select value={material} onChange={e => setMaterial(e.target.value)}>
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
            {!d && <ResourceState res={res} runningText="v3 planner is analysing the part — the quote appears when it finishes…" />}

            {d && activeTab === 'summary' && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Cost per unit</h3><span>{qty} pcs</span></div>
                  <div className="aq-card-body">
                    <Row label="Material" value={fmtINR(cost.material_inr)} />
                    <Row label={`Machining · ${fmtNum(d.machining && d.machining.total_minutes, 1)} min @ ${fmtINR(d.rates && d.rates.machine_inr_per_hr)}/hr`} value={fmtINR(cost.machining_inr)} />
                    <Row label={`Setup · ${fmtNum(d.setup_minutes, 0)} min, shared over the batch`} value={fmtINR(cost.setup_inr)} />
                    <Row label="Subtotal" value={fmtINR(cost.subtotal_inr)} cls="muted" />
                    <Row label={`Margin · ${show(d.rates && d.rates.margin_pct)}%`} value={fmtINR(cost.margin_inr)} cls="muted" />
                    <Row label="Unit price" value={fmtINR(cost.unit_price_inr)} cls="total" />
                    <Row label={`Order total · ${qty} pcs`} value={fmtINR(cost.total_inr)} cls="total" />
                    {Array.isArray(cost.excludes) && cost.excludes.length > 0 && <div className="cell-sub">Excludes {cost.excludes.join(', ')}</div>}
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>At a glance</h3></div>
                  <div className="aq-card-body">
                    <Row label="Lead time" value={`${show(lead.total)} days`} />
                    <Row label="Stock" value={<>{mat.in_stock ? 'In inventory' : mat.supplier ? `${mat.supplier.name} · ${show(mat.supplier.lead_days)} days` : 'Not in stock'}{((mat.in_stock && mat.inventory_item && mat.inventory_item.sample) || (!mat.in_stock && mat.supplier && mat.supplier.sample)) && <span className="badge b-near" style={{ marginLeft: 6 }}>sample data</span>}</>} />
                    <Row label="Machining time / part" value={`${fmtNum(d.machining && d.machining.total_minutes, 1)} min`} />
                    <Row label="Setups" value={show((d.machining && d.machining.by_setup && d.machining.by_setup.length) || d.setups)} />
                    <div className="cell-sub" style={{ marginTop: 10 }}>Calculated live from the v3 machining plan for this part. Change quantity or material to re-price.</div>
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
                <div className="aq-card-head"><h3>Machining time by tool (v3 planner)</h3><span>{fmtNum(d.machining && d.machining.total_minutes, 1)} min / part</span></div>
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
                          v3's own total is {fmtNum(d.machining.v3_total_minutes, 1)} min because it assumes 15 min per manual tool change.
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
                      ? <>{show(mat.inventory_item.id)}{mat.inventory_item.location ? ` · ${mat.inventory_item.location}` : ''}{mat.inventory_item.sample && <span className="badge b-near" style={{ marginLeft: 6 }}>sample data</span>}</>
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
                          <Row label="Supplier" value={<>{show(mat.supplier.name)}{mat.supplier.sample && <span className="badge b-near" style={{ marginLeft: 6 }}>sample data</span>}</>} />
                          <Row label="City" value={show(mat.supplier.city)} />
                          <Row label="Lead time" value={`${show(mat.supplier.lead_days)} days`} />
                          <Row label="Price" value={`${fmtINR(mat.supplier.price_inr_per_kg)}/kg`} />
                        </>
                      ) : <p style={{ margin: 0, color: 'var(--error-ink)' }}>Not in inventory and no supplier was found for this grade and size.</p>}
                  </div>
                </div>
              </div>
            )}

            {d && activeTab === 'lead' && (
              <div className="aq-card">
                <div className="aq-card-head"><h3>Lead time</h3><span>{show(lead.total)} days total</span></div>
                <div className="aq-card-body">
                  <Row label="Material" value={`${show(lead.material)} days`} />
                  <Row label="Machining" value={`${show(lead.machining)} days`} />
                  <Row label="QC & dispatch" value={`${show(lead.qc_dispatch)} days`} />
                  <Row label="Total" value={`${show(lead.total)} days`} cls="total" />
                </div>
              </div>
            )}

            {d && activeTab === 'manual' && prev && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card">
                  <div className="aq-card-head"><h3>This quote</h3></div>
                  <div className="aq-card-body">
                    <Row label="Unit price" value={fmtINR(cost.unit_price_inr)} cls="total" />
                    <Row label="Lead time" value={`${show(lead.total)} days`} />
                    <Row label="Quantity" value={qty} />
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Previous manual quote</h3></div>
                  <div className="aq-card-body">
                    {typeof prev === 'object'
                      ? Object.entries(prev).map(([k, v]) => <Row key={k} label={k.replace(/_/g, ' ')} value={/inr/i.test(k) ? fmtINR(v) : show(v)} />)
                      : <p style={{ margin: 0 }}>{show(prev)}</p>}
                  </div>
                </div>
                {d.calibration_note && (
                  <div className="aq-notice" style={{ gridColumn: '1 / -1' }}><MdOutlineInfo style={{ fontSize: '1.2rem', flexShrink: 0 }} /><span>{d.calibration_note}</span></div>
                )}
              </div>
            )}
          </main>
        </div>

        <footer className="aq-footer">
          <div className="aq-footer-left">
            <span style={{ fontSize: '0.8rem', color: 'var(--aq-muted)' }}>Status: <strong>{status || 'NOT SAVED'}</strong></span>
          </div>
          <div className="aq-footer-right">
            <button className="aq-btn aq-btn-secondary" disabled={!d} onClick={() => handleSave(false)}><MdSave /> Save Draft</button>
            <button className="aq-btn aq-btn-primary" disabled={!d} onClick={() => handleSave(true)}><MdCheckCircle /> Finalize Quote</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
