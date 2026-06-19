// client/src/candidate/VoiceInterview.jsx
import { useState, useCallback, useEffect, useRef } from 'react';
import './VoiceInterview.css';
import WaveformRing      from '../components/WaveformRing.jsx';
import TranscriptFeed    from '../components/TranscriptFeed.jsx';
import useVAD            from '../hooks/useVAD.js';
import useAudioPlayer    from '../hooks/useAudioPlayer.js';
import useScreenRecorder from '../hooks/useScreenRecorder.js';
import { API_BASE, authHeaders } from '../api.js';

const TOTAL_ROUNDS = 7;

const STATE_TO_MODE = {
  idle:           'idle',
  arjun_thinking: 'processing',
  arjun_speaking: 'ammy-speaking',
  listening:      'listening',
  processing:     'processing',
  done:           'idle',
};

const STATUS_LABELS = {
  idle:           'Click mic to speak',
  arjun_thinking: 'Ammy is thinking...',
  arjun_speaking: 'Ammy is speaking',
  listening:      'Recording — click ➤ when done',
  processing:     'Processing...',
  done:           'Interview complete',
};

const FALLBACK_QUESTION =
  "Let's begin. Can you walk me through a challenging technical problem you've solved recently?";
const FALLBACK_RESPONSE =
  "Thank you for that answer. Let's continue with the next question.";

// ── Browser TTS ─────────────────────────────────────────────────────────────
function speakBrowser(text, onEnd) {
  if (!window.speechSynthesis || !text?.trim()) { onEnd?.(); return; }
  window.speechSynthesis.cancel();

  setTimeout(() => {
    const utt = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    const preferred = [
      "Samantha",
      "Google UK English Female",
      "Microsoft Sonia Online",
      "Microsoft Aria Online",
      "Karen",
      "Moira",
      "Microsoft Zira",
    ];

    const voice = preferred
      .map((name) => voices.find((v) => v.name.includes(name)))
      .find(Boolean);

    if (voice) utt.voice = voice;

    utt.rate   = 0.88;
    utt.pitch  = 1.1;
    utt.volume = 1;

    const watchdog = setTimeout(() => { onEnd?.(); }, Math.max(6000, text.length * 65));
    utt.onend   = () => { clearTimeout(watchdog); onEnd?.(); };
    utt.onerror = () => { clearTimeout(watchdog); onEnd?.(); };

    window.speechSynthesis.speak(utt);
  }, 80);
}

function speakWhenReady(text, onEnd) {
  const go = () => speakBrowser(text, onEnd);
  if (window.speechSynthesis.getVoices().length > 0) {
    go();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      go();
    };
    setTimeout(go, 1200);
  }
}

