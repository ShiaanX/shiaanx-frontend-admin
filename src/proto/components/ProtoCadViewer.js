import React, { useEffect, useState } from 'react';
import CadViewer from '../../components/enquiry/CadViewer';
import { useProtoData } from '../ProtoDataContext';

// Renders an uploaded STEP/IGES file for real, reusing the admin app's own CadViewer (occt-import-js
// + three.js, both already dependencies). The file is fetched from the server with the logged-in
// account and handed to the viewer as a blob: URL.
export default function ProtoCadViewer({ fileKey }) {
  const { fetchFile } = useProtoData();
  const [file, setFile] = useState(null); // { url, name }
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let url;
    let cancelled = false;
    (async () => {
      const entry = await fetchFile(fileKey);
      if (cancelled) return;
      if (!entry) { setMissing(true); return; }
      url = URL.createObjectURL(entry.blob);
      setFile({ url, name: entry.name });
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [fileKey, fetchFile]);

  if (missing) {
    return <div className="viewer-shell"><div className="empty-hint" style={{ color: '#cfe0ef' }}>The file could not be loaded from the server.</div></div>;
  }
  if (!file) {
    return <div className="viewer-shell"><div className="empty-hint" style={{ color: '#cfe0ef' }}>Loading…</div></div>;
  }
  return (
    <div className="viewer-shell">
      <div className="viewer-chip">CAD//VIEW · {file.name}</div>
      <div style={{ position: 'absolute', inset: 0 }}>
        <CadViewer fileUrl={file.url} fileName={file.name} />
      </div>
    </div>
  );
}
