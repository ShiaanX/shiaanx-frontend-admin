import React, { useState } from 'react';
import Icon from '../icons';

// Mimics the mockup's brief "Downloading…" feedback. No real file sits behind this yet.
export default function DownloadLink({ file }) {
  const [busy, setBusy] = useState(false);
  const click = (e) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => setBusy(false), 700);
  };
  return (
    <a href="#!" className="dl-link" onClick={click}>
      {busy ? 'Downloading…' : <>{file} <Icon name="download" size={13} /></>}
    </a>
  );
}
