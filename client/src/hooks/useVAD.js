// hooks/useVAD.js
import { useRef, useCallback } from 'react';
import { API_BASE, authHeaders } from '../api.js';

const MIN_SPEECH_MS = 300;
const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
];

const MIC_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
  },
  video: false,
};

function debugLog(...args) {
  if (import.meta.env.DEV) console.log(...args);
}

function debugWarn(...args) {
  if (import.meta.env.DEV) console.warn(...args);
}

function debugError(...args) {
  if (import.meta.env.DEV) console.error(...args);
}

function bestSupportedMimeType() {
  return AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function cloneLiveAudioStream(stream) {
  const liveTracks = stream?.getAudioTracks?.().filter((track) => track.readyState === 'live') || [];
  if (!liveTracks.length) return null;
  return new MediaStream(liveTracks.map((track) => track.clone()));
}

export default function useVAD({ onTranscript, onStateChange, audioStream }) {
  const streamRef      = useRef(null);
  const mediaRecRef    = useRef(null);
  const chunksRef      = useRef([]);
  const startTimeRef   = useRef(null);
  const activeRef      = useRef(false);
  const stoppingRef    = useRef(false);
  const mimeTypeRef    = useRef('audio/webm');

  const callbackRef = useRef(onTranscript);

  const startListening = useCallback(async (options = {}) => {
    callbackRef.current = options.onTranscript ?? onTranscript;

    if (activeRef.current) {
      debugWarn('[VAD] already active');
      return;
    }

    activeRef.current    = true;
    stoppingRef.current  = false;
    chunksRef.current    = [];
    startTimeRef.current = Date.now();

    try {
      const stream = cloneLiveAudioStream(audioStream)
        || await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      streamRef.current = stream;

      const mimeType = bestSupportedMimeType();
      mimeTypeRef.current = mimeType || 'audio/webm';

      const rec = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
        : new MediaRecorder(stream, { audioBitsPerSecond: 128000 });
      mediaRecRef.current = rec;

      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      rec.onstop = async () => {
        activeRef.current   = false;
        stoppingRef.current = false;

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const duration = Date.now() - startTimeRef.current;
        const chunks   = [...chunksRef.current];
        chunksRef.current = [];

        if (duration < MIN_SPEECH_MS || chunks.length === 0) {
          debugLog('[VAD] too short, skipping');
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
            debugLog('[VAD] transcript:', data.transcript);
            callbackRef.current?.(data.transcript.trim());
          } else {
            debugWarn('[VAD] empty transcript');
            onStateChange?.('idle');
          }
        } catch (err) {
          debugError('[VAD] transcribe error:', err);
          onStateChange?.('error');
        }
      };

      rec.start(100);
      debugLog('[VAD] recording started');

    } catch (err) {
      debugError('[VAD] mic error:', err);
      activeRef.current = false;
      onStateChange?.('idle');
    }
  }, [audioStream, onTranscript, onStateChange]);

  const submitNow = useCallback(() => {
    if (!activeRef.current || stoppingRef.current) {
      debugWarn('[VAD] submitNow: not recording or already stopping');
      return;
    }
    debugLog('[VAD] submitNow triggered');
    stoppingRef.current = true;
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.requestData?.();
      mediaRecRef.current.stop();
    }
  }, []);

  const stopListening = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.requestData?.();
      mediaRecRef.current.stop();
    } else {
      activeRef.current   = false;
      stoppingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, []);

  return { startListening, stopListening, submitNow };
}
