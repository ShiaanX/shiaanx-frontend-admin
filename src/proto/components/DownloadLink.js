import React, { useState } from 'react';
import Icon from '../icons';
import { useProtoData } from '../ProtoDataContext';

// With a fileKey (a real upload stored in this browser's IndexedDB), downloads that exact file to
// disk. Without one (sample-data rows have no real file behind them), mimics the mockup's brief
// "Downloading…" feedback — there is nothing real to download.
export default function DownloadLink({ file, fileKey }) {
  const { downloadFile } = useProtoData();
  const [busy, setBusy] = useState(false);
  const click = async (e) => {
    e.preventDefault();
    if (fileKey) { downloadFile(fileKey); return; }
    setBusy(true);
    setTimeout(() => setBusy(false), 700);
  };
  return (
    <a href="#!" className="dl-link" onClick={click}>
      {busy ? 'Downloading…' : <>{file} <Icon name="download" size={13} /></>}
    </a>
  );
}
