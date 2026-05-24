const API =
  typeof window !== 'undefined' && window.location.origin.includes('localhost:5173')
    ? 'http://localhost:3000/api'
    : '/api';

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${input}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => 'Network error');
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const providersApi = {
  list: () => api<any[]>('/providers'),
  update: (id: string, data: any) => api<any>(`/providers/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  test: (id: string) => api<any>(`/providers/${id}/test`, { method: 'POST' }),
  models: (id: string) => api<{ models: string[] }>(`/providers/${id}/models`),
};

export const sessionsApi = {
  list: () => api<any[]>('/sessions'),
  create: (data: any) => api<any>('/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  delete: (id: string) => api<any>(`/sessions/${id}`, { method: 'DELETE' }),
  messages: (id: string) => api<any[]>(`/sessions/${id}/messages`),
};

export const chatApi = {
  send: (data: { sessionId: string; content: string; providerId: string }) =>
    api<any>('/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
};

export const changesApi = {
  list: () => api<any[]>('/changes'),
  create: (data: any) => api<any>('/changes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
};

export const loopApi = {
  get: () => api<any>('/loop'),
  start: (task?: string) => api<any>('/loop', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task }),
  }),
};

export const featuresApi = {
  list: () => api<any[]>('/features'),
  update: (id: string, data: any) => api<any>(`/features/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
};

export const errorsApi = {
  list: () => api<any[]>('/errors'),
  create: (data: any) => api<any>('/errors', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  fix: (id: string, fix: string) => api<any>(`/errors/${id}/fix`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fix }),
  }),
};

export const projectApi = {
  stats: (root: string) => api<any>(`/project-stats?root=${encodeURIComponent(root)}`),
};

export const filesApi = {
  tree: (root?: string) => api<any>(`/files?root=${encodeURIComponent(root || '')}`),
};

export const verifyApi = {
  list: () => api<any[]>('/verify'),
  create: (data: any) => api<any>('/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
};

export const actionsApi = {
  list: () => api<any[]>('/actions'),
};
