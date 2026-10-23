import React, { useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import './proto.css';
import Icon from './icons';
import { ProtoDataProvider, useProtoData } from './ProtoDataContext';

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

const NAV = [
  { to: '/proto', end: true, icon: 'base', label: 'Enquiries & Orders', crumb: 'Sales / Enquiries & Orders' },
  { to: '/proto/board', icon: 'board', label: 'Production Board', crumb: 'Production / Production Board' },
  { to: '/proto/cam', icon: 'cam', label: 'CAM Programs', crumb: 'Production / CAM Programs' },
  { to: '/proto/closed-loop', icon: 'knowledge', label: 'Closed Loop', crumb: 'Production / Closed Loop' },
  { to: '/proto/settings', icon: 'settings', label: 'Settings', crumb: 'Admin / Settings' },
];

function crumbFor(pathname) {
  if (pathname.startsWith('/proto/customers')) return 'Sales / Customers';
  if (pathname.startsWith('/proto/parts')) return 'Enquiries & Orders / CAM program';
  if (pathname.startsWith('/proto/inspection')) return 'Enquiries & Orders / Inspection report';
  if (pathname.startsWith('/proto/orders') || pathname.startsWith('/proto/enquiries')) return 'Sales / Enquiries & Orders';
  const hit = NAV.slice().reverse().find(n => pathname.startsWith(n.to) && (n.to !== '/proto' || pathname === '/proto'));
  return hit ? hit.crumb : 'Sales / Enquiries & Orders';
}

function LoginScreen() {
  const { login } = useProtoData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email.trim(), password); } catch (err) { setError(err.message || String(err)); setBusy(false); }
  };
  return (
    <div className="proto-app login-screen">
      <form className="card login-card" onSubmit={submit}>
        <div className="sidebar-top" style={{ padding: 0, marginBottom: 18 }}><div className="brand-mark">SX</div><div className="brand-name" style={{ color: 'var(--ink)' }}>ShiaanX</div></div>
        <h2 style={{ margin: '0 0 14px' }}>Log in</h2>
        <div className="field"><label>Email</label><input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} autoFocus /></div>
        <div className="field"><label>Password</label><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <p className="field-error" style={{ margin: '0 0 10px' }}>{error}</p>}
        <button type="submit" className="btn px-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy || !email || !password}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="cell-sub" style={{ marginTop: 14 }}>Accounts are added by an admin under Settings → Users.</p>
      </form>
    </div>
  );
}

const initials = (name) => (name || '?').split(/s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

function Shell({ children }) {
  const [navOpen, setNavOpen] = useState(true);
  const { me, logout, actionError, clearActionError, loadError } = useProtoData();
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
          <span className="preview-flag">Dev environment — shared with the team</span>
          <span className="sample-toggle" style={{ cursor: 'default' }}>{me ? me.name : ''}</span>
          <button type="button" className="sample-toggle" onClick={logout}>Log out</button>
          <div className="avatar" style={{ marginLeft: 6 }} title={me ? me.email : ''}>{initials(me && me.name)}</div>
        </header>
        <main>
          {(actionError || loadError) && (
            <div className="error-banner" role="alert">
              <span>{actionError || `Could not load the latest data: ${loadError}`}</span>
              {actionError && <button type="button" className="btn-text" onClick={clearActionError}>Dismiss</button>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function Gate({ children }) {
  const { authed, loaded, loadError } = useProtoData();
  if (!authed) return <LoginScreen />;
  if (!loaded) return <div className="proto-app login-screen"><div className="empty-hint">{loadError ? `Could not reach the server: ${loadError}` : 'Loading…'}</div></div>;
  return children;
}

export default function ProtoApp() {
  return (
    <ProtoDataProvider>
      <Gate>
      <Shell>
        <Routes>
          <Route index element={<EnquiriesOrders />} />
          <Route path="enquiries/:id" element={<EnquiryDetail />} />
          <Route path="orders/:orderId" element={<OrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="parts/:tmplId" element={<PartWorkspace />} />
          <Route path="board" element={<ProductionBoard />} />
          <Route path="cam" element={<CamPrograms />} />
          <Route path="closed-loop" element={<ClosedLoop />} />
          <Route path="closed-loop/:partId" element={<ClosedLoop />} />
          <Route path="inspection/:part" element={<Inspection />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </Shell>
      </Gate>
    </ProtoDataProvider>
  );
}
