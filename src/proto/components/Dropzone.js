import React, { useRef, useState } from 'react';
import Icon from '../icons';

const kb = (f) => `${(f.size / 1024).toFixed(1)} KB`;

// A file field that takes drag-and-drop as well as click-to-browse. Picking a new file (by either
// route) just replaces `file` via onChange — nothing is read or uploaded anywhere until the form
// that owns this field is submitted.
//
// With `multiple`, it holds any number of files instead: `files` is the list, every pick or drop
// adds to it, and each listed file has its own remove ×. onChange gets the whole new list.
export default function Dropzone({ label, accept, file, onChange, multiple, files, hint }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const take = (f) => { if (f) onChange(f); };
  const list = files || [];
  const addMany = (picked) => {
    const add = Array.from(picked || []);
    if (add.length) onChange([...list, ...add]);
  };
  const removeAt = (i) => onChange(list.filter((_, j) => j !== i));

  if (multiple) {
    return (
      <div className="field" data-multi-dropzone={label}>
        <label>{label}</label>
        <div
          className={`dropzone ${over ? 'over' : ''}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); addMany(e.dataTransfer.files); }}
        >
          <Icon name="upload" />
          <div className="dz-sub">{list.length ? 'Drop or click to add more files' : 'Drag files here, or click to browse'}{hint ? ` · ${hint}` : ''}</div>
          <input
            ref={inputRef} type="file" multiple accept={accept} style={{ display: 'none' }}
            onChange={(e) => { addMany(e.target.files); e.target.value = ''; }}
          />
        </div>
        {list.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {list.map((f, i) => (
              <li key={`${f.name}-${i}`} data-file={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <Icon name="doc" size={14} />
                <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-all', fontWeight: 600 }}>{f.name}</span>
                <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{kb(f)}</span>
                <button
                  type="button" aria-label={`Remove ${f.name}`} title="Remove"
                  onClick={() => removeAt(i)}
                  style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

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
              <div className="dz-sub">{kb(file)} · click or drop to replace</div>
            </div>
            <button type="button" className="btn-sm text" onClick={(e) => { e.stopPropagation(); onChange(null); }}>Remove</button>
          </>
        ) : (
          <>
            <Icon name="upload" />
            <div className="dz-sub">Drag a file here, or click to browse</div>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => { take(e.target.files[0]); e.target.value = ''; }} />
      </div>
    </div>
  );
}
