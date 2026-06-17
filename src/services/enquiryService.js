"use strict";

import api from './api';

const enquiryService = {
  getEnquiries: async (params = {}) => {
    try {
      const response = await api.get('/admin/enquiries', { params });
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getEnquiryDetails: async (id) => {
    try {
      const response = await api.get(`/admin/enquiries/${id}`);
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  updateEnquiryStatus: async (id, status, reason) => {
    try {
      const response = await api.patch(`/admin/enquiries/${id}/status`, { status, reason });
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  addMessage: async (id, message) => {
    try {
      const response = await api.post(`/admin/enquiries/${id}/messages`, { message });
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getConfig: async () => {
    try {
      const response = await api.get('/customer/enquiries/config');
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  createEnquiry: async (data) => {
    try {
      const response = await api.post('/admin/enquiries', data);
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  uploadEnquiryDocuments: async (id, documents, enquiryPartId = null, documentType = 'OTHER', remarks = '') => {
    try {
      const formData = new FormData();
      documents.forEach(doc => {
        formData.append('documents', doc);
      });

      if (enquiryPartId) {
        formData.append('enquiry_part_id', enquiryPartId);
      }

      if (documentType) {
        formData.append('document_type', documentType);
      }

      if (remarks) {
        formData.append('remarks', remarks);
      }

      const response = await api.post(`/admin/enquiries/${id}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  rejectPO: async (id, reason) => {
    try {
      const response = await api.patch(`/admin/enquiries/${id}/reject-po`, { reason });
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  updateEnquiry: async (id, data) => {
    try {
      const response = await api.put(`/admin/enquiries/${id}`, data);
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  addPart: async (enquiryId, data) => {
    try {
      const response = await api.post(`/admin/enquiries/${enquiryId}/parts`, data);
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  updatePart: async (enquiryId, partId, data) => {
    try {
      const response = await api.put(`/admin/enquiries/${enquiryId}/parts/${partId}`, data);
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // ─── Auto Quote ─────────────────────────────────────────────────────────────
  getAutoQuoteState: async (enquiryId, partId) => {
    try {
      const response = await api.get(`/admin/enquiries/${enquiryId}/parts/${partId}/auto-quote`);
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  generateAutoQuote: async (enquiryId, partId, options = {}) => {
    try {
      const response = await api.post(`/admin/enquiries/${enquiryId}/parts/${partId}/auto-quote/generate`, options);
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  saveAutoQuote: async (enquiryId, partId, state, finalize = false) => {
    try {
      const response = await api.put(`/admin/enquiries/${enquiryId}/parts/${partId}/auto-quote`, { state, finalize });
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  saveMasterQuote: async (enquiryId, master_quote_data, finalize = false) => {
    try {
      const response = await api.put(`/admin/enquiries/${enquiryId}/master-quote`, { master_quote_data, finalize });
      return response.data || response;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getPipelineHealth: async () => {
    try {
      const response = await api.get('/admin/enquiries/auto-quote/pipeline-health');
      return response.data || response;
    } catch (error) {
      return { online: false };
    }
  },

  getAutoQuotePdfUrl: (pdfUrl) => {
    return `${api.defaults.baseURL}${pdfUrl}`;
  },

  downloadAutoQuotePdf: async (pdfUrl, filename) => {
    try {
      const response = await api.get(pdfUrl, { responseType: 'blob' });
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'program_sheet.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }
};

export default enquiryService;
