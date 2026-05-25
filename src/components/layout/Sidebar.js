import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiUsers, FiMessageSquare, FiShoppingBag, FiPackage, FiTrendingUp, FiSliders, FiActivity, FiBarChart } from 'react-icons/fi';
// We'll assume a shared CSS file or module for layout, adapting from existing styles
import '../../styles/Enquiries.css'; // Reusing existing styles for now, will refactor to Layout.css later

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/home', label: 'Dashboard', icon: <FiHome size={20} /> },
    { path: '/users', label: 'User Management', icon: <FiUsers size={20} /> },
    { path: '/enquiries', label: 'All Enquiries', icon: <FiMessageSquare size={20} /> },
    { path: '/orders', label: 'All Orders', icon: <FiShoppingBag size={20} /> },
    { path: '/vendors', label: 'Vendor Management', icon: <FiPackage size={20} /> },
    { path: '/analytics', label: 'Analytics', icon: <FiTrendingUp size={20} /> },
    { path: '/public/analytics', label: 'Public Analytics', icon: <FiBarChart size={20} /> },
    { path: '/master-attributes', label: 'Master Attributes', icon: <FiSliders size={20} /> },
  ];

  return (
    <>
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src={process.env.PUBLIC_URL + '/logoimg.png'} alt="ShiaanX" className="sidebar-logo" />
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <div 
              key={item.path}
              className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => {
                navigate(item.path);
                if (window.innerWidth <= 768 && onClose) onClose();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </div>
      {isOpen && <div className="overlay" onClick={onClose}></div>}
    </>
  );
};

export default Sidebar;
