import React from 'react';

// Each item: { n, l, cls } — cls is 'ok' | 'warn' | 'err' | undefined, matching .kpi.ok/.warn/.err in proto.css.
export default function KpiStrip({ items, style }) {
  return (
    <div className="kpi-strip" style={style}>
      {items.map((it, i) => (
        <div key={i} className={`kpi ${it.cls || ''}`}>
          <div className="n">{it.n}</div>
          <div className="l">{it.l}</div>
        </div>
      ))}
    </div>
  );
}
