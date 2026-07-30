// hooks/useAudioPlayer.js
// Plays TTS audio returned from the backend (base64 PCM/MP3 or a blob URL)
// Exposes: play(base64orUrl), stop(), isPlaying, analyserNode (for visualizer)

import { useRef, useState, useCallback } from 'react';

export default function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef    = useRef(null);
  const ctxRef      = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef   = useRef(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {
        // Source nodes may already be disconnected during cleanup.
      }
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current  = null;
      analyserRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // play accepts:
  //   - a base64 string (audio/mp3 or audio/wav)
  //   - a Blob URL
  //   - a plain URL string
  const play = useCallback((audioData, mimeType = 'audio/mp3', onEnd = null) => {
    stop();

    let src;
    if (audioData instanceof Blob) {
      src = URL.createObjectURL(audioData);
    } else if (audioData.startsWith('data:') || audioData.startsWith('http') || audioData.startsWith('blob:')) {
      src = audioData;
    } else {
      // raw base64
      src = `data:${mimeType};base64,${audioData}`;
    }

    const audio = new Audio(src);
    audioRef.current = audio;

    // Wire up Web Audio analyser for waveform visualisation
    const ctx      = new (window.AudioContext || window.webkitAudioContext)();
    const source   = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    ctxRef.current      = ctx;
    analyserRef.current = analyser;
    sourceRef.current   = source;

    audio.onplay  = () => setIsPlaying(true);
    audio.onended = () => {
      setIsPlaying(false);
      URL.revokeObjectURL(src);
      onEnd?.();
    };
    audio.onerror = () => {
      setIsPlaying(false);
      onEnd?.();
    };

    audio.play().catch((err) => {
      if (import.meta.env.DEV) console.error('Audio playback failed:', err);
      setIsPlaying(false);
      onEnd?.();
    });
  }, [stop]);

  return { play, stop, isPlaying, analyser: analyserRef };
}
