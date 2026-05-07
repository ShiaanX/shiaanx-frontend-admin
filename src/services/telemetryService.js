import api from './api';

const telemetryService = {
  getRawTelemetry: async (params = {}) => {
    return api.get('/admin/telemetry/raw', { params });
  }
};

export default telemetryService;
