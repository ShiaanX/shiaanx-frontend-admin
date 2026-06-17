import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShoppingBag, FiPackage, FiFileText, FiClock, FiEdit2, FiUploadCloud, FiCheckCircle, FiLoader } from 'react-icons/fi';
import orderService from '../services/orderService';
import OrderEditModal from '../components/order/OrderEditModal';
import toast from 'react-hot-toast';
import '../styles/ViewDetails.css';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function FileUploadZone({ label, accentColor, bgColor, borderColor, onUpload, uploading, existingFiles, onDownload, onView }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    if (files && files.length > 0) onUpload(Array.from(files));
  };

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: '16px', overflow: 'hidden', background: bgColor }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', background: accentColor, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <FiUploadCloud size={20} color="white" />
        <span style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>{label}</span>
      </div>

      {/* Existing files */}
      {existingFiles && existingFiles.length > 0 && (
        <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: `1px solid ${borderColor}` }}>
          {existingFiles.map((doc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', borderRadius: '8px', padding: '0.6rem 0.9rem', border: `1px solid ${borderColor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden', marginRight: '0.5rem' }}>
                <FiCheckCircle size={16} color={accentColor} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.file_name}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => onView(doc.file_path)}
                  style={{ fontSize: '0.75rem', fontWeight: 700, color: accentColor, padding: '0.3rem 0.75rem', borderRadius: '6px', border: `1px solid ${accentColor}`, backgroundColor: 'white', whiteSpace: 'nowrap', cursor: 'pointer', outline: 'none' }}
                >
                  View
                </button>
                <a
                  href="#download"
                  onClick={(e) => { e.preventDefault(); onDownload(doc.file_path, doc.file_name); }}
                  style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', backgroundColor: accentColor, textDecoration: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', border: `1px solid ${accentColor}`, whiteSpace: 'nowrap' }}
                >
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragging ? `${bgColor}` : 'transparent',
          transition: 'background 0.2s ease',
          opacity: uploading ? 0.7 : 1
        }}
      >
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: accentColor }}>
            <FiLoader size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Uploading...</span>
          </div>
        ) : (
          <>
            <FiUploadCloud size={28} color={accentColor} style={{ marginBottom: '0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
              {dragging ? 'Drop files here' : 'Click or drag & drop to upload'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ViewDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingCam, setUploadingCam] = useState(false);
  const [uploadingQc, setUploadingQc] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchOrder = async () => {
    try {
      const data = await orderService.getDetails(id);
      setOrder(data);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch order details');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handleCamUpload = async (files) => {
    setUploadingCam(true);
    try {
      await orderService.uploadCamFile(id, files);
      toast.success('CAM file(s) uploaded successfully');
      await fetchOrder();
    } catch (err) {
      toast.error(err.message || 'CAM file upload failed');
    } finally {
      setUploadingCam(false);
    }
  };

  const handleQcUpload = async (files) => {
    setUploadingQc(true);
    try {
      await orderService.uploadQcReport(id, files);
      toast.success('QC report(s) uploaded successfully');
      await fetchOrder();
    } catch (err) {
      toast.error(err.message || 'QC report upload failed');
    } finally {
      setUploadingQc(false);
    }
  };
  
  const handleEditSubmit = async (data) => {
    try {
      await orderService.update(id, data);
      toast.success('Order updated successfully');
      setIsEditModalOpen(false);
      await fetchOrder();
    } catch (err) {
      toast.error(err.message || 'Failed to update order');
    }
  };

  const handleDownload = async (filePath, fileName) => {
    try {
      const url = filePath.startsWith('http') ? filePath : `${BASE_URL}/${filePath}`;
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || filePath.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      window.open(filePath.startsWith('http') ? filePath : `${BASE_URL}/${filePath}`, '_blank');
    }
  };

  const handleView = (filePath) => {
    const url = filePath.startsWith('http') ? filePath : `${BASE_URL}/${filePath}`;
    window.open(url, '_blank');
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading order details...</div>;
  if (!order) return <div style={{ padding: '2rem' }}>Order not found</div>;

  const camFiles = order.enquiry?.documents?.filter(d => d.document_type === 'CAM_FILE') || [];
  const qcFiles = order.enquiry?.documents?.filter(d => d.document_type === 'QC_REPORT') || [];
  const enquiryDocs = order.enquiry?.documents?.filter(d => !['CAM_FILE', 'QC_REPORT', 'ORDER_DOCUMENT'].includes(d.document_type)) || [];

  return (
    <div className="view-details-content" style={{ padding: '2rem' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <FiArrowLeft size={24} />
        </button>
        <div className="details-header" style={{ border: 'none', marginBottom: 0, paddingBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <h2>Order Details</h2>
          {order.status === 'PROCESSING' && (
            <button
              className="btn-secondary"
              onClick={() => setIsEditModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }}
            >
              <FiEdit2 size={18} /> Edit Order
            </button>
          )}
        </div>
      </div>

      <div className="order-id-display">
        <FiShoppingBag size={20} color="var(--primary)" />
        <span style={{ fontWeight: 800 }}>{order.order_number}</span>
      </div>

      <div className="details-layout">
        {/* Left Column */}
        <div className="left-column">
          <div className="detail-section">
            <h3 className="section-title"><FiShoppingBag size={20} /> Order Items</h3>
            <div className="order-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <div key={item.id} className="part-card">
                    <div className="part-header">
                      <div className="part-title-wrapper">
                        <span className="part-index">{idx + 1}</span>
                        <h4 className="part-name">{item.item_name || 'Custom Part'}</h4>
                      </div>
                      <div className="part-quantity"><FiPackage size={14} /> Qty: {item.quantity}</div>
                    </div>
                    <div className="part-specs">
                      {['technologies', 'materials', 'finishes'].map(key => (
                        <div key={key} className="spec-group">
                          <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                          <div className="spec-chips">
                            {item[key]?.length > 0
                              ? item[key].map((t, i) => <span key={i} className="chip">{t.name}</span>)
                              : <span className="chip" style={{ opacity: 0.6 }}>Not specified</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {item.total_price && (
                      <div className="part-footer">
                        <div className="part-unit-price">Unit Price: ₹{item.unit_price || 0}</div>
                        <div className="part-total-price">Total: ₹{item.total_price}</div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="part-card">
                  <div className="part-header">
                    <div className="part-title-wrapper">
                      <span className="part-index">1</span>
                      <h4 className="part-name">Single Custom Part</h4>
                    </div>
                    <div className="part-quantity"><FiPackage size={14} /> Qty: {order.quantity || 1}</div>
                  </div>
                  <div className="part-specs">
                    <div className="spec-group"><label>Technology</label><div className="spec-chips"><span className="chip">{order.technology?.name || order.processing_technology || 'Not specified'}</span></div></div>
                    <div className="spec-group"><label>Material</label><div className="spec-chips"><span className="chip">{order.materialRef?.name || order.material || 'Not specified'}</span></div></div>
                    <div className="spec-group"><label>Finish</label><div className="spec-chips"><span className="chip">{order.finishRef?.name || order.finishes || 'Not specified'}</span></div></div>
                  </div>
                </div>
              )}
            </div>

            <div className="data-grid" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid var(--background)' }}>
              <div className="data-item">
                <label>Tracking ID</label>
                <span style={{ color: 'var(--primary)' }}>{order.tracking_number || 'Awaiting Logistics'}</span>
              </div>
              <div className="data-item">
                <label>Expected Arrival</label>
                <span>{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'To be determined'}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3 className="section-title"><FiPackage size={20} /> Client Information</h3>
            <div className="data-grid">
              <div className="data-item"><label>Customer Name</label><span>{order.customer?.company_name ? `${order.customer.company_name} - ${order.customer?.name}` : order.customer?.name}</span></div>
              <div className="data-item"><label>Inquiry Origin</label><span>{order.enquiry?.enquiry_number || 'Direct Order'}</span></div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="right-column">
          <div className="amount-card">
            <div className="amount-label">Final Investment</div>
            <div className="amount-value">₹{order.final_amount}</div>
          </div>

          {/* CAM File Upload */}
          <div className="detail-section" style={{ padding: '0', overflow: 'hidden' }}>
            <FileUploadZone
              label="CAM Files"
              accentColor="#2563eb"
              bgColor="#eff6ff"
              borderColor="#bfdbfe"
              onUpload={handleCamUpload}
              uploading={uploadingCam}
              existingFiles={camFiles}
              onDownload={handleDownload}
              onView={handleView}
            />
          </div>

          {/* QC Report Upload */}
          <div className="detail-section" style={{ padding: '0', overflow: 'hidden' }}>
            <FileUploadZone
              label="QC Reports"
              accentColor="#059669"
              bgColor="#f0fdf4"
              borderColor="#bbf7d0"
              onUpload={handleQcUpload}
              uploading={uploadingQc}
              existingFiles={qcFiles}
              onDownload={handleDownload}
              onView={handleView}
            />
          </div>

          {/* Enquiry Documents */}
          <div className="detail-section">
            <h3 className="section-title"><FiFileText size={20} /> Enquiry Documents</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {enquiryDocs.length > 0 ? (
                enquiryDocs.map((doc, index) => (
                  <div key={index} style={{ padding: '0.75rem 1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', marginRight: '0.5rem' }}>
                      <div style={{ padding: '0.5rem', backgroundColor: 'var(--background)', borderRadius: '6px', color: 'var(--primary)', flexShrink: 0 }}>
                        <FiFileText size={18} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.file_name}</div>
                        {doc.uploader && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>by {doc.uploader.name}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button 
                        onClick={() => handleView(doc.file_path)} 
                        style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--primary)', backgroundColor: 'white', whiteSpace: 'nowrap', cursor: 'pointer', outline: 'none' }}
                      >
                        View
                      </button>
                      <a 
                        href="#download" 
                        onClick={(e) => { e.preventDefault(); handleDownload(doc.file_path, doc.file_name); }} 
                        style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', backgroundColor: 'var(--primary)', textDecoration: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--primary)', whiteSpace: 'nowrap' }}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '1.5rem', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px dotted var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No enquiry documents found.</div>
              )}
            </div>
          </div>

          <button className="btn-confirm" style={{ width: '100%', padding: '1.25rem', fontSize: '1.125rem' }} onClick={() => navigate(`/orders/${id}/track`)}>
            Open Live Timeline
          </button>
        </div>
      </div>

      {/* Status History */}
      <div className="status-history-section">
        <h3 className="section-title" style={{ border: 'none' }}><FiClock size={20} /> Status History</h3>
        <div className="history-timeline">
          {order.statusHistory && order.statusHistory.length > 0 ? (
            [...order.statusHistory]
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((history, index) => (
                <div key={history.id} className={`history-item ${index === 0 ? 'active' : ''}`}>
                  <div className="history-dot"></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: index === 0 ? 'var(--primary)' : 'var(--text-main)' }}>{history.to_status.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{new Date(history.createdAt).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{history.change_reason || 'Manual status transition'}</p>
                    {history.changer && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginTop: '0.5rem' }}>Verified by {history.changer.name}</span>}
                  </div>
                </div>
              ))
          ) : (
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--background)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Initial processing started on {new Date(order.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <OrderEditModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        orderData={order}
      />
    </div>
  );
}

export default ViewDetails;