// ── Improvement Panel ────────────────────────────────────────────────────────
function ImprovementPanel({ improvements }) {
  const [open, setOpen] = useState(0);
  if (!improvements?.length) return null;
  return (
    <div className="vi-improve-panel">
      <h3 className="vi-improve-title">📈 Answer Improvements</h3>
      {improvements.map((item, i) => (
        <div key={i} className={`vi-improve-card ${open === i ? 'expanded' : ''}`}>
          <button className="vi-improve-header" onClick={() => setOpen(open === i ? -1 : i)}>
            <span>Round {item.round}</span>
            <span className="vi-improve-tip-preview">{item.tip}</span>
            <span>{open === i ? '▲' : '▼'}</span>
          </button>
          {open === i && (
            <div className="vi-improve-body">
              <div className="vi-improve-section">
                <label>Your answer</label>
                <p className="vi-improve-original">{item.original}</p>
              </div>
              <div className="vi-improve-section">
                <label>Stronger answer</label>
                <p className="vi-improve-better">{item.improved}</p>
              </div>
              <div className="vi-improve-tip">💡 {item.tip}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function VoiceInterview({ config, streams, onFinish }) {
  const [phase,        setPhase]        = useState('idle');
  const [round,        setRound]        = useState(1);
  const [elapsed,      setElapsed]      = useState(0);
  const [transcript,   setTranscript]   = useState([]);
  const [error,        setError]        = useState('');
  const [liveAnswer,   setLiveAnswer]   = useState('');
  const [improvements, setImprovements] = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const sessionIdRef     = useRef(null);
  const idCounter        = useRef(0);
  const timerRef         = useRef(null);
  const roundRef         = useRef(1);
  const pipVideoRef      = useRef(null);
  const browserTTSActive = useRef(false);
  const phaseRef         = useRef('idle');
  const interviewStarted = useRef(false);
  const onTranscriptRef  = useRef(null);
  const stableSessionId  = useRef(`pending_${Date.now()}`);
  const transcriptRef    = useRef([]);

  // ✅ KEY FIX: store elapsed in a ref so callbacks always read the latest value
  // without needing elapsed in their dependency arrays (which caused re-renders
  // that reset or froze the timer)
  const elapsedRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const appendTranscript = useCallback((entry) => {
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscript(transcriptRef.current);
  }, []);

  const replaceTranscript = useCallback((entries) => {
    transcriptRef.current = entries;
    setTranscript(entries);
  }, []);

  const { play, stop: stopAudio, isPlaying, analyser } = useAudioPlayer();

  const { isRecording } = useScreenRecorder({
    webcamStreamRef: { current: streams?.cameraStream ?? null },
    sessionId: sessionIdRef.current ?? stableSessionId.current,
  });

  // ── Webcam PiP ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pipVideoRef.current && streams?.cameraStream) {
      pipVideoRef.current.srcObject = streams.cameraStream;
      pipVideoRef.current.play().catch(() => {});
    }
  }, [streams]);

  // ── VAD state ─────────────────────────────────────────────────────────────
  const handleVADState = useCallback((s) => {
    console.log('[VAD→UI] state:', s);
    if (s === 'processing') {
      setPhase('processing');
      setError('');
    } else if (s === 'idle') {
      if (['listening', 'processing'].includes(phaseRef.current)) setPhase('idle');
    } else if (s === 'error') {
      setError('Transcription failed — check server is running');
      setPhase('idle');
    }
  }, []);

  const { startListening, stopListening, submitNow } = useVAD({
    onTranscript:  null,
    onStateChange: handleVADState,
  });

  // ── Speak helper ──────────────────────────────────────────────────────────
  const speakArjun = useCallback((text, audioBase64, onEnd) => {
    const safeText = text?.trim() || FALLBACK_RESPONSE;
    console.log('[TTS] speaking:', safeText.slice(0, 60));
    if (audioBase64) {
      browserTTSActive.current = false;
      play(audioBase64);
    } else {
      browserTTSActive.current = true;
      setPhase('arjun_speaking');
      speakWhenReady(safeText, () => {
        console.log('[TTS] done');
        browserTTSActive.current = false;
        onEnd?.();
      });
    }
  }, [play]);

  // ── Handle transcript ─────────────────────────────────────────────────────
  // ✅ KEY FIX: removed `elapsed` from dependency array entirely.
  // We read elapsedRef.current instead — always fresh, never stale,
  // and does NOT cause this callback to be recreated on every tick.
  const handleTranscript = useCallback(async (text) => {
    const currentRound = roundRef.current;
    console.log('[Interview] round', currentRound, 'transcript:', text);
    setError('');
    setLiveAnswer('');

    idCounter.current++;
    appendTranscript({
      role: 'you',
      text,
      round: currentRound,
      id: idCounter.current,
    });
    setPhase('arjun_thinking');

    try {
      const res = await fetch(`${API_BASE}/api/voice-respond`, {
        method:  'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          sessionId:  sessionIdRef.current,
          transcript: text,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server ${res.status}`);
      }

      const data = await res.json();
      const responseText = data.response?.trim() || FALLBACK_RESPONSE;

      idCounter.current++;
      appendTranscript({
        role: 'arjun',
        text: responseText,
        round: data.round,
        id: idCounter.current,
      });

      // ── Done ──────────────────────────────────────────────────────────────
      if (data.done || currentRound >= TOTAL_ROUNDS) {
        setPhase('done');

        // ✅ Stop the timer using the ref (not a stale closure variable)
        clearInterval(timerRef.current);
        timerRef.current = null;

        speakArjun(responseText, data.audio, async () => {
          try {
            const rRes = await fetch(`${API_BASE}/api/report`, {
              method:  'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ sessionId: sessionIdRef.current }),
            });
            if (!rRes.ok) {
              const errData = await rRes.json().catch(() => ({}));
              throw new Error(errData.error || `Server ${rRes.status}`);
            }
            const report = await rRes.json();
            if (report.answerImprovements?.length) {
              setImprovements(report.answerImprovements);
            }
            // ✅ Read elapsed from ref — always the real current value
            onFinish({ sessionId: sessionIdRef.current, config, elapsed: elapsedRef.current, report, history: transcriptRef.current });
          } catch {
            onFinish({ sessionId: sessionIdRef.current, config, elapsed: elapsedRef.current, report: null, history: transcriptRef.current });
          }
        });
        return;
      }

      // ── Next round ────────────────────────────────────────────────────────
      const next = currentRound + 1;
      roundRef.current = next;
      setRound(next);

      speakArjun(responseText, data.audio, () => {
        setPhase('idle');
      });

      if (data.audio) setPhase('arjun_speaking');

    } catch (err) {
      console.error('[Interview] voice-respond error:', err);
      setError(`Error: ${err.message} — is the server running?`);
      setPhase('idle');
    }
  // ✅ `elapsed` removed from deps — we use elapsedRef instead
  }, [appendTranscript, config, speakArjun, onFinish]);

  useEffect(() => { onTranscriptRef.current = handleTranscript; }, [handleTranscript]);

  useEffect(() => {
    if (phase === 'arjun_speaking' && !isPlaying && !browserTTSActive.current) {
      setPhase('idle');
    }
  }, [isPlaying, phase]);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (interviewStarted.current) return;
    interviewStarted.current = true;

    // ✅ Timer increments both the display state AND the ref
    // The ref is what callbacks read; the state is what the UI renders.
    // This decouples "reading elapsed" from "causing re-renders".
    const interval = setInterval(() => {
      elapsedRef.current += 1;          // always up to date, no re-render
      setElapsed(elapsedRef.current);   // triggers UI update only
    }, 1000);

    timerRef.current = interval;

    beginInterview();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopListening();
      stopAudio();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Begin interview ───────────────────────────────────────────────────────
  const beginInterview = async () => {
    setPhase('arjun_thinking');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/voice-start`, {
        method:  'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          role:          config.role,
          difficulty:    config.difficulty,
          candidateName: config.name ?? 'Candidate',
        }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      sessionIdRef.current = data.sessionId;
      const questionText = data.question?.trim() || FALLBACK_QUESTION;
      idCounter.current++;
      replaceTranscript([{ role: 'arjun', text: questionText, round: data.round || 1, id: idCounter.current }]);
      speakArjun(questionText, data.audio, () => setPhase('idle'));
      setPhase('arjun_speaking');
    } catch (err) {
      console.error('[Interview] voice-start failed:', err);
      setError(`Could not connect to server (${err.message}).`);
      idCounter.current++;
      replaceTranscript([{ role: 'arjun', text: FALLBACK_QUESTION, round: 1, id: idCounter.current }]);
      speakWhenReady(FALLBACK_QUESTION, () => setPhase('idle'));
      setPhase('arjun_speaking');
    }
  };

  // ── Button handlers ───────────────────────────────────────────────────────
  const handleMicClick = useCallback(() => {
    if (phase === 'idle') {
      startListening({ onTranscript: (t) => onTranscriptRef.current?.(t) });
      setPhase('listening');
      setLiveAnswer('');
    } else if (phase === 'listening') {
      stopListening();
      setPhase('idle');
      setLiveAnswer('');
    }
  }, [phase, startListening, stopListening]);

  const handleSend = useCallback(() => {
    if (phase !== 'listening') return;
    submitNow();
  }, [phase, submitNow]);

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const ringMode    = STATE_TO_MODE[phase] ?? 'idle';
  const statusLabel = STATUS_LABELS[phase] ?? '';
  const progress    = (round / TOTAL_ROUNDS) * 100;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="vi-root">

      {/* Top bar */}
      <div className="vi-topbar">
        <div className="vi-topbar-left">
          <span className="vi-logo"><span className="vi-logo-dot">◉</span> mock.ai</span>
          <div className="vi-divider" />
          <span className="vi-role-tag">
            {config.role?.toUpperCase()} · {config.difficulty?.toUpperCase()}
          </span>
        </div>
        <div className="vi-topbar-right">
          {isRecording && (
            <span className="vi-rec-badge"><span className="vi-rec-dot" /> REC</span>
          )}
          <div className="vi-round-badge">
            <span className="vi-round-cur">{round}</span>
            <span className="vi-round-sep">/</span>
            <span className="vi-round-tot">{TOTAL_ROUNDS}</span>
          </div>
          <div className="vi-divider" />
          <span className="vi-timer">⏱ {formatTime(elapsed)}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="vi-progress-track">
        <div className="vi-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="vi-error-banner">
          ⚠️ {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Stage */}
      <div className="vi-stage">
        <div className="vi-avatar-wrap">
          <WaveformRing analyser={analyser} mode={ringMode} />
          <div className={`vi-avatar ${phase === 'arjun_speaking' ? 'speaking' : ''}`}>
            <span className="vi-avatar-letter">A</span>
          </div>
        </div>

        <div className="vi-identity">
          <span className="vi-name">Ammy</span>
          <span className="vi-title">Senior Engineer · 10 yrs</span>
        </div>

        <div className={`vi-status-wrap ${statusLabel ? 'visible' : ''}`}>
          <span className={`vi-status-dot ${phase}`} />
          <span className="vi-status-label">{statusLabel}</span>
        </div>

        {/* Live answer preview while recording */}
        {phase === 'listening' && (
          <div className="vi-live-answer">
            <span className="vi-live-dot" />
            <span className="vi-live-text">
              {liveAnswer || 'Listening... speak your answer'}
            </span>
          </div>
        )}

        {(phase === 'idle' || phase === 'listening') && (
          <div className="vi-mic-wrap">
            <button
              className={`vi-mic-btn ${phase === 'listening' ? 'active' : ''}`}
              onClick={handleMicClick}
              title={phase === 'listening' ? 'Cancel' : 'Start speaking'}
            >
              {phase === 'listening' ? <MicActiveIcon /> : <MicIcon />}
            </button>
            {phase === 'listening' && (
              <button className="vi-send-btn" onClick={handleSend} title="Submit answer">
                <SendIcon />
              </button>
            )}
          </div>
        )}

        {(phase === 'arjun_thinking' || phase === 'processing') && (
          <div className="vi-spinner-wrap">
            <span className="vi-spinner" />
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="vi-transcript-wrap">
        <TranscriptFeed entries={transcript} />
      </div>

      {/* Improvement panel — shown after interview ends */}
      {phase === 'done' && improvements && (
        <ImprovementPanel improvements={improvements} />
      )}

      {/* Webcam PiP */}
      {streams?.cameraStream && (
        <div className="vi-pip-wrap">
          <video ref={pipVideoRef} className="vi-pip-video" autoPlay playsInline muted />
          <div className="vi-pip-overlay">
            {isRecording && (
              <span className="vi-pip-rec"><span className="vi-rec-dot-sm" /> REC</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="9"  y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function MicActiveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="9"  y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
