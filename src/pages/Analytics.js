import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiHome, FiUsers, FiShoppingBag, FiMessageSquare, FiUser, FiBell, FiSettings, FiPackage, FiTrendingUp, FiDollarSign } from 'react-icons/fi';
import '../styles/Analytics.css';

function Analytics() {
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

  return (
    <div className="analytics-container">
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
          
          <div className="nav-item" onClick={() => { navigate('/vendors'); setSidebarOpen(false); }}>
            <FiPackage size={20} />
            <span>Vendor Management</span>
          </div>
          
          <div className="nav-item active" onClick={() => { navigate('/analytics'); setSidebarOpen(false); }}>
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
          <h1>Analytics & Reports</h1>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card">
            <div className="card-icon revenue">
              <FiDollarSign size={28} />
            </div>
            <div className="card-content">
              <span className="card-label">Total Revenue</span>
              <span className="card-value">₹12,45,890</span>
              <span className="card-change positive">+12.5% from last month</span>
            </div>
          </div>

          <div className="analytics-card">
            <div className="card-icon users">
              <FiUsers size={28} />
            </div>
            <div className="card-content">
              <span className="card-label">Total Users</span>
              <span className="card-value">234</span>
              <span className="card-change positive">+8 new this month</span>
            </div>
          </div>

          <div className="analytics-card">
            <div className="card-icon orders">
              <FiShoppingBag size={28} />
            </div>
            <div className="card-content">
              <span className="card-label">Total Orders</span>
              <span className="card-value">156</span>
              <span className="card-change positive">+15.2% from last month</span>
            </div>
          </div>

          <div className="analytics-card">
            <div className="card-icon vendors">
              <FiPackage size={28} />
            </div>
            <div className="card-content">
              <span className="card-label">Active Vendors</span>
              <span className="card-value">18</span>
              <span className="card-change neutral">Same as last month</span>
            </div>
          </div>
        </div>

        <div className="charts-section">
          <div className="chart-card">
            <h3>Order Trends</h3>
            <div className="chart-placeholder">
              <p>Chart visualization would go here</p>
              <p className="chart-note">(Line chart showing orders over time)</p>
            </div>
          </div>

          <div className="chart-card">
            <h3>Top Vendors by Orders</h3>
            <div className="chart-placeholder">
              <p>Chart visualization would go here</p>
              <p className="chart-note">(Bar chart showing vendor performance)</p>
            </div>
          </div>
        </div>

        <div className="report-section">
          <h2>Generate Reports</h2>
          <div className="report-options">
            <button className="report-btn">Monthly Sales Report</button>
            <button className="report-btn">User Activity Report</button>
            <button className="report-btn">Vendor Performance Report</button>
            <button className="report-btn">Custom Report</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
