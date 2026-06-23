import axios from 'axios';

let baseURL = import.meta.env.VITE_API_URL || '/api';
if (baseURL.startsWith('http') && !baseURL.endsWith('/api') && !baseURL.endsWith('/api/')) {
  baseURL = baseURL.replace(/\/$/, '') + '/api';
}
const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aotms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('aotms_token');
      localStorage.removeItem('aotms_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const leadsAPI = {
  getAll: (params) => api.get('/leads', { params }),
  getMyCalls: () => api.get('/leads/my-calls'),
  getStats: () => api.get('/leads/stats'),
  getOne: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
  logCall: (id, data) => api.post(`/leads/${id}/call`, data),
  addNote: (id, data) => api.post(`/leads/${id}/note`, data),
  updateStatus: (id, data) => api.put(`/leads/${id}/status`, data),
  exportCSV: (params) => api.get('/leads/export', { params, responseType: 'blob' }),
  // Send push notification to caller's mobile app
  initiateCall: (leadId, callerId) => api.post(`/leads/${leadId}/initiate-call`, { callerId }),
  // Transfer leads from one caller to another
  transferLeads: (data) => api.post('/leads/transfer', data),
  // Get leads by caller
  getByCallerAll: (callerId) => api.get(`/leads/by-caller/${callerId}`),
};

export const followupsAPI = {
  getAll: (params) => api.get('/followups', { params }),
  create: (data) => api.post('/followups', data),
  update: (id, data) => api.put(`/followups/${id}`, data),
  delete: (id) => api.delete(`/followups/${id}`),
  import: (formData) => api.post('/followups/import', formData),
};

