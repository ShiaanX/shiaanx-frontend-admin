import React, { useRef, useState } from 'react';
import Icon from '../icons';

// A file field that takes drag-and-drop as well as click-to-browse. Picking a new file (by either
// route) just replaces `file` via onChange — nothing is read or uploaded anywhere until the form
// that owns this field is submitted.
export default function Dropzone({ label, accept, file, onChange }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const take = (f) => { if (f) onChange(f); };

  return (
    <div className="field">
      <label>{label}</label>
      <div
        className={`dropzone ${over ? 'over' : ''} ${file ? 'has-file' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
      >
        {file ? (
          <>
            <Icon name="doc" />
            <div className="dz-file">
              <div className="dz-name">{file.name}</div>
              <div className="dz-sub">{(file.size / 1024).toFixed(1)} KB · click or drop to replace</div>
            </div>
            <button type="button" className="btn-sm text" onClick={(e) => { e.stopPropagation(); onChange(null); }}>Remove</button>
          </>
        ) : (
          <>
            <Icon name="upload" />
            <div className="dz-sub">Drag a file here, or click to browse</div>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => take(e.target.files[0])} />
      </div>
    </div>
  );
}
