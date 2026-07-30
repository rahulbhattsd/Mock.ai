// hooks/useScreenRecorder.js
// Canvas compositor: draws screen capture + webcam PiP every frame
// Records via MediaRecorder → Blob → uploads to /api/upload-recording
//
// Usage:
//   const { start, stop, isRecording, error } = useScreenRecorder({ webcamStream, sessionId })

import { useRef, useState, useCallback } from 'react';
import { API_BASE, authHeaders } from '../api.js';

const FPS          = 30;
const WEBM_MIME    = 'video/webm;codecs=vp9,opus';
const FALLBACK_MIME = 'video/webm';

// PiP position: bottom-right corner
const PIP = {
  widthRatio:  0.22,   // 22% of canvas width
  margin:      16,
  borderRadius: 12,
  borderWidth:  2,
};

export default function useScreenRecorder({ webcamStreamRef, sessionId }) {
  const [isRecording, setIsRecording] = useState(false);
  const [error,       setError]       = useState(null);
  const [uploadState, setUploadState] = useState('idle'); // idle|uploading|done|failed

  const canvasRef      = useRef(null);
  const screenVideoRef = useRef(null);  // offscreen video for screen stream
  const webcamVideoRef = useRef(null);  // offscreen video for webcam stream
  const recorderRef    = useRef(null);
  const chunksRef      = useRef([]);
  const rafRef         = useRef(null);
  const screenStreamRef = useRef(null);

  // ── Draw one frame onto canvas ──────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const screen = screenVideoRef.current;
    const webcam = webcamVideoRef.current;
    if (!canvas || !screen) return;

    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;

    // 1. Draw screen capture as background
    if (screen.readyState >= 2) {
      ctx.drawImage(screen, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Draw webcam PiP — bottom right
    if (webcam && webcam.readyState >= 2) {
      const pipW = Math.round(W * PIP.widthRatio);
      const pipH = Math.round(pipW * (9 / 16));
      const pipX = W - pipW - PIP.margin;
      const pipY = H - pipH - PIP.margin;

      // Rounded clip
      ctx.save();
      roundedRect(ctx, pipX, pipY, pipW, pipH, PIP.borderRadius);
      ctx.clip();

      // Mirror webcam (natural selfie view)
      ctx.translate(pipX + pipW, pipY);
      ctx.scale(-1, 1);
      ctx.drawImage(webcam, 0, 0, pipW, pipH);
      ctx.restore();

      // Border ring
      ctx.save();
      ctx.strokeStyle = 'rgba(232, 255, 71, 0.6)';
      ctx.lineWidth   = PIP.borderWidth;
      roundedRect(ctx, pipX, pipY, pipW, pipH, PIP.borderRadius);
      ctx.stroke();
      ctx.restore();

      // REC indicator
      ctx.save();
      ctx.fillStyle = 'rgba(255, 68, 68, 0.9)';
      ctx.beginPath();
      ctx.arc(pipX + 10, pipY + 10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  // ── Start recording ─────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      // 1. Request screen capture
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: FPS, cursor: 'always' },
        audio: true,  // capture system audio if available
      });
      screenStreamRef.current = screenStream;

      // Stop recording if user closes the share dialog
      screenStream.getVideoTracks()[0].onended = () => stop();

      // 2. Set up offscreen screen video
      const screenVid = document.createElement('video');
      screenVid.srcObject = screenStream;
      screenVid.muted     = true;
      await screenVid.play();
      screenVideoRef.current = screenVid;

      // Canvas dimensions match screen capture
      const track    = screenStream.getVideoTracks()[0];
      const settings = track.getSettings();
      const W        = settings.width  || 1280;
      const H        = settings.height || 720;

      // 3. Set up offscreen webcam video
      if (webcamStreamRef?.current) {
        const webcamVid = document.createElement('video');
        webcamVid.srcObject = webcamStreamRef.current;
        webcamVid.muted     = true;
        await webcamVid.play();
        webcamVideoRef.current = webcamVid;
      }

      // 4. Create canvas
      const canvas   = document.createElement('canvas');
      canvas.width   = W;
      canvas.height  = H;
      canvasRef.current = canvas;

      // 5. Start drawing frames
      drawFrame();

      // 6. Capture canvas stream + mic audio
      const canvasStream = canvas.captureStream(FPS);

      // Mix in mic audio from screen stream if present
      screenStream.getAudioTracks().forEach(t => canvasStream.addTrack(t));

      // 7. Start MediaRecorder
      const mime     = MediaRecorder.isTypeSupported(WEBM_MIME) ? WEBM_MIME : FALLBACK_MIME;
      const recorder = new MediaRecorder(canvasStream, {
        mimeType:    mime,
        videoBitsPerSecond: 2_500_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        cancelAnimationFrame(rafRef.current);
        await uploadRecording(mime);
      };

      recorder.start(1000); // chunk every 1s
      recorderRef.current = recorder;
      setIsRecording(true);

    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Screen share was denied. Recording requires screen share permission.'
        : `Recording error: ${err.message}`;
      setError(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamStreamRef, drawFrame]);

  // ── Stop recording ──────────────────────────────────────────
  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    setIsRecording(false);
  }, []);

  // ── Upload to server ────────────────────────────────────────
  const uploadRecording = useCallback(async (mime) => {
    if (import.meta.env.VITE_ENABLE_RECORDING_UPLOAD !== 'true') {
      chunksRef.current = [];
      setUploadState('idle');
      return;
    }

    if (chunksRef.current.length === 0) return;
    setUploadState('uploading');

    const blob     = new Blob(chunksRef.current, { type: mime });
    const formData = new FormData();
    formData.append('recording', blob, `${sessionId}.webm`);
    formData.append('sessionId', sessionId);

    try {
      const res = await fetch(`${API_BASE}/api/upload-recording`, {
        method: 'POST',
        headers: authHeaders(),
        body:   formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      setUploadState('done');
    } catch (err) {
      console.error('Upload error:', err);
      setUploadState('failed');
    }
  }, [sessionId]);

  return {
    start,
    stop,
    isRecording,
    uploadState,
    error,
  };
}

// ── Helpers ──────────────────────────────────────────────────
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}
