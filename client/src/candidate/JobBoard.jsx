import { useEffect, useState } from 'react';
import { API_BASE } from '../api.js';
import './JobBoard.css';

function formatPostedDate(value) {
  if (!value) return 'recently';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function JobBoard({ onSelectJob, onHome, onAbout }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadJobs() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${API_BASE}/api/jobs`);
        const data = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(data?.error || 'Could not load open roles.');
        }

        if (!ignore) {
          setJobs(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Could not load open roles.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadJobs();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="job-board-page">
      <div className="role-grid-bg" />

      <header className="job-board-header">
        <button
          className="job-board-home"
          onClick={onHome}
          type="button"
        >
          Home
        </button>

        <div className="job-board-header-actions">
          {onAbout && (
            <button
              className="role-badge"
              onClick={onAbout}
              type="button"
            >
              About
            </button>
          )}

          <h2 className="job-board-heading">
            Open Roles
          </h2>
        </div>
      </header>

      <section className="job-board-hero">
        <div className="role-eyebrow">
          <span className="role-eyebrow-dot" />
          Candidate Job Board
        </div>

        <h1 className="job-board-title">
          Choose a role and start your interview.
        </h1>

        <p className="job-board-subtitle">
          These openings are posted by HR teams and connect directly
          into the resume-based interview flow.
        </p>
      </section>

      {loading && (
        <div className="job-board-loading">
          <div className="job-board-spinner" />
          <p>Loading open roles...</p>
        </div>
      )}

      {!loading && error && (
        <div className="job-board-empty">
          <strong>Could not load jobs.</strong>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="job-board-empty">
          No open roles right now - check back soon.
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <section className="job-board-grid" aria-label="Open roles">
          {jobs.map((job) => {
            const jdId = job._id?.toString?.() || job._id;

            return (
              <button
                className="job-board-card"
                key={jdId}
                onClick={() => onSelectJob?.(jdId)}
                type="button"
              >
                <div className="job-board-card-copy">
                  <span>{job.companyName || 'Company'}</span>
                  <h2>{job.title || 'Untitled role'}</h2>
                  <p>Posted {formatPostedDate(job.createdAt)}</p>
                </div>

                <span className="job-board-apply">
                  Apply
                </span>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
