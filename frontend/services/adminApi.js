// frontend/services/adminApi.js
// Client สำหรับเรียก Backend Admin REST API (/api/admin/exercises)
// ใช้ Bearer token จาก Firebase Auth
import { auth } from '../firebase';
import { getApiBase } from './apiConfig';

const API_BASE = getApiBase();

async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(await getAuthHeader()),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const adminApi = {
  listExercises: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.status) qs.set('status', params.status);
    if (params.level) qs.set('level', params.level);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/admin/exercises${suffix}`);
  },

  getExercise: (id) => request(`/api/admin/exercises/${id}`),

  createExercise: (data) =>
    request('/api/admin/exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateExercise: (id, data) =>
    request(`/api/admin/exercises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteExercise: (id) =>
    request(`/api/admin/exercises/${id}`, {
      method: 'DELETE',
    }),
};
