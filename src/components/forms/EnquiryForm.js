import React, { useState, useEffect } from 'react';
import { FiUpload, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import CustomDropdown from './CustomDropdown';
import MultiSelectDropdown from './MultiSelectDropdown';
import masterAttributeService from '../../services/masterAttributeService';
import toast from 'react-hot-toast';
import '../../styles/EnquiryForm.css';

const EnquiryForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  errors = {}, 
  isEditMode = false,
  users = [],
}) => {
  const [config, setConfig] = useState({
    PROCESSING_TECHNOLOGIES: [],
    MATERIALS: [],
    FINISHES: []
  });

  const [formData, setFormData] = useState({
    customer_id: '',
    remarks: '',
    shipping_address: '',
    billing_address: '',
    parts: [
      {
        id: Date.now(), // Local unique ID for UI tracking
        part_name: '',
        quantity: 1,
        remarks: '',
        technology_ids: [],
        material_ids: [],
        finish_ids: [],
        documents: []
      }
    ],
    ...initialData
  });

  const [addModal, setAddModal] = useState({ isOpen: false, type: '', label: '', value: '' });
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const fetchConfig = async () => {
    try {
      const response = await masterAttributeService.getAllAttributes();
      setConfig({
        PROCESSING_TECHNOLOGIES: response.technologies || [],
        MATERIALS: response.materials || [],
        FINISHES: response.finishes || []
      });
    } catch (err) {
      toast.error('Failed to load form options');
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleAddNew = (type) => {
    let namePrompt = '';
    
    if (type === 'PROCESSING_TECHNOLOGIES') namePrompt = 'Processing Technology';
    else if (type === 'MATERIALS') namePrompt = 'Material';
    else if (type === 'FINISHES') namePrompt = 'Finish';

    setAddModal({ isOpen: true, type, label: namePrompt, value: '' });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addModal.value.trim()) return;

    let apiCall = null;
    if (addModal.type === 'PROCESSING_TECHNOLOGIES') apiCall = masterAttributeService.createTechnology;
    else if (addModal.type === 'MATERIALS') apiCall = masterAttributeService.createMaterial;
    else if (addModal.type === 'FINISHES') apiCall = masterAttributeService.createFinish;

    try {
      await apiCall({ name: addModal.value.trim(), description: '' });
      toast.success(`${addModal.value} added successfully`);
      await fetchConfig();
      setAddModal({ isOpen: false, type: '', label: '', value: '' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to add new item');
    }
  };

  const handleSameAsBillingChange = (e) => {
    const checked = e.target.checked;
    setSameAsBilling(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, shipping_address: prev.billing_address }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      if (name === 'customer_id') {
        const selectedUser = users.find(u => u.id === value);
        if (selectedUser && selectedUser.registered_address) {
          newData.billing_address = selectedUser.registered_address;
          if (sameAsBilling) {
            newData.shipping_address = selectedUser.registered_address;
          }
        }
      } else if (name === 'billing_address' && sameAsBilling) {
        newData.shipping_address = value;
      }
      
      return newData;
    });
  };

  const handlePartChange = (partId, field, value) => {
    setFormData(prev => ({
      ...prev,
      parts: prev.parts.map(part => 
        part.id === partId ? { ...part, [field]: value } : part
      )
    }));
  };

  const addPart = () => {
    setFormData(prev => ({
      ...prev,
      parts: [
        ...prev.parts,
        {
          id: Date.now(),
          part_name: '',
          quantity: 1,
          remarks: '',
          technology_ids: [],
          material_ids: [],
          finish_ids: [],
          documents: []
        }
      ]
    }));
  };

  const removePart = (partId) => {
    if (formData.parts.length === 1) {
      toast.error('At least one part is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      parts: prev.parts.filter(p => p.id !== partId)
    }));
  };

  const handlePartFileChange = (partId, e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      parts: prev.parts.map(part => 
        part.id === partId ? { ...part, documents: [...part.documents, ...files] } : part
      )
    }));
  };

  const removePartFile = (partId, fileIndex) => {
    setFormData(prev => ({
      ...prev,
      parts: prev.parts.map(part => 
        part.id === partId 
          ? { ...part, documents: part.documents.filter((_, i) => i !== fileIndex) } 
          : part
      )
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Frontend validation
    if (!formData.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    if (!formData.shipping_address) {
      toast.error('Shipping address is required');
      return;
    }
    
    // Check if at least one part name is provided
    const invalidPart = formData.parts.find(p => !p.part_name);
    if (invalidPart) {
      toast.error('Please provide a name for all parts');
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="enquiry-form-container" style={{ maxWidth: '1000px' }}>
      <h2 className="enquiry-form-title">{isEditMode ? 'Edit Enquiry' : 'Make Enquiry (On Behalf of Customer)'}</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
            <CustomDropdown 
                label="Assign to Customer"
                name="customer_id"
                value={formData.customer_id}
                options={users.filter(u => u.role === 'CUSTOMER').map(u => ({
                    ...u,
                    displayName: u.company_name ? `${u.company_name} - ${u.name}` : u.name
                }))}
                onChange={handleChange}
                placeholder="Select Customer"
                error={errors.customer_id}
                isObject={true}
                displayKey="displayName"
                valueKey="id"
            />
        </div>

        <div className="parts-container">
          {formData.parts.map((part, index) => (
            <div key={part.id} className="part-section">
              <div className="part-header">
                <h3>Part #{index + 1}</h3>
                <button type="button" className="remove-part-btn" onClick={() => removePart(part.id)}>
                  <FiTrash2 /> Remove Part
                </button>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Part Name / ID</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Bottom Plate"
                    value={part.part_name}
                    onChange={(e) => handlePartChange(part.id, 'part_name', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={part.quantity}
                    onChange={(e) => handlePartChange(part.id, 'quantity', e.target.value)}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <MultiSelectDropdown 
                  label="Processing Technologies"
                  name={`tech_${part.id}`}
                  value={part.technology_ids}
                  options={config.PROCESSING_TECHNOLOGIES}
                  onChange={(e) => handlePartChange(part.id, 'technology_ids', e.target.value)}
                  placeholder="Select Technologies"
                  isObject={true}
                  onAddNew={() => handleAddNew('PROCESSING_TECHNOLOGIES')}
                />

                <MultiSelectDropdown 
                  label="Materials"
                  name={`mat_${part.id}`}
                  value={part.material_ids}
                  options={config.MATERIALS}
                  onChange={(e) => handlePartChange(part.id, 'material_ids', e.target.value)}
                  placeholder="Select Materials"
                  isObject={true}
                  onAddNew={() => handleAddNew('MATERIALS')}
                />
              </div>

              <div className="form-row">
                <MultiSelectDropdown 
                  label="Finishes"
                  name={`fin_${part.id}`}
                  value={part.finish_ids}
                  options={config.FINISHES}
                  onChange={(e) => handlePartChange(part.id, 'finish_ids', e.target.value)}
                  placeholder="Select Finishes"
                  isObject={true}
                  onAddNew={() => handleAddNew('FINISHES')}
                />
                
                <div className="form-group">
                  <label>Part Remarks</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Specific tolerances, etc."
                    value={part.remarks}
                    onChange={(e) => handlePartChange(part.id, 'remarks', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Upload Part Documents (CAD / Drawings)</label>
                <div className="file-upload-box" onClick={() => document.getElementById(`file-upload-${part.id}`).click()}>
                  <FiUpload className="file-upload-icon" />
                  <p>Click to upload files for this part</p>
                  <input
                    type="file"
                    id={`file-upload-${part.id}`}
                    className="file-input"
                    multiple
                    accept=".step,.stp,.sldprt,.stl,.sat,.3dxml,.prt,.itp,.catpart,.x_t,.x_b,.dws,.dwf,.dwg,.dxf,.pdf,.doc,.docx,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif,.webp"
                    onChange={(e) => handlePartFileChange(part.id, e)}
                  />
                </div>
                
                {part.documents.length > 0 && (
                  <div className="uploaded-files">
                    {part.documents.map((file, fIndex) => (
                      <span key={fIndex} className="file-tag">
                        {file.name}
                        <FiX className="remove-file" onClick={() => removePartFile(part.id, fIndex)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <button type="button" className="add-part-btn" onClick={addPart}>
            <FiPlus /> Add Another Part
          </button>
        </div>

        <div className="form-group" style={{ marginTop: '2rem' }}>
          <label htmlFor="remarks">Overall Enquiry Remarks</label>
          <textarea
            id="remarks"
            name="remarks"
            className="form-control"
            value={formData.remarks}
            onChange={handleChange}
            placeholder="Any general instructions for the entire enquiry..."
          ></textarea>
        </div>

        <div className="form-row">
            <div className="form-group">
                <label htmlFor="billing_address">Billing Address</label>
                <textarea
                    id="billing_address"
                    name="billing_address"
                    className={`form-control ${errors.billing_address ? 'error' : ''}`}
                    value={formData.billing_address}
                    onChange={handleChange}
                    placeholder="Enter full billing address"
                    style={{ minHeight: '120px' }}
                ></textarea>
                {errors.billing_address && <span className="error-message">{errors.billing_address}</span>}
            </div>

            <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="shipping_address" style={{ margin: 0 }}>Shipping Address</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontWeight: 'normal', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={sameAsBilling} onChange={handleSameAsBillingChange} style={{ margin: 0 }} />
                    Same as Billing
                  </label>
                </div>
                <textarea
                    id="shipping_address"
                    name="shipping_address"
                    className={`form-control ${errors.shipping_address ? 'error' : ''}`}
                    value={formData.shipping_address}
                    onChange={handleChange}
                    placeholder="Enter full shipping address"
                    style={{ minHeight: '120px' }}
                    disabled={sameAsBilling}
                ></textarea>
                {errors.shipping_address && <span className="error-message">{errors.shipping_address}</span>}
            </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {isEditMode ? 'Update Enquiry' : 'Create Enquiry'}
          </button>
        </div>
      </form>

      {addModal.isOpen && (
        <div className="modal-overlay" onClick={() => setAddModal({ isOpen: false, type: '', label: '', value: '' })}>
          <div className="modal-container glass user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '24px' }}>
            <div className="modal-header" style={{ marginBottom: '15px' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Add New {addModal.label}</h2>
              <button className="close-btn" onClick={() => setAddModal({ isOpen: false, type: '', label: '', value: '' })}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="user-form">
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  className="form-control"
                  style={{ width: '100%' }}
                  value={addModal.value}
                  onChange={(e) => setAddModal(prev => ({ ...prev, value: e.target.value }))}
                  placeholder={`Enter ${addModal.label} name`}
                  autoFocus
                  required
                />
              </div>
              <div className="form-actions" style={{ marginTop: '20px', paddingTop: '15px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddModal({ isOpen: false, type: '', label: '', value: '' })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnquiryForm;
