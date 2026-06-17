import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiClock, FiCheckCircle, FiEdit2, FiTruck, FiFileText, FiUpload, FiX, FiDownload, FiLoader, FiEye } from 'react-icons/fi';
import orderService from '../services/orderService';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import '../styles/TrackOrder.css';

function TrackOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [timelineNote, setTimelineNote] = useState('');
  const [BASE_URL] = useState(process.env.REACT_APP_API_URL || 'http://localhost:8000');

  const fetchOrderDetails = async () => {
    try {
      const data = await orderService.getDetails(id);
      setOrder(data);
      setNewStatus(data.status);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch order details');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id, navigate]);

  const handleUpdateStatus = async () => {
    try {
      const reason = statusReason || 'Status updated by admin';
      await orderService.updateStatus(id, newStatus, reason);
      toast.success('Order status updated');
      setIsEditingStatus(false);
      setIsModalOpen(false);
      setStatusReason('');
      fetchOrderDetails();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
      setIsModalOpen(false);
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

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const submitDocuments = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      await orderService.uploadDocuments(id, selectedFiles, timelineNote);
      toast.success('Documents and note posted successfully');
      setSelectedFiles([]);
      setTimelineNote('');
      fetchOrderDetails();
    } catch (err) {
      toast.error(err.message || 'Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePostTimelineUpdate = async () => {
    const hasFiles = selectedFiles.length > 0;
    const hasNote = timelineNote.trim() !== '';

    if (hasFiles) {
      await submitDocuments();
    } else if (hasNote) {
      // Logic for note only: call updateStatus with current status to log the note
      setIsUploading(true);
      try {
        await orderService.updateStatus(id, order.status, timelineNote);
        toast.success('Note posted to timeline');
        setTimelineNote('');
        fetchOrderDetails();
      } catch (err) {
        toast.error(err.message || 'Failed to post note');
      } finally {
        setIsUploading(false);
      }
    } else {
      toast.error('Please add a note or select a file to post an update.');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading timeline...</div>;
  if (!order) return <div style={{ padding: '2rem' }}>Order not found</div>;

  // Define valid transitions (allow backwards matching backend)
  const allStatuses = ['PROCESSING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
  const availableNextStatuses = allStatuses.filter(s => s !== order.status);

  // Combine status history and documents into events
  const events = [
    ...(order.statusHistory || []).map(h => ({ ...h, type: 'STATUS', date: new Date(h.createdAt) })),
    ...(order.enquiry?.documents || []).map(d => ({ ...d, type: 'DOCUMENT', date: new Date(d.createdAt) }))
  ].sort((a, b) => b.date - a.date);
  return (
    <div className="track-order-content" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <FiArrowLeft size={24} />
        </button>
        <h2 className="page-title" style={{ margin: 0 }}>Order Timeline</h2>
      </div>

      <div className="item-id-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div>
            <span className="item-label">Order Number</span>
            <div className="item-value" style={{ marginTop: '0.25rem' }}>{order.order_number}</div>
          </div>
          <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)' }}></div>
          <div>
            <span className="item-label">Customer</span>
            <div className="item-value" style={{ marginTop: '0.25rem' }}>{order.customer?.name}</div>
          </div>
        </div>
      </div>

      <div className="split-box" style={{ display: 'flex', marginTop: '2.5rem' }}>
        <div className="split-left" style={{ flex: '1.2' }}>
          <h3>Order Journey</h3>
          <div className="timeline-container">
              {events.length > 0 ? (
                  events.map((event, index) => (
                      <div key={event.id} className="timeline-item" style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
                          {index !== events.length - 1 && (
                              <div style={{ position: 'absolute', left: '11px', top: '24px', bottom: '-24px', width: '2px', background: 'var(--border)' }}></div>
                          )}
                          <div className="timeline-marker" style={{ 
                              width: '24px', 
                              height: '24px', 
                              borderRadius: '50%', 
                              backgroundColor: event.type === 'STATUS' ? 'var(--primary)' : '#10b981', 
                              border: `6px solid ${event.type === 'STATUS' ? 'var(--primary-light)' : '#d1fae5'}`, 
                              zIndex: 1, 
                              marginTop: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                          }}>
                          </div>
                          <div className="timeline-content" style={{ flex: 1, paddingBottom: '2.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {event.type === 'STATUS' ? <FiClock size={14} color="var(--primary)" /> : <FiFileText size={14} color="#059669" />}
                                      <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                                          {event.type === 'STATUS' ? event.to_status.replace(/_/g, ' ') : `Document: ${event.file_name}`}
                                      </span>
                                  </div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                      {event.date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                              </div>
                              
                              {event.type === 'STATUS' ? (
                                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{event.change_reason || 'Status updated by system'}</p>
                              ) : (
                                  <div style={{ marginTop: '0.75rem' }}>
                                      {event.remarks && (
                                          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--background)', padding: '0.5rem 0.75rem', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                                              "{event.remarks}"
                                          </p>
                                      )}
                                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                          <button 
                                              onClick={() => handleView(event.file_path)}
                                              style={{ padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', border: '1px solid #166534', background: 'white', color: '#166534', fontWeight: 700, borderRadius: '8px', outline: 'none' }}
                                          >
                                              <FiEye size={14} /> View
                                          </button>
                                          <button 
                                              className="blue-box" 
                                              onClick={() => handleDownload(event.file_path, event.file_name)}
                                              style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', border: 'none', background: '#f0fdf4', color: '#166534', fontWeight: 700, borderRadius: '8px' }}
                                          >
                                              <FiDownload size={14} /> Download ({(event.file_size_kb / 1024).toFixed(2)} MB)
                                          </button>
                                      </div>
                                  </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
                                      {(event.changer?.name || event.uploader?.name || 'S').charAt(0)}
                                  </div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{event.changer?.name || event.uploader?.name || 'System'}</span>
                              </div>
                          </div>
                      </div>
                  ))
              ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                      <FiClock size={20} color="var(--primary)" />
                      <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>No project updates recorded yet.</span>
                  </div>
              )}
          </div>
        </div>
        
        <div className="split-right" style={{ flex: '0.8' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Card 1: Status Control */}
              <div className="status-control" style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiTruck size={18} color="var(--primary)" /> Status Management
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '12px', textAlign: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Actual Status</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{order.status.replace(/_/g, ' ')}</div>
                      </div>

                      <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Update to New Status</label>
                          <select 
                              value={newStatus} 
                              onChange={(e) => setNewStatus(e.target.value)}
                              style={{ width: '100%', borderRadius: '12px', padding: '0.75rem', border: '1px solid var(--border)', fontSize: '0.9rem', fontWeight: 600 }}
                          >
                              <option value={order.status}>No Change</option>
                              {availableNextStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                      </div>

                      {newStatus !== order.status && (
                          <div>
                              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Reason for Change (Optional)</label>
                              <textarea 
                                  value={statusReason}
                                  onChange={(e) => setStatusReason(e.target.value)}
                                  placeholder="Why is this status being updated?..."
                                  style={{ width: '100%', borderRadius: '12px', padding: '0.75rem', border: '1px solid var(--border)', fontSize: '0.9rem', minHeight: '80px', resize: 'vertical' }}
                              />
                          </div>
                      )}

                      <button 
                          onClick={() => setIsModalOpen(true)}
                          disabled={newStatus === order.status}
                          style={{ 
                              width: '100%', 
                              padding: '1rem', 
                              background: newStatus !== order.status ? 'var(--primary)' : 'var(--background)', 
                              color: newStatus !== order.status ? 'white' : 'var(--text-muted)', 
                              border: 'none', 
                              borderRadius: '12px', 
                              fontWeight: 800, 
                              cursor: newStatus !== order.status ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem'
                          }}
                      >
                          <FiCheckCircle size={18} /> Update Status
                      </button>
                  </div>
              </div>

              {/* Card 2: Project Updates */}
              <div className="status-control" style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiEdit2 size={18} color="var(--primary)" /> Project Updates
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>General Remarks / Notes</label>
                          <textarea 
                              value={timelineNote}
                              onChange={(e) => setTimelineNote(e.target.value)}
                              placeholder="Add an internal progress note..."
                              style={{ width: '100%', borderRadius: '12px', padding: '0.75rem', border: '1px solid var(--border)', fontSize: '0.9rem', minHeight: '100px', resize: 'vertical' }}
                          />
                      </div>

                      <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Documents / Attachments</label>
                          <div 
                              onClick={() => document.getElementById('file-upload').click()}
                              style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', background: 'var(--background)' }}
                              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                          >
                              <FiUpload size={24} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Click to add files</p>
                              <input id="file-upload" type="file" multiple hidden onChange={handleFileUpload} />
                          </div>

                          {selectedFiles.length > 0 && (
                              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {selectedFiles.map((file, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                              <FiFileText size={14} color="var(--primary)" />
                                              <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                                          </div>
                                          <FiX size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => removeFile(idx)} />
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      <button 
                          className="btn-confirm" 
                          disabled={isUploading}
                          onClick={handlePostTimelineUpdate}
                          style={{ marginTop: '0.5rem', width: '100%', padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                      >
                          {isUploading ? (
                              <><FiLoader className="spin" /> Posting...</>
                          ) : (
                              <><FiCheckCircle size={18} /> Post Update to Timeline</>
                          )}
                      </button>
                  </div>
              </div>
            
              <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(33, 96, 183, 0.05)', borderRadius: '16px', border: '1px solid rgba(33, 96, 183, 0.1)' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase' }}>Logistics Tracking</label>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
                      <FiTruck size={18} color="var(--primary)" />
                      {order.tracking_number || 'Awaiting tracking ID'}
                  </div>
              </div>
          </div>
        </div>
      </div>

      <div className="bottom-section" style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2.5rem' }}>
        <div className="bottom-left">
          <div className="field-section">
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Expected Delivery Window</label>
            <div className="blue-box" style={{ padding: '1.25rem', fontWeight: 600 }}>
                {order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'To be determined'}
            </div>
          </div>
          <button 
            className="view-timeline-btn" 
            onClick={() => navigate(`/orders/${id}`)}
            style={{ marginTop: '1.5rem', width: '100%' }}
          >
            Go to Full Specifications
          </button>
        </div>
        <div className="bottom-right">
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Technical Method</label>
          <div className="blue-box" style={{ padding: '1.25rem', fontWeight: 600 }}>
              {order.processing_technology}
          </div>
        </div>
      </div>
      <ConfirmationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleUpdateStatus}
        title="Update Order Status"
        message={`Are you sure you want to change this order status to ${newStatus?.replace(/_/g, ' ')}?`}
        confirmText="Yes, Update"
        cancelText="No, Keep It"
        type={newStatus === 'CANCELLED' ? 'danger' : 'primary'}
      />
    </div>
  );
}

export default TrackOrder;
