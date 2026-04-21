// components/WaveformRing.jsx
// Circular waveform that pulses when Arjun is speaking
// or shows a mic-active ring when user is listening

import { useEffect, useRef } from 'react';
import './WaveformRing.css';

const BARS       = 48;
const RADIUS     = 88;
const CENTER     = 120;
const MIN_HEIGHT = 3;
const MAX_HEIGHT = 38;

export default function WaveformRing({ analyser, mode }) {
  // mode: 'idle' | 'arjun-speaking' | 'listening' | 'processing'
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CENTER * 2 * dpr;
    canvas.height = CENTER * 2 * dpr;
    ctx.scale(dpr, dpr);

    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, CENTER * 2, CENTER * 2);
      frame++;

      let dataArray = null;
      if (analyser?.current && mode === 'arjun-speaking') {
        dataArray = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < BARS; i++) {
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        let barH    = MIN_HEIGHT;

        if (mode === 'arjun-speaking') {
          if (dataArray) {
            const idx  = Math.floor((i / BARS) * dataArray.length * 0.5);
            const val  = dataArray[idx] / 255;
            barH = MIN_HEIGHT + val * MAX_HEIGHT;
          } else {
            // Fallback idle pulse
            barH = MIN_HEIGHT + Math.abs(Math.sin(frame * 0.04 + i * 0.3)) * 14;
          }
        } else if (mode === 'listening') {
          // Breathing ring — steady gentle pulse
          barH = MIN_HEIGHT + Math.abs(Math.sin(frame * 0.025 + i * 0.18)) * 10;
        } else if (mode === 'processing') {
          // Slow rotating highlight
          const highlight = (frame * 0.6 + i * (360 / BARS)) % 360;
          barH = MIN_HEIGHT + Math.max(0, Math.cos((highlight * Math.PI) / 180)) * 20;
        }

        const innerR = RADIUS - barH / 2;
        const outerR = RADIUS + barH / 2;
        const x1 = CENTER + Math.cos(angle) * innerR;
        const y1 = CENTER + Math.sin(angle) * innerR;
        const x2 = CENTER + Math.cos(angle) * outerR;
        const y2 = CENTER + Math.sin(angle) * outerR;

        // Color per mode
        let color;
        if (mode === 'arjun-speaking') {
          const intensity = Math.min(1, (barH - MIN_HEIGHT) / MAX_HEIGHT);
          color = `rgba(232, 255, 71, ${0.25 + intensity * 0.75})`;
        } else if (mode === 'listening') {
          color = `rgba(68, 255, 136, ${0.3 + Math.abs(Math.sin(frame * 0.025 + i * 0.18)) * 0.5})`;
        } else if (mode === 'processing') {
          color = `rgba(255, 180, 50, 0.35)`;
        } else {
          color = `rgba(60, 60, 60, 0.6)`;
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = 'round';
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, mode]);

  return (
    <div className="waveform-ring-wrap">
      <canvas ref={canvasRef} className="waveform-canvas" style={{ width: CENTER * 2, height: CENTER * 2 }} />
    </div>
  );
}