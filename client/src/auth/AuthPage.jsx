// client/src/auth/AuthPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth.jsx';
import './AuthPage.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function AuthPage({ onSuccess }) {
  const [mode,    setMode]    = useState('login');   // login | signup
  const [role,    setRole]    = useState('candidate'); // candidate | hr
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });

  const { login, signup, googleAuth } = useAuth();

  // Load Google Identity SDK
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = initGoogle;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const initGoogle = useCallback(() => {
    if (!window.google || !GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback:  handleGoogleCallback,
    });
    renderGoogleBtn();
  }, [role]);

  const renderGoogleBtn = () => {
    const el = document.getElementById('google-btn');
    if (!el || !window.google) return;
    el.innerHTML = '';
    window.google.accounts.id.renderButton(el, {
      theme: 'filled_black',
      size:  'large',
      width: '100%',
      text:  mode === 'login' ? 'signin_with' : 'signup_with',
    });
  };

  useEffect(() => {
    if (window.google) { initGoogle(); renderGoogleBtn(); }
  }, [mode, role]);

  const handleGoogleCallback = async (response) => {
    setError('');
    setLoading(true);
    try {
      // HR Google signup needs company name
      if (role === 'hr' && mode === 'signup' && !form.company) {
        setError('Please enter your company name before signing in with Google');
        setLoading(false);
        return;
      }
      const user = await googleAuth({
        credential: response.credential,
        role,
        company: form.company || undefined,
      });
      onSuccess(user);
    } catch (err) {
      setError(err.message === 'company_required'
        ? 'Enter your company name first, then sign in with Google'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user;
      if (mode === 'login') {
        user = await login({ email: form.email, password: form.password, role });
      } else {
        user = await signup({ ...form, role });
      }
      onSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
 
  return (
    <div className="auth-root">
      {/* Background grid */}
      <div className="auth-grid" aria-hidden />

      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-dot">◉</span> mock.ai
        </div>

        {/* Role toggle */}
        <div className="auth-role-toggle">
          <button
            className={`auth-role-btn ${role === 'candidate' ? 'active' : ''}`}
            onClick={() => setRole('candidate')}
            type="button"
          >
            Candidate
          </button>
          <button
            className={`auth-role-btn ${role === 'hr' ? 'active' : ''}`}
            onClick={() => setRole('hr')}
            type="button"
          >
            HR / Company
          </button>
        </div>

        {/* Heading */}
        <div className="auth-heading">
          <h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
          <p>
            {role === 'candidate'
              ? 'Practice interviews. Stop getting rejected.'
              : 'Screen candidates at scale with AI.'}
          </p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="auth-field">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Rahul Sharma"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>
          )}

          {mode === 'signup' && role === 'hr' && (
            <div className="auth-field">
              <label>Company Name</label>
              <input
                type="text"
                placeholder="Acme Corp"
                value={form.company}
                onChange={set('company')}
                required
              />
            </div>
          )}

          {/* Company name for Google HR signup — show always when HR */}
          {mode === 'login' && role === 'hr' && (
            <div className="auth-field">
              <label>Company Name <span className="auth-optional">(for Google login)</span></label>
              <input
                type="text"
                placeholder="Acme Corp"
                value={form.company}
                onChange={set('company')}
              />
            </div>
          )}

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              required
              minLength={6}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider"><span>or</span></div>

        {/* Google button */}
        {GOOGLE_CLIENT_ID
          ? <div id="google-btn" className="auth-google-wrap" />
          : (
            <div className="auth-google-missing">
              Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable Google login
            </div>
          )
        }

        {/* Switch mode */}
        <div className="auth-switch">
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button type="button" onClick={() => setMode('signup')}>Sign up</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')}>Sign in</button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}