import React, { useRef, useEffect } from 'react';
import { SWARAS } from '../types/music';
import type { DetectedPitch } from '../types/music';

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

export interface HighwayTargetBlock {
  swaraId: string;
  startTimeSec: number; // time relative to exercise start
  durationSec: number;
  label: string;
  type: 'assisted' | 'user'; // 'assisted' = Guru guide (Saffron/Gold), 'user' = User singing (Padhanisa Orange/Cyan)
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
}

export const NoteHighwayCanvas: React.FC<NoteHighwayCanvasProps> = ({
  currentPitch,
  targetBlocks,
  exerciseStartTimeMs,
  stage,
  isHitActive,
  audioLevel = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const userPitchTrailRef = useRef<{ timeMs: number; semitonePos: number; isInSur: boolean }[]>([]);
  const animRef = useRef<number | null>(null);

  // Keep user pitch trail updated
  useEffect(() => {
    if (stage === 'practicing' && currentPitch) {
      const swaraIndex = SWARAS.findIndex(s => s.id === currentPitch.swara.id);
      const basePos = swaraIndex !== -1 ? swaraIndex : 0;
      const pos = basePos + currentPitch.centsDeviation / 100;

      userPitchTrailRef.current.push({
        timeMs: performance.now(),
        semitonePos: pos,
        isInSur: currentPitch.isInSur,
      });

      // Keep last 8 seconds of pitch history
      const cutoff = performance.now() - 8000;
      userPitchTrailRef.current = userPitchTrailRef.current.filter(p => p.timeMs > cutoff);
    } else if (stage === 'idle') {
      userPitchTrailRef.current = [];
    }
  }, [currentPitch, stage]);

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

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

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

      // Vertical Measure Beat Lines (Dividers every 250px)
      const now = performance.now();
      const elapsedSec = exerciseStartTimeMs !== null ? (now - exerciseStartTimeMs) / 1000 : 0;
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

      // 3. Left-of-Playhead Spotlight Luminous Glow (as seen in Padhanisa screenshot)
      const leftSpotlight = ctx.createLinearGradient(playheadX - 140, 0, playheadX, 0);
      leftSpotlight.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
      leftSpotlight.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
      ctx.fillStyle = leftSpotlight;
      ctx.fillRect(Math.max(sidebarWidth, playheadX - 140), 0, playheadX - Math.max(sidebarWidth, playheadX - 140), height);

      let activeCrossingBlock: HighwayTargetBlock | null = null;
      let activeRemainingSec = 0;

      // 4. Draw Connecting Melody Step Lines (as seen in Padhanisa screenshot)
      if (targetBlocks.length > 1) {
        for (let i = 0; i < targetBlocks.length - 1; i++) {
          const b1 = targetBlocks[i];
          const b2 = targetBlocks[i + 1];

          // Only connect blocks of the same phase (e.g. assisted to assisted, or user to user)
          if (b1.type === b2.type) {
            const idx1 = SWARAS.findIndex(s => s.id === b1.swaraId);
            const idx2 = SWARAS.findIndex(s => s.id === b2.swaraId);
            if (idx1 !== -1 && idx2 !== -1) {
              const y1 = (totalLanes - 1 - idx1) * laneHeight + laneHeight * 0.5;
              const y2 = (totalLanes - 1 - idx2) * laneHeight + laneHeight * 0.5;

              const x1 = playheadX + (b1.startTimeSec + b1.durationSec - elapsedSec) * pixelsPerSec;
              const x2 = playheadX + (b2.startTimeSec - elapsedSec) * pixelsPerSec;

              if (x2 > sidebarWidth && x1 < width) {
                ctx.save();
                ctx.strokeStyle = b1.type === 'assisted' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 122, 0, 0.25)';
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

      // 5. Draw Target Note Bars (Padhanisa Stepped Bars)
      if (targetBlocks.length > 0) {
        for (const block of targetBlocks) {
          const swaraIdx = SWARAS.findIndex(s => s.id === block.swaraId);
          if (swaraIdx === -1) continue;
          const laneY = (totalLanes - 1 - swaraIdx) * laneHeight;

          // Compute X based on scroll
          const blockFrontX = playheadX + (block.startTimeSec - elapsedSec) * pixelsPerSec;
          const blockWidth = block.durationSec * pixelsPerSec;
          const blockBackX = blockFrontX + blockWidth;

          // Check if currently crossing playhead
          const isCrossingPlayhead = blockFrontX <= playheadX && blockBackX >= playheadX;
          if (isCrossingPlayhead) {
            activeCrossingBlock = block;
            activeRemainingSec = Math.max(0, (blockBackX - playheadX) / pixelsPerSec);
          }

          // Only render if visible in viewport
          if (blockBackX > sidebarWidth && blockFrontX < width) {
            const isAssisted = block.type === 'assisted';
            const rx = Math.max(sidebarWidth, blockFrontX);
            const rw = Math.min(width - rx, blockBackX - rx);

            if (rw > 0) {
              ctx.save();
              ctx.beginPath();
              // Rounded horizontal bar matching Padhanisa
              ctx.roundRect(rx, laneY + 5, rw, laneHeight - 10, 5);

              if (isAssisted) {
                // ==========================================
                // ASSISTED (GURU) NOTE: ROYAL SAFFRON / GOLD
                // ==========================================
                if (isCrossingPlayhead) {
                  // Active Guru Singing: Golden Luminous Glow
                  ctx.shadowBlur = 18;
                  ctx.shadowColor = '#F59E0B';
                  ctx.fillStyle = '#F59E0B';
                  ctx.fill();
                  ctx.strokeStyle = '#FDE68A';
                  ctx.lineWidth = 2.5;
                  ctx.stroke();
                } else {
                  // Approaching Guru Note: Warm Amber Bar
                  ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                }
              } else {
                // ==========================================
                // USER (YOU) NOTE: PADHANISA ORANGE & GREEN
                // ==========================================
                if (isCrossingPlayhead) {
                  if (isHitActive) {
                    // Match! Pure Green (matching Padhanisa screenshot green hit bar!)
                    ctx.shadowBlur = 22;
                    ctx.shadowColor = '#22C55E';
                    ctx.fillStyle = '#22C55E';
                    ctx.fill();
                    ctx.strokeStyle = '#86EFAC';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                  } else {
                    // Active Singing (Orange bar)
                    ctx.shadowBlur = 16;
                    ctx.shadowColor = '#FF7A00';
                    ctx.fillStyle = '#FF7A00';
                    ctx.fill();
                    ctx.strokeStyle = '#FED7AA';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                  }
                } else {
                  // Approaching User Note: Bold Tangerine Orange Bar
                  ctx.fillStyle = 'rgba(255, 122, 0, 0.32)';
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(255, 122, 0, 0.85)';
                  ctx.lineWidth = 1.8;
                  ctx.stroke();
                }
              }
              ctx.restore();

              // If crossing playhead, draw progress fill / past portion outline
              if (isCrossingPlayhead && playheadX > rx) {
                const filledWidth = Math.min(rw, playheadX - rx);
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(rx, laneY + 5, filledWidth, laneHeight - 10, [5, 0, 0, 5]);

                if (isAssisted) {
                  ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
                } else {
                  ctx.fillStyle = isHitActive ? 'rgba(34, 197, 94, 0.9)' : 'rgba(255, 122, 0, 0.85)';
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

                const rolePrefix = isAssisted ? '🎧 GURU' : '🎤 YOU';
                if (isCrossingPlayhead) {
                  ctx.fillText(`${rolePrefix} • ${block.label}`, labelX, laneY + laneHeight * 0.65);
                } else {
                  ctx.fillText(`${rolePrefix} • ${block.label} (${block.durationSec}s)`, labelX, laneY + laneHeight * 0.65);
                }
              }
              ctx.restore();
            }

            // Spawn spark particles on hit
            const shouldSpark = isCrossingPlayhead && (isAssisted || isHitActive);
            if (shouldSpark && Math.random() < 0.6) {
              particlesRef.current.push({
                x: playheadX,
                y: laneY + laneHeight * 0.5 + (Math.random() * 12 - 6),
                vx: -(Math.random() * 2 + 1),
                vy: (Math.random() - 0.5) * 2,
                size: Math.random() * 3 + 2,
                color: isAssisted ? '#FBBF24' : isHitActive ? '#22C55E' : '#FF7A00',
                alpha: 1,
                life: 28,
              });
            }
          }
        }
      }

      // 6. Draw User's Continuous Vocal Pitch Trail (Curve on Left of Playhead, as seen in screenshot)
      if (stage !== 'idle' && userPitchTrailRef.current.length > 1) {
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

        // Color matches Padhanisa: Bright Green when in Sur, Orange/Red when transitioning!
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

      // 7. Hit Spark Particles
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

      // 8. Vertical Target Playhead (Beam Line)
      const isAssistedCrossing = activeCrossingBlock?.type === 'assisted';
      const isUserCrossing = activeCrossingBlock?.type === 'user';
      const playheadColor = isAssistedCrossing ? '#F59E0B' : (isUserCrossing && isHitActive) ? '#22C55E' : isUserCrossing ? '#FF7A00' : 'rgba(255, 255, 255, 0.4)';

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
      const playheadBadge = isAssistedCrossing ? 'GURU' : isUserCrossing ? 'YOU' : 'READY';
      ctx.fillText(playheadBadge, playheadX, 22);
      ctx.restore();

      // 9a. Guru Acoustic Soundwaves on Playhead (during assisted guide)
      if (isAssistedCrossing && activeCrossingBlock) {
        const swaraIdx = SWARAS.findIndex(s => s.id === (activeCrossingBlock as HighwayTargetBlock).swaraId);
        if (swaraIdx !== -1) {
          const laneY = (totalLanes - 1 - swaraIdx) * laneHeight;
          const centerY = laneY + laneHeight * 0.5;
          const lvl = Math.max(0.2, audioLevel || 0.65);

          ctx.save();
          // Radiating acoustic soundwave rings
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.3 + lvl * 0.6})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(playheadX, centerY, 8 + lvl * 22, 0, Math.PI * 2);
          ctx.stroke();

          // Golden vocal core
          ctx.fillStyle = '#F59E0B';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#FBBF24';
          ctx.beginPath();
          ctx.arc(playheadX, centerY, 7 + lvl * 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(playheadX, centerY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 9b. Bright Glowing Cursor Dot on Playhead (matching screenshot)
      if (stage !== 'idle' && currentPitch) {
        const swaraIndex = SWARAS.findIndex(s => s.id === currentPitch.swara.id);
        const basePos = swaraIndex !== -1 ? swaraIndex : 0;
        const currentPos = basePos + currentPitch.centsDeviation / 100;
        const dotY = height - (currentPos + 0.5) * laneHeight;
        const userVol = Math.max(0.15, audioLevel || (currentPitch.clarity * 0.7));
        const dotRadius = 7 + userVol * 8;

        ctx.save();
        // Dot Color: Pure Green when in sur, Orange when off
        const dotColor = currentPitch.isInSur ? '#22C55E' : '#FF7A00';
        ctx.shadowBlur = 22;
        ctx.shadowColor = dotColor;
        ctx.fillStyle = dotColor;

        ctx.beginPath();
        ctx.arc(playheadX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // White bright center core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(playheadX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Radiating pulse ring when matching pure sur
        if (currentPitch.isInSur) {
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

      // 11. Top Status Badge on Canvas
      if (stage !== 'idle') {
        let statusText = '';
        let bannerColor = '#F59E0B';

        if (activeCrossingBlock?.type === 'assisted') {
          statusText = `🎧 GURU SINGS: ${activeCrossingBlock.label} (${activeRemainingSec.toFixed(1)}s left)`;
          bannerColor = '#F59E0B';
        } else if (activeCrossingBlock?.type === 'user') {
          statusText = `🎤 YOUR TURN: Sing "${activeCrossingBlock.label}" (${activeRemainingSec.toFixed(1)}s left)`;
          bannerColor = isHitActive ? '#22C55E' : '#FF7A00';
        } else {
          // Check upcoming block
          const upcoming = targetBlocks.find(b => b.startTimeSec > elapsedSec);
          if (upcoming?.type === 'user') {
            const timeToUser = (upcoming.startTimeSec - elapsedSec).toFixed(1);
            statusText = `👀 Take a breath... You sing in ${timeToUser}s!`;
            bannerColor = '#FF7A00';
          } else if (upcoming?.type === 'assisted') {
            const timeToAssisted = (upcoming.startTimeSec - elapsedSec).toFixed(1);
            statusText = `🎧 Guru will sing in ${timeToAssisted}s...`;
            bannerColor = '#F59E0B';
          }
        }

        if (statusText) {
          ctx.save();
          const bannerW = 310;
          const bannerH = 26;
          const bannerX = width - bannerW - 14;
          const bannerY = 10;

          ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
          ctx.strokeStyle = bannerColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 13);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 11px "Outfit", sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'left';
          ctx.fillText(statusText, bannerX + 12, bannerY + 17);

          ctx.fillStyle = bannerColor;
          ctx.beginPath();
          ctx.arc(bannerX + bannerW - 12, bannerY + 13, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
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
  }, [stage, exerciseStartTimeMs, targetBlocks, isHitActive, currentPitch, audioLevel]);

  return (
    <div className="highway-canvas-container">
      <canvas ref={canvasRef} className="highway-canvas" />
    </div>
  );
};
