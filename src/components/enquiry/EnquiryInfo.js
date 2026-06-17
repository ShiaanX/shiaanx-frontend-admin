import React, { useState, useEffect } from 'react';
import { 
  FiPaperclip, FiUpload, FiCheckCircle, FiInfo, FiBox, 
  FiTruck, FiFileText, FiTool, FiCalendar, FiUser, FiPackage,
  FiPlus, FiX, FiChevronDown, FiChevronRight, FiClock, FiFile, FiCheck
} from 'react-icons/fi';
import enquiryService from '../../services/enquiryService';
import toast from 'react-hot-toast';
import { MdAutoGraph, MdOutlineViewInAr, MdEdit, MdCheckCircle } from 'react-icons/md';
import AutoQuoteModal from './AutoQuoteModal';
import CADViewerModal from './CADViewerModal';
import EditEnquiryModal from './EditEnquiryModal';
import EditPartModal from './EditPartModal';
import AddPartModal from './AddPartModal';
import MasterQuoteModal from './MasterQuoteModal';

// Builds a clean absolute URL for any stored file_path.
// handles both absolute (http://...) and relative (/api/api/v1) API URLs.
const getFileUrl = (filePath) => {
  if (!filePath) return '#';
  if (filePath.startsWith('http')) return filePath;
  
  // Strip ../ or ./ from the start of the path
  const cleanPath = filePath.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
  
  const apiUrl = process.env.REACT_APP_API_URL || '';
  
  if (apiUrl.startsWith('http')) {
    try {
      const origin = new URL(apiUrl).origin;
      return `${origin}/${cleanPath}`;
    } catch (e) {
      return `${apiUrl}/${filePath}`;
    }
  }
  
  // If API URL is relative (like /api/api/v1), we use the domain root + /api/
  // This ensures we get http://domain/api/uploads/... instead of /api/api/...
  return `/api/${cleanPath}`;
};

