// candidate/ScoreScreen.jsx
import { useEffect, useRef, useState } from 'react';
import './ScoreScreen.css';

const VERDICT_COLOR = {
  Hire:       '#4ade80',
  Borderline: '#facc15',
  Reject:     '#f87171',
};

// ── Answer Improvements accordion ─────────────────────────────────────────────
function AnswerImprovements({ improvements, history = [] }) {
  const [openIdx, setOpenIdx] = useState(0);
  const answersByRound = new Map(
    history
      .filter((entry) => entry.role === 'you' || entry.role === 'candidate')
      .map((entry, index) => [Number(entry.round || index + 1), entry.text || ''])
  );

  if (!improvements?.length) return (
    <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '20px' }}>
      No improvement data available.
    </p>
  );

  return (
    <div className="ss-improvements">
      {improvements.map((item, i) => (
        <div key={i} className="ss-imp-card">
          <button
            className="ss-imp-header"
            onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
          >
            <span className="ss-imp-round">Round {item.round}</span>
            <span className="ss-imp-tip-preview">{item.tip}</span>
            <span className="ss-imp-chevron">{openIdx === i ? '▲' : '▼'}</span>
          </button>

              {openIdx === i && (
            <div className="ss-imp-body">
              <div className="ss-imp-section">
                <label>Your answer</label>
                <p className="ss-imp-original">{item.original || answersByRound.get(Number(item.round)) || ''}</p>
              </div>
              <div className="ss-imp-section">
                <label>Stronger answer</label>
                <p className="ss-imp-better">{item.improved}</p>
              </div>
              <div className="ss-imp-tip">💡 {item.tip}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ScoreScreen({ report, history, config, elapsed, onRetry }) {
  const [visible,      setVisible]      = useState(false);
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [activeTab,    setActiveTab]    = useState('overview');
  const canvasRef = useRef(null);

  const score   = report?.overallScore ?? 0;
  const verdict = report?.verdict      ?? 'Borderline';
  const color   = VERDICT_COLOR[verdict] ?? '#facc15';

  // Fade in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Count-up animation
  useEffect(() => {
    if (!visible) return;
    let current = 0;
    const step  = Math.ceil(score / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, score);
      setScoreDisplay(current);
      if (current >= score) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [visible, score]);

  // Arc canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width  = 200;
    const H = canvas.height = 200;
    const cx = W / 2, cy = H / 2, r = 80;

    ctx.clearRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth   = 10;
    ctx.lineCap     = 'round';
    ctx.stroke();

    const end = -Math.PI / 2 + (scoreDisplay / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, end);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 10;
    ctx.lineCap     = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur  = 18;
    ctx.stroke();
  }, [scoreDisplay, color]);

  const formatTime = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

  if (!report) {
    return (
      <div className="ss-root">
        <div className="ss-loading">
          <span className="ss-spinner" />
          <p>Generating your report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ss-root ${visible ? 'ss-visible' : ''}`}>

      <div className="ss-header">
        <span className="ss-logo">◉ mock.ai</span>
        <span className="ss-role">{config?.role} · {config?.difficulty}</span>
      </div>

      {/* Score arc */}
      <div className="ss-score-wrap">
        <canvas ref={canvasRef} className="ss-canvas" />
        <div className="ss-score-inner">
          <span className="ss-score-num">{scoreDisplay}</span>
          <span className="ss-score-label">/ 100</span>
        </div>
      </div>

      {/* Verdict */}
      <div className="ss-verdict" style={{ color, borderColor: color }}>
        {verdict}
      </div>

      {/* Tabs — always show, even if no improvements (shows empty state) */}
      <div className="ss-tabs">
        <button
          className={`ss-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`ss-tab ${activeTab === 'improvements' ? 'active' : ''}`}
          onClick={() => setActiveTab('improvements')}
        >
          📈 Answer Improvements
        </button>
      </div>

      {/* ── Overview tab ── */}
      {activeTab === 'overview' && (
        <>
          {report.summary && (
            <p className="ss-summary">{report.summary}</p>
          )}

          {report.roundScores?.length > 0 && (
            <div className="ss-rounds">
              {report.roundScores.map((s, i) => (
                <div key={i} className="ss-round-bar">
                  <span className="ss-round-label">R{i + 1}</span>
                  <div className="ss-bar-track">
                    <div
                      className="ss-bar-fill"
                      style={{
                        width: `${s}%`,
                        background: s >= 70 ? '#4ade80' : s >= 45 ? '#facc15' : '#f87171',
                      }}
                    />
                  </div>
                  <span className="ss-round-score">{s}</span>
                </div>
              ))}
            </div>
          )}

          <div className="ss-sw-grid">
            {report.strengths?.length > 0 && (
              <div className="ss-card ss-card--green">
                <h4>Strengths</h4>
                <ul>{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {report.weaknesses?.length > 0 && (
              <div className="ss-card ss-card--red">
                <h4>Areas to Improve</h4>
                <ul>{report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
          </div>

          {report.studyList?.length > 0 && (
            <div className="ss-study">
              <h4>Study These Next</h4>
              <div className="ss-tags">
                {report.studyList.map((t, i) => (
                  <span key={i} className="ss-tag">{t}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Improvements tab ── */}
      {activeTab === 'improvements' && (
        <AnswerImprovements improvements={report.answerImprovements} history={history} />
      )}

      <div className="ss-meta">
        Interview duration: {formatTime(elapsed ?? 0)}
      </div>

      <button className="ss-retry" onClick={onRetry}>
        Practice Again
      </button>
    </div>
  );
}
