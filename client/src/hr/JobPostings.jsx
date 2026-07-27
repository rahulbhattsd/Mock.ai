import { useEffect, useMemo, useState } from 'react';
import { hrFetch } from './hrApi.js';
import './JobPostings.css';

function getPostingId(posting) {
  return posting?._id || posting?.jdId || posting?.id || '';
}

function scoreText(score) {
  return Number.isFinite(Number(score)) ? Math.round(Number(score)) : 'N/A';
}

export default function JobPostings({ onOpenCandidates }) {
  const [postings, setPostings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [form, setForm] = useState({ title: '', jdText: '' });

  const origin = useMemo(() => window.location.origin, []);

  async function loadPostings() {
    setLoading(true);
    setError('');

    try {
      const data = await hrFetch('/api/hr/jds');
      setPostings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPostings();
  }, []);

  async function createPosting(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = await hrFetch('/api/hr/jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      setPostings((current) => [data, ...current]);
      setForm({ title: '', jdText: '' });
      setFormOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(posting, status) {
    const id = getPostingId(posting);
    setError('');

    try {
      const data = await hrFetch(`/api/hr/jd/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      setPostings((current) =>
        current.map((item) => (getPostingId(item) === id ? { ...item, ...data } : item))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyShareLink(posting, event) {
    const id = getPostingId(posting);
    const link = `${origin}/apply/${id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        throw new Error('Clipboard unavailable');
      }
    } catch {
      event.currentTarget.previousElementSibling?.select();
      document.execCommand('copy');
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(''), 1400);
  }

  return (
    <section className="hr-panel jobs-panel">
      <div className="hr-section-head">
        <div>
          <p className="hr-section-kicker">Open roles</p>
          <h2>Job Postings</h2>
        </div>
        <button className="hr-primary-btn" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? 'Cancel' : '+ New Posting'}
        </button>
      </div>

      {formOpen && (
        <form className="job-form" onSubmit={createPosting}>
          <label>
            <span>Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Senior Frontend Engineer"
              maxLength={140}
              required
            />
          </label>

          <label>
            <span>Job description</span>
            <textarea
              value={form.jdText}
              onChange={(event) => setForm((current) => ({ ...current, jdText: event.target.value }))}
              placeholder="Paste responsibilities, required skills, seniority, and interview focus."
              rows={8}
              minLength={20}
              required
            />
          </label>

          <button className="hr-primary-btn" disabled={saving}>
            {saving ? 'Creating...' : 'Create posting'}
          </button>
        </form>
      )}

      {error && <div className="hr-error">{error}</div>}
      {loading && <div className="hr-empty">Loading postings...</div>}

      {!loading && postings.length === 0 && (
        <div className="hr-empty">No postings yet. Create the first role to start collecting applicants.</div>
      )}

      <div className="jobs-grid">
        {postings.map((posting) => {
          const id = getPostingId(posting);
          const shareLink = `${origin}/apply/${id}`;
          const isClosed = posting.status === 'closed';

          return (
            <article className="job-card" key={id}>
              <div className="job-card-top">
                <h3>{posting.title}</h3>
                <span className={`status-badge ${isClosed ? 'closed' : 'active'}`}>
                  {isClosed ? 'Closed' : 'Active'}
                </span>
              </div>

              <div className="job-stats">
                <div>
                  <span>{posting.applicantCount || 0}</span>
                  <small>Applicants</small>
                </div>
                <div>
                  <span>{scoreText(posting.avgScore)}</span>
                  <small>Avg score</small>
                </div>
              </div>

              <div className="share-link">
                <input value={shareLink} readOnly />
                <button onClick={(event) => copyShareLink(posting, event)}>
                  {copiedId === id ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="job-actions">
                <button onClick={() => onOpenCandidates(id)}>View candidates</button>
                <label className="status-toggle">
                  <input
                    type="checkbox"
                    checked={isClosed}
                    onChange={(event) => updateStatus(posting, event.target.checked ? 'closed' : 'active')}
                  />
                  <span>Close applications</span>
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
