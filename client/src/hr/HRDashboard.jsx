import { useState } from 'react';
import JobPostings from './JobPostings.jsx';
import CandidateList from './CandidateList.jsx';
import './HRDashboard.css';

export default function HRDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('jobs');
  const [selectedJdId, setSelectedJdId] = useState('');

  const openCandidates = (jdId = '') => {
    setSelectedJdId(jdId);
    setActiveTab('candidates');
  };

  return (
    <main className="hr-dashboard">
      <div className="hr-grid-bg" />

      <header className="hr-dashboard-header">
        <div className="hr-brand">
          <span className="hr-brand-mark">o</span>
          <span>mock<span className="hr-brand-dot">.</span>ai</span>
        </div>

        <div className="hr-header-actions">
          <div className="hr-company">
            <span className="hr-company-label">Company</span>
            <strong>{user?.company || user?.name || 'HR workspace'}</strong>
          </div>
          <button className="hr-signout" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <section className="hr-dashboard-hero">
        <div>
          <p className="hr-eyebrow"><span /> Hiring command center</p>
          <h1>Review roles and candidates.</h1>
        </div>

        <nav className="hr-tabs" aria-label="HR dashboard sections">
          <button
            className={activeTab === 'jobs' ? 'active' : ''}
            onClick={() => setActiveTab('jobs')}
          >
            Job Postings
          </button>
          <button
            className={activeTab === 'candidates' ? 'active' : ''}
            onClick={() => openCandidates('')}
          >
            Candidates
          </button>
        </nav>
      </section>

      {activeTab === 'jobs' ? (
        <JobPostings onOpenCandidates={openCandidates} />
      ) : (
        <CandidateList initialJdId={selectedJdId} onClearJd={() => setSelectedJdId('')} />
      )}
    </main>
  );
}
