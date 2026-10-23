import React, { useEffect, useRef, useState } from 'react';
import CadViewer3D from './CadViewer3D';
import { useProtoData } from '../ProtoDataContext';

// Renders an uploaded STEP/IGES file with the admin flow's 3D viewer (views, display modes,
// bounding box, measure). The file is fetched from the server with the logged-in account and
// handed to the viewer as a blob: URL. `tall` makes it fill most of the window (the View 3D page);
// `onFile` receives { name } once the file has arrived.
export default function ProtoCadViewer({ fileKey, tall = false, onFile }) {
  const { fetchFile } = useProtoData();
  const [file, setFile] = useState(null); // { url, name }
  const [missing, setMissing] = useState(false);
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  useEffect(() => {
    let url;
    let cancelled = false;
    setFile(null);
    setMissing(false);
    (async () => {
      const entry = await fetchFile(fileKey);
      if (cancelled) return;
      if (!entry) { setMissing(true); if (onFileRef.current) onFileRef.current(null); return; }
      url = URL.createObjectURL(entry.blob);
      setFile({ url, name: entry.name });
      if (onFileRef.current) onFileRef.current({ name: entry.name });
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [fileKey, fetchFile]);

  const cls = `viewer-shell cad3d${tall ? ' tall' : ''}`;
  if (missing) {
    return <div className={cls}><div className="cad3d-overlay err">The file could not be loaded from the server.</div></div>;
  }
  if (!file) {
    return <div className={cls}><div className="cad3d-overlay">Loading…</div></div>;
  }
  return (
    <div className={cls}>
      <CadViewer3D fileUrl={file.url} fileName={file.name} label={`CAD//VIEW · ${file.name}`} />
    </div>
  );
}
