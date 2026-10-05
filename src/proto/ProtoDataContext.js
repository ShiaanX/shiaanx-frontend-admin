import React, { createContext, useContext, useState, useCallback } from 'react';
import { ROWS, INITIAL_CUSTOMERS, INITIAL_ARTIFACT_STATE } from './fixtures';

// A lightweight in-memory store standing in for the real backend. Every page reads/writes through
// here instead of its own local state, so Generate/Upload on an order and the customer list stay
// consistent across pages exactly like the mockup's module-level state did. Nothing persists past
// a reload — there is no backend yet (see the PRD's P1 phase).
const ProtoDataContext = createContext(null);

export function ProtoDataProvider({ children }) {
  const [rows] = useState(ROWS); // read-only sample set; "Create enquiry/job" in the modal is non-functional, as in the mockup
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [artifactState, setArtifactState] = useState(INITIAL_ARTIFACT_STATE);
  const [clientReleased, setClientReleased] = useState({});

  const addCustomer = useCallback((c) => {
    setCustomers(prev => [...prev, c]);
  }, []);

  const markArtifactDone = useCallback((jobId, artifactId) => {
    setArtifactState(prev => ({ ...prev, [jobId]: { ...(prev[jobId] || {}), [artifactId]: true } }));
  }, []);

  const toggleClientRelease = useCallback((jobId, artifactId) => {
    setClientReleased(prev => {
      const jobState = prev[jobId] || { inspReport: true, materialCert: true };
      return { ...prev, [jobId]: { ...jobState, [artifactId]: !jobState[artifactId] } };
    });
  }, []);

  const getClientReleased = useCallback((jobId) => clientReleased[jobId] || { inspReport: true, materialCert: true }, [clientReleased]);

  const value = {
    rows,
    findRow: (id) => rows.find(r => r.id === id),
    findOrder: (orderId) => rows.find(r => r.orderId === orderId),
    customers,
    addCustomer,
    artifactState,
    markArtifactDone,
    getClientReleased,
    toggleClientRelease,
  };

  return <ProtoDataContext.Provider value={value}>{children}</ProtoDataContext.Provider>;
}

export function useProtoData() {
  const ctx = useContext(ProtoDataContext);
  if (!ctx) throw new Error('useProtoData must be used inside ProtoDataProvider');
  return ctx;
}
