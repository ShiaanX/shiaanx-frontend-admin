import React from 'react';

// The processes a part needs (CNC milling, turning, …) as small chips. Nothing when none are set.
export default function ProcessChips({ processes, style }) {
  if (!processes || processes.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', ...style }} data-process-chips>
      {processes.map(name => <span key={name} className="tag inhouse">{name}</span>)}
    </div>
  );
}

// The "Not ordered" marker for a part left out when the enquiry was converted.
export function NotOrderedBadge({ part }) {
  if (!part || part.ordered !== false) return null;
  return <span className="badge b-neutral" data-not-ordered>Not ordered</span>;
}

export const isOrdered = (p) => p.ordered !== false;
