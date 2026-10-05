import React, { useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import './proto.css';
import Icon from './icons';
import { ProtoDataProvider } from './ProtoDataContext';

import EnquiriesOrders from './pages/EnquiriesOrders';
import EnquiryDetail from './pages/EnquiryDetail';
import OrderDetail from './pages/OrderDetail';
import Customers from './pages/Customers';
import PartWorkspace from './pages/PartWorkspace';
import ProductionBoard from './pages/ProductionBoard';
import CamPrograms from './pages/CamPrograms';
import ClosedLoop from './pages/ClosedLoop';
import Inspection from './pages/Inspection';
import Settings from './pages/Settings';
import Factory from './pages/Factory';

const NAV = [
  { to: '/proto', end: true, icon: 'base', label: 'Enquiries & Orders', crumb: 'Sales / Enquiries & Orders' },
  { to: '/proto/parts', icon: 'part', label: 'Part Workspace', crumb: 'Engineering / Part Workspace' },
  { to: '/proto/board', icon: 'board', label: 'Production Board', crumb: 'Production / Production Board' },
  { to: '/proto/cam', icon: 'cam', label: 'CAM Programs', crumb: 'Production / CAM Programs' },
  { to: '/proto/closed-loop', icon: 'knowledge', label: 'Closed Loop', crumb: 'Production / Closed Loop' },
  { to: '/proto/factory', icon: 'factory', label: 'Factory', crumb: 'Factory / Machines & Rules' },
  { to: '/proto/settings', icon: 'settings', label: 'Settings', crumb: 'Admin / Settings' },
];

function crumbFor(pathname) {
  if (pathname.startsWith('/proto/customers')) return 'Sales / Customers';
  if (pathname.startsWith('/proto/inspection')) return 'Closed Loop / Inspection';
  if (pathname.startsWith('/proto/orders') || pathname.startsWith('/proto/enquiries')) return 'Sales / Enquiries & Orders';
  const hit = NAV.slice().reverse().find(n => pathname.startsWith(n.to) && (n.to !== '/proto' || pathname === '/proto'));
  return hit ? hit.crumb : 'Sales / Enquiries & Orders';
}

function Shell({ children }) {
  const [navOpen, setNavOpen] = useState(true);
  const location = useLocation();
  const crumb = crumbFor(location.pathname);
  const [section, title] = crumb.split(' / ');

  return (
    <div className={`proto-app app-grid ${navOpen ? 'nav-open' : ''}`}>
      <aside className="px-sidebar">
        <div className="sidebar-top">
          <div className="brand-mark">SX</div>
          <div className="brand-name">ShiaanX</div>
        </div>
        <nav className="nav-list">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `px-nav-item ${isActive ? 'active' : ''}`}>
              <Icon name={n.icon} /> <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-divider" />
        <button type="button" className="nav-foot" onClick={() => setNavOpen(o => !o)}>
          <Icon name="base" /> <span className="nav-label">Collapse</span>
        </button>
      </aside>
      <div className="shell">
        <header className="px-topbar">
          <button type="button" className="px-icon-btn" onClick={() => setNavOpen(o => !o)} aria-label="Toggle menu"><Icon name="base" /></button>
          <div className="crumb">{section} / <b>{title}</b></div>
          <div className="topbar-spacer" />
          <span className="preview-flag">Preview — mock data</span>
          <div className="avatar" style={{ marginLeft: 14 }}>AK</div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export default function ProtoApp() {
  return (
    <ProtoDataProvider>
      <Shell>
        <Routes>
          <Route index element={<EnquiriesOrders />} />
          <Route path="enquiries/:id" element={<EnquiryDetail />} />
          <Route path="orders/:orderId" element={<OrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="parts" element={<PartWorkspace />} />
          <Route path="parts/:tmplId" element={<PartWorkspace />} />
          <Route path="board" element={<ProductionBoard />} />
          <Route path="cam" element={<CamPrograms />} />
          <Route path="closed-loop" element={<ClosedLoop />} />
          <Route path="closed-loop/:partId" element={<ClosedLoop />} />
          <Route path="inspection/:part" element={<Inspection />} />
          <Route path="factory" element={<Factory />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </Shell>
    </ProtoDataProvider>
  );
}
