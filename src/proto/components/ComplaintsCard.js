import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import ComplaintModal, { KindBadge, ComplaintStatusBadge, ResolveModal } from './ComplaintModal';
import { isStepFile, view3dPath } from './docLinks';
import { useProtoData } from '../ProtoDataContext';
import { fmtDate } from '../utils';

const day = (s) => (s ? fmtDate(String(s).slice(0, 10)) : '—');

// Complaints, rejections and feedback the customer sent about this job, newest first, each with what
// it named (parts, quantity), its attachments and — once closed — how it was resolved. The same
// records feed the all-jobs Complaints & Feedback page.
export default function ComplaintsCard({ row }) {
  const navigate = useNavigate();
  const { addComplaint, updateComplaint, addComplaintAttachments, removeComplaint, openFile, downloadFile } = useProtoData();
  const [editing, setEditing] = useState(null); // 'new' | complaint
  const [resolving, setResolving] = useState(null);
  const list = [...(row.complaints || [])].sort((a, b) => String(b.receivedOn || '').localeCompare(String(a.receivedOn || '')));
  const partName = (id) => { const p = row.parts.find(x => x.uuid === id); return p ? p.name : 'Removed part'; };

  const save = async (data, files) => {
    if (editing === 'new') { await addComplaint(row, data, files); return; }
    await updateComplaint(editing.id, data);
    if (files.length) await addComplaintAttachments(editing.id, files);
  };
  const reopen = (c) => updateComplaint(c.id, { status: 'OPEN' }).catch(() => {});
  const remove = (c) => {
    if (!window.confirm(`Delete this ${c.kind.toLowerCase()} received ${day(c.receivedOn)}? It is removed from this job and from Complaints & Feedback.`)) return;
    removeComplaint(c.id).catch(() => {});
  };

  return (
    <div className="card" data-complaints-card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}><Icon name="quality" /> Complaints &amp; feedback</h2>
        <button type="button" className="btn-sm primary" onClick={() => setEditing('new')} data-complaint-add><Icon name="plus" size={13} /> Add</button>
      </div>
      {list.length === 0 && <div className="cell-sub" style={{ marginTop: 12 }}>Nothing recorded. Add a complaint, rejection or feedback when the customer sends one.</div>}
      {list.map(c => (
        <div key={c.id} className="part-row" style={{ marginTop: 12 }} data-complaint={c.id}>
          <div className="part-row-head" style={{ marginBottom: 6 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <KindBadge kind={c.kind} /><span className="cell-sub" style={{ margin: 0 }}>Received {day(c.receivedOn)}</span>
            </span>
            <ComplaintStatusBadge status={c.status} />
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }} data-complaint-desc>{c.description}</div>
          {((c.partIds || []).length > 0 || c.qtyAffected != null) && (
            <div className="mini-grid" style={{ marginTop: 10 }}>
              {(c.partIds || []).length > 0 && <div><span className="ml">Parts</span><span className="mv">{c.partIds.map(partName).join(', ')}</span></div>}
              {c.qtyAffected != null && <div><span className="ml">Qty affected</span><span className="mv">{c.qtyAffected}</span></div>}
            </div>
          )}
          {(c.attachments || []).map(a => (
            <div key={a.fileKey} className="doc-row" style={{ padding: '8px 0' }} data-complaint-attachment>
              <div className="doc-icon"><Icon name="doc" /></div>
              <div><div className="doc-name">{a.name}</div><div className="doc-sub">Attachment</div></div>
              <div className="doc-actions">
                {isStepFile(a.name)
                  ? <button type="button" className="btn-text" onClick={() => navigate(view3dPath(a.fileKey))}>View 3D</button>
                  : <button type="button" className="btn-text" onClick={() => openFile(a.fileKey)}>View</button>}
                <button type="button" className="btn-text" onClick={() => downloadFile(a.fileKey)}>Download</button>
              </div>
            </div>
          ))}
          {c.status === 'RESOLVED' && (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 9, background: 'var(--shell-bg)', fontSize: 13 }} data-complaint-resolution>
              <div className="cell-sub" style={{ marginTop: 0 }}>Resolved {day(c.resolvedOn)}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.resolution || '—'}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {c.createdByName && <span className="cell-sub" style={{ margin: '0 auto 0 0' }}>Recorded by {c.createdByName}</span>}
            <button type="button" className="btn-sm text" onClick={() => setEditing(c)} data-complaint-edit>Edit</button>
            {c.status === 'RESOLVED'
              ? <button type="button" className="btn-sm text" onClick={() => reopen(c)} data-complaint-reopen>Reopen</button>
              : <button type="button" className="btn-sm ghost" onClick={() => setResolving(c)} data-complaint-resolve>Mark resolved</button>}
            <button type="button" className="btn-sm text" onClick={() => remove(c)} data-complaint-delete>Delete</button>
          </div>
        </div>
      ))}
      {editing && <ComplaintModal row={row} complaint={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />}
      {resolving && <ResolveModal complaint={resolving} onSave={(patch) => updateComplaint(resolving.id, patch)} onClose={() => setResolving(null)} />}
    </div>
  );
}
