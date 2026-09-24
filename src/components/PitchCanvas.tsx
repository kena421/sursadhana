import React, { useRef, useEffect } from 'react';
import { SWARAS } from '../types/music';
import type { DetectedPitch } from '../types/music';

interface TargetNoteBlock {
  swaraId: string;
  startTime: number;
  duration: number; // in seconds
}

interface PitchCanvasProps {
  currentPitch: DetectedPitch | null;
  targetNotes?: TargetNoteBlock[];
  isPracticing?: boolean;
}

interface PitchPoint {
  time: number;
  semitonePos: number; // 0 for Sa, 1 for re, 2 for Re, ... 12 for Taar Sa
  centsDeviation: number;
  isInSur: boolean;
}

export const PitchCanvas: React.FC<PitchCanvasProps> = ({
  currentPitch,
  targetNotes = [],
  isPracticing = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<PitchPoint[]>([]);
  const animRef = useRef<number | null>(null);

  // Keep pitch history updated
  useEffect(() => {
    const now = performance.now();
    if (currentPitch) {
      const swaraIndex = SWARAS.findIndex(s => s.id === currentPitch.swara.id);
      const basePos = swaraIndex !== -1 ? swaraIndex : 0;
      // Add fine cents adjustment (-0.5 to +0.5 of a semitone)
      const fractionalPos = basePos + currentPitch.centsDeviation / 100;

      historyRef.current.push({
        time: now,
        semitonePos: fractionalPos,
        centsDeviation: currentPitch.centsDeviation,
        isInSur: currentPitch.isInSur,
      });
    }

    // Keep only last 6 seconds of history
    const cutoff = now - 6000;
    historyRef.current = historyRef.current.filter(p => p.time > cutoff);
  }, [currentPitch]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear background
      ctx.fillStyle = '#0a0d18';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle horizontal grid lanes for each Swara (13 swaras: Sa to Taar Sa)
      const totalLanes = SWARAS.length;
      const laneHeight = height / totalLanes;
      const now = performance.now();
      const timeWindow = 4500; // 4.5 seconds visible across width

      // Swara lanes (from Taar Sa at top to Madhya Sa at bottom)
      for (let i = 0; i < totalLanes; i++) {
        const swara = SWARAS[totalLanes - 1 - i]; // Reverse so Taar Sa is at top
        const y = i * laneHeight;

        // Alternating subtle lane background
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
          ctx.fillRect(0, y, width, laneHeight);
        }

        // Special highlight for Achala swaras (Sa and Pa)
        const isKeySwar = swara.id === 'S' || swara.id === 'P' || swara.id === 'S_taar';
        if (isKeySwar) {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.04)';
          ctx.fillRect(0, y, width, laneHeight);
        }

        // Lane separator line
        ctx.strokeStyle = isKeySwar ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = isKeySwar ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(55, y + laneHeight);
        ctx.lineTo(width, y + laneHeight);
        ctx.stroke();

        // Swara label tag on left sidebar
        ctx.fillStyle = isKeySwar ? '#F59E0B' : 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'bold 12px "Outfit", sans-serif';
        ctx.fillText(swara.shortName, 10, y + laneHeight * 0.65);

        ctx.font = '11px "Noto Sans Devanagari", sans-serif';
        ctx.fillStyle = isKeySwar ? '#FBBF24' : 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(swara.devanagari, 28, y + laneHeight * 0.65);
      }

      // Draw vertical time grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridIntervalX = width / 6;
      for (let x = 60; x < width; x += gridIntervalX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Left border dividing labels from pitch space
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(55, 0);
      ctx.lineTo(55, height);
      ctx.stroke();

      // Draw Target Notes (if practicing Alankars)
      if (isPracticing && targetNotes.length > 0) {
        targetNotes.forEach(tn => {
          const swaraIdx = SWARAS.findIndex(s => s.id === tn.swaraId);
          if (swaraIdx === -1) return;
          const laneY = (totalLanes - 1 - swaraIdx) * laneHeight;

          // Compute X based on time
          const x = width - ((now - tn.startTime) / timeWindow) * (width - 55);
          const blockW = (tn.duration / timeWindow) * (width - 55);

          if (x + blockW > 55 && x < width) {
            // Target block
            ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 2;
            const rx = Math.max(55, x);
            const rw = Math.min(width - rx, blockW);
            ctx.beginPath();
            ctx.roundRect(rx, laneY + 4, rw, laneHeight - 8, 6);
            ctx.fill();
            ctx.stroke();

            // Target note label
            ctx.fillStyle = '#6EE7B7';
            ctx.font = 'bold 11px "Outfit", sans-serif';
            ctx.fillText(tn.swaraId, rx + 8, laneY + laneHeight * 0.62);
          }
        });
      }

      // Draw Live Glowing Pitch History Ribbon
      const history = historyRef.current;
      if (history.length > 1) {
        ctx.save();
        ctx.beginPath();

        let hasStarted = false;
        for (let i = 0; i < history.length; i++) {
          const pt = history[i];
          const age = now - pt.time;
          if (age > timeWindow) continue;

          // X position: current time is at width - 20, older points move left toward 55px
          const x = width - 20 - (age / timeWindow) * (width - 75);
          if (x < 55) continue;

          // Y position: semitonePos 0 (Sa) is at bottom, 12 (Taar Sa) is at top
          // Invert because canvas Y is 0 at top
          const y = height - (pt.semitonePos + 0.5) * laneHeight;

          if (!hasStarted) {
            ctx.moveTo(x, y);
            hasStarted = true;
          } else {
            // Check for gap between singing points (e.g. pause in singing)
            const prevPt = history[i - 1];
            if (pt.time - prevPt.time > 120) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        }

        // Ribbon Glow Effect
        ctx.shadowBlur = 12;
        ctx.shadowColor = currentPitch?.isInSur ? '#10B981' : '#F59E0B';
        ctx.strokeStyle = currentPitch?.isInSur ? '#34D399' : '#FBBF24';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.restore();
      }

      // Draw current live vocal head (glowing orb on right)
      if (currentPitch) {
        const swaraIndex = SWARAS.findIndex(s => s.id === currentPitch.swara.id);
        const basePos = swaraIndex !== -1 ? swaraIndex : 0;
        const currentPos = basePos + currentPitch.centsDeviation / 100;
        const headY = height - (currentPos + 0.5) * laneHeight;
        const headX = width - 20;

        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = currentPitch.isInSur ? '#10B981' : '#F59E0B';

        ctx.fillStyle = currentPitch.isInSur ? '#10B981' : '#F59E0B';
        ctx.beginPath();
        ctx.arc(headX, headY, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(headX, headY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [targetNotes, isPracticing, currentPitch]);

  return (
    <div className="pitch-canvas-wrapper">
      <div className="canvas-header-info">
        <span className="canvas-title">Continuous Swara Track (स्वर ग्राफ)</span>
        <span className="canvas-legend">
          <span className="legend-dot green" /> In-Sur (±15¢)
          <span className="legend-dot amber" /> Flat / Sharp
        </span>
      </div>
      <canvas ref={canvasRef} className="pitch-canvas" />
    </div>
  );
};
