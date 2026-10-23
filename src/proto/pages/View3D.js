import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../icons';
import ProtoCadViewer from '../components/ProtoCadViewer';
import { useProtoData } from '../ProtoDataContext';

// Full-page 3D view of any stored CAD document (a current or earlier STEP version, a reference
// STEP file, …), opened at /proto/view3d/<fileKey>.
export default function View3D() {
  const { fileKey } = useParams(); // the router hands it over already decoded
  const navigate = useNavigate();
  const { downloadFile } = useProtoData();
  const [file, setFile] = useState(undefined); // undefined = loading, null = missing

  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        <Icon name="back" /> Back
      </button>
      <div className="page-head">
        <div>
          <h1 style={{ wordBreak: 'break-all' }}>{file ? file.name : file === null ? 'File not found' : 'Loading…'}</h1>
          <div className="page-sub">3D view · drag to orbit, scroll to zoom, right-drag to pan</div>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost" disabled={!file} onClick={() => downloadFile(fileKey)}>
            <Icon name="download" size={14} /> Download
          </button>
        </div>
      </div>
      <ProtoCadViewer fileKey={fileKey} tall onFile={setFile} />
    </div>
  );
}