const EnquiryInfo = ({ data, onApprovePO, onRejectPO, onUpdateStatus }) => {
  const [quoteFile, setQuoteFile] = useState(null);
  const [isUploadingQuote, setIsUploadingQuote] = useState(false);

  const handleDownload = async (filePath, fileName) => {
    try {
      const url = getFileUrl(filePath);
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
      window.open(getFileUrl(filePath), '_blank');
    }
  };

  const handleView = (filePath) => {
    window.open(getFileUrl(filePath), '_blank');
  };

  // DFM Modal state
  const [isDfmModalOpen, setIsDfmModalOpen] = useState(false);
  const [dfmFiles, setDfmFiles] = useState([]);
  const [dfmRemarks, setDfmRemarks] = useState('');
  const [isUploadingDfm, setIsUploadingDfm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Vendor Modal state
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorFiles, setVendorFiles] = useState([]);
  const [vendorRemarks, setVendorRemarks] = useState('');
  const [isUploadingVendor, setIsUploadingVendor] = useState(false);
  const [isVendorDragOver, setIsVendorDragOver] = useState(false);

  // Auto Quote state
  const [selectedAutoQuotePart, setSelectedAutoQuotePart] = useState(null);
  const [selectedCADPart, setSelectedCADPart] = useState(null);
  const [isEditEnquiryOpen, setIsEditEnquiryOpen] = useState(false);
  const [isAddPartOpen, setIsAddPartOpen] = useState(false);
  const [isMasterQuoteOpen, setIsMasterQuoteOpen] = useState(false);
  const [selectedEditPart, setSelectedEditPart] = useState(null);
  const [expandedParts, setExpandedParts] = useState([]);
  const [localData, setLocalData] = useState(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const toggleRow = (partId) => {
    setExpandedParts(prev => 
      prev.includes(partId) ? prev.filter(id => id !== partId) : [...prev, partId]
    );
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setDfmFiles(prev => [...prev, ...files]);
  };

  const handleVendorDragOver = (e) => { e.preventDefault(); setIsVendorDragOver(true); };
  const handleVendorDragLeave = () => setIsVendorDragOver(false);
  const handleVendorDrop = (e) => {
    e.preventDefault();
    setIsVendorDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setVendorFiles(prev => [...prev, ...files]);
  };

  if (!data) return <div className="info-card">Loading...</div>;

  const quotes = data.documents?.filter(doc => doc.document_type === 'QUOTE') || [];
  const dfms = data.documents?.filter(doc => doc.document_type === 'DFM') || [];
  const vendorDocs = data.documents?.filter(doc => doc.document_type === 'VENDOR_DOCUMENT') || [];

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const getStatusColor = (status) => {
    const positive = ['QUOTED', 'ORDER_GENERATED', 'READY', 'PO_UPLOADED'];
    return positive.includes(status) ? { bg: '#dcfce7', color: '#166534' } : { bg: '#fef3c7', color: '#92400e' };
  };

  const handleQuoteUpload = async () => {
    if (!quoteFile) { toast.error("Please select a file"); return; }
    try {
      setIsUploadingQuote(true);
      await enquiryService.uploadEnquiryDocuments(data.id, [quoteFile], null, 'QUOTE');
      toast.success("Quote uploaded successfully");
      setQuoteFile(null);
      window.location.reload();
    } catch (error) {
      toast.error(error.message || "Failed to upload quote");
    } finally {
      setIsUploadingQuote(false);
    }
  };

  const handleDfmUpload = async () => {
    if (dfmFiles.length === 0) { toast.error("Please select at least one file for DFM"); return; }
    try {
      setIsUploadingDfm(true);
      await enquiryService.uploadEnquiryDocuments(data.id, dfmFiles, null, 'DFM', dfmRemarks);
      toast.success("DFM uploaded successfully");
      setDfmFiles([]);
      setDfmRemarks('');
      setIsDfmModalOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error.message || "Failed to upload DFM");
    } finally {
      setIsUploadingDfm(false);
    }
  };

  const handleVendorUpload = async () => {
    if (vendorFiles.length === 0) { toast.error("Please select at least one document"); return; }
    try {
      setIsUploadingVendor(true);
      await enquiryService.uploadEnquiryDocuments(data.id, vendorFiles, null, 'VENDOR_DOCUMENT', vendorRemarks);
      toast.success("Vendor document uploaded successfully");
      setVendorFiles([]);
      setVendorRemarks('');
      setIsVendorModalOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error.message || "Failed to upload vendor document");
    } finally {
      setIsUploadingVendor(false);
    }
  };

  const handleApprove = () => {
    onApprovePO();
  };

  const handleReject = async () => {
    try {
      await onRejectPO();
      toast.success("Purchase Order rejected");
      window.location.reload();
    } catch (error) {
      toast.error(error.message || "Failed to reject PO");
    }
  };

  const statusColors = getStatusColor(data.status);

  return (
    <div className="enquiry-info-wrapper">
      {/* Vendor Document Upload Modal */}
      {isVendorModalOpen && (
        <div className="dfm-modal-overlay" onClick={() => setIsVendorModalOpen(false)}>
          <div className="dfm-modal" style={{ borderTop: '4px solid #8b5cf6' }} onClick={(e) => e.stopPropagation()}>
            <div className="dfm-modal-header">
              <h3 style={{ color: '#6d28d9' }}><FiTruck /> Add Vendor Document</h3>
              <button 
                className="dfm-modal-close" 
                onClick={() => { setIsVendorModalOpen(false); setVendorFiles([]); setVendorRemarks(''); }}
              >
                <FiX />
              </button>
            </div>
            <div className="dfm-modal-body">
              <div className="dfm-modal-field">
                <label className="dfm-modal-label">Vendor Reference Files <span style={{ color: '#e53e3e' }}>*</span></label>
                <div 
                  className={`dfm-modal-file-zone ${isVendorDragOver ? 'drag-over' : vendorFiles.length > 0 ? 'has-file' : ''}`}
                  style={isVendorDragOver ? { borderColor: '#8b5cf6', background: '#f5f3ff' } : vendorFiles.length > 0 ? { borderColor: '#8b5cf6', background: '#f5f3ff' } : {}}
                  onDragOver={handleVendorDragOver}
                  onDragLeave={handleVendorDragLeave}
                  onDrop={handleVendorDrop}
                >
                  <FiUpload size={28} color={isVendorDragOver ? '#8b5cf6' : '#94a3b8'} />
                  <p className="dfm-zone-title">
                    {isVendorDragOver ? 'Drop files here' : 'Drag & drop or click to browse'}
                  </p>
                  <p className="dfm-zone-hint">PDF, Images, Excel, or any vendor reference doc</p>
                  <input 
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      if (files.length > 0) setVendorFiles(prev => [...prev, ...files]);
                    }}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  />
                </div>

                {/* File Previews */}
                {vendorFiles.length > 0 && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>SELECTED FILES ({vendorFiles.length})</span>
                      <button 
                        onClick={() => setVendorFiles([])} 
                        style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
                      {vendorFiles.map((file, idx) => {
                        const isImage = file.type.startsWith('image/');
                        return (
                          <div key={idx} style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px', backgroundColor: '#f8fafc' }}>
                            <button 
                              onClick={() => setVendorFiles(prev => prev.filter((_, i) => i !== idx))}
                              style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', zIndex: 5, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                            >
                              <FiX size={12} />
                            </button>
                            {isImage ? (
                              <img 
                                src={URL.createObjectURL(file)} 
                                alt="preview" 
                                style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '6px' }} 
                              />
                            ) : (
                              <div style={{ width: '100%', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f3ff', borderRadius: '6px', color: '#7c3aed' }}>
                                <FiFileText size={24} />
                              </div>
                            )}
                            <div style={{ fontSize: '0.65rem', color: '#475569', textAlign: 'center', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                              {file.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="dfm-modal-field">
                <label className="dfm-modal-label">Internal Remarks</label>
                <textarea
                  placeholder="Notes about this vendor document..."
                  value={vendorRemarks}
                  onChange={(e) => setVendorRemarks(e.target.value)}
                  className="dfm-modal-textarea"
                />
              </div>
            </div>
            <div className="dfm-modal-footer">
              <button 
                className="dfm-modal-cancel"
                onClick={() => { setIsVendorModalOpen(false); setVendorFiles([]); setVendorRemarks(''); }}
              >
                Cancel
              </button>
              <button 
                className="dfm-modal-submit"
                style={{ backgroundColor: '#8b5cf6' }}
                onClick={handleVendorUpload}
                disabled={isUploadingVendor || vendorFiles.length === 0}
              >
                {isUploadingVendor ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Quote Modal */}
      {selectedAutoQuotePart && (
        <AutoQuoteModal 
          enquiryId={localData.id}
          part={selectedAutoQuotePart}
          onClose={() => setSelectedAutoQuotePart(null)}
          onSave={(res) => {
             setLocalData(prev => ({
               ...prev,
               parts: prev.parts.map(p => 
                 p.id === selectedAutoQuotePart.id 
                  ? { ...p, auto_quote_status: res.auto_quote_status, auto_quote_data: res.auto_quote_data } 
                  : p
               )
             }));
          }}
        />
      )}

      {/* CAD Viewer Modal */}
      <CADViewerModal 
        isOpen={!!selectedCADPart}
        part={selectedCADPart}
        onClose={() => setSelectedCADPart(null)}
      />

      {/* Edit Enquiry Modal */}
      <EditEnquiryModal 
        isOpen={isEditEnquiryOpen}
        onClose={() => setIsEditEnquiryOpen(false)}
        enquiryData={localData}
        onUpdate={(updated) => setLocalData(updated)}
      />

      {/* Edit Part Modal */}
      <EditPartModal 
        isOpen={!!selectedEditPart}
        onClose={() => setSelectedEditPart(null)}
        enquiryId={localData.id}
        part={selectedEditPart}
        onUpdate={(updated) => {
          setLocalData(updated);
          // If we were editing a part, find it in the updated data to keep the modal state fresh
          const updatedPart = updated.parts?.find(p => p.id === selectedEditPart.id);
          if (updatedPart) setSelectedEditPart(updatedPart);
        }}
      />

      {/* Add Part Modal */}
      <AddPartModal 
        isOpen={isAddPartOpen}
        onClose={() => setIsAddPartOpen(false)}
        enquiryId={localData.id}
        onAdded={(updated) => setLocalData(updated)}
      />

      {/* Master Quote Modal */}
      <MasterQuoteModal 
        isOpen={isMasterQuoteOpen}
        onClose={() => setIsMasterQuoteOpen(false)}
        enquiryData={localData}
        onSave={(updated) => setLocalData(updated)}
      />

      {/* DFM Upload Modal */}
      {isDfmModalOpen && (
        <div className="dfm-modal-overlay" onClick={() => setIsDfmModalOpen(false)}>
          <div className="dfm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dfm-modal-header">
              <h3><FiTool /> Add DFM Analysis</h3>
              <button 
                className="dfm-modal-close" 
                onClick={() => { setIsDfmModalOpen(false); setDfmFiles([]); setDfmRemarks(''); }}
              >
                <FiX />
              </button>
            </div>
            <div className="dfm-modal-body">
              <div className="dfm-modal-field">
                <label className="dfm-modal-label">DFM Report File <span style={{ color: '#e53e3e' }}>*</span></label>
                <div 
                  className={`dfm-modal-file-zone ${isDragOver ? 'drag-over' : ''} ${dfmFiles.length > 0 ? 'has-file' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <FiUpload size={28} color={isDragOver ? '#16a34a' : '#94a3b8'} />
                  <p className="dfm-zone-title">
                    {isDragOver ? 'Drop files here' : 'Drag & drop or click to browse'}
                  </p>
                  <p className="dfm-zone-hint">PDF, Images, DWG, STEP, or any report format</p>
                  <input 
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      if (files.length > 0) setDfmFiles(prev => [...prev, ...files]);
                    }}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  />
                </div>

                {/* File Previews */}
                {dfmFiles.length > 0 && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>SELECTED FILES ({dfmFiles.length})</span>
                      <button 
                        onClick={() => setDfmFiles([])} 
                        style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
                      {dfmFiles.map((file, idx) => {
                        const isImage = file.type.startsWith('image/');
                        return (
                          <div key={idx} style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px', backgroundColor: '#f8fafc' }}>
                            <button 
                              onClick={() => setDfmFiles(prev => prev.filter((_, i) => i !== idx))}
                              style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', zIndex: 5, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                            >
                              <FiX size={12} />
                            </button>
                            {isImage ? (
                              <img 
                                src={URL.createObjectURL(file)} 
                                alt="preview" 
                                style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '6px' }} 
                              />
                            ) : (
                              <div style={{ width: '100%', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', borderRadius: '6px', color: '#2563eb' }}>
                                <FiFileText size={24} />
                              </div>
                            )}
                            <div style={{ fontSize: '0.65rem', color: '#475569', textAlign: 'center', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                              {file.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="dfm-modal-field">
                <label className="dfm-modal-label">Remarks for Customer</label>
                <textarea
                  placeholder="Describe findings, changes required, or notes..."
                  value={dfmRemarks}
                  onChange={(e) => setDfmRemarks(e.target.value)}
                  className="dfm-modal-textarea"
                />
              </div>
            </div>
            <div className="dfm-modal-footer">
              <button 
                className="dfm-modal-cancel"
                onClick={() => { setIsDfmModalOpen(false); setDfmFiles([]); setDfmRemarks(''); }}
              >
                Cancel
              </button>
              <button 
                className="dfm-modal-submit"
                onClick={handleDfmUpload}
                disabled={isUploadingDfm || dfmFiles.length === 0}
              >
                {isUploadingDfm ? 'Uploading...' : 'Upload DFM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <nav className="breadcrumb-nav">
        <span className="breadcrumb-item" onClick={() => window.location.href = '/'}>All Items</span>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item" style={{ fontWeight: 600, color: '#0f172a' }}>{localData.enquiry_number}</span>
      </nav>

      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="dashboard-title">Enquiry Details</h1>
          <button 
            onClick={() => setIsEditEnquiryOpen(true)}
            style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center' }}
            title="Edit Enquiry Information"
          >
            <MdEdit size={18} />
          </button>
        </div>
        <span 
          className="status-pill"
          style={{ backgroundColor: statusColors.bg, color: statusColors.color }}
        >
          {formatStatus(localData.status)}
        </span>
      </header>

      <div className="dashboard-grid">
        {/* Left Column */}
        <div className="dashboard-main-content">
          {/* General Info Card */}
          <div className="info-card">
              <div className="parameters-grid">
                <div className="param-item">
                  <span className="param-label">Customer</span>
                  <span className="param-value">{localData.customer?.name || 'N/A'}</span>
                </div>
                <div className="param-item">
                  <span className="param-label">Created Date</span>
                  <span className="param-value">{formatDate(localData.created_at || localData.createdAt)}</span>
                </div>
                <div className="param-item">
                  <span className="param-label">Shipping Address</span>
                  <span className="param-value" style={{ fontSize: '0.85rem' }}>{localData.shipping_address || 'India'}</span>
                </div>
                <div className="param-item">
                  <span className="param-label">General Remarks</span>
                  <span className="param-value" style={{ fontSize: '0.85rem' }}>{localData.remarks || 'No specific notes.'}</span>
                </div>
             </div>
          </div>

          {/* Parts Section - Tabular View */}
          <div className="info-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ margin: 0, marginBottom: 0 }}>
                <FiPackage style={{ marginRight: '8px' }} /> Parts Specification
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => setIsAddPartOpen(true)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px', 
                    padding: '6px 12px', background: '#e0e7ff', 
                    color: '#3730a3', border: 'none', borderRadius: '6px', 
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' 
                  }}
                >
                  <FiPlus /> Add Part
                </button>
                <button
                  onClick={() => setIsMasterQuoteOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px',
                    background: localData.master_quote_data ? '#ecfdf5' : 'linear-gradient(135deg, #0f766e, #14b8a6)',
                    color: localData.master_quote_data ? '#065f46' : 'white',
                    border: localData.master_quote_data ? '1px solid #6ee7b7' : 'none',
                    borderRadius: '6px',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    boxShadow: localData.master_quote_data ? 'none' : '0 2px 8px rgba(20,184,166,0.35)'
                  }}
                >
                  <MdAutoGraph size={16} />
                  {localData.master_quote_data ? 'View Master Quote' : 'Master Quote'}
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="parts-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Part Name</th>
                    <th>Process / Technology</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Surface Finish</th>
                    <th>Files</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {localData.parts && localData.parts.length > 0 ? (
                    localData.parts.map((part, index) => {
                      const isExpanded = expandedParts.includes(part.id);
                      const sortedDocs = [...(part.documents || [])].sort((a, b) => 
                        new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
                      );

                      return (
                        <React.Fragment key={part.id || index}>
                          <tr style={{ background: isExpanded ? '#f8fafc' : 'white', transition: 'all 0.2s' }}>
                            <td className="col-index">{index + 1}</td>
                            <td className="col-name" style={{ cursor: 'pointer' }} onClick={() => toggleRow(part.id)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                                  {isExpanded ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
                                </span>
                                <strong>{part.part_name}</strong>
                              </div>
                              {part.auto_quote_status === 'FINALIZED' && (
                                <div style={{ marginLeft: 26, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#10b981', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #a7f3d0' }}>
                                  <MdCheckCircle size={12} /> FINALIZED: ₹{part.auto_quote_data?.grandTotal?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                              )}
                              {part.auto_quote_status === 'DRAFT' && (
                                <div style={{ marginLeft: 26, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fffbeb', color: '#d97706', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #fde68a' }}>
                                  <MdEdit size={12} /> DRAFT: ₹{part.auto_quote_data?.grandTotal?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className="tech-badge">
                                {part.technologies?.map(t => t.name).join(', ') || 'N/A'}
                              </span>
                            </td>
                            <td>{part.materials?.map(m => m.name).join(', ') || 'N/A'}</td>
                            <td className="col-qty">{part.quantity} Units</td>
                            <td>{part.finishes?.map(f => f.name).join(', ') || 'As Manufactured'}</td>
                            <td className="col-files">
                              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{part.documents?.length || 0} Files</span>
                            </td>
                            <td className="col-actions">
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                  className="btn-auto-quote"
                                  onClick={() => setSelectedAutoQuotePart(part)}
                                  title={part.auto_quote_status ? 'Edit Quote' : 'Generate Insta Quote'}
                                  style={{
                                    border: part.auto_quote_status === 'FINALIZED' ? '1px solid #10b981' : undefined,
                                    background: part.auto_quote_status === 'FINALIZED' ? '#ecfdf5' : undefined,
                                    color: part.auto_quote_status === 'FINALIZED' ? '#10b981' : undefined,
                                  }}
                                >
                                  <MdAutoGraph /> {part.auto_quote_status ? 'Edit Quote' : 'Auto Quote'}
                                </button>
                                <button 
                                  className="btn-secondary-action"
                                  style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                                  onClick={() => setSelectedCADPart(part)}
                                  title="View 3D CAD"
                                >
                                  <MdOutlineViewInAr /> View 3D
                                </button>
                                <button 
                                  className="btn-secondary-action"
                                  style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', backgroundColor: '#fdf2f2', color: '#b91c1c' }}
                                  onClick={() => setSelectedEditPart(part)}
                                  title="Edit Part / Revisions"
                                >
                                  <MdEdit size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED ROW CONTENT */}
                          {isExpanded && (
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              <td colSpan="8" style={{ padding: '0' }}>
                                <div style={{ padding: '24px', display: 'flex', gap: '32px', borderTop: '1px dashed #cbd5e1' }}>
                                  
                                  {/* Technical Remarks */}
                                  <div style={{ flex: 1 }}>
                                    <h5 style={{ margin: '0 0 12px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                                      <FiInfo /> Technical Remarks
                                    </h5>
                                    <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px' }}>
                                      <p style={{ margin: 0, fontSize: '0.85rem', color: part.remarks ? '#334155' : '#94a3b8', lineHeight: '1.5' }}>
                                        {part.remarks || 'No technical remarks provided for this part.'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Revisions / Files */}
                                  <div style={{ flex: 1 }}>
                                    <h5 style={{ margin: '0 0 12px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                                      <FiClock /> File Revisions
                                    </h5>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                      {sortedDocs.length > 0 ? sortedDocs.map((doc, idx) => (
                                        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'white', border: `1px solid ${idx === 0 ? '#10b981' : '#e2e8f0'}`, borderRadius: '8px', opacity: idx === 0 ? 1 : 0.7 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                                            <div style={{ color: idx === 0 ? '#10b981' : '#64748b', flexShrink: 0 }}>
                                              {idx === 0 ? <FiCheck /> : <FiFile />}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {doc.file_name}
                                                {idx === 0 && <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#ecfdf5', color: '#10b981', border: '1px solid #10b981', fontSize: '0.6rem', borderRadius: '4px', fontWeight: 700 }}>LATEST</span>}
                                              </p>
                                              <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                                                {new Date(doc.created_at || doc.createdAt).toLocaleString()}
                                              </p>
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => handleView(doc.file_path)} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', outline: 'none' }}>VIEW</button>
                                            <a href="#download" onClick={(e) => { e.preventDefault(); handleDownload(doc.file_path, doc.file_name); }} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>DOWNLOAD</a>
                                          </div>
                                        </div>
                                      )) : (
                                        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                          No files uploaded for this part. Click the "Edit Part" pencil icon to upload revisions.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty-table">No parts found for this enquiry</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Sidebar */}
        <div className="dashboard-sidebar">
          <div className="sticky-panel">
            {/* Actions Card */}
            <div className="cost-summary-card">
                <div className="card-title" style={{ border: 'none', marginBottom: '0.5rem' }}>Enquiry Actions</div>
                
                {data.status !== 'ORDER_GENERATED' && data.status !== 'CANCELLED' && (
                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {data.status === 'PO_UPLOADED' && (
                            <button onClick={handleReject} className="btn-secondary-action" style={{ width: '100%', padding: '0.75rem', color: '#e53e3e', borderColor: '#fc8181', borderRadius: '8px' }}>
                                Reject Purchase Order
                            </button>
                        )}
                        <button onClick={handleApprove} className="confirm-order-btn" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', fontWeight: 700, fontSize: '1rem' }}>
                            {data.status === 'PO_UPLOADED' ? 'Complete Order' : 'Generate Order'}
                        </button>
                        {data.status === 'PARKED' ? (
                            <button onClick={() => onUpdateStatus('PENDING', 'Unparked manually')} className="btn-secondary-action" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                                Unpark Enquiry
                            </button>
                        ) : (
                            <button onClick={() => onUpdateStatus('PARKED', 'Parked manually')} className="btn-secondary-action" style={{ width: '100%', padding: '0.75rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', cursor: 'pointer' }}>
                                Park Enquiry
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Pricing Summary Card — shown when master quote exists */}
            {localData.master_quote_data && (() => {
                const mq = localData.master_quote_data;
                return (
                    <div className="info-card" style={{ border: '1px solid #a7f3d0', background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', padding: '0', overflow: 'hidden' }}>
                        {/* Card Header */}
                        <div style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                                <MdAutoGraph size={18} />
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.02em' }}>MASTER QUOTE</span>
                            </div>
                            <span style={{ 
                                background: 'rgba(255,255,255,0.2)', 
                                color: 'white', 
                                padding: '2px 8px', 
                                borderRadius: '20px', 
                                fontSize: '0.7rem', 
                                fontWeight: 700 
                            }}>
                                {localData.status === 'QUOTED' ? 'FINALIZED' : 'DRAFT'}
                            </span>
                        </div>

                        {/* Grand Total Hero */}
                        <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid #d1fae5', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Grand Total (Inc. 18% GST)</p>
                            <p style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 900, color: '#0f766e', lineHeight: 1 }}>
                                ₹{(mq.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>

                        {/* Breakdown */}
                        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                <span style={{ color: '#6b7280' }}>Parts Subtotal</span>
                                <span style={{ fontWeight: 600, color: '#374151' }}>₹{(mq.partsSubTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            {mq.globalShipping > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                    <span style={{ color: '#6b7280' }}>Shipping</span>
                                    <span style={{ fontWeight: 600, color: '#374151' }}>+ ₹{(mq.globalShipping || 0).toLocaleString()}</span>
                                </div>
                            )}
                            {mq.globalDiscount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                    <span style={{ color: '#6b7280' }}>Discount</span>
                                    <span style={{ fontWeight: 700, color: '#0f766e' }}>- ₹{(mq.globalDiscount || 0).toLocaleString()}</span>
                                </div>
                            )}
                            <div style={{ height: '1px', background: '#d1fae5' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: '#6b7280', fontWeight: 600 }}>Net Subtotal</span>
                                <span style={{ fontWeight: 700, color: '#111827' }}>₹{(mq.subTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                <span style={{ color: '#9ca3af' }}>GST (18%)</span>
                                <span style={{ color: '#9ca3af' }}>₹{(mq.gstAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            {mq.paymentTerms && (
                                <div style={{ marginTop: '4px', padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '0.78rem', color: '#065f46', fontWeight: 600 }}>
                                    💳 {mq.paymentTerms}
                                </div>
                            )}
                        </div>

                        {/* Edit button */}
                        <div style={{ padding: '0 18px 16px' }}>
                            <button 
                                onClick={() => setIsMasterQuoteOpen(true)}
                                style={{ width: '100%', background: 'white', border: '1px solid #6ee7b7', color: '#0f766e', borderRadius: '6px', padding: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                            >
                                Edit Master Quote
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Quotation Management Card */}
            <div className="info-card quote-upload-card">
                <h3 className="card-title"><FiFileText /> Quotation Management</h3>
                <div className="reference-upload-zone quote-zone">
                    {quotes.length > 0 ? (
                        <div className="uploaded-files-list">
                            {quotes.map((q, i) => (
                                <div key={i} className="uploaded-file-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                    <span className="file-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{q.file_name}</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleView(q.file_path)} className="view-link" style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', padding: 0, outline: 'none' }}>VIEW</button>
                                        <a href="#download" onClick={(e) => { e.preventDefault(); handleDownload(q.file_path, q.file_name); }} className="view-link" style={{ textDecoration: 'none', color: '#16a34a', fontWeight: 600, fontSize: '0.8rem' }}>DOWNLOAD</a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <FiUpload size={24} className="upload-icon" />}
                    <div 
                        className={`quote-drop-zone ${quoteFile ? 'has-file' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                        onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                        onDrop={(e) => { 
                            e.preventDefault(); 
                            e.currentTarget.classList.remove('drag-over');
                            const file = e.dataTransfer.files[0];
                            if (file) setQuoteFile(file);
                        }}
                        style={{ position: 'relative', borderRadius: '8px', border: '2px dashed #bfdbfe', background: '#f0f7ff', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '0.75rem' }}
                    >
                        {quoteFile ? (
                            <>
                                <FiCheckCircle size={22} color="#2563eb" />
                                <p style={{ margin: '0.4rem 0 0.15rem', fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8', wordBreak: 'break-all' }}>{quoteFile.name}</p>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>Click to change file</p>
                            </>
                        ) : (
                            <>
                                <FiUpload size={22} color="#94a3b8" />
                                <p style={{ margin: '0.4rem 0 0.15rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Drag & drop or click to browse</p>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>PDF, XLSX, or any quote document</p>
                            </>
                        )}
                        <input 
                            type="file" 
                            onChange={(e) => setQuoteFile(e.target.files[0])}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                        />
                    </div>
                    <button 
                        onClick={handleQuoteUpload} 
                        disabled={isUploadingQuote || !quoteFile} 
                        className="btn-upload-primary"
                    >
                        {isUploadingQuote ? 'Uploading...' : 'Upload Quotation'}
                    </button>
                    
                    <div style={{ margin: '16px 0', borderTop: '1px solid #e2e8f0' }}></div>
                    
                    {localData.master_quote_data ? (
                        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>Master Quote Generated</p>
                            <button 
                                onClick={() => setIsMasterQuoteOpen(true)}
                                style={{ width: '100%', background: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                View / Edit Master Quote
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsMasterQuoteOpen(true)}
                            style={{ 
                                width: '100%', 
                                background: '#3b82f6', 
                                color: 'white', 
                                border: 'none', 
                                padding: '10px', 
                                borderRadius: '8px', 
                                fontWeight: 700, 
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <MdAutoGraph size={18} /> Generate Master Quote
                        </button>
                    )}
                </div>
            </div>

            {/* DFM Analysis Card - Modal Triggered */}
            <div className="info-card dfm-upload-card">
                <h3 className="card-title" style={{ justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FiTool /> DFM Analysis
                    </span>
                    <button 
                        className="btn-add-dfm"
                        onClick={() => setIsDfmModalOpen(true)}
                    >
                        <FiPlus size={14} /> Add DFM
                    </button>
                </h3>
                {dfms.length > 0 ? (
                    <div className="dfm-entries-list">
                        {dfms.map((d, i) => (
                            <div key={i} className="dfm-entry">
                                <div className="dfm-entry-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="dfm-entry-label">Analysis #{i + 1} ({d.file_name})</span>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button 
                                            onClick={() => handleView(d.file_path)} 
                                            className="view-link dfm"
                                            style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', padding: 0, outline: 'none' }}
                                        >
                                            VIEW
                                        </button>
                                        <a 
                                            href="#download" 
                                            onClick={(e) => { e.preventDefault(); handleDownload(d.file_path, d.file_name); }} 
                                            className="view-link dfm"
                                            style={{ textDecoration: 'none', color: '#16a34a', fontWeight: 600, fontSize: '0.8rem' }}
                                        >
                                            DOWNLOAD
                                        </a>
                                    </div>
                                </div>
                                <div style={{ marginTop: '8px' }}>
                                    {d.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                                        <img 
                                            src={getFileUrl(d.file_path)} 
                                            alt={d.file_name}
                                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'block', marginBottom: '8px' }}
                                        />
                                    )}
                                    {d.remarks && (
                                        <p className="dfm-entry-remarks" style={{ margin: 0 }}>{d.remarks}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="dfm-empty-state">
                        <FiTool size={28} color="#bbf7d0" />
                        <p>No DFM analysis uploaded yet.</p>
                        <p style={{ fontSize: '0.75rem' }}>Click "Add DFM" to upload one.</p>
                    </div>
                )}
            </div>

            {/* Vendor Documents Card */}
            <div className="info-card vendor-upload-card">
                <h3 className="card-title" style={{ justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FiTruck /> Vendor Documents
                    </span>
                    <button 
                        className="btn-add-vendor"
                        onClick={() => setIsVendorModalOpen(true)}
                    >
                        <FiPlus size={14} /> Add Doc
                    </button>
                </h3>
                {vendorDocs.length > 0 ? (
                    <div className="dfm-entries-list">
                        {vendorDocs.map((d, i) => (
                            <div key={i} className="dfm-entry" style={{ background: '#f5f3ff', borderColor: '#ddd6fe' }}>
                                <div className="dfm-entry-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="dfm-entry-label" style={{ color: '#5b21b6' }}>Doc #{i + 1} ({d.file_name})</span>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button 
                                            onClick={() => handleView(d.file_path)} 
                                            className="view-link"
                                            style={{ color: '#7c3aed', background: 'none', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', padding: 0, outline: 'none' }}
                                        >
                                            VIEW
                                        </button>
                                        <a 
                                            href="#download" 
                                            onClick={(e) => { e.preventDefault(); handleDownload(d.file_path, d.file_name); }} 
                                            className="view-link"
                                            style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                                        >
                                            DOWNLOAD
                                        </a>
                                    </div>
                                </div>
                                <div style={{ marginTop: '8px' }}>
                                    {d.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                                        <img 
                                            src={getFileUrl(d.file_path)} 
                                            alt={d.file_name}
                                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'block', marginBottom: '8px' }}
                                        />
                                    )}
                                    {d.remarks && (
                                        <p className="dfm-entry-remarks" style={{ borderLeftColor: '#8b5cf6', margin: 0 }}>{d.remarks}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="dfm-empty-state">
                        <FiTruck size={28} color="#ddd6fe" />
                        <p>No vendor documents uploaded.</p>
                        <p style={{ fontSize: '0.75rem' }}>Click "Add Doc" to upload one.</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnquiryInfo;
