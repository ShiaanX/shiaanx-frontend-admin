import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiX, FiCheckCircle } from 'react-icons/fi';
import orderService from '../services/orderService';
import userService from '../services/userService';
import enquiryService from '../services/enquiryService';
import masterAttributeService from '../services/masterAttributeService';
import CustomDropdown from '../components/forms/CustomDropdown';
import toast from 'react-hot-toast';
import '../styles/OrderForm.css';

const OrderForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [config, setConfig] = useState({
        PROCESSING_TECHNOLOGIES: [],
        MATERIALS: [],
        FINISHES: []
    });
    const [formData, setFormData] = useState({
        customer_id: '',
        processing_technology_id: '',
        material_id: '',
        finish_id: '',
        quantity: 1,
        total_amount: 0,
        tax_amount: 0,
        discount_amount: 0,
        expected_delivery_date: '',
        admin_notes: '',
        customer_notes: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch customers and master attributes
                const [usersRes, attributesRes] = await Promise.all([
                    userService.getUsers({ limit: 100 }),
                    masterAttributeService.getAllAttributes()
                ]);
                
                setCustomers(usersRes.items || []);
                
                setConfig({
                    PROCESSING_TECHNOLOGIES: attributesRes.technologies || [],
                    MATERIALS: attributesRes.materials || [],
                    FINISHES: attributesRes.finishes || []
                });

                if (isEditMode) {
                    const order = await orderService.getDetails(id);
                    
                    if (order.status !== 'PROCESSING') {
                        toast.error('Only orders in PROCESSING status can be edited');
                        navigate('/orders');
                        return;
                    }

                    setFormData({
                        customer_id: order.customer_id,
                        processing_technology_id: order.processing_technology_id || '',
                        material_id: order.material_id || '',
                        finish_id: order.finish_id || '',
                        quantity: order.quantity,
                        total_amount: order.total_amount,
                        tax_amount: order.tax_amount,
                        discount_amount: order.discount_amount,
                        expected_delivery_date: order.expected_delivery_date ? order.expected_delivery_date.split('T')[0] : '',
                        admin_notes: order.admin_notes || '',
                        customer_notes: order.customer_notes || ''
                    });
                }
            } catch (err) {
                toast.error(err.message || 'Failed to fetch data');
                if (isEditMode) navigate('/orders');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, isEditMode, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'quantity' || name === 'total_amount' || name === 'tax_amount' || name === 'discount_amount' 
                ? parseFloat(value) || 0 
                : value
        }));
    };

    const calculateFinalAmount = () => {
        const total = parseFloat(formData.total_amount) || 0;
        const tax = parseFloat(formData.tax_amount) || 0;
        const discount = parseFloat(formData.discount_amount) || 0;
        return (total + tax - discount).toFixed(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (isEditMode) {
                await orderService.update(id, formData);
                toast.success('Order updated successfully');
            } else {
                await orderService.create(formData);
                toast.success('Order created successfully');
            }
            navigate('/orders');
        } catch (err) {
            toast.error(err.message || 'Failed to save order');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="loading-state">Loading order details...</div>;

    return (
        <div className="order-form-container">
            <div className="form-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <FiArrowLeft size={20} />
                </button>
                <h2>{isEditMode ? 'Edit Order' : 'Create New Order'}</h2>
            </div>

            <form className="premium-form glass" onSubmit={handleSubmit}>
                <div className="form-grid">
                    <div className="form-section full-width">
                        <h3><FiArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} /> Basic Information</h3>
                        
                        <CustomDropdown 
                            label="Customer"
                            name="customer_id"
                            value={formData.customer_id}
                            options={customers.map(c => ({
                                ...c,
                                displayName: c.company_name ? `${c.company_name} - ${c.name}` : c.name
                            }))}
                            onChange={handleChange}
                            placeholder="Select Customer"
                            isObject={true}
                            displayKey="displayName"
                            valueKey="id"
                            disabled={isEditMode}
                        />
                    </div>

                    <div className="form-section">
                        <h3>Technical Specifications</h3>
                        
                        <CustomDropdown 
                            label="Processing Technology"
                            name="processing_technology_id"
                            value={formData.processing_technology_id}
                            options={config.PROCESSING_TECHNOLOGIES}
                            onChange={handleChange}
                            placeholder="Select Technology"
                            required
                            isObject={true}
                            displayKey="name"
                            valueKey="id"
                        />

                        <CustomDropdown 
                            label="Material"
                            name="material_id"
                            value={formData.material_id}
                            options={config.MATERIALS}
                            onChange={handleChange}
                            placeholder="Select Material"
                            required
                            isObject={true}
                            displayKey="name"
                            valueKey="id"
                        />

                        <CustomDropdown 
                            label="Finishes"
                            name="finish_id"
                            value={formData.finish_id}
                            options={config.FINISHES}
                            onChange={handleChange}
                            placeholder="Select Finish"
                            required
                            isObject={true}
                            displayKey="name"
                            valueKey="id"
                        />
                        <div className="input-group">
                            <label>Quantity</label>
                            <input 
                                type="number" 
                                name="quantity" 
                                value={formData.quantity} 
                                onChange={handleChange} 
                                min="1"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Financial Details</h3>
                        <div className="input-group">
                            <label>Base Amount (₹)</label>
                            <input 
                                type="number" 
                                name="total_amount" 
                                value={formData.total_amount} 
                                onChange={handleChange} 
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Tax Amount (₹)</label>
                            <input 
                                type="number" 
                                name="tax_amount" 
                                value={formData.tax_amount} 
                                onChange={handleChange} 
                                step="0.01"
                            />
                        </div>
                        <div className="input-group">
                            <label>Discount Amount (₹)</label>
                            <input 
                                type="number" 
                                name="discount_amount" 
                                value={formData.discount_amount} 
                                onChange={handleChange} 
                                step="0.01"
                            />
                        </div>
                        <div className="final-amount-box">
                            <span>Estimated Final Amount</span>
                            <strong>₹{calculateFinalAmount()}</strong>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Logistics & Dates</h3>
                        <div className="input-group">
                            <label>Expected Delivery Date</label>
                            <input 
                                type="date" 
                                name="expected_delivery_date" 
                                value={formData.expected_delivery_date} 
                                onChange={handleChange} 
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Notes</h3>
                        <div className="input-group">
                            <label>Admin Notes (Internal)</label>
                            <textarea 
                                name="admin_notes" 
                                value={formData.admin_notes} 
                                onChange={handleChange} 
                                placeholder="Internal team notes..."
                                rows="3"
                            ></textarea>
                        </div>
                        <div className="input-group">
                            <label>Customer Notes (Visible to Customer)</label>
                            <textarea 
                                name="customer_notes" 
                                value={formData.customer_notes} 
                                onChange={handleChange} 
                                placeholder="Notes for the customer..."
                                rows="3"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                        <FiX size={18} /> Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : <><FiSave size={18} /> {isEditMode ? 'Update Order' : 'Create Order'}</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OrderForm;
