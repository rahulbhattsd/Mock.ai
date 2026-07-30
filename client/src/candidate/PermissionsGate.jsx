// candidate/PermissionsGate.jsx
// Step-by-step permissions: mic → camera → screen share
// Each permission is requested and confirmed before moving to the next
// Only when all three are granted does onReady() fire

import { useState, useEffect, useRef } from 'react';
import './PermissionsGate.css';

const STEPS = [
  {
    id:      'mic',
    icon:    '🎙',
    label:   'Microphone',
    desc:    'Arjun hears your answers through your mic.',
    why:     'Required — interview is voice-based',
    action:  'Allow Microphone',
  },
  {
    id:      'camera',
    icon:    '📷',
    label:   'Camera',
    desc:    'Your face is recorded alongside the interview.',
    why:     'Required — HR reviews your recording',
    action:  'Allow Camera',
  },
  {
    id:      'screen',
    icon:    '🖥',
    label:   'Screen Share',
    desc:    'Your full screen is recorded for the interview session.',
    why:     'Required — ensures interview integrity',
    action:  'Share Screen',
  },
];

export default function PermissionsGate({ onReady }) {
  // granted: { mic: bool, camera: bool, screen: bool }
  const [granted,  setGranted]  = useState({ mic: false, camera: false, screen: false });
  const [current,  setCurrent]  = useState(0);   // which step we're on
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [preview,  setPreview]  = useState(false); // show camera preview

  // Streams to hand off
  const micStreamRef    = useRef(null);
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const previewVideoRef = useRef(null);

  // When all granted, fire onReady
  useEffect(() => {
    if (granted.mic && granted.camera && granted.screen) {
      setTimeout(() => {
        onReady({
          micStream:    micStreamRef.current,
          cameraStream: cameraStreamRef.current,
          screenStream: screenStreamRef.current,
        });
      }, 800);
    }
  }, [granted, onReady]);

  const requestPermission = async (stepId) => {
    setLoading(true);
    setError(null);

    try {
      if (stepId === 'mic') {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          },
          video: false,
        });
        micStreamRef.current = stream;
        setGranted(g => ({ ...g, mic: true }));
        setCurrent(1);
      }

      else if (stepId === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        cameraStreamRef.current = stream;
        setGranted(g => ({ ...g, camera: true }));
        setPreview(true);
        // Attach to preview video
        setTimeout(() => {
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
            previewVideoRef.current.play().catch(() => {});
          }
        }, 100);
        setCurrent(2);
      }

      else if (stepId === 'screen') {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30, cursor: 'always' },
          audio: true,
        });
        screenStreamRef.current = stream;
        // Stop recording if user ends share
        stream.getVideoTracks()[0].onended = () => {
          setGranted(g => ({ ...g, screen: false }));
          setCurrent(2);
          setError('Screen share was stopped. Please share again to continue.');
        };
        setGranted(g => ({ ...g, screen: true }));
      }

    } catch (err) {
      const msg =
        err.name === 'NotAllowedError' ? `Permission denied. Please allow ${stepId} access in your browser settings.`
      : err.name === 'NotFoundError'   ? `No ${stepId} device found.`
      : `Error: ${err.message}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const allGranted = granted.mic && granted.camera && granted.screen;
  const step       = STEPS[current];

  return (
    <div className="pgate-root">
      <div className="pgate-grid-bg" />

      {/* Header */}
      <header className="pgate-header">
        <span className="pgate-logo">
  <img src="" alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
</span>
        <span className="pgate-badge">INTERVIEW SETUP</span>
      </header>

      <div className="pgate-body">

        {/* Left — steps */}
        <div className="pgate-left">
          <div className="pgate-intro">
            <h1 className="pgate-title">Before we begin</h1>
            <p className="pgate-sub">
              This interview is recorded. HR will review your session video, transcript, and AI score.
            </p>
          </div>

          {/* Step list */}
          <div className="pgate-steps">
            {STEPS.map((s, i) => {
              const isDone    = granted[s.id];
              const isActive  = i === current && !allGranted;
              const isLocked  = i > current && !granted[s.id];

              return (
                <div
                  key={s.id}
                  className={`pgate-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                >
                  <div className="pgate-step-icon-wrap">
                    <span className="pgate-step-icon">{s.icon}</span>
                    {isDone && <span className="pgate-step-check">✓</span>}
                  </div>

                  <div className="pgate-step-info">
                    <div className="pgate-step-top">
                      <span className="pgate-step-label">{s.label}</span>
                      <span className={`pgate-step-status ${isDone ? 'granted' : isActive ? 'pending' : 'waiting'}`}>
                        {isDone ? 'Granted' : isActive ? 'Required' : 'Waiting'}
                      </span>
                    </div>
                    <p className="pgate-step-desc">{s.desc}</p>
                    <span className="pgate-step-why">{s.why}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="pgate-error">
              <span className="pgate-error-icon">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* CTA Button */}
          {!allGranted ? (
            <button
              className={`pgate-btn ${loading ? 'loading' : ''}`}
              onClick={() => requestPermission(step.id)}
              disabled={loading}
            >
              {loading ? (
                <><span className="pgate-spinner" /> Requesting access...</>
              ) : (
                <>{step.icon} {step.action}</>
              )}
            </button>
          ) : (
            <div className="pgate-ready">
              <span className="pgate-ready-icon">◉</span>
              <span className="pgate-ready-text">All set — starting interview</span>
              <span className="pgate-ready-dots">
                <span /><span /><span />
              </span>
            </div>
          )}

          {/* Fine print */}
          <p className="pgate-legal">
            By continuing, you consent to this session being recorded and reviewed by the hiring team.
          </p>
        </div>

        {/* Right — camera preview */}
        <div className="pgate-right">
          <div className={`pgate-preview-wrap ${preview ? 'active' : ''}`}>
            {preview ? (
              <>
                <video
                  ref={previewVideoRef}
                  className="pgate-preview-video"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="pgate-preview-overlay">
                  <span className="pgate-preview-label">Your camera</span>
                  <span className="pgate-rec-dot" />
                </div>
              </>
            ) : (
              <div className="pgate-preview-placeholder">
                <span className="pgate-preview-ph-icon">📷</span>
                <span className="pgate-preview-ph-text">Camera preview will appear here</span>
              </div>
            )}
          </div>

          {/* What gets recorded info box */}
          <div className="pgate-info-box">
            <span className="pgate-info-title">What gets recorded</span>
            <ul className="pgate-info-list">
              <li><span className="pgate-info-dot accent" />Your full screen</li>
              <li><span className="pgate-info-dot accent" />Your webcam feed (PiP)</li>
              <li><span className="pgate-info-dot accent" />Your voice + transcript</li>
              <li><span className="pgate-info-dot accent" />AI scores per round</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
