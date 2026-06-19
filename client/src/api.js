export const API_BASE = import.meta.env.VITE_API_URL || "";

export function authHeaders(headers = {}) {
  const token = localStorage.getItem("token");
  return token
    ? { ...headers, Authorization: `Bearer ${token}` }
    : headers;
}
