// components/FeedbackReport.jsx
import { useEffect, useRef, useState } from 'react';

const VERDICT_COLOR = {
  Hire:       '#4ade80',
  Borderline: '#facc15',
  Reject:     '#f87171',
};

function AnswerImprovements({ improvements }) {
  const [openIdx, setOpenIdx] = useState(0);

  if (!improvements?.length) {
    return (
      <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '24px 0' }}>
        No improvement data returned from AI.
      </p>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {improvements.map((item, i) => (
        <div key={i} style={{
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          marginBottom: 10,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.85rem',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: 600, minWidth: 65 }}>Round {item.round}</span>
            <span style={{
              flex: 1, color: 'rgba(255,255,255,0.38)', fontSize: '0.78rem',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{item.tip}</span>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
              {openIdx === i ? '▲' : '▼'}
            </span>
          </button>

          {openIdx === i && (
            <div style={{
              padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>
                  Your answer
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.84rem', lineHeight: 1.55, margin: 0 }}>
                  {item.original}
                </p>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>
                  Stronger answer
                </div>
                <p style={{ color: 'rgba(100,220,130,0.9)', fontSize: '0.84rem', lineHeight: 1.55, margin: 0 }}>
                  {item.improved}
                </p>
              </div>
              <div style={{
                fontSize: '0.8rem', color: 'rgba(250,200,80,0.85)',
                background: 'rgba(250,200,80,0.07)', borderRadius: 6, padding: '8px 12px',
              }}>
                💡 {item.tip}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FeedbackReport({ sessionData, report, onRetry }) {
  const [visible,      setVisible]      = useState(false);
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [activeTab,    setActiveTab]    = useState('overview');
  const canvasRef = useRef(null);

  const score   = report?.overallScore ?? 0;
  const verdict = report?.verdict      ?? 'Borderline';
  const color   = VERDICT_COLOR[verdict] ?? '#facc15';
  const elapsed = sessionData?.elapsed ?? 0;
  const config  = sessionData?.config  ?? {};

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

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
    ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.stroke();

    const end = -Math.PI / 2 + (scoreDisplay / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, end);
    ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.stroke();
  }, [scoreDisplay, color]);

  const fmt = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

  if (!report) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080808', color: '#fff', gap: 16 }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#e8ff47', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Generating your report...</p>
      </div>
    );
  }

  const S = (style) => style; // passthrough helper for inline styles

  return (
    <div style={{
      minHeight: '100vh', background: '#080808', color: '#fff',
      fontFamily: 'inherit', overflowY: 'auto', paddingBottom: 60,
      opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em' }}>◉ mock.ai</span>
        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
          {config.role} · {config.difficulty}
        </span>
      </div>

      {/* Score arc */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0 16px' }}>
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1 }}>{scoreDisplay}</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>/ 100</span>
          </div>
        </div>

        {/* Verdict */}
        <div style={{
          marginTop: 12, padding: '6px 20px', borderRadius: 20,
          border: `1px solid ${color}`, color, fontSize: '0.9rem', fontWeight: 600,
        }}>
          {verdict}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '16px 0 8px' }}>
        {['overview', 'improvements'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 22px', borderRadius: 20, cursor: 'pointer', fontSize: '0.84rem',
            border: '1px solid rgba(255,255,255,0.15)',
            background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: activeTab === tab ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
          }}>
            {tab === 'overview' ? 'Overview' : '📈 Answer Improvements'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px' }}>

        {/* ── Overview tab ── */}
        {activeTab === 'overview' && (
          <>
            {report.summary && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6, margin: '16px 0 24px' }}>
                {report.summary}
              </p>
            )}

            {/* Round scores */}
            {report.roundScores?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                {report.roundScores.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', width: 28 }}>R{i+1}</span>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${s}%`, borderRadius: 3,
                        background: s >= 70 ? '#4ade80' : s >= 45 ? '#facc15' : '#f87171',
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', width: 24, textAlign: 'right' }}>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Strengths + Weaknesses */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {report.strengths?.length > 0 && (
                <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                  <h4 style={{ color: '#4ade80', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Strengths</h4>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {report.strengths.map((s, i) => (
                      <li key={i} style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginBottom: 4, lineHeight: 1.45 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.weaknesses?.length > 0 && (
                <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                  <h4 style={{ color: '#f87171', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Areas to Improve</h4>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {report.weaknesses.map((w, i) => (
                      <li key={i} style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginBottom: 4, lineHeight: 1.45 }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Study list */}
            {report.studyList?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Study These Next</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {report.studyList.map((t, i) => (
                    <span key={i} style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Improvements tab ── */}
        {activeTab === 'improvements' && (
          <AnswerImprovements improvements={report.answerImprovements} />
        )}

        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', margin: '20px 0 16px' }}>
          Interview duration: {fmt(elapsed)}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={onRetry} style={{
            padding: '12px 32px', borderRadius: 10, background: '#e8ff47',
            color: '#000', fontWeight: 700, fontSize: '0.9rem', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Practice Again
          </button>
        </div>
      </div>
    </div>
  );
}