import { useState } from 'react';
import './RoleSelector.css';

const roles = [
  { id: 'frontend',      label: 'Frontend',      icon: '⬡', desc: 'React, CSS, browser APIs, performance',        tags: ['React', 'DOM', 'CSS', 'Perf'] },
  { id: 'backend',       label: 'Backend',        icon: '⬢', desc: 'Node, databases, APIs, system design',         tags: ['Node', 'SQL', 'REST', 'Auth'] },
  { id: 'fullstack',     label: 'Fullstack',      icon: '◈', desc: 'End-to-end — both worlds, no hiding',          tags: ['Both', 'Deploy', 'Arch'] },
  { id: 'dsa',           label: 'DSA',            icon: '◎', desc: 'Algorithms, data structures, complexity',      tags: ['Arrays', 'Trees', 'DP', 'O(n)'] },
  { id: 'system_design', label: 'System Design',  icon: '⬛', desc: 'Scale, architecture, trade-offs, reliability', tags: ['Scale', 'CAP', 'DBs', 'APIs'] },
  { id: 'ai_engineer',   label: 'AI Engineer',    icon: '◆', desc: 'LLMs, RAG, fine-tuning, ML pipelines',        tags: ['LLMs', 'RAG', 'Vectors', 'MLOps'] },
  { id: 'hr',            label: 'HR Interview',   icon: '◇', desc: 'Behavioral, communication, personality',       tags: ['HR', 'Behavioral', 'Culture'] },
  { id: 'managerial',    label: 'Managerial',     icon: '○', desc: 'Leadership, ownership, decision making',       tags: ['Leadership', 'Ownership', 'Team'] },
];

const difficulties = [
  { id: 'fresher', label: 'Fresher', sub: '0–1 yrs' },
  { id: 'mid',     label: 'Mid',     sub: '2–4 yrs' },
  { id: 'senior',  label: 'Senior',  sub: '5+ yrs'  },
];

export default function RoleSelector({ onStart }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedDiff, setSelectedDiff] = useState('mid');

  const canStart = selectedRole !== null;
  const selected = roles.find(r => r.id === selectedRole);

  return (
    <div className="role-page">
      <div className="role-grid-bg" />
      <header className="role-header">
        <img src="/favicon.png" alt="Logo" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
        <span className="role-badge">BETA</span>
      </header>

      <div className="role-hero">
        <div className="role-eyebrow">
          <span className="role-eyebrow-dot" />
          AI Mock Interviews · Brutal. Honest. Effective.
        </div>
        <h1 className="role-title">
          Are you interview<br />
          <span className="role-title-accent">ready?</span>
        </h1>
        <p className="role-subtitle">7 rounds. No sugarcoating. A score that tells the truth.</p>
      </div>

      <section className="role-section">
        <label className="role-section-label">01 — Choose your role</label>
        <div className="role-cards-grid">
          {roles.map((role) => (
            <button
              key={role.id}
              className={`role-card ${selectedRole === role.id ? 'selected' : ''}`}
              onClick={() => setSelectedRole(role.id)}
            >
              <span className="role-card-icon">{role.icon}</span>
              <div className="role-card-info">
                <span className="role-card-label">{role.label}</span>
                <span className="role-card-desc">{role.desc}</span>
              </div>
              <div className="role-card-tags">
                {role.tags.map(t => <span key={t} className="role-tag">{t}</span>)}
              </div>
              {selectedRole === role.id && <span className="role-card-checkmark">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="role-section">
        <label className="role-section-label">02 — Set difficulty</label>
        <div className="diff-row">
          {difficulties.map((d) => (
            <button
              key={d.id}
              className={`diff-btn ${selectedDiff === d.id ? 'selected' : ''}`}
              onClick={() => setSelectedDiff(d.id)}
            >
              <span className="diff-btn-label">{d.label}</span>
              <span className="diff-btn-sub">{d.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="start-wrap">
        <button
          className={`start-btn ${canStart ? 'ready' : 'disabled'}`}
          onClick={() => canStart && onStart({ role: selectedRole, difficulty: selectedDiff })}
          disabled={!canStart}
        >
          {canStart ? <>Start Interview <span className="start-arrow">→</span></> : 'Pick a role to continue'}
        </button>
        {canStart && (
          <p className="start-meta">
            {selected?.label?.toUpperCase()} · {selectedDiff?.toUpperCase()} · 7 rounds · ~10 min
          </p>
        )}
      </div>

      <footer className="role-footer">Powered by Groq · Built to make you better</footer>
    </div>
  );
}