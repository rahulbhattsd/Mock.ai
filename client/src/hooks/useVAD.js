// hooks/useVAD.js
import { useRef, useCallback } from 'react';
import { API_BASE, authHeaders } from '../api.js';

const MIN_SPEECH_MS = 300;

export default function useVAD({ onTranscript, onStateChange }) {
  const streamRef      = useRef(null);
  const mediaRecRef    = useRef(null);
  const chunksRef      = useRef([]);
  const startTimeRef   = useRef(null);
  const activeRef      = useRef(false);
  const stoppingRef    = useRef(false);
  const mimeTypeRef    = useRef('audio/webm');

  // ✅ Store the per-call onTranscript override in a ref
  const callbackRef = useRef(onTranscript);

  const startListening = useCallback(async (options = {}) => {
    // ✅ Use per-call onTranscript if provided, else fall back to hook-level one
    callbackRef.current = options.onTranscript ?? onTranscript;

    if (activeRef.current) {
      console.warn('[VAD] already active');
      return;
    }

    activeRef.current    = true;
    stoppingRef.current  = false;
    chunksRef.current    = [];
    startTimeRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      mimeTypeRef.current = mimeType;

      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        activeRef.current   = false;
        stoppingRef.current = false;

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        const duration = Date.now() - startTimeRef.current;
        const chunks   = [...chunksRef.current];
        chunksRef.current = [];

        if (duration < MIN_SPEECH_MS || chunks.length === 0) {
          console.log('[VAD] too short, skipping');
          onStateChange?.('idle');
          return;
        }

        onStateChange?.('processing');

        const blob = new Blob(chunks, { type: mimeTypeRef.current });

        try {
          const formData = new FormData();
          formData.append('audio', blob, 'speech.webm');

          const res = await fetch(`${API_BASE}/api/transcribe`, {
            method: 'POST',
            headers: authHeaders(),
            body:   formData,
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          if (data.transcript?.trim()) {
            console.log('[VAD] ✅ transcript:', data.transcript);
            // ✅ Call whichever callback was set at startListening time
            callbackRef.current?.(data.transcript.trim());
          } else {
            console.warn('[VAD] empty transcript');
            onStateChange?.('idle');
          }
        } catch (err) {
          console.error('[VAD] transcribe error:', err);
          onStateChange?.('error');
        }
      };

      rec.start(100);
      console.log('[VAD] 🎙️ recording started');

    } catch (err) {
      console.error('[VAD] mic error:', err);
      activeRef.current = false;
      onStateChange?.('idle');
    }
  }, [onTranscript, onStateChange]);

  const submitNow = useCallback(() => {
    if (!activeRef.current || stoppingRef.current) {
      console.warn('[VAD] submitNow: not recording or already stopping');
      return;
    }
    console.log('[VAD] submitNow triggered');
    stoppingRef.current = true;
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop();
    }
  }, []);

  const stopListening = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop();
    } else {
      activeRef.current   = false;
      stoppingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
  }, []);

  return { startListening, stopListening, submitNow };
}
