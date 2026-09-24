import React, { useState } from 'react';
import { Mic, MicOff, Volume2, Sparkles, Sliders, Music2 } from 'lucide-react';
import { COMMON_SCALE_PRESETS } from '../types/music';
import type { RootPitchConfig, RootNoteName, TuningSystem } from '../types/music';
import { NOTE_NAMES, INDIAN_NOTE_NAMES } from '../utils/pitchMath';

interface HeaderProps {
  isMicActive: boolean;
  onToggleMic: () => void;
  rootPitch: RootPitchConfig;
  onSelectRootPitch: (note: RootNoteName, octave: number) => void;
  tuningSystem: TuningSystem;
  onToggleTuningSystem: (system: TuningSystem) => void;
  isTanpuraActive: boolean;
  onToggleTanpura: () => void;
  isTaalActive: boolean;
  onToggleTaal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isMicActive,
  onToggleMic,
  rootPitch,
  onSelectRootPitch,
  tuningSystem,
  onToggleTuningSystem,
  isTanpuraActive,
  onToggleTanpura,
  isTaalActive,
  onToggleTaal,
}) => {
  const [showScaleModal, setShowScaleModal] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <div className="app-brand">
            <div className="brand-icon-box">
              <span className="brand-swar-symbol">सा</span>
            </div>
            <div className="brand-text">
              <h1 className="brand-title">
                SurSadhana <span className="free-badge">FREE</span>
              </h1>
              <p className="brand-subtitle">Indian Classical Riyaz Companion</p>
            </div>
          </div>
        </div>

        <div className="header-center">
          {/* Quick Root Sa Selector Button */}
          <button
            className="scale-pill-btn"
            onClick={() => setShowScaleModal(true)}
            title="Change your root Sa (Tonic)"
          >
            <div className="scale-pill-content">
              <span className="scale-label">Root Sa (आधार स्वर):</span>
              <span className="scale-value">
                {rootPitch.note}{rootPitch.octave} <span className="scale-indian">({INDIAN_NOTE_NAMES[rootPitch.note]})</span>
              </span>
            </div>
            <Sliders size={15} className="scale-edit-icon" />
          </button>
        </div>

        <div className="header-right">
          {/* Tanpura Quick Toggle */}
          <button
            className={`quick-action-btn ${isTanpuraActive ? 'active-tanpura' : ''}`}
            onClick={onToggleTanpura}
            title={isTanpuraActive ? 'Stop Tanpura' : 'Play Tanpura'}
          >
            <Music2 size={16} />
            <span className="btn-text">Tanpura</span>
            {isTanpuraActive && <span className="pulse-dot" />}
          </button>

          {/* Taal Quick Toggle */}
          <button
            className={`quick-action-btn ${isTaalActive ? 'active-taal' : ''}`}
            onClick={onToggleTaal}
            title={isTaalActive ? 'Stop Taal' : 'Play Taal'}
          >
            <Volume2 size={16} />
            <span className="btn-text">Taal</span>
            {isTaalActive && <span className="pulse-dot" />}
          </button>

          {/* Main Microphone Start/Stop Button */}
          <button
            className={`mic-primary-btn ${isMicActive ? 'listening' : ''}`}
            onClick={onToggleMic}
            title={isMicActive ? 'Turn off Microphone' : 'Start Microphone for Pitch Detection'}
          >
            {isMicActive ? (
              <>
                <Mic size={18} className="mic-icon animate-pulse" />
                <span>Listening</span>
              </>
            ) : (
              <>
                <MicOff size={18} className="mic-icon" />
                <span>Start Riyaz</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Scale & Tuning Modal */}
      {showScaleModal && (
        <div className="modal-backdrop" onClick={() => setShowScaleModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Sparkles size={20} className="modal-icon-sparkle" />
                <h3>Choose Your Base Sa (स्केल चयन)</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowScaleModal(false)}>×</button>
            </div>

            <p className="modal-desc">
              Every singer has a natural vocal scale. Select your root tonic (<span className="text-gold">Sa / षड्ज</span>) to align all Swaras, Tanpura, and pitch visuals.
            </p>

            {/* Quick Presets */}
            <div className="presets-section">
              <label className="section-label">Popular Vocal Presets:</label>
              <div className="presets-grid">
                {COMMON_SCALE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className={`preset-btn ${rootPitch.note === preset.note && rootPitch.octave === preset.octave ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectRootPitch(preset.note, preset.octave);
                    }}
                  >
                    <span className="preset-name">{preset.label}</span>
                    <span className="preset-pitch">{preset.note}{preset.octave}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Note & Octave Selector */}
            <div className="manual-scale-picker">
              <label className="section-label">Custom Root Note:</label>
              <div className="note-chips-grid">
                {NOTE_NAMES.map((note) => (
                  <button
                    key={note}
                    className={`note-chip ${rootPitch.note === note ? 'active' : ''}`}
                    onClick={() => onSelectRootPitch(note, rootPitch.octave)}
                  >
                    <span className="chip-note">{note}</span>
                    <span className="chip-sub">{INDIAN_NOTE_NAMES[note].split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              <div className="octave-picker">
                <span className="octave-label">Octave (सप्तक):</span>
                <div className="octave-buttons">
                  {[2, 3, 4].map(oct => (
                    <button
                      key={oct}
                      className={`oct-btn ${rootPitch.octave === oct ? 'active' : ''}`}
                      onClick={() => onSelectRootPitch(rootPitch.note, oct)}
                    >
                      {oct === 2 ? 'Octave 2 (Kharaj/Bass)' : oct === 3 ? 'Octave 3 (Standard Male/Low Female)' : 'Octave 4 (Standard Female)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tuning System: Just Intonation vs Equal Temperament */}
            <div className="tuning-system-selector">
              <div className="tuning-info">
                <span className="tuning-title">Intonation System (श्रुति व्यवस्था):</span>
                <span className="tuning-sub">
                  {tuningSystem === 'just'
                    ? 'Natural Just Intonation (Gandharva harmonic ratios - Authentic for Indian Classical)'
                    : '12-TET Equal Temperament (Standard Western 100 cents per semitone)'}
                </span>
              </div>
              <div className="tuning-toggle-group">
                <button
                  className={`tuning-toggle-btn ${tuningSystem === 'just' ? 'active' : ''}`}
                  onClick={() => onToggleTuningSystem('just')}
                >
                  Just Intonation (Shruti)
                </button>
                <button
                  className={`tuning-toggle-btn ${tuningSystem === 'equal' ? 'active' : ''}`}
                  onClick={() => onToggleTuningSystem('equal')}
                >
                  Equal (12-TET)
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button className="confirm-btn" onClick={() => setShowScaleModal(false)}>
                Done (लागू करें)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
