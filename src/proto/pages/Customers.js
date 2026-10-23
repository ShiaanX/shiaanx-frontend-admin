import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import AddCustomerModal from '../components/AddCustomerModal';
import { useProtoData } from '../ProtoDataContext';

export default function Customers() {
  const navigate = useNavigate();
  const { customers, rows, deleteCustomer } = useProtoData();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null); // customer object, or null
  // Grouped by company, so several contacts from the same factory sit together; then by name.
  const byCompany = (a, b) => (a.company || a.name).localeCompare(b.company || b.name, undefined, { sensitivity: 'base' }) || a.name.localeCompare(b.name);

  const remove = (c, enqCount) => {
    const msg = enqCount > 0
      ? `Delete ${c.name}? ${enqCount} enquir${enqCount === 1 ? 'y' : 'ies'} will keep this customer's name, just unlinked from this list.`
      : `Delete ${c.name}?`;
    if (window.confirm(msg)) deleteCustomer(c.name).catch(() => {});
  };

  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate('/proto')}><Icon name="back" /> Back to Enquiries &amp; Orders</button>
      <div className="page-head">
        <div><h1>Customers</h1><div className="page-sub">Every account that can raise an enquiry. Lives under Sales — kept separate from internal Users.</div></div>
        <div className="head-actions"><button type="button" className="btn px-btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" /> Add customer</button></div>
      </div>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Company</th><th>User name</th><th>Contact</th><th>Website</th><th>Enquiries</th><th>Orders</th><th /></tr></thead>
          <tbody>
            {customers.slice().sort(byCompany).map(c => {
              const enq = rows.filter(r => r.customerId === c.id);
              return (
                <tr key={c.id}>
                  <td className="cell-primary">{c.company || '—'}</td>
                  <td>{c.name}</td>
                  <td><div>{c.email || '—'}</div><div className="cell-sub">{c.phone || ''}</div></td>
                  <td>{c.website ? <a href={c.website} target="_blank" rel="noreferrer" className="dl-link">{c.website}</a> : '—'}</td>
                  <td>{enq.length}</td>
                  <td>{enq.filter(r => r.isOrder).length}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-text" onClick={() => setEditing(c)}>Edit</button>
                      <button type="button" className="btn-text" style={{ color: 'var(--error)' }} onClick={() => remove(c, enq.length)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} />}
      {editing && <AddCustomerModal customer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
