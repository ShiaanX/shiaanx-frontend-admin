import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import AddCustomerModal from '../components/AddCustomerModal';
import { useProtoData } from '../ProtoDataContext';

export default function Customers() {
  const navigate = useNavigate();
  const { customers, rows } = useProtoData();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate('/proto')}><Icon name="back" /> Back to Enquiries &amp; Orders</button>
      <div className="page-head">
        <div><h1>Customers</h1><div className="page-sub">Every account that can raise an enquiry. Lives under Sales — kept separate from internal Users.</div></div>
        <div className="head-actions"><button type="button" className="btn px-btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" /> Add customer</button></div>
      </div>
      <div className="tablecard overflow-x">
        <table className="data">
          <thead><tr><th>Customer</th><th>Company</th><th>Contact</th><th>Enquiries</th><th>Orders</th></tr></thead>
          <tbody>
            {customers.map(c => {
              const enq = rows.filter(r => r.customer === c.name);
              return (
                <tr key={c.name}>
                  <td className="cell-primary">{c.name}</td>
                  <td>{c.company || '—'}</td>
                  <td><div>{c.email || '—'}</div><div className="cell-sub">{c.phone || ''}</div></td>
                  <td>{enq.length}</td>
                  <td>{enq.filter(r => r.isOrder).length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
