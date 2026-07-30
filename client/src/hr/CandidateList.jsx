import { useEffect, useState } from 'react';
import CandidateDetail from './CandidateDetail.jsx';
import { hrFetch } from './hrApi.js';
import './CandidateList.css';

const VERDICT_CLASS = {
  Hire: 'hire',
  Borderline: 'borderline',
  Reject: 'reject',
};

function getCandidateId(candidate) {
  return candidate?._id || candidate?.id || '';
}

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(value));
}

function reportVerdict(candidate) {
  return candidate?.report?.verdict || candidate?.aiVerdict || 'Borderline';
}

export default function CandidateList({ initialJdId, onClearJd, onOpenJobPostings }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [role, setRole] = useState('');
  const [minScore, setMinScore] = useState('');
  const [jdId, setJdId] = useState(initialJdId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setJdId(initialJdId || '');
    setSelectedId('');
  }, [initialJdId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (role.trim()) params.set('role', role.trim());
    if (minScore) params.set('minScore', minScore);
    if (jdId) params.set('jdId', jdId);

    async function loadCandidates() {
      setLoading(true);
      setError('');

      try {
        const query = params.toString();
        const data = await hrFetch(`/api/hr/candidates${query ? `?${query}` : ''}`);
        setCandidates(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCandidates();
  }, [role, minScore, jdId]);

  if (selectedId) {
    return (
      <CandidateDetail
        sessionId={selectedId}
        onBack={() => setSelectedId('')}
        onOpenJobPostings={onOpenJobPostings}
      />
    );
  }

  const clearJdFilter = () => {
    setJdId('');
    onClearJd?.();
  };

  return (
    <section className="hr-panel candidates-panel">
      <div className="hr-section-head candidate-head">
        <div>
          <p className="hr-section-kicker">Applicant review</p>
          <h2>Candidates</h2>
        </div>

        <div className="candidate-filters">
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Filter role"
          />
          <input
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            placeholder="Min score"
            type="number"
            min="0"
            max="100"
          />
        </div>
      </div>

      {jdId && (
        <div className="active-filter">
          Showing candidates for one posting
          <button onClick={clearJdFilter}>Clear</button>
        </div>
      )}

      {error && <div className="hr-error">{error}</div>}
      {loading && <div className="hr-empty">Loading candidates...</div>}

      {!loading && candidates.length === 0 && (
        <div className="hr-empty">No completed JD-based candidates match these filters.</div>
      )}

      {!loading && candidates.length > 0 && (
        <div className="candidate-table-wrap">
          <table className="candidate-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>JD applied</th>
                <th>Score</th>
                <th>Verdict</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const verdict = reportVerdict(candidate);
                const id = getCandidateId(candidate);

                return (
                  <tr key={id} onClick={() => setSelectedId(id)}>
                    <td>
                      <strong>{candidate.candidateName || candidate.interviewContext?.candidate?.name || 'Candidate'}</strong>
                      <span>{candidate.role || 'Interview session'}</span>
                    </td>
                    <td>{candidate.jdTitle || candidate.interviewContext?.job?.title || 'JD posting'}</td>
                    <td>{candidate.overallScore ?? candidate.report?.overallScore ?? 'N/A'}</td>
                    <td>
                      <span className={`verdict-pill ${VERDICT_CLASS[verdict] || 'borderline'}`}>
                        {verdict}
                      </span>
                    </td>
                    <td>{formatDate(candidate.completedAt || candidate.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
