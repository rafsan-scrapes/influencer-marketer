// frontend/src/api.js — API client (fetch wrappers, auth handling)

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
    credentials: 'include', // Include cookies for JWT
  };

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.error?.code;
    err.details = data.error?.details;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  signup: (email, password) => request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Projects
  listProjects: () => request('/api/projects'),
  createProject: (name) => request('/api/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  updateProject: (id, name) => request(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),

  // Sequences
  listSequences: (projectId) => request(`/api/projects/${projectId}/sequences`),
  createSequence: (projectId, name) => request(`/api/projects/${projectId}/sequences`, { method: 'POST', body: JSON.stringify({ name }) }),
  updateSequence: (projectId, id, name) => request(`/api/projects/${projectId}/sequences/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteSequence: (projectId, id) => request(`/api/projects/${projectId}/sequences/${id}`, { method: 'DELETE' }),
  reorderSequences: (projectId, ids) => request(`/api/projects/${projectId}/sequences/reorder`, { method: 'POST', body: JSON.stringify({ ids }) }),

  // Templates
  listTemplates: (sequenceId) => request(`/api/sequences/${sequenceId}/templates`),
  createTemplate: (sequenceId, data) => request(`/api/sequences/${sequenceId}/templates`, { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => request(`/api/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: 'DELETE' }),
  addCondition: (templateId, data) => request(`/api/templates/${templateId}/conditions`, { method: 'POST', body: JSON.stringify(data) }),
  updateCondition: (id, data) => request(`/api/conditions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCondition: (id) => request(`/api/conditions/${id}`, { method: 'DELETE' }),

  // Contacts
  importContacts: (projectId, headers, rows) => request(`/api/projects/${projectId}/contacts/import`, { method: 'POST', body: JSON.stringify({ headers, rows }) }),
  listContacts: (projectId) => request(`/api/projects/${projectId}/contacts`),
  updateContactSequenceStep: (contactId, step) => request(`/api/contacts/${contactId}/sequence-step`, { method: 'PATCH', body: JSON.stringify({ step }) }),

  // Generation
  generate: (projectId, contactIds, sequenceId) => request(`/api/projects/${projectId}/generate`, { method: 'POST', body: JSON.stringify({ contactIds, sequenceId }) }),

  // Generated Emails
  listGenerated: (projectId, { sequenceId, status, contactId, limit = 50, offset = 0 } = {}) => {
    const params = new URLSearchParams();
    if (sequenceId) params.set('sequenceId', sequenceId);
    if (status) params.set('status', status);
    if (contactId) params.set('contactId', contactId);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return request(`/api/projects/${projectId}/generated-emails?${params.toString()}`);
  },
  deleteGenerated: (id) => request(`/api/generated-emails/${id}`, { method: 'DELETE' }),

  // AI Proxy
  generateAI: (data) => request('/api/ai/generate', { method: 'POST', body: JSON.stringify(data) }),

  // Settings
  getSettings: () => request('/api/settings'),
  updateSettings: (data) => request('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};