// client/src/auth/useAuth.js
/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { useState, useEffect, createContext, useContext } from 'react';
import { API_BASE } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount. This mirrors the original behavior; lint-only
  // suppression avoids changing auth timing during the Phase 1 guard work.
  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');
    if (token && saved) {
      setUser(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const saveSession = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // ── Email/Password ───────────────────────────────────────
  const signup = async ({ name, email, password, company, role }) => {
    const endpoint = role === 'hr' ? '/api/auth/hr/signup' : '/api/auth/candidate/signup';
    const body = role === 'hr' ? { name, email, password, company } : { name, email, password };
    const res  = await fetch(`${API_BASE}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    saveSession(data.token, data.user);
    return data.user;
  };

  const login = async ({ email, password, role }) => {
    const endpoint = role === 'hr' ? '/api/auth/hr/login' : '/api/auth/candidate/login';
    const res  = await fetch(`${API_BASE}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    saveSession(data.token, data.user);
    return data.user;
  };

  // ── Google OAuth ─────────────────────────────────────────
  const googleAuth = async ({ credential, role, company }) => {
    const endpoint = role === 'hr' ? '/api/auth/hr/google' : '/api/auth/candidate/google';
    const res  = await fetch(`${API_BASE}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ credential, company }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    saveSession(data.token, data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, googleAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
