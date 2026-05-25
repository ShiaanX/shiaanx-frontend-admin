import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home';
import Enquiries from './pages/Enquiries';
import EnquiryDetails from './pages/EnquiryDetails'; // Imported
import Orders from './pages/Orders';
import TrackOrder from './pages/TrackOrder';
import ViewDetails from './pages/ViewDetails';
import OrderForm from './pages/OrderForm';
import Users from './pages/Users';
import Vendors from './pages/Vendors';
import Analytics from './pages/Analytics';
import Telemetry from './pages/Telemetry';
import MakeEnquiry from './pages/MakeEnquiry';
import MasterAttributes from './pages/MasterAttributes';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
// import TelemetryReference from './pages/TelemetryReference';
// removed as not needed
import ProtectedRoute from './components/layout/ProtectedRoute';

import TelemetryAnalyticsPublic from './pages/TelemetryAnalyticsPublic';
import PublicAnalytics from './pages/PublicAnalytics';

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" reverseOrder={false} />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* <Route path="/dashboard-reference" element={<TelemetryReference />} /> */}
          <Route path="/telemetry-public" element={<TelemetryAnalyticsPublic />} />
          <Route path="/public/analytics" element={<PublicAnalytics />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/home" element={<Home />} />
            <Route path="/enquiries" element={<Enquiries />} />
            <Route path="/enquiries/:id" element={<EnquiryDetails />} /> {/* New Route */}
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<OrderForm />} />
            <Route path="/orders/:id/edit" element={<OrderForm />} />
            <Route path="/orders/:id" element={<ViewDetails />} />
            <Route path="/orders/:id/track" element={<TrackOrder />} />
            <Route path="/users" element={<Users />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/telemetry" element={<Telemetry />} />
            <Route path="/make-enquiry" element={<MakeEnquiry />} />
            <Route path="/master-attributes" element={<MasterAttributes />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
