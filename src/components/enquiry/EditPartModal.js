import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSave, FiUpload, FiFile, FiClock, FiCheck, FiCheckCircle, FiChevronDown, FiAlertCircle, FiSearch } from 'react-icons/fi';
import { MdOutlineArchitecture, MdNumbers, MdOutlineDescription } from 'react-icons/md';
import enquiryService from '../../services/enquiryService';
import masterAttributeService from '../../services/masterAttributeService';
import toast from 'react-hot-toast';
import './AutoQuoteModal.css';

// ─── Custom Select Component ──────────────────────────────────────────────────
const CustomSelect = ({ label, options, value, onChange, placeholder, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  
  const selectedOption = options.find(opt => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="aq-field" ref={containerRef} style={{ position: 'relative' }}>
      <label>{label}</label>
      <div 
        className={`custom-select-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#fffdf9',
          border: `1px solid ${isOpen ? 'var(--aq-teal)' : 'rgba(65,50,35,0.18)'}`,
          borderRadius: '10px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          minHeight: '42px',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ 
          fontSize: '0.88rem', 
          color: selectedOption ? 'var(--aq-ink)' : 'var(--aq-muted)',
          fontWeight: selectedOption ? '700' : '500'
        }}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <FiChevronDown style={{ 
          color: 'var(--aq-muted)', 
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s'
        }} />
      </div>

      {isOpen && (
        <div 
          className="custom-select-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            right: 0,
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(30,20,10,0.15)',
            border: '1px solid var(--aq-line)',
            zIndex: 100,
            maxHeight: '250px',
            overflowY: 'auto',
            padding: '6px'
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--aq-muted)', textAlign: 'center' }}>No options available</div>
          ) : (
            options.map(opt => (
              <div 
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                style={{
                  padding: '10px 12px',
                  fontSize: '0.86rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: value === opt.id ? 'rgba(27,107,92,0.08)' : 'transparent',
                  color: value === opt.id ? 'var(--aq-teal)' : 'var(--aq-ink)',
                  fontWeight: value === opt.id ? '700' : '500',
                  marginBottom: '2px'
                }}
                onMouseOver={(e) => { if(value !== opt.id) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                onMouseOut={(e) => { if(value !== opt.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{opt.name}</span>
                {value === opt.id && <FiCheck size={14} />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};


const EditPartModal = ({ isOpen, onClose, enquiryId, part, onUpdate }) => {
  const [formData, setFormData] = useState({
    part_name: '',
    quantity: 1,
    remarks: '',
    material_ids: [],
    technology_ids: [],
    finish_ids: []
  });

  const [options, setOptions] = useState({
    materials: [],
    technologies: [],
    finishes: []
  });

  const [newFile, setNewFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDownload = async (filePath, fileName) => {
    try {
      const url = getFullUrl(filePath);
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
      window.open(getFullUrl(filePath), '_blank');
    }
  };

  const handleView = (filePath) => {
    window.open(getFullUrl(filePath), '_blank');
  };

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [m, t, f] = await Promise.all([
          masterAttributeService.getMaterials({ limit: 100 }),
          masterAttributeService.getTechnologies({ limit: 100 }),
          masterAttributeService.getFinishes({ limit: 100 })
        ]);
        setOptions({
          materials: m.items || [],
          technologies: t.items || [],
          finishes: f.items || []
        });
      } catch (err) {
        console.error('Failed to fetch options:', err);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (part) {
      setFormData({
        part_name: part.part_name || '',
        quantity: part.quantity || 1,
        remarks: part.remarks || '',
        material_ids: part.materials?.map(m => m.id) || [],
        technology_ids: part.technologies?.map(t => t.id) || [],
        finish_ids: part.finishes?.map(f => f.id) || []
      });
    }
  }, [part]);

  if (!isOpen || !part) return null;

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const updatedEnquiry = await enquiryService.updatePart(enquiryId, part.id, formData);
      toast.success('Part specifications updated');
      onUpdate(updatedEnquiry);
    } catch (error) {
      toast.error(error.message || 'Failed to update part');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadRevision = async () => {
    if (!newFile) return;
    try {
      setIsUploading(true);
      await enquiryService.uploadEnquiryDocuments(enquiryId, [newFile], part.id, 'OTHER', 'New Revision');
      toast.success('New revision uploaded');
      setNewFile(null);
      const updated = await enquiryService.getEnquiryDetails(enquiryId);
      onUpdate(updated);
    } catch (error) {
      toast.error(error.message || 'Failed to upload revision');
    } finally {
      setIsUploading(false);
    }
  };

  const sortedDocs = [...(part.documents || [])].sort((a, b) => 
    new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
  );

  const getFullUrl = (filePath) => {
    if (!filePath) return '#';
    if (filePath.startsWith('http')) return filePath;
    
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
    
    return `/api/${cleanPath}`;
  };

  return (
    <div className="aq-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="aq-modal" style={{ width: 'min(1100px, 95vw)', height: 'min(800px, 90vh)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Premium Header */}
        <header className="aq-header">
          <div className="aq-header-left">
            <div className="aq-badge-dot" style={{ backgroundColor: 'var(--aq-teal)', width: 12, height: 12 }}></div>
            <div>
              <p className="aq-header-eyebrow">Part Configuration</p>
              <h2 className="aq-header-title">{part.part_name}</h2>
            </div>
          </div>
          <button className="aq-btn aq-btn-ghost" onClick={onClose} style={{ borderRadius: '50%', padding: '8px' }}>
            <FiX size={20} />
          </button>
        </header>

        <div className="aq-body" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', minHeight: 0 }}>
          
          {/* Left Panel: Specifications Form */}
          <div className="aq-content" style={{ padding: '32px', borderRight: '1px solid var(--aq-line)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <MdOutlineArchitecture size={24} style={{ color: 'var(--aq-teal)' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--aq-ink)' }}>Specifications</h3>
            </div>

            <form onSubmit={handleSaveInfo} style={{ display: 'grid', gap: '24px' }}>
              <div className="aq-field">
                <label>Part Name</label>
                <input 
                  value={formData.part_name}
                  onChange={e => setFormData({...formData, part_name: e.target.value})}
                  placeholder="Enter custom part name..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <CustomSelect 
                  label="Technology"
                  options={options.technologies}
                  value={formData.technology_ids[0]}
                  onChange={(val) => setFormData({...formData, technology_ids: [val]})}
                  placeholder="Select Process"
                />

                <CustomSelect 
                  label="Material"
                  options={options.materials}
                  value={formData.material_ids[0]}
                  onChange={(val) => setFormData({...formData, material_ids: [val]})}
                  placeholder="Select Material"
                />

                <CustomSelect 
                  label="Surface Finish"
                  options={options.finishes}
                  value={formData.finish_ids[0]}
                  onChange={(val) => setFormData({...formData, finish_ids: [val]})}
                  placeholder="Select Finish"
                />
              </div>

              <div className="aq-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MdNumbers /> Total Quantity</label>
                <input 
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                  style={{ width: '120px' }}
                />
              </div>

              <div className="aq-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MdOutlineDescription /> Technical Remarks</label>
                <textarea 
                  value={formData.remarks}
                  onChange={e => setFormData({...formData, remarks: e.target.value})}
                  placeholder="Enter specific manufacturing requirements..."
                  style={{ minHeight: '120px' }}
                />
              </div>

              <button type="submit" disabled={isSubmitting} className="aq-btn aq-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                <FiSave /> {isSubmitting ? 'Syncing...' : 'Save Specifications'}
              </button>
            </form>
          </div>

          {/* Right Panel: Revisions & File History */}
          <div className="aq-sidebar" style={{ background: 'rgba(255,255,255,0.4)', padding: '32px', overflowY: 'auto' }}>
            
            {/* New Revision Upload Area */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <FiUpload size={20} style={{ color: 'var(--aq-amber)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--aq-ink)' }}>Upload New Revision</h3>
              </div>
              
              <div 
                onClick={() => fileInputRef.current.click()}
                style={{ 
                  border: '2px dashed var(--aq-line)', 
                  borderRadius: '16px', 
                  padding: '24px', 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  backgroundColor: newFile ? 'rgba(217, 164, 65, 0.05)' : 'rgba(0,0,0,0.02)',
                  transition: 'all 0.2s'
                }}
              >
                <input 
                  type="file" 
                  hidden 
                  ref={fileInputRef} 
                  accept=".step,.stp,.sldprt,.stl,.sat,.3dxml,.prt,.itp,.catpart,.x_t,.x_b,.dws,.dwf,.dwg,.dxf,.pdf,.doc,.docx,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={e => setNewFile(e.target.files[0])}
                />
                {!newFile ? (
                  <>
                    <FiUpload size={32} style={{ color: 'var(--aq-muted)', marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--aq-muted)', fontWeight: 600 }}>Click to select new file</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--aq-muted)', opacity: 0.7 }}>CAD, PDF, or DOC formats</p>
                  </>
                ) : (
                  <div>
                    <FiFile size={32} style={{ color: 'var(--aq-teal)', marginBottom: '10px' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--aq-teal)', fontWeight: 700 }}>{newFile.name}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleUploadRevision(); }}
                      disabled={isUploading}
                      className="aq-btn aq-btn-success" 
                      style={{ marginTop: '12px', fontSize: '0.75rem', padding: '6px 12px' }}
                    >
                      {isUploading ? 'Uploading...' : 'Confirm Upload'}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setNewFile(null); }}
                      style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Revision Timeline */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <FiClock size={20} style={{ color: 'var(--aq-muted)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--aq-ink)' }}>Revision History</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedDocs.map((doc, idx) => (
                  <div 
                    key={doc.id} 
                    className="aq-card" 
                    style={{ 
                      padding: '12px 16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      borderLeft: idx === 0 ? '4px solid var(--aq-teal)' : '1px solid var(--aq-line)',
                      background: idx === 0 ? 'var(--aq-soft)' : 'white',
                      opacity: idx === 0 ? 1 : 0.8
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                      <div style={{ color: idx === 0 ? 'var(--aq-teal)' : 'var(--aq-muted)', flexShrink: 0 }}>
                        {idx === 0 ? <FiCheckCircle size={18} /> : <FiFile size={18} />}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--aq-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.file_name}</p>
                          {idx === 0 && <span className="aq-pipeline-badge online" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>LATEST</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--aq-muted)' }}>{new Date(doc.created_at || doc.createdAt).toLocaleDateString()} at {new Date(doc.created_at || doc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleView(doc.file_path)} className="aq-btn aq-btn-ghost" style={{ fontSize: '0.7rem', padding: '4px 8px', border: 'none', cursor: 'pointer', background: 'none' }}>VIEW</button>
                      <button onClick={() => handleDownload(doc.file_path, doc.file_name)} className="aq-btn aq-btn-ghost" style={{ fontSize: '0.7rem', padding: '4px 8px', border: 'none', color: '#16a34a', cursor: 'pointer', background: 'none' }}>DOWNLOAD</button>
                    </div>
                  </div>
                ))}
                {sortedDocs.length === 0 && (
                  <div className="aq-notice" style={{ fontSize: '0.75rem', padding: '12px' }}>
                    <FiAlertCircle size={16} /> No files associated with this part.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="aq-footer">
          <p style={{ fontSize: '0.8rem', color: 'var(--aq-muted)', margin: 0 }}>Updating specifications will automatically re-calculate potential auto-quotes.</p>
          <button onClick={onClose} className="aq-btn aq-btn-secondary">Close Manager</button>
        </footer>
      </div>
    </div>
  );
};

export default EditPartModal;
