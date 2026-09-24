import { Volume2, Zap } from 'lucide-react';
import type { DetectedPitch } from '../types/music';

interface SurMeterProps {
  detectedPitch: DetectedPitch | null;
  volumePercent: number;
  isMicActive: boolean;
  onStartMic: () => void;
}

export const SurMeter: React.FC<SurMeterProps> = ({
  detectedPitch,
  volumePercent,
  isMicActive,
  onStartMic,
}) => {
  // Needle angle: -50 cents maps to -65 deg, +50 cents maps to +65 deg
  const cents = detectedPitch ? detectedPitch.centsDeviation : 0;
  const needleAngle = Math.max(-65, Math.min(65, (cents / 50) * 65));

  // Determine status color and label
  let statusColor = '#64748B'; // idle gray
  let statusText = 'Waiting for your voice... (गाना शुरू करें)';
  let statusTag = 'idle';

  if (!isMicActive) {
    statusText = 'Microphone is off (माइक बंद है)';
  } else if (detectedPitch) {
    const absDeviation = Math.abs(detectedPitch.centsDeviation);
    if (absDeviation <= 12) {
      statusColor = '#10B981'; // emerald green
      statusText = '✨ Perfect Sur! (एकदम सुर में)';
      statusTag = 'perfect';
    } else if (detectedPitch.centsDeviation < -12) {
      statusColor = '#F59E0B'; // amber flat
      statusText = `Flat (उतरा हुआ: ${Math.abs(detectedPitch.centsDeviation)} cents)`;
      statusTag = 'flat';
    } else {
      statusColor = '#EF4444'; // red sharp
      statusText = `Sharp (चढ़ा हुआ: +${detectedPitch.centsDeviation} cents)`;
      statusTag = 'sharp';
    }
  }

  const octaveLabel = detectedPitch ? (
    detectedPitch.octaveOffset === -1 ? 'मंद्र सप्तक (Lower Octave)' :
    detectedPitch.octaveOffset === 0 ? 'मध्य सप्तक (Middle Octave)' :
    detectedPitch.octaveOffset === 1 ? 'तार सप्तक (Higher Octave)' :
    detectedPitch.octaveOffset < -1 ? 'अतिमंद्र सप्तक' : 'अतितार सप्तक'
  ) : 'मध्य सप्तक';

  return (
    <div className="sur-meter-card">
      {/* Header Info */}
      <div className="meter-top-bar">
        <div className="saptak-pill">
          <span className="dot" style={{ backgroundColor: statusColor }} />
          <span>{octaveLabel}</span>
        </div>

        <div className="volume-indicator-wrap" title={`Mic Volume: ${Math.round(volumePercent)}%`}>
          <Volume2 size={15} className="vol-icon" />
          <div className="vol-bar-bg">
            <div
              className="vol-bar-fill"
              style={{
                width: `${volumePercent}%`,
                backgroundColor: volumePercent > 80 ? '#EF4444' : volumePercent > 20 ? '#10B981' : '#64748B'
              }}
            />
          </div>
        </div>
      </div>

      {/* Semi-circular Dial with Needle */}
      <div className="dial-container">
        <svg viewBox="0 0 320 180" className="dial-svg">
          <defs>
            {/* Glow filters */}
            <filter id="needleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="25%" stopColor="#F59E0B" />
              <stop offset="42%" stopColor="#10B981" />
              <stop offset="58%" stopColor="#10B981" />
              <stop offset="75%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background Arc Track */}
          <path
            d="M 40 160 A 120 120 0 0 1 280 160"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Active Gradient Sur Arc */}
          <path
            d="M 40 160 A 120 120 0 0 1 280 160"
            fill="none"
            stroke="url(#arcGrad)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Perfect Sur Sweet Spot Highlight (-12 to +12 cents) */}
          <path
            d="M 140 42 A 120 120 0 0 1 180 42"
            fill="none"
            stroke="#10B981"
            strokeWidth="14"
            strokeLinecap="round"
            filter="url(#needleGlow)"
            opacity="0.85"
          />

          {/* Tick Marks */}
          {[-50, -25, 0, 25, 50].map((c) => {
            const rad = ((c / 50) * 65 - 90) * (Math.PI / 180);
            const x1 = 160 + 120 * Math.cos(rad);
            const y1 = 160 + 120 * Math.sin(rad);
            const x2 = 160 + 106 * Math.cos(rad);
            const y2 = 160 + 106 * Math.sin(rad);
            return (
              <g key={c}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={c === 0 ? '#10B981' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={c === 0 ? 3 : 1.5}
                />
                <text
                  x={160 + 94 * Math.cos(rad)}
                  y={160 + 94 * Math.sin(rad) + 4}
                  fill={c === 0 ? '#10B981' : 'rgba(255,255,255,0.5)'}
                  fontSize="10"
                  fontWeight={c === 0 ? '700' : '400'}
                  textAnchor="middle"
                >
                  {c > 0 ? `+${c}` : c}
                </text>
              </g>
            );
          })}

          {/* Rotating Needle */}
          <g
            transform={`rotate(${needleAngle}, 160, 160)`}
            style={{ transition: 'transform 0.1s cubic-bezier(0.1, 0.9, 0.2, 1)' }}
          >
            {/* Needle Glow line */}
            <line
              x1="160"
              y1="160"
              x2="160"
              y2="42"
              stroke={statusColor}
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#needleGlow)"
            />
            <circle cx="160" cy="42" r="5" fill="#FFFFFF" />
          </g>

          {/* Center Hub */}
          <circle cx="160" cy="160" r="14" fill="#1E293B" stroke={statusColor} strokeWidth="3" />
          <circle cx="160" cy="160" r="6" fill="#F8FAFC" />
        </svg>

        {/* Center Swara Display */}
        <div className="center-swara-box">
          {detectedPitch ? (
            <div className="swara-detected-animation">
              <span className="swara-devanagari" style={{ color: statusColor }}>
                {detectedPitch.swara.devanagari}
              </span>
              <div className="swara-names-row">
                <span className="swara-short">{detectedPitch.swara.shortName}</span>
                <span className="swara-full">({detectedPitch.swara.fullName})</span>
              </div>
            </div>
          ) : (
            <div className="swara-empty">
              {isMicActive ? (
                <span className="sing-prompt">Sing Sa, Re, Ga...</span>
              ) : (
                <button className="start-mic-action" onClick={onStartMic}>
                  <Zap size={16} /> Click to Start Mic
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sur Status Badge */}
      <div className={`sur-status-banner status-${statusTag}`}>
        <span className="status-label-text">{statusText}</span>
      </div>

      {/* Precision Stats Footer */}
      <div className="meter-stats-row">
        <div className="stat-item">
          <span className="stat-label">Frequency (Hz)</span>
          <span className="stat-value">{detectedPitch ? `${detectedPitch.frequency} Hz` : '--'}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Cents Deviation</span>
          <span className="stat-value" style={{ color: statusColor }}>
            {detectedPitch ? (detectedPitch.centsDeviation > 0 ? `+${detectedPitch.centsDeviation} ¢` : `${detectedPitch.centsDeviation} ¢`) : '--'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Clarity (सटीकता)</span>
          <span className="stat-value">
            {detectedPitch ? `${Math.round(detectedPitch.clarity * 100)}%` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};
