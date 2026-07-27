import { API_BASE, authHeaders } from '../api.js';

export async function hrFetch(path, options = {}) {
  const headers = authHeaders(options.headers || {});
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : { error: await res.text() };

  if (!res.ok) {
    throw new Error(data.error || `Request failed with ${res.status}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error('API returned HTML instead of JSON. Check that the backend server is running and /api is proxied correctly.');
  }

  return data;
}
