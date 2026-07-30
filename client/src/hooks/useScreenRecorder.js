// hooks/useScreenRecorder.js
// Canvas compositor: draws screen capture + webcam PiP every frame.
// Records via MediaRecorder, then optionally uploads to /api/upload-recording.

import { useRef, useState, useCallback } from 'react';
import { API_BASE, authHeaders } from '../api.js';

const FPS           = 30;
const WEBM_MIME     = 'video/webm;codecs=vp9,opus';
const FALLBACK_MIME = 'video/webm';

const PIP = {
  widthRatio:  0.22,
  margin:      16,
  borderRadius: 12,
  borderWidth:  2,
};

function debugError(...args) {
  if (import.meta.env.DEV) console.error(...args);
}

function hasLiveVideo(stream) {
  return stream?.getVideoTracks?.().some((track) => track.readyState === 'live');
}

export default function useScreenRecorder({ webcamStreamRef, screenStreamRef: providedScreenStreamRef, sessionId, sessionIdRef }) {
  const [isRecording, setIsRecording] = useState(false);
  const [error,       setError]       = useState(null);
  const [uploadState, setUploadState] = useState('idle');

  const canvasRef       = useRef(null);
  const screenVideoRef  = useRef(null);
  const webcamVideoRef  = useRef(null);
  const recorderRef     = useRef(null);
  const chunksRef       = useRef([]);
  const rafRef          = useRef(null);
  const screenStreamRef = useRef(null);
  const stoppingRef     = useRef(false);

  const uploadRecording = useCallback(async (mime) => {
    if (import.meta.env.VITE_ENABLE_RECORDING_UPLOAD !== 'true') {
      chunksRef.current = [];
      setUploadState('idle');
      return;
    }

    if (chunksRef.current.length === 0) return;
    setUploadState('uploading');

    const uploadSessionId = sessionIdRef?.current || sessionId;
    const blob     = new Blob(chunksRef.current, { type: mime });
    const formData = new FormData();
    formData.append('recording', blob, `${uploadSessionId}.webm`);
    formData.append('sessionId', uploadSessionId);

    try {
      const res = await fetch(`${API_BASE}/api/upload-recording`, {
        method: 'POST',
        headers: authHeaders(),
        body:   formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      setUploadState('done');
    } catch (err) {
      debugError('Upload error:', err);
      setUploadState('failed');
    } finally {
      chunksRef.current = [];
    }
  }, [sessionId, sessionIdRef]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const screen = screenVideoRef.current;
    const webcam = webcamVideoRef.current;
    if (!canvas || !screen) return;

    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;

    if (screen.readyState >= 2) {
      ctx.drawImage(screen, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);
    }

    if (webcam && webcam.readyState >= 2) {
      const pipW = Math.round(W * PIP.widthRatio);
      const pipH = Math.round(pipW * (9 / 16));
      const pipX = W - pipW - PIP.margin;
      const pipY = H - pipH - PIP.margin;

      ctx.save();
      roundedRect(ctx, pipX, pipY, pipW, pipH, PIP.borderRadius);
      ctx.clip();
      ctx.translate(pipX + pipW, pipY);
      ctx.scale(-1, 1);
      ctx.drawImage(webcam, 0, 0, pipW, pipH);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(232, 255, 71, 0.6)';
      ctx.lineWidth   = PIP.borderWidth;
      roundedRect(ctx, pipX, pipY, pipW, pipH, PIP.borderRadius);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(255, 68, 68, 0.9)';
      ctx.beginPath();
      ctx.arc(pipX + 10, pipY + 10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const stop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.requestData?.();
      recorderRef.current.stop();
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    cancelAnimationFrame(rafRef.current);
    setIsRecording(false);
    stoppingRef.current = false;
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current?.state === 'recording') return;

    setError(null);
    chunksRef.current = [];

    try {
      const screenStream = hasLiveVideo(providedScreenStreamRef?.current)
        ? providedScreenStreamRef.current
        : await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: FPS, cursor: 'always' },
            audio: true,
          });
      screenStreamRef.current = screenStream;

      const [screenTrack] = screenStream.getVideoTracks();
      if (screenTrack) screenTrack.onended = () => stop();

      const screenVid = document.createElement('video');
      screenVid.srcObject = screenStream;
      screenVid.muted     = true;
      await screenVid.play();
      screenVideoRef.current = screenVid;

      const settings = screenTrack?.getSettings?.() || {};
      const W        = settings.width  || 1280;
      const H        = settings.height || 720;

      if (webcamStreamRef?.current) {
        const webcamVid = document.createElement('video');
        webcamVid.srcObject = webcamStreamRef.current;
        webcamVid.muted     = true;
        await webcamVid.play();
        webcamVideoRef.current = webcamVid;
      }

      const canvas  = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      canvasRef.current = canvas;
      drawFrame();

      const canvasStream = canvas.captureStream(FPS);
      screenStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));

      const mime = MediaRecorder.isTypeSupported(WEBM_MIME) ? WEBM_MIME : FALLBACK_MIME;
      const recorder = new MediaRecorder(canvasStream, {
        mimeType: mime,
        videoBitsPerSecond: 2_500_000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        cancelAnimationFrame(rafRef.current);
        setIsRecording(false);
        await uploadRecording(mime);
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Screen share was denied. Recording requires screen share permission.'
        : `Recording error: ${err.message}`;
      setError(msg);
    }
  }, [drawFrame, providedScreenStreamRef, stop, uploadRecording, webcamStreamRef]);

  return {
    start,
    stop,
    isRecording,
    uploadState,
    error,
  };
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
