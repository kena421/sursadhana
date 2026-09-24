import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { TAALS } from '../types/music';
import type { TaalDefinition, TaalMatra } from '../types/music';
import { taalService } from '../services/taalService';

interface TaalPanelProps {
  isActive: boolean;
  onToggleActive: () => void;
  baseFrequency: number;
}

export const TaalPanel: React.FC<TaalPanelProps> = ({
  isActive,
  onToggleActive,
  baseFrequency,
}) => {
  const [selectedTaal, setSelectedTaal] = useState<TaalDefinition>(taalService.getTaal());
  const [bpm, setBpm] = useState<number>(taalService.getBpm());
  const [currentMatra, setCurrentMatra] = useState<TaalMatra | null>(null);
  const [volume, setVolume] = useState<number>(0.8);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    taalService.setBasePitch(baseFrequency);
  }, [baseFrequency]);

  useEffect(() => {
    const unsub = taalService.subscribeBeat((matra) => {
      setCurrentMatra(matra);
    });
    return () => {
      unsub();
    };
  }, []);

  const handleSelectTaal = (id: string) => {
    taalService.setTaal(id);
    const updated = taalService.getTaal();
    setSelectedTaal(updated);
    setBpm(updated.defaultBpm);
  };

  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    taalService.setBpm(newBpm);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    taalService.setVolume(newVol);
  };

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    taps.push(now);

    // Keep only last 4 taps within 3 seconds
    if (taps.length > 4) taps.shift();
    const recentTaps = taps.filter(t => now - t < 3000);
    tapTimesRef.current = recentTaps;

    if (recentTaps.length >= 2) {
      let intervalsSum = 0;
      for (let i = 1; i < recentTaps.length; i++) {
        intervalsSum += recentTaps[i] - recentTaps[i - 1];
      }
      const avgInterval = intervalsSum / (recentTaps.length - 1);
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 240) {
        handleBpmChange(calculatedBpm);
      }
    }
  };

  // Helper for circular layout
  const radius = 95;
  const centerX = 120;
  const centerY = 120;

  return (
    <div className="taal-panel-card">
      <div className="panel-header">
        <div className="title-block">
          <div className="icon-badge">🥁</div>
          <div>
            <h2 className="panel-title">Taal & Tabla Companion (ताल एवं ठेका)</h2>
            <p className="panel-sub">
              Procedural Tabla Accompaniment • {selectedTaal.totalMatras} Matras ({selectedTaal.name})
            </p>
          </div>
        </div>

        <button
          className={`play-btn-large ${isActive ? 'playing' : ''}`}
          onClick={onToggleActive}
        >
          {isActive ? <Pause size={20} /> : <Play size={20} />}
          <span>{isActive ? 'Pause Taal' : 'Start Theka'}</span>
        </button>
      </div>

      {/* Taal Selection Tabs */}
      <div className="taal-chips-row">
        {TAALS.map((taal) => (
          <button
            key={taal.id}
            className={`taal-chip-btn ${selectedTaal.id === taal.id ? 'active' : ''}`}
            onClick={() => handleSelectTaal(taal.id)}
          >
            <span className="taal-chip-name">{taal.name}</span>
            <span className="taal-chip-matras">{taal.totalMatras} Beats</span>
          </button>
        ))}
      </div>

      {/* Hero Visualizer: Circular Wheel + Current Beat Callout */}
      <div className="taal-visualizer-split">
        {/* Circular Mandala Beat Wheel */}
        <div className="circle-wheel-wrap">
          <svg viewBox="0 0 240 240" className="taal-wheel-svg">
            <defs>
              <filter id="beatGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Circular Track */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="10"
            />

            {/* Matra Markers on Circle */}
            {selectedTaal.matras.map((m, idx) => {
              const angle = ((idx / selectedTaal.totalMatras) * 360 - 90) * (Math.PI / 180);
              const x = centerX + radius * Math.cos(angle);
              const y = centerY + radius * Math.sin(angle);
              const isCurrent = currentMatra?.matra === m.matra && isActive;

              let markerColor = 'rgba(255, 255, 255, 0.3)';
              if (m.type === 'sam') markerColor = '#EF4444'; // Red for Sam
              else if (m.type === 'tali') markerColor = '#F59E0B'; // Gold for Tali
              else if (m.type === 'khali') markerColor = '#06B6D4'; // Cyan for Khali

              return (
                <g key={m.matra}>
                  {/* Connecting notch */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isCurrent ? 14 : m.type === 'sam' ? 10 : 7}
                    fill={isCurrent ? (m.type === 'sam' ? '#EF4444' : '#10B981') : '#1E293B'}
                    stroke={markerColor}
                    strokeWidth={isCurrent ? 3 : 2}
                    filter={isCurrent ? 'url(#beatGlow)' : undefined}
                    className="matra-circle"
                  />
                  <text
                    x={x}
                    y={y + 4}
                    fill={isCurrent ? '#FFFFFF' : markerColor}
                    fontSize={isCurrent ? '11' : '9'}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {m.matra}
                  </text>
                </g>
              );
            })}

            {/* Center Display */}
            <circle cx={centerX} cy={centerY} r="52" fill="#131826" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" />
            <text x={centerX} y={centerY - 10} fill="#94A3B8" fontSize="11" textAnchor="middle">
              {selectedTaal.hindiName}
            </text>
            <text x={centerX} y={centerY + 16} fill="#F8FAFC" fontSize="22" fontWeight="800" textAnchor="middle">
              {currentMatra ? currentMatra.bol : selectedTaal.matras[0].bol}
            </text>
          </svg>
        </div>

        {/* Current Beat Callout Info Card */}
        <div className="current-beat-hero-card">
          <div className="beat-status-badge">
            {currentMatra?.type === 'sam' ? (
              <span className="badge-sam">🔴 सम (Sam - Beat 1)</span>
            ) : currentMatra?.type === 'khali' ? (
              <span className="badge-khali">⚪ खाली (Khali - 0)</span>
            ) : currentMatra?.type === 'tali' ? (
              <span className="badge-tali">👏 ताली (Tali - {currentMatra.sign})</span>
            ) : (
              <span className="badge-normal">मात्रा {currentMatra?.matra || 1}</span>
            )}
          </div>

          <div className="giant-bol-display">
            <span className="bol-hindi">{currentMatra ? currentMatra.bolDevanagari : selectedTaal.matras[0].bolDevanagari}</span>
            <span className="bol-english">{currentMatra ? currentMatra.bol : selectedTaal.matras[0].bol}</span>
          </div>

          <p className="taal-description-text">{selectedTaal.description}</p>
        </div>
      </div>

      {/* Linear Step Sequencer Matra Bar */}
      <div className="linear-matra-strip">
        {selectedTaal.matras.map((m) => {
          const isCurrent = currentMatra?.matra === m.matra && isActive;
          return (
            <div
              key={m.matra}
              className={`matra-pill-card ${isCurrent ? 'active-beat' : ''} type-${m.type}`}
            >
              <div className="pill-top">
                <span className="pill-matra-num">{m.matra}</span>
                {m.sign && <span className="pill-sign">{m.sign}</span>}
              </div>
              <span className="pill-bol">{m.bol}</span>
              <span className="pill-bol-dev">{m.bolDevanagari}</span>
            </div>
          );
        })}
      </div>

      {/* Rhythm Controls: BPM, Tap Tempo, Volume */}
      <div className="rhythm-controls-grid">
        {/* Tempo / BPM Slider */}
        <div className="control-item">
          <div className="label-with-value">
            <label className="control-label">Tempo / Laya (गति):</label>
            <div className="bpm-callout">
              <span className="bpm-number">{bpm}</span> <span className="bpm-unit">BPM</span>
            </div>
          </div>
          <input
            type="range"
            min="40"
            max="200"
            step="1"
            value={bpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value))}
            className="styled-slider"
          />
          <div className="laya-presets-row">
            <button
              className={`laya-btn ${bpm <= 60 ? 'selected' : ''}`}
              onClick={() => handleBpmChange(55)}
            >
              Vilambit (55)
            </button>
            <button
              className={`laya-btn ${bpm > 60 && bpm <= 110 ? 'selected' : ''}`}
              onClick={() => handleBpmChange(85)}
            >
              Madhya (85)
            </button>
            <button
              className={`laya-btn ${bpm > 110 ? 'selected' : ''}`}
              onClick={() => handleBpmChange(135)}
            >
              Drut (135)
            </button>
            <button className="tap-tempo-btn" onClick={handleTapTempo}>
              👆 Tap Tempo
            </button>
          </div>
        </div>

        {/* Tabla Master Volume */}
        <div className="control-item">
          <div className="label-with-value">
            <label className="control-label">Tabla Volume (मात्रा स्वर स्तर):</label>
            <span className="value-badge">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="styled-slider"
          />
        </div>
      </div>
    </div>
  );
};
