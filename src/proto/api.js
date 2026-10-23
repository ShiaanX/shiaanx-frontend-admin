// The production-flow API in shiaanx-backend (/api/v1/admin/flow). Logs in with the same account
// and token storage as the rest of the admin app, so one login covers both.
export const API_BASE = (process.env.REACT_APP_API_URL || '/api/v1').replace(/\/+$/, '');
const FLOW = `${API_BASE}/admin/flow`;

export class AuthError extends Error {}

const token = () => { try { return localStorage.getItem('token'); } catch (e) { return null; } };

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.data || !body.data.token) throw new Error(body.message || `Login failed (${res.status})`);
  if (body.data.user && body.data.user.role !== 'ADMIN') throw new Error('This account is not a team account.');
  localStorage.setItem('token', body.data.token);
  localStorage.setItem('user', JSON.stringify(body.data.user));
  localStorage.setItem('isAuthenticated', 'true');
  return body.data.user;
}

export function logout() {
  ['token', 'user', 'isAuthenticated'].forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
}

export const hasToken = () => !!token();

// JSON in/out, or FormData when `form` is given. Returns the response's `data`.
export async function call(method, path, { json, form } = {}) {
  const headers = { Authorization: `Bearer ${token()}` };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${FLOW}${path}`, { method, headers, body: form || (json !== undefined ? JSON.stringify(json) : undefined) });
  } catch (e) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw new AuthError(body.message || 'Please log in again.');
  if (!res.ok) throw new Error(body.message || `The server answered ${res.status}`);
  return body.data;
}

// A stored document as a Blob, with the name it was uploaded under.
export async function fetchDocument(id) {
  const res = await fetch(`${FLOW}/documents/${id}/file`, { headers: { Authorization: `Bearer ${token()}` } });
  if (res.status === 401 || res.status === 403) throw new AuthError('Please log in again.');
  if (!res.ok) throw new Error(`File not available (${res.status})`);
  const cd = res.headers.get('content-disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/);
  const name = m ? decodeURIComponent(m[1]) : 'download';
  return { blob: await res.blob(), name, type: res.headers.get('content-type') || '' };
}
