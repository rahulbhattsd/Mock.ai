import { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from '../api.js';
import './JDInterviewSetup.css';

const MAX_RESUME_SIZE_BYTES = 3 * 1024 * 1024;

export default function JDInterviewSetup({ jdId, onStart, initialError = '' }) {
  const [posting, setPosting] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadPosting() {
      setLoading(true);
      setError('');

      try {
        const res = await fetch(`${API_BASE}/api/apply/${encodeURIComponent(jdId)}`, {
          headers: authHeaders(),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'This application link is not available.');
        }

        if (active) setPosting(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPosting();
    return () => { active = false; };
  }, [jdId]);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setResumeFile(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      setResumeFile(null);
      setError('Please upload a PDF resume.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setResumeFile(null);
      setError('Resume file exceeds the 3MB limit.');
      event.target.value = '';
      return;
    }

    setResumeFile(file);
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!posting || posting.status !== 'active') {
      setError('This application link is not currently accepting candidates.');
      return;
    }

    if (!resumeFile) {
      setError('Upload your resume to begin this JD-based interview.');
      return;
    }

    onStart({
      interviewType: 'jd_based',
      jdId,
      jdTitle: posting.title,
      resumeFile,
    });
  };

  const title = posting?.title || 'this role';

  return (
    <div className="jd-setup-page">
      <div className="jd-setup-grid-bg" />

      <header className="jd-setup-header">
        <img src="/favicon.png" alt="Logo" className="jd-setup-logo" />
        <span className="jd-setup-badge">JD Interview</span>
      </header>

      <main className="jd-setup-main">
        <div className="jd-setup-eyebrow">
          <span className="jd-setup-dot" />
          Candidate application
        </div>

        <h1 className="jd-setup-title">
          Apply for <span>{loading ? '...' : title}</span>
        </h1>
        <p className="jd-setup-subtitle">
          Upload your resume to begin. The interview questions are personalized against this posting.
        </p>

        <form className="jd-setup-form" onSubmit={handleSubmit}>
          <label className={`jd-resume-upload ${resumeFile ? 'has-file' : ''}`}>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleResumeChange}
              disabled={loading || posting?.status !== 'active'}
            />
            <span className="jd-resume-title">
              {resumeFile ? resumeFile.name : 'Upload resume'}
            </span>
            <span className="jd-resume-meta">Required PDF - Max 3MB</span>
          </label>

          {error && <div className="jd-setup-error">{error}</div>}

          <button
            className={`jd-start-btn ${resumeFile && posting?.status === 'active' ? 'ready' : 'disabled'}`}
            type="submit"
            disabled={loading || posting?.status !== 'active'}
          >
            {posting?.status === 'closed' ? 'Applications closed' : 'Begin JD interview'}
          </button>
        </form>
      </main>
    </div>
  );
}
