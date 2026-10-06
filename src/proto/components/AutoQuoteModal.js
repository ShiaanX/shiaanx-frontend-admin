import React, { useState, useMemo } from 'react';
import {
  MdClose, MdSave, MdCheckCircle, MdOutlinePrecisionManufacturing, MdLayers, MdConstruction,
  MdLocalShipping, MdInventory2, MdBarChart, MdCalculate, MdOutlineInfo, MdAutoAwesome,
} from 'react-icons/md';
import '../../components/enquiry/AutoQuoteModal.css';
import { useProtoData } from '../ProtoDataContext';

// Modelled directly on the real cost-breakdown tool already built in this app
// (src/components/enquiry/AutoQuoteModal.js + shiaanx-backend's enquiry_parts.auto_quote_data /
// insta_quote's /process schema) rather than inventing a separate "quote" concept for the preview.
// The only thing swapped out is the data layer: it reads/writes through ProtoDataContext instead of
// enquiryService, and "Generate" fills the same fields with placeholder starting values instead of
// running the real CAD pipeline (no backend here to run it against).
export default function AutoQuoteModal({ row, partIndex, onClose }) {
  const { getAutoQuote, generateAutoQuote, saveAutoQuote } = useProtoData();
  const part = row.parts[partIndex];
  const existing = getAutoQuote(row.id, partIndex);
  const [activeTab, setActiveTab] = useState('summary');
  const [S, setS] = useState(existing ? existing.data : null);
  const [status, setStatus] = useState(existing ? existing.status : null);

  const handleGenerate = () => {
    const data = generateAutoQuote(row.id, partIndex, part);
    setS(data);
    setStatus('DRAFT');
  };

  const handleSave = (finalize = false) => {
    saveAutoQuote(row.id, partIndex, S, finalize);
    setStatus(finalize ? 'FINALIZED' : 'DRAFT');
    if (finalize) onClose();
  };

  const derived = useMemo(() => {
    if (!S) return null;
    const materialCost = S.stockMassKg * S.materialRate;
    const machiningCost = (S.cycleTimeMin * S.quantity * S.machineRate) / 60;
    const setupCost = S.setupCount * S.setupTimePerSetupMin * (S.setupCostPerMin || 25);
    const fixtureCost = S.fixtureCost || 0;
    const totalMachining = machiningCost + setupCost + fixtureCost;
    const inspectionRate = S.inspectionType === 'Manual Inspection' ? (S.inspectionRateManual || 600) : (S.inspectionRateCmm || 1000);
    const inspectionHours = S.inspectionBaseHours + (S.setupCount * S.inspectionPerSetupHours) + (S.featureCount * S.inspectionPerFeatureHours);
    const totalInspection = inspectionHours * inspectionRate;
    const totalFinish = (S.finishes || []).reduce((acc, f) => acc + (parseFloat(f.cost) || 0), 0);
    const totalSecondary = (S.secondaryOps || []).reduce((acc, o) => acc + (parseFloat(o.cost) || 0), 0);
    const totalLogistics = (S.packagingCost || 0) + (S.shippingCost || 0);
    const totalExtras = (S.extraCharges || []).reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    const subTotal = materialCost + totalMachining + totalInspection + totalFinish + totalSecondary + totalLogistics + (S.miscCost || 0) + totalExtras;
    const gstPercent = S.gstPercent || 18;
    const gstAmount = subTotal * (gstPercent / 100);
    const grandTotal = subTotal + gstAmount;
    return { materialCost, totalMachining, inspectionHours, totalInspection, totalFinish, totalSecondary, totalLogistics, totalExtras, subTotal, gstAmount, grandTotal, unitPrice: grandTotal / S.quantity };
  }, [S]);

  const updateS = (key, val) => setS(prev => ({ ...prev, [key]: val }));
  const addArrayItem = (arrayKey, newItem) => setS(prev => ({ ...prev, [arrayKey]: [...(prev[arrayKey] || []), newItem] }));
  const removeArrayItem = (arrayKey, index) => setS(prev => ({ ...prev, [arrayKey]: (prev[arrayKey] || []).filter((_, i) => i !== index) }));
  const updateArrayItem = (arrayKey, index, key, val) => setS(prev => ({ ...prev, [arrayKey]: (prev[arrayKey] || []).map((item, i) => (i === index ? { ...item, [key]: val } : item)) }));

  if (!S) {
    return (
      <div className="aq-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="aq-modal" style={{ height: 'auto', maxWidth: 480 }}>
          <div className="aq-generating">
            <MdAutoAwesome style={{ fontSize: 40, color: 'var(--aq-teal)' }} />
            <h2 className="aq-generating-title">No quote worked out yet</h2>
            <p className="aq-generating-sub">Fill starting values for {part.name}, then adjust every line to the real figures before finalizing.</p>
            <button className="aq-btn aq-btn-primary" style={{ marginTop: 16 }} onClick={handleGenerate}>Fill starting values</button>
            <button className="aq-btn aq-btn-ghost" style={{ marginTop: 10 }} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aq-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="aq-modal">
        <header className="aq-header">
          <div className="aq-header-left">
            <div>
              <p className="aq-header-eyebrow">Auto-Quote / Cost breakdown</p>
              <h1 className="aq-header-title">{part.name}</h1>
              <p className="aq-header-sub">{row.id}{S._source === 'placeholder' && status !== 'FINALIZED' ? ' · starting values, not yet reviewed' : ''}</p>
            </div>
          </div>
          <div className="aq-header-actions">
            <div className={`aq-pipeline-badge ${status === 'FINALIZED' ? 'online' : 'offline'}`}>
              <div className="aq-badge-dot"></div>
              {status === 'FINALIZED' ? 'Finalized' : 'Draft — preview only'}
            </div>
            <button className="aq-btn aq-btn-ghost" onClick={onClose}><MdClose /></button>
          </div>
        </header>

        <div className="aq-body">
          <aside className="aq-sidebar">
            <div className="aq-grand-total-pill">
              <p className="aq-grand-total-label">Grand Total (Inc. GST)</p>
              <div className="aq-grand-total-value">₹ {derived.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="aq-unit-price">Unit Price: ₹ {derived.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <nav className="aq-nav">
              <button className={`aq-nav-item ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}><span><MdCalculate style={{ marginRight: 8 }} /> Summary</span></button>
              <button className={`aq-nav-item ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}><span><MdInventory2 style={{ marginRight: 8 }} /> Materials</span><span className="aq-nav-section-amount">₹{derived.materialCost.toFixed(0)}</span></button>
              <button className={`aq-nav-item ${activeTab === 'machining' ? 'active' : ''}`} onClick={() => setActiveTab('machining')}><span><MdOutlinePrecisionManufacturing style={{ marginRight: 8 }} /> Machining</span><span className="aq-nav-section-amount">₹{derived.totalMachining.toFixed(0)}</span></button>
              <button className={`aq-nav-item ${activeTab === 'inspection' ? 'active' : ''}`} onClick={() => setActiveTab('inspection')}><span><MdConstruction style={{ marginRight: 8 }} /> Inspection</span><span className="aq-nav-section-amount">₹{derived.totalInspection.toFixed(0)}</span></button>
              <button className={`aq-nav-item ${activeTab === 'finishes' ? 'active' : ''}`} onClick={() => setActiveTab('finishes')}><span><MdLayers style={{ marginRight: 8 }} /> Finishes & Ops</span><span className="aq-nav-section-amount">₹{(derived.totalFinish + derived.totalSecondary).toFixed(0)}</span></button>
              <button className={`aq-nav-item ${activeTab === 'logistics' ? 'active' : ''}`} onClick={() => setActiveTab('logistics')}><span><MdLocalShipping style={{ marginRight: 8 }} /> Logistics</span><span className="aq-nav-section-amount">₹{derived.totalLogistics.toFixed(0)}</span></button>
            </nav>
            <div style={{ padding: 20, marginTop: 'auto' }}>
              <div className="aq-notice"><MdOutlineInfo style={{ fontSize: '1.2rem', flexShrink: 0 }} /><span>Adjusting values in fields updates the grand total in real time.</span></div>
            </div>
          </aside>

          <main className="aq-content">
            {activeTab === 'summary' && (
              <div className="aq-card">
                <div className="aq-card-head"><h3>Quote Summary Breakdown</h3><span>Subtotal: ₹ {derived.subTotal.toLocaleString()}</span></div>
                <div className="aq-card-body">
                  <table className="aq-table">
                    <thead><tr><th>Component</th><th>Details</th><th>Amount</th></tr></thead>
                    <tbody>
                      <tr><td>Material</td><td>{S.materialName} @ ₹{S.materialRate}/kg ({S.stockMassKg.toFixed(2)}kg)</td><td className="aq-amount">₹ {derived.materialCost.toLocaleString()}</td></tr>
                      <tr><td>Machining</td><td>{S.cycleTimeMin.toFixed(2)} min/part, {S.setupCount} setup(s)</td><td className="aq-amount">₹ {derived.totalMachining.toLocaleString()}</td></tr>
                      <tr><td>Inspection</td><td>{S.inspectionType} ({derived.inspectionHours.toFixed(2)} hrs)</td><td className="aq-amount">₹ {derived.totalInspection.toLocaleString()}</td></tr>
                      <tr><td>Secondary Ops</td><td>{S.secondaryOps?.length || 0} operations + {S.finishes?.length || 0} finishes</td><td className="aq-amount">₹ {(derived.totalFinish + derived.totalSecondary).toLocaleString()}</td></tr>
                      <tr><td>Logistics</td><td>{S.shippingType} to {S.deliveryCity || 'Destination'}</td><td className="aq-amount">₹ {derived.totalLogistics.toLocaleString()}</td></tr>
                      {derived.totalExtras > 0 && <tr><td>Extra Charges</td><td>{S.extraCharges?.length || 0} manual additions</td><td className="aq-amount">₹ {derived.totalExtras.toLocaleString()}</td></tr>}
                      <tr className="aq-subtotal"><td colSpan="2">Taxable Value</td><td className="aq-amount">₹ {derived.subTotal.toLocaleString()}</td></tr>
                      <tr><td>GST ({S.gstPercent}%)</td><td>Integrated Goods & Services Tax</td><td className="aq-amount">₹ {derived.gstAmount.toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                  <div className="aq-totals-rows" style={{ marginTop: 20 }}>
                    <div className="aq-total-row grand-total"><div className="aq-total-label grand">Final Commercial Offer</div><div className="aq-total-amount grand">₹ {derived.grandTotal.toLocaleString()}</div></div>
                  </div>
                  <div className="aq-field" style={{ marginTop: 20 }}>
                    <label>Quote Notes & Assumptions</label>
                    <textarea value={S.notes} onChange={(e) => updateS('notes', e.target.value)} placeholder="Enter any assumptions, lead time details, or exclusions…" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'materials' && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Material Selection</h3></div>
                  <div className="aq-card-body">
                    <div className="aq-field"><label>Material Name</label><input value={S.materialName} onChange={(e) => updateS('materialName', e.target.value)} /></div>
                    <div className="aq-field"><label>Material Rate (₹ / kg)</label><input type="number" value={S.materialRate} onChange={(e) => updateS('materialRate', parseFloat(e.target.value))} /></div>
                    <div className="aq-field"><label>Quantity</label><input type="number" value={S.quantity} onChange={(e) => updateS('quantity', parseInt(e.target.value, 10))} /></div>
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Physical Properties</h3></div>
                  <div className="aq-card-body">
                    <div className="aq-grid aq-grid-2">
                      <div className="aq-field"><label>Stock Mass (kg)</label><input type="number" value={S.stockMassKg} onChange={(e) => updateS('stockMassKg', parseFloat(e.target.value))} /></div>
                      <div className="aq-field"><label>Part Mass (kg)</label><input type="number" value={S.partMassKg} onChange={(e) => updateS('partMassKg', parseFloat(e.target.value))} /></div>
                      <div className="aq-field"><label>Stock X (mm)</label><input type="number" value={S.stockX} onChange={(e) => updateS('stockX', parseFloat(e.target.value))} /></div>
                      <div className="aq-field"><label>Stock Y (mm)</label><input type="number" value={S.stockY} onChange={(e) => updateS('stockY', parseFloat(e.target.value))} /></div>
                      <div className="aq-field"><label>Stock Z (mm)</label><input type="number" value={S.stockZ} onChange={(e) => updateS('stockZ', parseFloat(e.target.value))} /></div>
                    </div>
                    <div className="aq-formula">
                      <p className="aq-formula-title">Cost Formula</p>
                      <p className="aq-formula-code">cost = stock_mass ({S.stockMassKg}kg) × rate (₹{S.materialRate}) = ₹{derived.materialCost.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'machining' && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Parameters</h3></div>
                  <div className="aq-card-body">
                    <div className="aq-field"><label>Machine Hourly Rate (₹)</label><input type="number" value={S.machineRate} onChange={(e) => updateS('machineRate', parseFloat(e.target.value))} /></div>
                    <div className="aq-field"><label>Cycle Time (min/part)</label><input type="number" step="0.1" value={S.cycleTimeMin} onChange={(e) => updateS('cycleTimeMin', parseFloat(e.target.value))} /></div>
                    <div className="aq-field"><label>Setup Count</label><input type="number" value={S.setupCount} onChange={(e) => updateS('setupCount', parseInt(e.target.value, 10))} /></div>
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Cost Modifiers</h3></div>
                  <div className="aq-card-body">
                    <div className="aq-grid aq-grid-2">
                      <div className="aq-field"><label>Time / Setup (min)</label><input type="number" value={S.setupTimePerSetupMin} onChange={(e) => updateS('setupTimePerSetupMin', parseInt(e.target.value, 10))} /></div>
                      <div className="aq-field"><label>Setup Cost / Min (₹)</label><input type="number" value={S.setupCostPerMin} onChange={(e) => updateS('setupCostPerMin', parseInt(e.target.value, 10))} /></div>
                      <div className="aq-field"><label>Fixture Cost (₹)</label><input type="number" value={S.fixtureCost} onChange={(e) => updateS('fixtureCost', parseInt(e.target.value, 10))} /></div>
                    </div>
                    <div className="aq-notice warn"><MdBarChart style={{ fontSize: '1.2rem' }} /><span>Complexity: {S.featureCount} features, {S.uniqueOperations} operations identified.</span></div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'inspection' && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Inspection Basis</h3></div>
                  <div className="aq-card-body">
                    <div className="aq-field">
                      <label>Inspection Type</label>
                      <select value={S.inspectionType} onChange={(e) => updateS('inspectionType', e.target.value)}>
                        <option value="CMM Inspection">CMM Inspection</option>
                        <option value="Manual Inspection">Manual Inspection</option>
                      </select>
                    </div>
                    {S.inspectionType === 'CMM Inspection' ? (
                      <div className="aq-field"><label>CMM Hourly Rate (₹)</label><input type="number" value={S.inspectionRateCmm} onChange={(e) => updateS('inspectionRateCmm', parseFloat(e.target.value))} /></div>
                    ) : (
                      <div className="aq-field"><label>Manual Rate (₹ / hr)</label><input type="number" value={S.inspectionRateManual} onChange={(e) => updateS('inspectionRateManual', parseFloat(e.target.value))} /></div>
                    )}
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Calculated Effort</h3></div>
                  <div className="aq-card-body">
                    <div className="aq-grid aq-grid-2">
                      <div className="aq-field"><label>Base Hours</label><input type="number" step="0.1" value={S.inspectionBaseHours} onChange={(e) => updateS('inspectionBaseHours', parseFloat(e.target.value))} /></div>
                      <div className="aq-field"><label>Hours / Setup</label><input type="number" step="0.1" value={S.inspectionPerSetupHours} onChange={(e) => updateS('inspectionPerSetupHours', parseFloat(e.target.value))} /></div>
                      <div className="aq-field"><label>Hours / Feature</label><input type="number" step="0.1" value={S.inspectionPerFeatureHours} onChange={(e) => updateS('inspectionPerFeatureHours', parseFloat(e.target.value))} /></div>
                    </div>
                    <div className="aq-formula">
                      <p className="aq-formula-title">Total Inspection: {derived.inspectionHours.toFixed(2)} hrs</p>
                      <p className="aq-formula-code">hours = base ({S.inspectionBaseHours}) + (setups {S.setupCount} × {S.inspectionPerSetupHours}) + (feats {S.featureCount} × {S.inspectionPerFeatureHours})</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'finishes' && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Finishes & Platings</h3><button className="aq-btn aq-btn-ghost aq-btn-sm" onClick={() => addArrayItem('finishes', { type: 'Custom', name: 'New Finish', cost: 0 })}>+ Add</button></div>
                  <div className="aq-card-body">
                    <div className="aq-dyn-list">
                      {(S.finishes || []).map((f, i) => (
                        <div key={i} className="aq-dyn-row">
                          <div className="aq-dyn-row-head"><input value={f.name} onChange={(e) => updateArrayItem('finishes', i, 'name', e.target.value)} style={{ fontWeight: 'bold', border: 'none', background: 'transparent', padding: 0 }} /><button className="aq-btn aq-btn-danger aq-btn-sm" onClick={() => removeArrayItem('finishes', i)}>Delete</button></div>
                          <div className="aq-field"><label>Cost (₹)</label><input type="number" value={f.cost} onChange={(e) => updateArrayItem('finishes', i, 'cost', parseFloat(e.target.value))} /></div>
                        </div>
                      ))}
                      {(S.finishes || []).length === 0 && <p className="aq-empty">No finishes added.</p>}
                    </div>
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Secondary Operations</h3><button className="aq-btn aq-btn-ghost aq-btn-sm" onClick={() => addArrayItem('secondaryOps', { type: 'Other', name: 'New Operation', cost: 0 })}>+ Add</button></div>
                  <div className="aq-card-body">
                    <div className="aq-dyn-list">
                      {(S.secondaryOps || []).map((o, i) => (
                        <div key={i} className="aq-dyn-row">
                          <div className="aq-dyn-row-head"><input value={o.name} onChange={(e) => updateArrayItem('secondaryOps', i, 'name', e.target.value)} style={{ fontWeight: 'bold', border: 'none', background: 'transparent', padding: 0 }} /><button className="aq-btn aq-btn-danger aq-btn-sm" onClick={() => removeArrayItem('secondaryOps', i)}>Delete</button></div>
                          <div className="aq-field"><label>Cost (₹)</label><input type="number" value={o.cost} onChange={(e) => updateArrayItem('secondaryOps', i, 'cost', parseFloat(e.target.value))} /></div>
                        </div>
                      ))}
                      {(S.secondaryOps || []).length === 0 && <p className="aq-empty">No secondary operations.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logistics' && (
              <div className="aq-grid aq-grid-2">
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Logistics Parameters</h3></div>
                  <div className="aq-card-body">
                    <div className="aq-field"><label>Packaging Type</label><input value={S.packagingType} onChange={(e) => updateS('packagingType', e.target.value)} /></div>
                    <div className="aq-field"><label>Packaging Cost (₹)</label><input type="number" value={S.packagingCost} onChange={(e) => updateS('packagingCost', parseFloat(e.target.value))} /></div>
                    <div className="aq-field"><label>Shipping Mode</label><input value={S.shippingType} onChange={(e) => updateS('shippingType', e.target.value)} /></div>
                    <div className="aq-field"><label>Shipping Cost (₹)</label><input type="number" value={S.shippingCost} onChange={(e) => updateS('shippingCost', parseFloat(e.target.value))} /></div>
                    <div className="aq-field"><label>Delivery City / Destination</label><input value={S.deliveryCity} onChange={(e) => updateS('deliveryCity', e.target.value)} /></div>
                  </div>
                </div>
                <div className="aq-card">
                  <div className="aq-card-head"><h3>Extra Charges & GST</h3><button className="aq-btn aq-btn-ghost aq-btn-sm" onClick={() => addArrayItem('extraCharges', { name: 'New Charge', amount: 0 })}>+ Add</button></div>
                  <div className="aq-card-body">
                    <div className="aq-field"><label>Documentation / Misc Handling (₹)</label><input type="number" value={S.miscCost} onChange={(e) => updateS('miscCost', parseFloat(e.target.value))} /></div>
                    <div className="aq-field"><label>GST / Tax Percent (%)</label><input type="number" value={S.gstPercent} onChange={(e) => updateS('gstPercent', parseFloat(e.target.value))} /></div>
                    <div className="aq-dyn-list" style={{ marginTop: 10 }}>
                      <p className="aq-formula-title" style={{ margin: '10px 0 5px' }}>Manual Surcharges</p>
                      {(S.extraCharges || []).map((e, i) => (
                        <div key={i} className="aq-dyn-row">
                          <div className="aq-dyn-row-head"><input value={e.name} onChange={(eVal) => updateArrayItem('extraCharges', i, 'name', eVal.target.value)} style={{ fontSize: '0.8rem', border: 'none', background: 'transparent', padding: 0 }} /><button className="aq-btn aq-btn-danger aq-btn-sm" onClick={() => removeArrayItem('extraCharges', i)}>Del</button></div>
                          <input type="number" value={e.amount} onChange={(eVal) => updateArrayItem('extraCharges', i, 'amount', parseFloat(eVal.target.value))} style={{ fontSize: '0.8rem' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="aq-footer">
          <div className="aq-footer-left">
            <span style={{ fontSize: '0.8rem', color: 'var(--aq-muted)' }}>
              Status: <strong style={{ color: status === 'FINALIZED' ? 'var(--aq-teal)' : 'var(--aq-amber)' }}>{status || 'DRAFT'}</strong>
            </span>
          </div>
          <div className="aq-footer-right">
            <button className="aq-btn aq-btn-secondary" onClick={() => handleSave(false)}><MdSave /> Save Draft</button>
            <button className="aq-btn aq-btn-primary" onClick={() => handleSave(true)}><MdCheckCircle /> Finalize Quote</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
