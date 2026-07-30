import { useEffect, useMemo, useState } from 'react';
import { hrFetch, hrFetchBlob } from './hrApi.js';
import './CandidateDetail.css';

const VERDICT_COLOR = {
  Hire: '#4ade80',
  Borderline: '#facc15',
  Reject: '#f87171',
};

function toList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function scoreColor(score) {
  if (score >= 70) return '#4ade80';
  if (score >= 45) return '#facc15';
  return '#f87171';
}

function ChipList({ items, emptyText }) {
  const list = toList(items);

  if (!list.length) {
    return <p className="detail-muted">{emptyText}</p>;
  }

  return (
    <div className="detail-chips">
      {list.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

function DetailList({ items, emptyText }) {
  const list = toList(items);

  if (!list.length) {
    return <p className="detail-muted">{emptyText}</p>;
  }

  return (
    <ul className="detail-list">
      {list.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ul>
  );
}

export default function CandidateDetail({ sessionId, onBack, onOpenJobPostings }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [shortlisted, setShortlisted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openingResume, setOpeningResume] = useState(false);

  useEffect(() => {
    async function loadCandidate() {
      setLoading(true);
      setError('');

      try {
        const data = await hrFetch(`/api/hr/candidate/${sessionId}`);
        setSession(data);
        setNote(data.hrNote?.note || '');
        setShortlisted(Boolean(data.hrNote?.shortlisted));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCandidate();
  }, [sessionId]);

  const report = useMemo(() => session?.report || {
    overallScore: session?.overallScore,
    verdict: session?.aiVerdict,
    roundScores: session?.roundScores,
  }, [session]);

  async function saveNote(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      await hrFetch(`/api/hr/candidate/${sessionId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, shortlisted }),
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function viewResume() {
    if (!session?.resumeFileId) return;

    setOpeningResume(true);
    setError('');

    try {
      const blob = await hrFetchBlob(`/api/hr/candidate/${sessionId}/resume`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setError(err.message);
    } finally {
      setOpeningResume(false);
    }
  }

  if (loading) {
    return <section className="hr-panel candidate-detail"><div className="hr-empty">Loading candidate...</div></section>;
  }

  if (error && !session) {
    return (
      <section className="hr-panel candidate-detail">
        <div className="detail-nav">
          <button className="detail-back" onClick={onBack}>Back to candidates</button>
          <button className="detail-back secondary" onClick={onOpenJobPostings}>Job Postings</button>
        </div>
        <div className="hr-error">{error}</div>
      </section>
    );
  }

  const context = session?.interviewContext || {};
  const candidate = context.candidate || {};
  const matchSignals = context.matchSignals || {};
  const projects = toList(candidate.projects);
  const score = Number(report?.overallScore || 0);
  const verdict = report?.verdict || session?.aiVerdict || 'Borderline';
  const verdictColor = VERDICT_COLOR[verdict] || VERDICT_COLOR.Borderline;

  return (
    <section className="hr-panel candidate-detail">
      <div className="detail-nav">
        <button className="detail-back" onClick={onBack}>Back to candidates</button>
        <button className="detail-back secondary" onClick={onOpenJobPostings}>Job Postings</button>
      </div>

      <div className="detail-title-row">
        <div>
          <p className="hr-section-kicker">Candidate file</p>
          <h2>{session.candidateName || candidate.name || 'Candidate'}</h2>
          <span>{session.jdTitle || context.job?.title || session.role}</span>
        </div>

        <div className="score-ring" style={{ '--score': `${score * 3.6}deg`, '--score-color': verdictColor }}>
          <strong>{score || 'N/A'}</strong>
          <small>{verdict}</small>
        </div>
      </div>

      {error && <div className="hr-error">{error}</div>}

      <div className="detail-grid">
        <article className="detail-card">
          <div className="report-heading">
            <h3>Resume context</h3>
            <button
              className="resume-view-btn"
              type="button"
              onClick={viewResume}
              disabled={!session.resumeFileId || openingResume}
            >
              {openingResume ? 'Opening...' : 'View resume'}
            </button>
          </div>
          <div className="context-metric">
            <span>Experience</span>
            <strong>{candidate.yearsExperience ?? 'N/A'} years</strong>
          </div>
          <h4>Skills</h4>
          <ChipList items={candidate.skills} emptyText="No resume skills extracted." />
          <h4>Projects</h4>
          {projects.length ? (
            <div className="project-list">
              {projects.map((project, index) => (
                <div key={`${project.name}-${index}`}>
                  <strong>{project.name}</strong>
                  <p>{project.oneLineDescription}</p>
                  <ChipList items={project.techStack} emptyText="No stack listed." />
                </div>
              ))}
            </div>
          ) : (
            <p className="detail-muted">No projects extracted.</p>
          )}
        </article>

        <article className="detail-card">
          <h3>JD match signals</h3>
          <h4>Overlap skills</h4>
          <ChipList items={matchSignals.overlapSkills} emptyText="No overlap skills extracted." />
          <h4>Gap skills</h4>
          <ChipList items={matchSignals.gapSkills} emptyText="No gap skills extracted." />
          {matchSignals.strongestProject && (
            <div className="context-callout">
              <span>Strongest project</span>
              <p>{matchSignals.strongestProject}</p>
            </div>
          )}
        </article>
      </div>

      <article className="detail-card report-card">
        <div className="report-heading">
          <h3>Scoring report</h3>
          <span className="verdict-label" style={{ color: verdictColor, borderColor: verdictColor }}>
            {verdict}
          </span>
        </div>

        {report?.summary && <p className="report-summary">{report.summary}</p>}

        <div className="round-bars">
          {toList(report?.roundScores).map((roundScore, index) => (
            <div className="round-row" key={`${roundScore}-${index}`}>
              <span>R{index + 1}</span>
              <div><i style={{ width: `${roundScore}%`, background: scoreColor(roundScore) }} /></div>
              <strong>{roundScore}</strong>
            </div>
          ))}
        </div>

        <div className="report-columns">
          <div>
            <h4>Strengths</h4>
            <DetailList items={report?.strengths} emptyText="No strengths returned." />
          </div>
          <div>
            <h4>Weaknesses</h4>
            <DetailList items={report?.weaknesses} emptyText="No weaknesses returned." />
          </div>
        </div>

        <h4>Answer improvements</h4>
        <div className="improvement-list">
          {toList(report?.answerImprovements).length ? (
            report.answerImprovements.map((item) => (
              <div key={item.round}>
                <strong>Round {item.round}</strong>
                <p>{item.improved}</p>
                <span>{item.tip}</span>
              </div>
            ))
          ) : (
            <p className="detail-muted">No answer improvements returned.</p>
          )}
        </div>
      </article>

      <form className="detail-card note-card" onSubmit={saveNote}>
        <div className="report-heading">
          <h3>HR note</h3>
          {saved && <span className="saved-label">Saved</span>}
        </div>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add private screening notes for this candidate."
          rows={5}
        />

        <div className="note-actions">
          <label>
            <input
              type="checkbox"
              checked={shortlisted}
              onChange={(event) => setShortlisted(event.target.checked)}
            />
            Shortlist candidate
          </label>
          <button className="hr-primary-btn" disabled={saving}>{saving ? 'Saving...' : 'Save note'}</button>
        </div>
      </form>
    </section>
  );
}
