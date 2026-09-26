import React, { useRef, useEffect, useState } from 'react';
import { SWARAS } from '../types/music';
import type { DetectedPitch, RecordedPitchPoint, HighwayTargetBlock } from '../types/music';
export type { HighwayTargetBlock };

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
}

interface NoteHighwayCanvasProps {
  currentPitch: DetectedPitch | null;
  targetBlocks: HighwayTargetBlock[];
  exerciseStartTimeMs: number | null; // null if idle or paused
  stage: 'idle' | 'practicing' | 'analysis';
  isHitActive: boolean; // true when user is matching pitch or guru is playing
  activeRemainingSec?: number;
  audioLevel?: number; // 0 to 1 live volume level of singing voice
  totalRoundSec?: number;
  singleRoundSec?: number;
  totalRounds?: number;
  isUserTurn?: boolean; // only plot user mic when it is user's turn (avoids speaker echo)

  // Scrollback & Review Mode Props
  isReviewMode?: boolean;
  reviewElapsedSec?: number;
  recordedPoints?: RecordedPitchPoint[];
  onScrubTime?: (sec: number) => void;
}

export const NoteHighwayCanvas: React.FC<NoteHighwayCanvasProps> = ({
  currentPitch,
  targetBlocks,
  exerciseStartTimeMs,
  stage,
  isHitActive,
  audioLevel = 0,
  isUserTurn = false,
  isReviewMode = false,
  reviewElapsedSec = 0,
  recordedPoints = [],
  onScrubTime,
  totalRoundSec = 10,
  singleRoundSec,
  totalRounds = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const userPitchTrailRef = useRef<{ timeMs: number; semitonePos: number; isInSur: boolean }[]>([]);
  const animRef = useRef<number | null>(null);

  // Mouse / Touch Dragging State for Direct Canvas Scrubbing
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);

  // Always keep all props in a ref so the RAF loop runs uninterrupted without cancellation churn
  const propsRef = useRef({
    currentPitch,
    targetBlocks,
    exerciseStartTimeMs,
    stage,
    isHitActive,
    audioLevel,
    isUserTurn,
    isReviewMode,
    reviewElapsedSec,
    recordedPoints,
    singleRoundSec,
    totalRounds,
  });

  propsRef.current = {
    currentPitch,
    targetBlocks,
    exerciseStartTimeMs,
    stage,
    isHitActive,
    audioLevel,
    isUserTurn,
    isReviewMode,
    reviewElapsedSec,
    recordedPoints,
    singleRoundSec,
    totalRounds,
  };

  // Main Canvas Rendering Loop - runs continuously at 60fps
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    const pixelsPerSec = 125; // 125 px/sec scrolling speed
    const playheadX = 180; // Playhead vertical line position from left (px)
    const sidebarWidth = 65; // Left Swara labels width

    const render = () => {
      if (!isRunning) return;

      const {
        currentPitch: curPitch,
        targetBlocks: curTargetBlocks,
        exerciseStartTimeMs: curStartTimeMs,
        stage: curStage,
        isHitActive: curHitActive,
        audioLevel: curAudioLevel,
        isUserTurn: curUserTurn,
        isReviewMode: curReviewMode,
        reviewElapsedSec: curReviewElapsedSec,
        recordedPoints: curRecordedPoints,
        singleRoundSec: curSingleRoundSec,
        totalRounds: curTotalRounds,
      } = propsRef.current;

      const now = performance.now();

      // Continuous pitch trail recording in lockstep with rendering
      if (!curReviewMode && curStage === 'practicing' && curUserTurn && curPitch) {
        const swaraIndex = SWARAS.findIndex(s => s.id === curPitch.swara.id);
        const basePos = swaraIndex !== -1 ? swaraIndex : 0;
        const pos = basePos + curPitch.centsDeviation / 100;

        userPitchTrailRef.current.push({
          timeMs: now,
          semitonePos: pos,
          isInSur: curPitch.isInSur,
        });

        // Keep last 8 seconds of pitch history in live view
        const cutoff = now - 8000;
        userPitchTrailRef.current = userPitchTrailRef.current.filter(p => p.timeMs > cutoff);
      } else if (curStage === 'idle' || !curUserTurn) {
        if (!curUserTurn) {
          userPitchTrailRef.current = [];
        }
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 800;
      const height = canvas.clientHeight || 290;

      if (width === 0 || height === 0) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      // Explicitly reset the transform matrix to identity on every frame before scaling by DPR
      // Prevents exponential scale accumulation that previously broke rendering
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      try {
        // 1. Deep Obsidian Pitch Black Background (like Padhanisa)
        ctx.fillStyle = '#05070D';
        ctx.fillRect(0, 0, width, height);

        const totalLanes = SWARAS.length;
        const laneHeight = height / totalLanes;

      // 2. Draw Horizontal Swara Grid Lanes
      for (let i = 0; i < totalLanes; i++) {
        const swara = SWARAS[totalLanes - 1 - i];
        const y = i * laneHeight;
        const isKeySwar = swara.id === 'S' || swara.id === 'P' || swara.id === 'S_taar';

        if (isKeySwar) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.04)';
          ctx.fillRect(0, y, width, laneHeight);
        } else if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
          ctx.fillRect(0, y, width, laneHeight);
        }

        // Horizontal lane divider
        ctx.strokeStyle = isKeySwar ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255, 255, 255, 0.035)';
        ctx.lineWidth = isKeySwar ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(sidebarWidth, y + laneHeight);
        ctx.lineTo(width, y + laneHeight);
        ctx.stroke();
      }

      // Elapsed Time for Scroll Calculation (Smooth & Continuous)
      const elapsedSec = curReviewMode
        ? curReviewElapsedSec
        : curStartTimeMs !== null
        ? (now - curStartTimeMs) / 1000
        : 0;

      // Vertical Measure Beat Lines (Dividers every 100px)
      const beatSpacingPx = 100;
      const beatOffset = (elapsedSec * pixelsPerSec) % beatSpacingPx;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let bx = sidebarWidth + (beatSpacingPx - beatOffset); bx < width; bx += beatSpacingPx) {
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, height);
        ctx.stroke();
      }

      // Vertical Round Boundary Dividers (Clear visual indicators between rounds)
      if (curSingleRoundSec && curSingleRoundSec > 0 && curTotalRounds && curTotalRounds > 1) {
        for (let r = 1; r < curTotalRounds; r++) {
          const roundStartSec = r * curSingleRoundSec;
          const rx = playheadX + (roundStartSec - elapsedSec) * pixelsPerSec;

          if (rx > sidebarWidth && rx < width) {
            ctx.save();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(rx, 0);
            ctx.lineTo(rx, height);
            ctx.stroke();

            // Round Badge Pill
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(rx - 30, 26, 60, 18, 9);
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 9px "Outfit", sans-serif';
            ctx.fillStyle = '#38BDF8';
            ctx.textAlign = 'center';
            ctx.fillText(`ROUND ${r + 1}`, rx, 39);
            ctx.restore();
          }
        }
      }

      // 3. Left-of-Playhead Spotlight Luminous Glow (as seen in Padhanisa)
      const leftSpotlight = ctx.createLinearGradient(playheadX - 140, 0, playheadX, 0);
      leftSpotlight.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
      leftSpotlight.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
      ctx.fillStyle = leftSpotlight;
      ctx.fillRect(
        Math.max(sidebarWidth, playheadX - 140),
        0,
        playheadX - Math.max(sidebarWidth, playheadX - 140),
        height
      );

      let activeCrossingBlock: HighwayTargetBlock | null = null;
      let activeRemaining = 0;

      // 4. Draw Connecting Melody Step Lines
      if (curTargetBlocks.length > 1) {
        for (let i = 0; i < curTargetBlocks.length - 1; i++) {
          const b1 = curTargetBlocks[i];
          const b2 = curTargetBlocks[i + 1];

          // Only connect notes that are close together (within 2.5s gap), not across long round intervals
          const gapSec = b2.startTimeSec - (b1.startTimeSec + b1.durationSec);
          if (b1.type === b2.type && gapSec <= 2.5 && gapSec >= -0.1) {
            const idx1 = SWARAS.findIndex(s => s.id === b1.swaraId);
            const idx2 = SWARAS.findIndex(s => s.id === b2.swaraId);
            if (idx1 !== -1 && idx2 !== -1) {
              const y1 = (totalLanes - 1 - idx1) * laneHeight + laneHeight * 0.5;
              const y2 = (totalLanes - 1 - idx2) * laneHeight + laneHeight * 0.5;

              const x1 = playheadX + (b1.startTimeSec + b1.durationSec - elapsedSec) * pixelsPerSec;
              const x2 = playheadX + (b2.startTimeSec - elapsedSec) * pixelsPerSec;

              if (x2 > sidebarWidth && x1 < width) {
                ctx.save();
                ctx.strokeStyle = curReviewMode
                  ? 'rgba(255, 122, 0, 0.35)'
                  : b1.type === 'assisted'
                  ? 'rgba(245, 158, 11, 0.25)'
                  : 'rgba(255, 122, 0, 0.25)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(Math.max(sidebarWidth, x1), y1);
                ctx.lineTo(x2, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
        }
      }

      // 5. Draw Target Note Bars (Expected Swara Blocks)
      if (curTargetBlocks.length > 0) {
        for (const block of curTargetBlocks) {
          const swaraIdx = SWARAS.findIndex(s => s.id === block.swaraId);
          if (swaraIdx === -1) continue;
          const laneY = (totalLanes - 1 - swaraIdx) * laneHeight;

          // Compute X based on continuous scroll
          const blockFrontX = playheadX + (block.startTimeSec - elapsedSec) * pixelsPerSec;
          const blockWidth = block.durationSec * pixelsPerSec;
          const blockBackX = blockFrontX + blockWidth;

          // Check if currently crossing playhead
          const isCrossingPlayhead = blockFrontX <= playheadX && blockBackX >= playheadX;
          if (isCrossingPlayhead) {
            activeCrossingBlock = block;
            activeRemaining = Math.max(0, (blockBackX - playheadX) / pixelsPerSec);
          }

          // Only render if visible in viewport
          if (blockBackX > sidebarWidth && blockFrontX < width) {
            const isAssisted = block.type === 'assisted';
            const rx = Math.max(sidebarWidth, blockFrontX);
            const rw = Math.min(width - rx, blockBackX - rx);

            if (rw > 0) {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(rx, laneY + 5, rw, laneHeight - 10, 6);

              if (curReviewMode) {
                // REVIEW MODE: Expected note bar with elegant amber outline
                if (isCrossingPlayhead) {
                  ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
                  ctx.fill();
                  ctx.strokeStyle = '#F59E0B';
                  ctx.lineWidth = 2.5;
                  ctx.shadowBlur = 14;
                  ctx.shadowColor = '#F59E0B';
                  ctx.stroke();
                } else {
                  ctx.fillStyle = 'rgba(255, 122, 0, 0.15)';
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(255, 122, 0, 0.7)';
                  ctx.lineWidth = 1.6;
                  ctx.stroke();
                }
              } else if (isAssisted) {
                // ASSISTED (GURU) NOTE
                if (isCrossingPlayhead) {
                  ctx.shadowBlur = 18;
                  ctx.shadowColor = '#F59E0B';
                  ctx.fillStyle = '#F59E0B';
                  ctx.fill();
                  ctx.strokeStyle = '#FDE68A';
                  ctx.lineWidth = 2.5;
                  ctx.stroke();
                } else {
                  ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                }
              } else {
                // LIVE USER (YOU) NOTE: PADHANISA ORANGE & GREEN
                if (isCrossingPlayhead) {
                  if (curHitActive) {
                    ctx.shadowBlur = 22;
                    ctx.shadowColor = '#22C55E';
                    ctx.fillStyle = '#22C55E';
                    ctx.fill();
                    ctx.strokeStyle = '#86EFAC';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                  } else {
                    ctx.shadowBlur = 16;
                    ctx.shadowColor = '#FF7A00';
                    ctx.fillStyle = '#FF7A00';
                    ctx.fill();
                    ctx.strokeStyle = '#FED7AA';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                  }
                } else {
                  ctx.fillStyle = 'rgba(255, 122, 0, 0.32)';
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(255, 122, 0, 0.85)';
                  ctx.lineWidth = 1.8;
                  ctx.stroke();
                }
              }
              ctx.restore();

              // If crossing playhead in live mode, draw progress fill
              if (!curReviewMode && isCrossingPlayhead && playheadX > rx) {
                const filledWidth = Math.min(rw, playheadX - rx);
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(rx, laneY + 5, filledWidth, laneHeight - 10, [5, 0, 0, 5]);

                if (isAssisted) {
                  ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
                } else {
                  ctx.fillStyle = curHitActive ? 'rgba(34, 197, 94, 0.9)' : 'rgba(255, 122, 0, 0.85)';
                }
                ctx.fill();
                ctx.restore();
              }

              // Text Label & Icon on Block
              ctx.save();
              const labelX = Math.max(sidebarWidth + 10, blockFrontX + 10);
              if (labelX < blockBackX - 10) {
                ctx.font = 'bold 11px "Outfit", sans-serif';
                ctx.fillStyle = '#FFFFFF';

                const rolePrefix = curReviewMode ? '🎯 EXPECTED' : isAssisted ? '🎧 GURU' : '🎤 YOU';
                if (isCrossingPlayhead) {
                  ctx.fillText(`${rolePrefix} • ${block.label}`, labelX, laneY + laneHeight * 0.65);
                } else {
                  ctx.fillText(`${rolePrefix} • ${block.label} (${block.durationSec}s)`, labelX, laneY + laneHeight * 0.65);
                }
              }
              ctx.restore();
            }

            // Spawn spark particles on hit (live mode only)
            if (!curReviewMode) {
              const shouldSpark = isCrossingPlayhead && (isAssisted || curHitActive);
              if (shouldSpark && Math.random() < 0.6) {
                particlesRef.current.push({
                  x: playheadX,
                  y: laneY + laneHeight * 0.5 + (Math.random() * 12 - 6),
                  vx: -(Math.random() * 2 + 1),
                  vy: (Math.random() - 0.5) * 2,
                  size: Math.random() * 3 + 2,
                  color: isAssisted ? '#FBBF24' : curHitActive ? '#22C55E' : '#FF7A00',
                  alpha: 1,
                  life: 28,
                });
              }
            }
          }
        }
      }

      // =========================================================================
      // 6. DRAW USER VOCAL PITCH TRAIL (RECORDED SUNG CURVE)
      // =========================================================================
      if (isReviewMode) {
        // ==========================================================
        // REVIEW MODE: RENDER ENTIRE RECORDED PITCH CURVE
        // ==========================================================
        if (curRecordedPoints && curRecordedPoints.length > 0) {
          ctx.save();

          // Group consecutive points where time difference <= 0.18s
          const segments: RecordedPitchPoint[][] = [];
          let curSeg: RecordedPitchPoint[] = [];

          for (let i = 0; i < curRecordedPoints.length; i++) {
            const pt = curRecordedPoints[i];
            if (curSeg.length === 0) {
              curSeg.push(pt);
            } else {
              const prev = curSeg[curSeg.length - 1];
              if (pt.timeSec - prev.timeSec <= 0.18) {
                curSeg.push(pt);
              } else {
                segments.push(curSeg);
                curSeg = [pt];
              }
            }
          }
          if (curSeg.length > 0) segments.push(curSeg);

          // Draw segments
          for (const seg of segments) {
            if (seg.length < 2) continue;

            for (let i = 0; i < seg.length - 1; i++) {
              const p1 = seg[i];
              const p2 = seg[i + 1];

              const x1 = playheadX + (p1.timeSec - elapsedSec) * pixelsPerSec;
              const x2 = playheadX + (p2.timeSec - elapsedSec) * pixelsPerSec;

              // Cull off-screen points
              if ((x1 < sidebarWidth && x2 < sidebarWidth) || (x1 > width && x2 > width)) continue;

              const pos1 =
                p1.semitonePos !== undefined
                  ? p1.semitonePos
                  : SWARAS.findIndex(s => s.id === p1.swaraId) + p1.centsDeviation / 100;
              const pos2 =
                p2.semitonePos !== undefined
                  ? p2.semitonePos
                  : SWARAS.findIndex(s => s.id === p2.swaraId) + p2.centsDeviation / 100;

              const y1 = height - (pos1 + 0.5) * laneHeight;
              const y2 = height - (pos2 + 0.5) * laneHeight;

              // Color-coded intonation:
              // Pure Green = in sur (±15 cents)
              // Amber = sharp (> +15 cents)
              // Cyan = flat (< -15 cents)
              const isInSur = p1.isInSur || p2.isInSur;
              const avgDev = (p1.centsDeviation + p2.centsDeviation) / 2;
              const strokeColor = isInSur ? '#22C55E' : avgDev > 15 ? '#F59E0B' : '#06B6D4';

              ctx.beginPath();
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 4;
              ctx.lineCap = 'round';
              ctx.shadowBlur = 10;
              ctx.shadowColor = strokeColor;
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();

              // Point dots for microtonal precision
              ctx.beginPath();
              ctx.fillStyle = '#FFFFFF';
              ctx.shadowBlur = 4;
              ctx.shadowColor = strokeColor;
              ctx.arc(x1, y1, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      } else if (stage !== 'idle' && isUserTurn && userPitchTrailRef.current.length > 1) {
        // ==========================================================
        // LIVE MODE: RENDER RECENT 8s PITCH TRAIL
        // ==========================================================
        ctx.save();
        ctx.beginPath();

        const trail = userPitchTrailRef.current;
        let started = false;

        for (let i = 0; i < trail.length; i++) {
          const pt = trail[i];
          const ageSec = (now - pt.timeMs) / 1000;
          const x = playheadX - ageSec * pixelsPerSec;
          if (x < sidebarWidth) continue;

          const y = height - (pt.semitonePos + 0.5) * laneHeight;

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            const prev = trail[i - 1];
            if (pt.timeMs - prev.timeMs > 140) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        }

        const isCurrentlyInSur = currentPitch?.isInSur ?? false;
        ctx.shadowBlur = 12;
        ctx.shadowColor = isCurrentlyInSur ? '#22C55E' : '#FF7A00';
        ctx.strokeStyle = isCurrentlyInSur ? '#22C55E' : '#FF7A00';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // 7. Hit Spark Particles (Live mode)
      if (!isReviewMode) {
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 1 / p.life;

          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // =========================================================================
      // 8. VERTICAL TARGET PLAYHEAD & INSPECTOR BEAM
      // =========================================================================
      const isAssistedCrossing = !isReviewMode && activeCrossingBlock?.type === 'assisted';
      const isUserCrossing = !isReviewMode && activeCrossingBlock?.type === 'user';
      const playheadColor = isReviewMode
        ? '#38BDF8'
        : isAssistedCrossing
        ? '#F59E0B'
        : isUserCrossing && isHitActive
        ? '#22C55E'
        : isUserCrossing
        ? '#FF7A00'
        : 'rgba(255, 255, 255, 0.4)';

      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = playheadColor;
      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Top Playhead Arrow Indicator
      ctx.fillStyle = playheadColor;
      ctx.beginPath();
      ctx.moveTo(playheadX - 8, 0);
      ctx.lineTo(playheadX + 8, 0);
      ctx.lineTo(playheadX, 10);
      ctx.closePath();
      ctx.fill();

      // Top Playhead Badge Label
      ctx.font = 'bold 9px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      const playheadBadge = isReviewMode ? 'REVIEW' : isAssistedCrossing ? 'GURU' : isUserCrossing ? 'YOU' : 'READY';
      ctx.fillText(playheadBadge, playheadX, 22);
      ctx.restore();

      // =========================================================================
      // 9. REVIEW MODE: EXACT EXPECTED VS RECORDED PLAYHEAD INSPECTION
      // =========================================================================
      if (isReviewMode) {
        // Find nearest recorded pitch point at playhead time (within ±0.15s)
        const recordedAtPlayhead = (curRecordedPoints || []).find(
          p => Math.abs(p.timeSec - elapsedSec) <= 0.15
        );

        if (recordedAtPlayhead) {
          const recPos =
            recordedAtPlayhead.semitonePos !== undefined
              ? recordedAtPlayhead.semitonePos
              : SWARAS.findIndex(s => s.id === recordedAtPlayhead.swaraId) +
                recordedAtPlayhead.centsDeviation / 100;
          const recY = height - (recPos + 0.5) * laneHeight;

          const dotColor = recordedAtPlayhead.isInSur
            ? '#22C55E'
            : recordedAtPlayhead.centsDeviation > 15
            ? '#F59E0B'
            : '#06B6D4';

          // Connect user's recorded dot with expected note center if expected block exists
          if (activeCrossingBlock) {
            const tgtIdx = SWARAS.findIndex(s => s.id === activeCrossingBlock.swaraId);
            if (tgtIdx !== -1) {
              const tgtCenterY = (totalLanes - 1 - tgtIdx) * laneHeight + laneHeight * 0.5;

              ctx.save();
              ctx.strokeStyle = dotColor;
              ctx.lineWidth = 1.5;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(playheadX, tgtCenterY);
              ctx.lineTo(playheadX, recY);
              ctx.stroke();
              ctx.restore();
            }
          }

          // Glowing cursor dot for recorded voice
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = dotColor;
          ctx.fillStyle = dotColor;
          ctx.beginPath();
          ctx.arc(playheadX, recY, 9, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(playheadX, recY, 4, 0, Math.PI * 2);
          ctx.fill();

          // Inspection Callout Pill on Playhead
          const devStr =
            recordedAtPlayhead.centsDeviation >= 0
              ? `+${recordedAtPlayhead.centsDeviation}¢`
              : `${recordedAtPlayhead.centsDeviation}¢`;
          const pillText = `${recordedAtPlayhead.swaraId} (${devStr})`;

          ctx.font = 'bold 11px "Outfit", sans-serif';
          const textW = ctx.measureText(pillText).width;
          const pillX = playheadX + 16;
          const pillY = Math.max(12, Math.min(height - 24, recY - 11));

          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.strokeStyle = dotColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, textW + 16, 22, 11);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'left';
          ctx.fillText(pillText, pillX + 8, pillY + 15);
          ctx.restore();
        }
      } else if (curStage !== 'idle' && curUserTurn && curPitch) {
        // LIVE MODE CURSOR DOT
        const swaraIndex = SWARAS.findIndex(s => s.id === curPitch.swara.id);
        const basePos = swaraIndex !== -1 ? swaraIndex : 0;
        const currentPos = basePos + curPitch.centsDeviation / 100;
        const dotY = height - (currentPos + 0.5) * laneHeight;
        const userVol = Math.max(0.15, curAudioLevel || curPitch.clarity * 0.7);
        const dotRadius = 7 + userVol * 8;

        ctx.save();
        const dotColor = curPitch.isInSur ? '#22C55E' : '#FF7A00';
        ctx.shadowBlur = 22;
        ctx.shadowColor = dotColor;
        ctx.fillStyle = dotColor;

        ctx.beginPath();
        ctx.arc(playheadX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(playheadX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();

        if (curPitch.isInSur) {
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(playheadX, dotY, dotRadius + 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 10. Left Sidebar with Swara Names
      ctx.save();
      ctx.fillStyle = '#05070D';
      ctx.fillRect(0, 0, sidebarWidth, height);

      // Subtle gradient drop shadow
      const shadowGrad = ctx.createLinearGradient(sidebarWidth, 0, sidebarWidth + 12, 0);
      shadowGrad.addColorStop(0, 'rgba(5, 7, 13, 0.95)');
      shadowGrad.addColorStop(1, 'rgba(5, 7, 13, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(sidebarWidth, 0, 12, height);

      // Swara Labels
      for (let i = 0; i < totalLanes; i++) {
        const swara = SWARAS[totalLanes - 1 - i];
        const y = i * laneHeight;
        const isKeySwar = swara.id === 'S' || swara.id === 'P' || swara.id === 'S_taar';

        ctx.font = 'bold 12px "Outfit", sans-serif';
        ctx.fillStyle = isKeySwar ? '#F59E0B' : 'rgba(255, 255, 255, 0.75)';
        ctx.textAlign = 'left';
        ctx.fillText(swara.shortName, 10, y + laneHeight * 0.65);

        ctx.font = '11px "Noto Sans Devanagari", sans-serif';
        ctx.fillStyle = isKeySwar ? '#FBBF24' : 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(swara.devanagari, 30, y + laneHeight * 0.65);
      }

      // Sidebar border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sidebarWidth, 0);
      ctx.lineTo(sidebarWidth, height);
      ctx.stroke();
      ctx.restore();

      // =========================================================================
      // 11. TOP STATUS BADGE ON CANVAS
      // =========================================================================
      let statusText = '';
      let bannerColor = '#F59E0B';

      if (curReviewMode) {
        const nearestRec = (curRecordedPoints || []).find(
          p => Math.abs(p.timeSec - elapsedSec) <= 0.15
        );

        if (activeCrossingBlock && nearestRec) {
          const isMatch = nearestRec.swaraId === activeCrossingBlock.swaraId && nearestRec.isInSur;
          const devStr = nearestRec.centsDeviation >= 0 ? `+${nearestRec.centsDeviation}¢` : `${nearestRec.centsDeviation}¢`;
          statusText = `🎯 EXPECTED: ${activeCrossingBlock.label}  |  🎤 SUNG: ${nearestRec.swaraId} (${nearestRec.frequency.toFixed(1)}Hz, ${devStr}) ${isMatch ? '✨ IN SUR' : '⚠️ OFF'}`;
          bannerColor = isMatch ? '#22C55E' : '#F59E0B';
        } else if (activeCrossingBlock && !nearestRec) {
          statusText = `🎯 EXPECTED: ${activeCrossingBlock.label}  |  🎤 SUNG: [Gap / Silence]`;
          bannerColor = '#94A3B8';
        } else if (!activeCrossingBlock && nearestRec) {
          statusText = `🎯 EXPECTED: [Rest]  |  🎤 SUNG: ${nearestRec.swaraId} (${nearestRec.frequency.toFixed(1)}Hz)`;
          bannerColor = '#38BDF8';
        } else {
          statusText = `🔍 REVIEW MODE • Drag canvas or slider to inspect Expected vs Recorded`;
          bannerColor = '#38BDF8';
        }
      } else if (stage !== 'idle') {
        if (activeCrossingBlock?.type === 'assisted') {
          statusText = `🎧 GURU SINGS: ${activeCrossingBlock.label} (${activeRemaining.toFixed(1)}s left)`;
          bannerColor = '#F59E0B';
        } else if (activeCrossingBlock?.type === 'user') {
          statusText = `🎤 YOUR TURN: Sing "${activeCrossingBlock.label}" (${activeRemaining.toFixed(1)}s left)`;
          bannerColor = isHitActive ? '#22C55E' : '#FF7A00';
        } else {
          const upcoming = targetBlocks.find(b => b.startTimeSec > elapsedSec);
          if (upcoming?.type === 'user') {
            const timeToUser = (upcoming.startTimeSec - elapsedSec).toFixed(1);
            statusText = `👀 Take a breath... You sing in ${timeToUser}s!`;
            bannerColor = '#FF7A00';
          }
        }
      }

      if (statusText) {
        ctx.save();
        ctx.font = 'bold 11px "Outfit", sans-serif';
        const txtWidth = ctx.measureText(statusText).width;
        const bannerW = Math.max(300, txtWidth + 34);
        const bannerH = 26;
        const bannerX = width - bannerW - 14;
        const bannerY = 10;

        ctx.fillStyle = 'rgba(10, 14, 23, 0.92)';
        ctx.strokeStyle = bannerColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 13);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(statusText, bannerX + 14, bannerY + 17);

        ctx.fillStyle = bannerColor;
        ctx.beginPath();
        ctx.arc(bannerX + bannerW - 12, bannerY + 13, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } catch (err) {
      console.error('NoteHighwayCanvas render loop error:', err);
    } finally {
      // Always reset transform matrix cleanly
      ctx.setTransform(1, 0, 0, 1, 0, 0);
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
  }, []);

  // Mouse / Touch Interaction for Direct Canvas Drag-Scrubbing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isReviewMode || !onScrubTime) return;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartTimeRef.current = reviewElapsedSec;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isReviewMode || !isDragging || !onScrubTime) return;
    const pixelsPerSec = 125;
    const dx = e.clientX - dragStartXRef.current;
    // Moving mouse to the right pulls past into view (decreases time)
    const newSec = Math.max(0, Math.min(totalRoundSec, dragStartTimeRef.current - dx / pixelsPerSec));
    onScrubTime(newSec);
  };

  const handleMouseUp = () => {
    if (isDragging) setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isReviewMode || !onScrubTime) return;
    const pixelsPerSec = 125;
    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    const dt = (delta / pixelsPerSec) * 0.4;
    onScrubTime(Math.max(0, Math.min(totalRoundSec, reviewElapsedSec + dt)));
  };

  return (
    <div className="highway-canvas-container">
      <canvas
        ref={canvasRef}
        className="highway-canvas"
        style={{ cursor: isReviewMode ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
};
