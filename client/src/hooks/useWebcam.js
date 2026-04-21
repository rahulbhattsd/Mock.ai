// hooks/useWebcam.js
// Manages webcam stream lifecycle
// Returns: { videoRef, stream, start, stop, hasPermission, error }

import { useRef, useState, useCallback } from 'react';

export default function useWebcam() {
  const videoRef        = useRef(null);   // attach to <video> element
  const streamRef       = useRef(null);
  const [hasPermission, setHasPermission] = useState(null); // null=unknown, true, false
  const [error,         setError]         = useState(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:       { ideal: 1280 },
          height:      { ideal: 720  },
          facingMode:  'user',
          frameRate:   { ideal: 30   },
        },
        audio: false, // audio handled separately by VAD
      });

      streamRef.current = stream;
      setHasPermission(true);

      // Attach to video element if already mounted
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      return stream;
    } catch (err) {
      setHasPermission(false);
      const msg = err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera and reload.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera error: ${err.message}`;
      setError(msg);
      return null;
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasPermission(null);
  }, []);

  // Called after videoRef is mounted — connects stream if already acquired
  const attachToRef = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  return {
    videoRef,
    attachToRef,
    stream:       streamRef,
    start,
    stop,
    hasPermission,
    error,
  };
}