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
}

interface NoteHighwayCanvasProps {
  currentPitch: DetectedPitch | null;
  targetBlocks: HighwayTargetBlock[];
  exerciseStartTimeMs: number | null; // null if idle or paused
  stage: 'idle' | 'demo' | 'countdown' | 'singing' | 'analysis';
  isHitActive: boolean; // true when user is matching pitch or guru is playing
  activeRemainingSec?: number; // duration remaining on current note
  audioLevel?: number; // 0 to 1 live volume level of singing voice
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
    if (stage === 'singing' && currentPitch) {
      const swaraIndex = SWARAS.findIndex(s => s.id === currentPitch.swara.id);
      const basePos = swaraIndex !== -1 ? swaraIndex : 0;
      const pos = basePos + currentPitch.centsDeviation / 100;

      userPitchTrailRef.current.push({
        timeMs: performance.now(),
        semitonePos: pos,
        isInSur: currentPitch.isInSur,
      });

      // Keep last 10 seconds of pitch points
      const cutoff = performance.now() - 10000;
      userPitchTrailRef.current = userPitchTrailRef.current.filter(p => p.timeMs > cutoff);
    } else if (stage === 'idle' || stage === 'demo' || stage === 'countdown') {
      userPitchTrailRef.current = [];
    }
  }, [currentPitch, stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    const pixelsPerSec = 120; // 120 px/sec scrolling speed
    const playheadX = 160; // Playhead vertical line position from left (px)
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

      // 1. Deep obsidian background
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, width, height);

      const totalLanes = SWARAS.length;
      const laneHeight = height / totalLanes;

      // 2. Draw Horizontal Swara Lanes
      for (let i = 0; i < totalLanes; i++) {
        const swara = SWARAS[totalLanes - 1 - i];
        const y = i * laneHeight;
        const isKeySwar = swara.id === 'S' || swara.id === 'P' || swara.id === 'S_taar';

        if (isKeySwar) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
          ctx.fillRect(0, y, width, laneHeight);
        } else if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.012)';
          ctx.fillRect(0, y, width, laneHeight);
        }

        // Lane separator line
        ctx.strokeStyle = isKeySwar ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = isKeySwar ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(sidebarWidth, y + laneHeight);
        ctx.lineTo(width, y + laneHeight);
        ctx.stroke();
      }

      // Elapsed time in current phase
      const now = performance.now();
      const elapsedSec = exerciseStartTimeMs !== null ? (now - exerciseStartTimeMs) / 1000 : 0;

      let activeCrossingBlock: HighwayTargetBlock | null = null;
      let activeRemainingSec = 0;

      // 3. Draw Scrolling Target Note Blocks (Capsules)
      if (targetBlocks.length > 0) {
        targetBlocks.forEach((block) => {
          const swaraIdx = SWARAS.findIndex(s => s.id === block.swaraId);
          if (swaraIdx === -1) return;
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
            const isCurrentlyHit = isCrossingPlayhead && isHitActive;

            const rx = Math.max(sidebarWidth, blockFrontX);
            const rw = Math.min(width - rx, blockBackX - rx);

            if (rw > 0) {
              ctx.save();

              // Draw base capsule background
              ctx.beginPath();
              ctx.roundRect(rx, laneY + 4, rw, laneHeight - 8, 8);

              if (isCurrentlyHit) {
                // Neon glow
                ctx.shadowBlur = 18;
                ctx.shadowColor = stage === 'demo' ? '#F59E0B' : '#10B981';
                ctx.fillStyle = stage === 'demo' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)';
                ctx.fill();
                ctx.strokeStyle = stage === 'demo' ? '#FBBF24' : '#34D399';
                ctx.lineWidth = 2.5;
                ctx.stroke();
              } else if (isCrossingPlayhead) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = 2;
                ctx.stroke();
              } else {
                ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
              ctx.restore();

              // If crossing playhead, draw the progress fill for the part already passed
              if (isCrossingPlayhead && playheadX > rx) {
                const filledWidth = Math.min(rw, playheadX - rx);
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(rx, laneY + 4, filledWidth, laneHeight - 8, [8, 0, 0, 8]);
                ctx.fillStyle = isCurrentlyHit
                  ? (stage === 'demo' ? 'rgba(245, 158, 11, 0.65)' : 'rgba(16, 185, 129, 0.65)')
                  : 'rgba(255, 255, 255, 0.2)';
                ctx.fill();
                ctx.restore();
              }

              // Text Label on Block
              ctx.save();
              const labelX = Math.max(sidebarWidth + 10, blockFrontX + 12);
              if (labelX < blockBackX - 10) {
                ctx.font = 'bold 12px "Outfit", sans-serif';
                ctx.fillStyle = isCurrentlyHit ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)';

                if (isCrossingPlayhead) {
                  ctx.fillText(`${block.label} • ${activeRemainingSec.toFixed(1)}s left`, labelX, laneY + laneHeight * 0.65);
                } else {
                  ctx.fillText(`${block.label} (${block.durationSec}s)`, labelX, laneY + laneHeight * 0.65);
                }
              }
              ctx.restore();
            }

            // Spawn spark particles at contact point during hit
            if (isCurrentlyHit && Math.random() < 0.65) {
              particlesRef.current.push({
                x: playheadX,
                y: laneY + laneHeight * 0.5 + (Math.random() * 14 - 7),
                vx: -(Math.random() * 2 + 1),
                vy: (Math.random() - 0.5) * 2.5,
                size: Math.random() * 3 + 2,
                color: stage === 'demo' ? '#FBBF24' : '#34D399',
                alpha: 1,
                life: 30,
              });
            }
          }
        });
      }

      // 4. Draw User's Live Singing Pitch Trail
      if (stage === 'singing' && userPitchTrailRef.current.length > 1) {
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

        ctx.shadowBlur = 12;
        ctx.shadowColor = currentPitch?.isInSur ? '#10B981' : '#F59E0B';
        ctx.strokeStyle = currentPitch?.isInSur ? '#34D399' : '#FBBF24';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // 5. Draw Particle Hit Sparks
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

      // 6. Draw Vertical Target Playhead
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = stage === 'singing' ? '#10B981' : stage === 'demo' ? '#F59E0B' : 'rgba(255, 255, 255, 0.4)';
      ctx.strokeStyle = stage === 'singing' ? '#10B981' : stage === 'demo' ? '#F59E0B' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top Playhead Pointer Arrow
      ctx.fillStyle = stage === 'singing' ? '#10B981' : stage === 'demo' ? '#F59E0B' : '#64748B';
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
      ctx.fillText(stage === 'singing' ? 'SING HERE' : stage === 'demo' ? 'GURU SINGS' : 'PLAYHEAD', playheadX, 22);
      ctx.restore();

      // 7a. Guru Acoustic Vocal Wave on Playhead (during demo)
      if (stage === 'demo' && isHitActive && activeCrossingBlock) {
        const swaraIdx = SWARAS.findIndex(s => s.id === (activeCrossingBlock as HighwayTargetBlock).swaraId);
        if (swaraIdx !== -1) {
          const laneY = (totalLanes - 1 - swaraIdx) * laneHeight;
          const centerY = laneY + laneHeight * 0.5;
          const lvl = Math.max(0.15, audioLevel || 0.65);

          ctx.save();
          // Radiating acoustic soundwave rings
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.3 + lvl * 0.6})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(playheadX, centerY, 8 + lvl * 20, 0, Math.PI * 2);
          ctx.stroke();

          // Vocal glowing core
          ctx.fillStyle = '#F59E0B';
          ctx.shadowBlur = 22;
          ctx.shadowColor = '#FBBF24';
          ctx.beginPath();
          ctx.arc(playheadX, centerY, 7 + lvl * 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(playheadX, centerY, 4, 0, Math.PI * 2);
          ctx.fill();

          // Vocal frequency & volume level badge
          ctx.font = 'bold 11px "Outfit", sans-serif';
          ctx.fillStyle = '#FBBF24';
          ctx.textAlign = 'left';
          ctx.fillText(`🎙️ Guru Voice: ${(lvl * 100).toFixed(0)}%`, playheadX + 18, centerY + 4);
          ctx.restore();
        }
      }

      // 7b. Live Vocal Cursor Dot on Playhead (during singing)
      if (stage === 'singing' && currentPitch) {
        const swaraIndex = SWARAS.findIndex(s => s.id === currentPitch.swara.id);
        const basePos = swaraIndex !== -1 ? swaraIndex : 0;
        const currentPos = basePos + currentPitch.centsDeviation / 100;
        const dotY = height - (currentPos + 0.5) * laneHeight;
        const userVol = Math.max(0.15, audioLevel || (currentPitch.clarity * 0.7));
        const dotRadius = 7 + userVol * 9;

        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = currentPitch.isInSur ? '#10B981' : '#F59E0B';
        ctx.fillStyle = currentPitch.isInSur ? '#10B981' : '#F59E0B';

        ctx.beginPath();
        ctx.arc(playheadX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(playheadX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Radiating pulse ring when matching pure sur
        if (currentPitch.isInSur) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(playheadX, dotY, dotRadius + 7, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Guidance text badge next to cursor
        if (activeCrossingBlock) {
          const targetSwaraIdx = SWARAS.findIndex(s => s.id === (activeCrossingBlock as HighwayTargetBlock).swaraId);
          const diffSemitones = currentPos - targetSwaraIdx;

          ctx.font = 'bold 11px "Outfit", sans-serif';
          ctx.textAlign = 'left';

          if (Math.abs(diffSemitones) <= 0.35 && currentPitch.isInSur) {
            ctx.fillStyle = '#34D399';
            ctx.fillText(`✨ IN SUR (${(userVol * 100).toFixed(0)}%)`, playheadX + 16, dotY + 4);
          } else if (diffSemitones < -0.2) {
            ctx.fillStyle = '#FBBF24';
            ctx.fillText('▲ Sing Higher', playheadX + 16, dotY + 4);
          } else if (diffSemitones > 0.2) {
            ctx.fillStyle = '#FBBF24';
            ctx.fillText('▼ Sing Lower', playheadX + 16, dotY + 4);
          }
        }
        ctx.restore();
      }

      // 8. Draw Opaque Left Sidebar (so blocks cleanly slide underneath)
      ctx.save();
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, sidebarWidth, height);

      // Subtle gradient drop shadow to right
      const shadowGrad = ctx.createLinearGradient(sidebarWidth, 0, sidebarWidth + 12, 0);
      shadowGrad.addColorStop(0, 'rgba(6, 10, 18, 0.9)');
      shadowGrad.addColorStop(1, 'rgba(6, 10, 18, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(sidebarWidth, 0, 12, height);

      // Draw Swara names in sidebar
      for (let i = 0; i < totalLanes; i++) {
        const swara = SWARAS[totalLanes - 1 - i];
        const y = i * laneHeight;
        const isKeySwar = swara.id === 'S' || swara.id === 'P' || swara.id === 'S_taar';

        ctx.font = 'bold 12px "Outfit", sans-serif';
        ctx.fillStyle = isKeySwar ? '#F59E0B' : 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'left';
        ctx.fillText(swara.shortName, 10, y + laneHeight * 0.65);

        ctx.font = '11px "Noto Sans Devanagari", sans-serif';
        ctx.fillStyle = isKeySwar ? '#FBBF24' : 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(swara.devanagari, 30, y + laneHeight * 0.65);
      }

      // Sidebar dividing border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sidebarWidth, 0);
      ctx.lineTo(sidebarWidth, height);
      ctx.stroke();
      ctx.restore();

      // 9. Floating Top HUD Banner (Live Status & Time Remaining)
      if (activeCrossingBlock && (stage === 'singing' || stage === 'demo')) {
        const activeBlock = activeCrossingBlock as HighwayTargetBlock;
        ctx.save();
        const bannerW = 280;
        const bannerH = 28;
        const bannerX = width - bannerW - 16;
        const bannerY = 12;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = stage === 'singing' ? (isHitActive ? '#10B981' : '#F59E0B') : '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 14);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 11px "Outfit", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        const statusText = stage === 'demo'
          ? `🎧 Guru Singing: ${activeBlock.label} (${activeRemainingSec.toFixed(1)}s)`
          : `🎤 Sing "${activeBlock.label}": ${activeRemainingSec.toFixed(1)}s left`;
        ctx.fillText(statusText, bannerX + 14, bannerY + 18);

        // Circular timer or dot
        ctx.fillStyle = isHitActive ? '#10B981' : '#F59E0B';
        ctx.beginPath();
        ctx.arc(bannerX + bannerW - 16, bannerY + 14, 5, 0, Math.PI * 2);
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
  }, [stage, exerciseStartTimeMs, targetBlocks, isHitActive, currentPitch, audioLevel]);

  return (
    <div className="highway-canvas-container">
      <canvas ref={canvasRef} className="highway-canvas" />
    </div>
  );
};
