import React from 'react';
import { useNavigate } from 'react-router-dom';

// "Repeat of <original>" on a repeat, "Repeated as <id>, <id>" on the job it repeats. Each links to
// that job's page (the enquiry address follows on to the order when it has become one).
export default function RepeatLinks({ row }) {
  const navigate = useNavigate();
  const repeats = row.repeats || [];
  if (!row.repeatOf && repeats.length === 0) return null;
  const link = (j) => (
    <button key={j.uuid} type="button" className="btn-text mono" onClick={() => navigate(`/proto/enquiries/${j.uuid}`)}>{j.id}</button>
  );
  return (
    <div className="page-sub" style={{ marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }} data-repeat-links>
      {row.repeatOf && <span data-repeat-of>Repeat of {link(row.repeatOf)}</span>}
      {repeats.length > 0 && (
        <span data-repeated-as>Repeated as {repeats.map((j, i) => <React.Fragment key={j.uuid}>{i > 0 && ', '}{link(j)}</React.Fragment>)}</span>
      )}
    </div>
  );
}
