import React, { useEffect, useState } from 'react';
import CadViewer from '../../components/enquiry/CadViewer';
import { fileGet } from '../db';

// Renders an uploaded STEP/IGES file for real, reusing the admin app's own CadViewer (occt-import-js
// + three.js, both already dependencies) instead of a placeholder — the file never leaves this
// browser; it's read straight out of IndexedDB and handed to the viewer as a blob: URL.
export default function ProtoCadViewer({ fileKey }) {
  const [file, setFile] = useState(null); // { url, name }
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let url;
    let cancelled = false;
    (async () => {
      const entry = await fileGet(fileKey);
      if (cancelled) return;
      if (!entry) { setMissing(true); return; }
      url = URL.createObjectURL(entry.blob);
      setFile({ url, name: entry.name });
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [fileKey]);

  if (missing) {
    return <div className="viewer-shell"><div className="empty-hint" style={{ color: '#cfe0ef' }}>Uploaded file not found in this browser's storage.</div></div>;
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
