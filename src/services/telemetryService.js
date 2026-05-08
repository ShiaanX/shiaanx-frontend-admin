import api from './api';

const telemetryService = {
  getRawTelemetry: async (params = {}) => {
    return api.get('/admin/telemetry/raw', { params });
  },
  getExportUrl: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    return `${baseUrl}/admin/telemetry/export?${query}`;
  }
};

export default telemetryService;
