import React, { useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import type { RootPitchConfig, TanpuraSettings } from '../types/music';
import { tanpuraService } from '../services/tanpuraService';

interface TanpuraPanelProps {
  rootPitch: RootPitchConfig;
  isActive: boolean;
  onToggleActive: () => void;
}

export const TanpuraPanel: React.FC<TanpuraPanelProps> = ({
  rootPitch,
  isActive,
  onToggleActive,
}) => {
  const [activeString, setActiveString] = useState<number>(-1);
  const [settings, setSettings] = useState<TanpuraSettings>(tanpuraService.getSettings());

  useEffect(() => {
    tanpuraService.updateConfig(rootPitch.frequency, settings);
  }, [rootPitch, settings]);

  useEffect(() => {
    const unsub = tanpuraService.subscribePluck((idx) => {
      setActiveString(idx);
    });
    return () => {
      unsub();
    };
  }, []);

  const handleFirstStringChange = (val: 'Pa' | 'Ma' | 'Ni') => {
    const updated = { ...settings, firstString: val };
    setSettings(updated);
    tanpuraService.updateConfig(rootPitch.frequency, updated);
  };

  const handleTempoChange = (val: number) => {
    const updated = { ...settings, tempoSeconds: val };
    setSettings(updated);
    tanpuraService.setTempo(val);
  };

  const handleFineTuneChange = (val: number) => {
    const updated = { ...settings, fineTuneCents: val };
    setSettings(updated);
    tanpuraService.updateConfig(rootPitch.frequency, updated);
  };

  const handleVolumeChange = (val: number) => {
    const updated = { ...settings, volume: val };
    setSettings(updated);
    tanpuraService.updateConfig(rootPitch.frequency, updated);
  };

  const stringLabels = [
    { name: settings.firstString, sub: settings.firstString === 'Pa' ? 'पंचम' : settings.firstString === 'Ma' ? 'मध्यम' : 'निषाद' },
    { name: 'Sa', sub: 'जोड़ी सा (१)' },
    { name: 'Sa', sub: 'जोड़ी सा (२)' },
    { name: 'Kharaj Sa', sub: 'मंद्र खरज सा' },
  ];

  return (
    <div className="tanpura-panel-card">
      <div className="panel-header">
        <div className="title-block">
          <div className="icon-badge">🪕</div>
          <div>
            <h2 className="panel-title">Acoustic Tanpura (तानपूरा)</h2>
            <p className="panel-sub">
              Synthesized Jawari Drone • Tonic: <span className="highlight-sa">{rootPitch.note}{rootPitch.octave}</span>
            </p>
          </div>
        </div>

        <button
          className={`play-btn-large ${isActive ? 'playing' : ''}`}
          onClick={onToggleActive}
        >
          {isActive ? <Pause size={20} /> : <Play size={20} />}
          <span>{isActive ? 'Pause Drone' : 'Start Tanpura'}</span>
        </button>
      </div>

      {/* 4 Interactive Visual Strings with Artisan Bridge Frame */}
      <div className="tanpura-instrument-frame">
        <div className="tanpura-peg-box">
          <span className="peg-box-label">खूंटी (Tuning Pegs)</span>
        </div>

        <div className="strings-visualizer-container">
          {stringLabels.map((str, idx) => {
            const isPlucking = activeString === idx && isActive;
            const wireClass = idx === 0 ? 'wire-brass' : idx === 3 ? 'wire-copper' : 'wire-steel';
            const material = idx === 0 ? 'Brass (पीतल)' : idx === 3 ? 'Thick Bronze (मंद्र तांबा)' : 'Steel (स्टील)';
            return (
              <div
                key={idx}
                className={`string-column ${isPlucking ? 'plucking' : ''}`}
              >
                <div className="string-info-top">
                  <span className="string-idx">#{idx + 1}</span>
                  <span className="string-name">{str.name}</span>
                  <span className="string-sub">{str.sub}</span>
                  <span className="string-material">{material}</span>
                </div>

                {/* The string wire */}
                <div className="string-wire-track">
                  <div className={`wire-line ${wireClass} ${isPlucking ? 'vibrating' : ''}`} />
                  {isPlucking && <div className="pluck-burst-sparkle" />}
                </div>

                <div className="string-indicator">
                  {isPlucking ? (
                    <span className="pluck-badge">PLUCK</span>
                  ) : (
                    <span className="idle-dot" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="tanpura-jawari-bridge">
          <span className="bridge-label">जवारी ब्रिज (Jawari Bone Bridge & Cotton Thread)</span>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="tanpura-controls-grid">
        {/* First String Preset (Pa / Ma / Ni) */}
        <div className="control-item">
          <label className="control-label">
            1st String Tuning (प्रथम तार स्वर):
          </label>
          <div className="btn-toggle-group">
            <button
              className={`toggle-option-btn ${settings.firstString === 'Pa' ? 'active' : ''}`}
              onClick={() => handleFirstStringChange('Pa')}
            >
              Pa (पंचम)
            </button>
            <button
              className={`toggle-option-btn ${settings.firstString === 'Ma' ? 'active' : ''}`}
              onClick={() => handleFirstStringChange('Ma')}
            >
              Ma (मध्यम)
            </button>
            <button
              className={`toggle-option-btn ${settings.firstString === 'Ni' ? 'active' : ''}`}
              onClick={() => handleFirstStringChange('Ni')}
            >
              Ni (निषाद)
            </button>
          </div>
          <span className="control-hint">
            {settings.firstString === 'Pa' ? 'Standard for most ragas (Yaman, Bhairav, Bilawal, etc.)' :
             settings.firstString === 'Ma' ? 'For ragas lacking Pancham (Malkauns, Bageshree, etc.)' :
             'For ragas with prominent Nishad (Marwa, Puriya, etc.)'}
          </span>
        </div>

        {/* Pluck Speed / Tempo */}
        <div className="control-item">
          <div className="label-with-value">
            <label className="control-label">Cycle Tempo (लय / गति):</label>
            <span className="value-badge">{settings.tempoSeconds.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="1.5"
            max="4.5"
            step="0.1"
            value={settings.tempoSeconds}
            onChange={(e) => handleTempoChange(parseFloat(e.target.value))}
            className="styled-slider"
          />
          <div className="slider-extremes">
            <span>Fast (द्रुत 1.5s)</span>
            <span>Slow (विलंबित 4.5s)</span>
          </div>
        </div>

        {/* Fine Tuning (Cents) */}
        <div className="control-item">
          <div className="label-with-value">
            <label className="control-label">Fine Tuning (सूक्ष्म स्वर बदलाव):</label>
            <span className="value-badge">
              {settings.fineTuneCents > 0 ? `+${settings.fineTuneCents}¢` : `${settings.fineTuneCents}¢`}
            </span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            value={settings.fineTuneCents}
            onChange={(e) => handleFineTuneChange(parseInt(e.target.value))}
            className="styled-slider"
          />
          <div className="slider-extremes">
            <span>-50 Cents (Flat)</span>
            <button className="reset-center-btn" onClick={() => handleFineTuneChange(0)}>Reset 0¢</button>
            <span>+50 Cents (Sharp)</span>
          </div>
        </div>

        {/* Master Volume */}
        <div className="control-item">
          <div className="label-with-value">
            <label className="control-label">Drone Volume (ध्वनि स्तर):</label>
            <span className="value-badge">{Math.round(settings.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="styled-slider"
          />
        </div>
      </div>
    </div>
  );
};
