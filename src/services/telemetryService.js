import api from './api';

const telemetryService = {
  getRawTelemetry: async (params = {}) => api.get('/public/telemetry/raw', { params }),
  getExportUrl: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    return `${baseUrl}/public/telemetry/export?${query}`;
  },
  getAnalyticsSummary: async (params = {}) => api.get('/public/telemetry/analytics/summary', { params }),
  getSpindleTrend: async (params = {}) => api.get('/public/telemetry/analytics/spindle-trend', { params }),
  getMachineMatrix: async (params = {}) => api.get('/public/telemetry/analytics/machine-matrix', { params }),
  getProgramMetrics: async (params = {}) => api.get('/public/telemetry/analytics/program-metrics', { params }),
  getToolMetrics: async (params = {}) => api.get('/public/telemetry/analytics/tool-metrics', { params }),
  getPrograms: async () => api.get('/public/telemetry/programs'),
};

export default telemetryService;
