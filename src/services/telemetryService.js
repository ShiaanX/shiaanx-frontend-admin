import api from './api';

/**
 * Machines exposed on the telemetry pages. Each telemetry call is scoped to one
 * machine via { factoryId, machineId } query params (backend: buildTagFilter).
 * First entry is the default.
 */
export const TELEMETRY_MACHINES = [
  { id: 'jyotiVMC', factoryId: 'ts', label: 'TS — jyotiVMC' },
  { id: 'STM', factoryId: 'krishna', label: 'Krishna — STM' },
];
export const DEFAULT_TELEMETRY_MACHINE_ID = TELEMETRY_MACHINES[0].id;
export const telemetryMachineParams = (machineId) => {
  const m = TELEMETRY_MACHINES.find(x => x.id === machineId) || TELEMETRY_MACHINES[0];
  return { factoryId: m.factoryId, machineId: m.id };
};

const telemetryService = {
  getRawTelemetry: async (params = {}) => api.get('/public/telemetry/raw', { params }),
  getExportUrl: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    return `${baseUrl}/public/telemetry/export?${query}`;
  },
  getAnalyticsSummary: async (params = {}) => api.get('/public/telemetry/analytics/summary', { params }),
  getBreakdown: async (params = {}) => api.get('/public/telemetry/analytics/breakdown', { params }),
  getSpindleTrend: async (params = {}) => api.get('/public/telemetry/analytics/spindle-trend', { params }),
  getMachineMatrix: async (params = {}) => api.get('/public/telemetry/analytics/machine-matrix', { params }),
  getProgramMetrics: async (params = {}) => api.get('/public/telemetry/analytics/program-metrics', { params }),
  getToolMetrics: async (params = {}) => api.get('/public/telemetry/analytics/tool-metrics', { params }),
  getPrograms: async (params = {}) => api.get('/public/telemetry/programs', { params }),
  
  // Test Telemetry & Mappings
  getRawTestTelemetry: async (params = {}) => api.get('/admin/telemetry/test/raw', { params }),
  getMappings: async () => api.get('/admin/telemetry/mappings'),
  upsertMapping: async (data) => api.post('/admin/telemetry/mappings', data),
  deleteMapping: async (id) => api.delete(`/admin/telemetry/mappings/${id}`),
};

export default telemetryService;
