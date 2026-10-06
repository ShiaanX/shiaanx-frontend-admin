import React, { useState } from 'react';
import Icon from '../icons';
import { useProtoData } from '../ProtoDataContext';

// With a fileKey (a real upload stored in this browser's IndexedDB), opens that exact file.
// Without one (sample-data rows have no real file behind them), mimics the mockup's brief
// "Downloading…" feedback — there is nothing real to open.
export default function DownloadLink({ file, fileKey }) {
  const { openFile } = useProtoData();
  const [busy, setBusy] = useState(false);
  const click = async (e) => {
    e.preventDefault();
    if (fileKey) { openFile(fileKey); return; }
    setBusy(true);
    setTimeout(() => setBusy(false), 700);
  };
  return (
    <a href="#!" className="dl-link" onClick={click}>
      {busy ? 'Downloading…' : <>{file} <Icon name="download" size={13} /></>}
    </a>
  );
}
