import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiHome, FiUsers, FiShoppingBag, FiMessageSquare, FiUser, FiBell, FiSettings, FiTrendingUp, FiPackage } from 'react-icons/fi';
import '../styles/Home.css';

function Home() {
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

  // Recent activities data
  const recentActivities = [
    {
      id: 1,
      activity: 'New Order: Item #19203 from User Nandini',
      date: '2026-02-03',
      status: 'Pending Review'
    },
    {
      id: 2,
      activity: 'Enquiry #18093 requires quote approval',
      date: '2026-02-02',
      status: 'Action Required'
    },
    {
      id: 3,
      activity: 'Vendor ABC Ltd updated delivery status',
      date: '2026-02-01',
      status: 'Completed'
    }
  ];

  return (
    <div className="home-container">
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
        <div className="welcome-text">
          <h1>Admin Dashboard</h1>
          <h3>Monitor and manage all platform activities</h3>
        </div>

        <div className="cards-grid">
          <div className="info-card" onClick={() => navigate('/users')}>
            <div className="card-icon">
              <FiUsers size={28} color="#2160b7" />
            </div>
            <h3>User Management</h3>
            <p>View and manage all registered users on the platform</p>
          </div>

          <div className="info-card" onClick={() => navigate('/enquiries')}>
            <div className="card-icon">
              <FiMessageSquare size={28} color="#2160b7" />
            </div>
            <h3>Enquiry Oversight</h3>
            <p>Monitor all user enquiries and quote requests</p>
          </div>

          <div className="info-card" onClick={() => navigate('/orders')}>
            <div className="card-icon">
              <FiShoppingBag size={28} color="#2160b7" />
            </div>
            <h3>Order Management</h3>
            <p>Track and manage all orders across the platform</p>
          </div>

          <div className="info-card" onClick={() => navigate('/vendors')}>
            <div className="card-icon">
              <FiPackage size={28} color="#2160b7" />
            </div>
            <h3>Vendor Management</h3>
            <p>Manage vendor partnerships and performance</p>
          </div>

          <div className="info-card" onClick={() => navigate('/analytics')}>
            <div className="card-icon">
              <FiTrendingUp size={28} color="#2160b7" />
            </div>
            <h3>Analytics & Reports</h3>
            <p>View platform statistics and generate reports</p>
          </div>
        </div>

        <div className="recent-section">
          <h2>Recent Activities</h2>
          <div className="recent-list">
            {recentActivities.slice(0, 3).map(activity => (
              <div key={activity.id} className="recent-item" onClick={() => navigate('/orders')}>
                <div className="recent-info">
                  <span className="recent-subject">{activity.activity}</span>
                  <span className="recent-date">{activity.date}</span>
                </div>
                <span
                  className={`status-badge quote ${activity.status === 'Completed' ? 'ready' : 'pending'
                    }`}
                >
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