export const campaignsAPI = {
  getAll: () => api.get('/campaigns'),
  getOne: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', data),
  update: (id, data) => api.put(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  addLeads: (id, leadIds) => api.post(`/campaigns/${id}/add-leads`, { leadIds }),
  removeLead: (id, leadId) => api.delete(`/campaigns/${id}/remove-lead/${leadId}`),
};

export const reportsAPI = {
  leaderboard: (params) => api.get('/reports/leaderboard', { params }),
  getLeaderboard: (params) => api.get('/reports/leaderboard', { params }),
  callsSummary: () => api.get('/reports/calls-summary'),
  callsList: () => api.get('/reports/calls-list'),
  adminAnalysis: () => api.get('/reports/admin-analysis'),
  getAdminAnalysis: () => api.get('/reports/admin-analysis'),
  userAnalysis: (userId) => api.get(`/reports/user-analysis/${userId}`),
  getUserAnalysis: (userId) => api.get(`/reports/user-analysis/${userId}`),
  leadView: (params) => api.get('/reports/lead-view', { params }),
  leadViewFilters: () => api.get('/reports/lead-view-filters'),
};

export const usersAPI = {
  getAll: () => api.get('/users'),
  getPreferences: () => api.get('/users/preferences'),
  updatePreferences: (data) => api.put('/users/preferences', data),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getLeaderboard: (params) => api.get('/reports/leaderboard', { params }),
  saveFcmToken: (token) => api.post('/users/fcm-token', { fcmToken: token }),
};

export const coursesAPI = {
  getAll: () => api.get('/courses'),
  getOne: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  delete: (id) => api.delete(`/courses/${id}`),
};

export const blocklistAPI = {
  getAll: (params) => api.get('/blocklist', { params }),
  add: (data) => api.post('/blocklist', data),
  remove: (id) => api.delete(`/blocklist/${id}`),
  removeByPhone: (phone) => api.delete(`/blocklist/phone/${phone}`),
  check: (phone) => api.get(`/blocklist/check/${phone}`),
};

export const messageTemplatesAPI = {
  getAll: (params) => api.get('/message-templates', { params }),
  create: (data) => api.post('/message-templates', data),
  update: (id, data) => api.put(`/message-templates/${id}`, data),
  delete: (id) => api.delete(`/message-templates/${id}`),
};

export const bulkImportAPI = {
  preview: (formData) => api.post('/bulk-import/preview', formData),
  import: (formData) => api.post('/bulk-import/import', formData),
  assign: (data) => api.post('/bulk-import/assign', data),
  downloadTemplate: () => api.get('/bulk-import/template', { responseType: 'blob' }),
};

export default api;
export const integrationsAPI = {
  getAll: () => api.get('/integrations'),
  getOne: (id) => api.get(`/integrations/${id}`),
  create: (data) => api.post('/integrations', data),
  update: (id, data) => api.put(`/integrations/${id}`, data),
  remove: (id) => api.delete(`/integrations/${id}`),
  getLeads: (id, params) => api.get(`/integrations/${id}/leads`, { params }),
  testWebhook: (id) => api.post(`/integrations/${id}/test-webhook`),
};

export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ── Automation & API suite ────────────────────────────────────────────────────
export const workflowsAPI = {
  meta: () => api.get('/workflows/meta'),
  getAll: (params) => api.get('/workflows', { params }), // params: { kind, status, search }
  getOne: (id) => api.get(`/workflows/${id}`),
  getExecutions: (id, params) => api.get(`/workflows/${id}/executions`, { params }),
  create: (data) => api.post('/workflows', data),
  update: (id, data) => api.put(`/workflows/${id}`, data),
  setStatus: (id, status) => api.patch(`/workflows/${id}/status`, { status }),
  delete: (id) => api.delete(`/workflows/${id}`),
};

export const salesformsAPI = {
  getAll: (params) => api.get('/salesforms', { params }),
  getActive: (params) => api.get('/salesforms/active', { params }),
  getOne: (id) => api.get(`/salesforms/${id}`),
  getSubmissions: (id) => api.get(`/salesforms/${id}/submissions`),
  create: (data) => api.post('/salesforms', data),
  update: (id, data) => api.put(`/salesforms/${id}`, data),
  setStatus: (id, status) => api.patch(`/salesforms/${id}/status`, { status }),
  submit: (id, data) => api.post(`/salesforms/${id}/submit`, data),
  delete: (id) => api.delete(`/salesforms/${id}`),
};

export const apiTemplatesAPI = {
  getAll: () => api.get('/api-templates'),
  getOne: (id) => api.get(`/api-templates/${id}`),
  create: (data) => api.post('/api-templates', data),
  update: (id, data) => api.put(`/api-templates/${id}`, data),
  test: (id, data) => api.post(`/api-templates/${id}/test`, data),
  delete: (id) => api.delete(`/api-templates/${id}`),
};

export const webhooksAPI = {
  getAll: () => api.get('/webhooks'),
  getOne: (id) => api.get(`/webhooks/${id}`),
  create: (data) => api.post('/webhooks', data),
  update: (id, data) => api.put(`/webhooks/${id}`, data),
  test: (id) => api.post(`/webhooks/${id}/test`),
  delete: (id) => api.delete(`/webhooks/${id}`),
};

export const accessTokensAPI = {
  getAll: () => api.get('/access-tokens'),
  create: (data) => api.post('/access-tokens', data),
  revoke: (id) => api.patch(`/access-tokens/${id}/revoke`),
  delete: (id) => api.delete(`/access-tokens/${id}`),
};

export const mcpAPI = {
  status: () => api.get('/mcp/status'),
  requestAccess: (provider) => api.post('/mcp/request-access', { provider }),
  approve: (id) => api.patch(`/mcp/${id}/approve`),
  revoke: (id) => api.patch(`/mcp/${id}/revoke`),
};

export const callIqAPI = {
  templates: () => api.get('/call-iq-agents/templates'),
  getAll: () => api.get('/call-iq-agents'),
  getOne: (id) => api.get(`/call-iq-agents/${id}`),
  create: (data) => api.post('/call-iq-agents', data),
  update: (id, data) => api.put(`/call-iq-agents/${id}`, data),
  delete: (id) => api.delete(`/call-iq-agents/${id}`),
  run: (id, data) => api.post(`/call-iq-agents/${id}/run`, data),
  getAudits: (id) => api.get(`/call-iq-agents/${id}/audits`),
};

export const n8nAPI = {
  getConfig: () => api.get('/n8n/config'),
  saveConfig: (data) => api.post('/n8n/config', data),
  test: () => api.post('/n8n/test'),
  listWorkflows: () => api.get('/n8n/workflows'),
  cachedWorkflows: () => api.get('/n8n/workflows/cached'),
  getWorkflow: (id) => api.get(`/n8n/workflows/${id}`),
  trigger: (id, payload) => api.post(`/n8n/workflows/${id}/trigger`, { payload }),
  getExecutions: (id, limit) => api.get(`/n8n/workflows/${id}/executions`, { params: { limit } }),
};