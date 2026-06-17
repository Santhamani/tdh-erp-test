import { API_BASE_URL } from './appConfig';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    ...init
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export const mysqlApi = {
  login: (email: string, pin: string) =>
    request<{ user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, pin })
    }),

  getUsers: () => request<any[]>('/users'),

  addUser: (payload: { name: string; email: string; role: string }) =>
    request<{ id: string; pin: string; password: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateUser: (id: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  deactivateUser: (id: string) =>
    request<{ ok: boolean }>(`/users/${id}`, {
      method: 'DELETE'
    }),

  submitStageData: (stageId: string, data: Record<string, any>, currentUser: any) =>
    request<{ ok: boolean }>('/stage-records', {
      method: 'POST',
      body: JSON.stringify({ stageId, data, currentUser })
    }),

  getInModeVehicles: () => request<string[]>('/in-mode-vehicles'),

  getArrivalRecords: () => request<any[]>('/arrival-records'),
  getWeighingRecords: () => request<any[]>('/weighing-records'),
  getQualityCheckRecords: () => request<any[]>('/quality-check-records'),
  getDispatchRecords: () => request<any[]>('/dispatch-records'),

  softDeleteArrival: (id: string) => request<{ ok: boolean }>(`/arrival-records/${id}/soft-delete`, { method: 'PATCH' }),
  softDeleteWeighing: (id: string) => request<{ ok: boolean }>(`/weighing-records/${id}/soft-delete`, { method: 'PATCH' }),
  softDeleteQualityCheck: (id: string) => request<{ ok: boolean }>(`/quality-check-records/${id}/soft-delete`, { method: 'PATCH' }),
  softDeleteDispatch: (id: string) => request<{ ok: boolean }>(`/dispatch-records/${id}/soft-delete`, { method: 'PATCH' }),
  softDeleteSales: (id: string) => request<{ ok: boolean }>(`/sales-records/${id}/soft-delete`, { method: 'PATCH' })
};
