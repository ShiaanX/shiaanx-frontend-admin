import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiHome, FiUsers, FiShoppingBag, FiMessageSquare, FiSearch, FiUser, FiBell, FiSettings, FiPackage, FiTrendingUp, FiEdit, FiStar } from 'react-icons/fi';
import '../styles/Vendors.css';

function Vendors() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleSettings = () => {
    setSettingsOpen(!settingsOpen);
  };

  const handleLogout = () => {
    navigate('/login');
  };

  const vendors = [
    {
      id: 1,
      name: 'ABC Manufacturing Ltd.',
      email: 'contact@abcmfg.com',
      phone: '+91 11 2345 6789',
      specialization: 'CNC Machining',
      activeOrders: 5,
      completedOrders: 45,
      rating: 4.8,
      status: 'Active'
    },
    {
      id: 2,
      name: 'XYZ Industries',
      email: 'info@xyzind.com',
      phone: '+91 22 3456 7890',
      specialization: '3D Printing',
      activeOrders: 3,
      completedOrders: 32,
      rating: 4.6,
      status: 'Active'
    },
    {
      id: 3,
      name: 'Tech Parts Ltd',
      email: 'sales@techparts.com',
      phone: '+91 80 4567 8901',
      specialization: 'Sheet Metal',
      activeOrders: 2,
      completedOrders: 28,
      rating: 4.5,
      status: 'Active'
    }
  ];

  return (
    <div className="vendors-container">
      {/* Top Navigation Bar */}
      <div className="topbar">
        <button className="menu-btn" onClick={toggleSidebar}>
          <FiMenu size={24} />
        </button>
        <div className="topbar-right">
          <div className="topbar-icons">
            <button className="icon-btn">
              <FiUser size={20} />
            </button>
            <button className="icon-btn">
              <FiBell size={20} />
            </button>
            <button className="icon-btn" onClick={toggleSettings}>
              <FiSettings size={20} />
            </button>
            {settingsOpen && (
              <div className="settings-dropdown">
                <button className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
          <img src={process.env.PUBLIC_URL + '/logoimg.png'} alt="ShiaanX" className="topbar-logo-img" />
        </div>
      </div>

      {/* Sidebar */}
      {/* <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src={process.env.PUBLIC_URL + '/logoimg.png'} alt="ShiaanX" className="sidebar-logo" />
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-item" onClick={() => { navigate('/home'); setSidebarOpen(false); }}>
            <FiHome size={20} />
            <span>Dashboard</span>
          </div>
          
          <div className="nav-item" onClick={() => { navigate('/users'); setSidebarOpen(false); }}>
            <FiUsers size={20} />
            <span>User Management</span>
          </div>
          
          <div className="nav-item" onClick={() => { navigate('/enquiries'); setSidebarOpen(false); }}>
            <FiMessageSquare size={20} />
            <span>All Enquiries</span>
          </div>
          
          <div className="nav-item" onClick={() => { navigate('/orders'); setSidebarOpen(false); }}>
            <FiShoppingBag size={20} />
            <span>All Orders</span>
          </div>
          
          <div className="nav-item active" onClick={() => { navigate('/vendors'); setSidebarOpen(false); }}>
            <FiPackage size={20} />
            <span>Vendor Management</span>
          </div>
          
          <div className="nav-item" onClick={() => { navigate('/analytics'); setSidebarOpen(false); }}>
            <FiTrendingUp size={20} />
            <span>Analytics</span>
          </div>
        </nav>
      </div> */}

      {/* Overlay when sidebar is open */}
      {sidebarOpen && <div className="overlay" onClick={toggleSidebar}></div>}

      {/* Main Content */}
      <div className="main-content">
        <div className="page-header">
          <div className="header-left">
            <h1>Vendor Management</h1>
            <div className="vendor-stats">
              <span>Total Vendors: <strong>{vendors.length}</strong></span>
              <span className="stat-divider">|</span>
              <span>Active: <strong>{vendors.filter(v => v.status === 'Active').length}</strong></span>
            </div>
          </div>
          <div className="header-buttons">
            <button className="new-vendor-btn">
              <FiPackage size={18} />
              Add New Vendor
            </button>
          </div>
        </div>

        <div className="search-bar">
          <FiSearch size={20} color="#999" />
          <input type="text" placeholder="Search vendors by name, specialization, or contact..." />
        </div>

        <div className="vendors-grid">
          {vendors.map(vendor => (
            <div key={vendor.id} className="vendor-card">
              <div className="vendor-header">
                <h3>{vendor.name}</h3>
                <div className="rating">
                  <FiStar size={16} color="#FFD700" fill="#FFD700" />
                  <span>{vendor.rating}</span>
                </div>
              </div>

              <div className="vendor-info">
                <p><strong>Specialization:</strong> {vendor.specialization}</p>
                <p><strong>Email:</strong> {vendor.email}</p>
                <p><strong>Phone:</strong> {vendor.phone}</p>
              </div>

              <div className="vendor-stats-row">
                <div className="stat-item">
                  <span className="stat-label">Active Orders</span>
                  <span className="stat-value">{vendor.activeOrders}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Completed</span>
                  <span className="stat-value">{vendor.completedOrders}</span>
                </div>
              </div>

              <div className="vendor-footer">
                <span className={`status-badge ${vendor.status.toLowerCase()}`}>{vendor.status}</span>
                <button className="edit-btn">
                  <FiEdit size={16} />
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Vendors;
