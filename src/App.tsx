import React, { useState, useEffect, useCallback } from 'react';
import type { RootPitchConfig, RootNoteName, TuningSystem, DetectedPitch } from './types/music';
import { createRootConfig } from './utils/pitchMath';
import { pitchService } from './services/pitchDetectorService';
import { tanpuraService } from './services/tanpuraService';
import { taalService } from './services/taalService';

import { Header } from './components/Header';
import { SurMeter } from './components/SurMeter';
import { PitchCanvas } from './components/PitchCanvas';
import { TanpuraPanel } from './components/TanpuraPanel';
import { TaalPanel } from './components/TaalPanel';
import { AlankarTrainer } from './components/AlankarTrainer';
import { GuruLessonPractice } from './components/GuruLessonPractice';
import { ScaleCalibrator } from './components/ScaleCalibrator';
import { Navigation } from './components/Navigation';
import type { ActiveTab } from './components/Navigation';

import { Volume2, Music2, Sparkles } from 'lucide-react';
import './App.css';

export const App: React.FC = () => {
  // Base Scale Sa state (Default: C#3 / Kali Ek - Standard Hindustani Male / Low Female reference)
  const [rootPitch, setRootPitch] = useState<RootPitchConfig>(() => {
    const savedNote = localStorage.getItem('sur_root_note') as RootNoteName || 'C#';
    const savedOctave = parseInt(localStorage.getItem('sur_root_octave') || '3');
    return createRootConfig(savedNote, savedOctave);
  });

  const [tuningSystem, setTuningSystem] = useState<TuningSystem>(() => {
    return (localStorage.getItem('sur_tuning_system') as TuningSystem) || 'just';
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');

  // Audio Engine States
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [detectedPitch, setDetectedPitch] = useState<DetectedPitch | null>(null);
  const [volumePercent, setVolumePercent] = useState<number>(0);

  const [isTanpuraActive, setIsTanpuraActive] = useState<boolean>(false);
  const [isTaalActive, setIsTaalActive] = useState<boolean>(false);

  // Update services when root Sa or tuning system changes
  useEffect(() => {
    pitchService.updateConfig(rootPitch.frequency, tuningSystem);
    tanpuraService.updateConfig(rootPitch.frequency, {});
    taalService.setBasePitch(rootPitch.frequency);

    localStorage.setItem('sur_root_note', rootPitch.note);
    localStorage.setItem('sur_root_octave', rootPitch.octave.toString());
    localStorage.setItem('sur_tuning_system', tuningSystem);
  }, [rootPitch, tuningSystem]);

  // Subscribe to pitch & volume updates
  useEffect(() => {
    const unsubPitch = pitchService.subscribePitch((pitch) => {
      setDetectedPitch(pitch);
    });

    const unsubVol = pitchService.subscribeVolume((vol) => {
      setVolumePercent(vol);
    });

    return () => {
      unsubPitch();
      unsubVol();
    };
  }, []);

  // Handlers
  const handleToggleMic = useCallback(async () => {
    if (isMicActive) {
      pitchService.stop();
      setIsMicActive(false);
      setDetectedPitch(null);
      setVolumePercent(0);
    } else {
      const ok = await pitchService.start();
      if (ok) {
        setIsMicActive(true);
      } else {
        alert('Microphone permission is required for real-time pitch detection. Please allow microphone access in your browser.');
      }
    }
  }, [isMicActive]);

  const handleToggleTanpura = useCallback(async () => {
    if (isTanpuraActive) {
      tanpuraService.stop();
      setIsTanpuraActive(false);
    } else {
      const ok = await tanpuraService.start();
      if (ok) setIsTanpuraActive(true);
    }
  }, [isTanpuraActive]);

  const handleToggleTaal = useCallback(async () => {
    if (isTaalActive) {
      taalService.stop();
      setIsTaalActive(false);
    } else {
      const ok = await taalService.start();
      if (ok) setIsTaalActive(true);
    }
  }, [isTaalActive]);

  const handleSelectRootPitch = (note: RootNoteName, octave: number) => {
    const config = createRootConfig(note, octave);
    setRootPitch(config);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleMic();
      } else if (e.key === 't' || e.key === 'T') {
        handleToggleTanpura();
      } else if (e.key === 'b' || e.key === 'B') {
        handleToggleTaal();
      } else if (e.key === '1') {
        setActiveTab('studio');
      } else if (e.key === '2') {
        setActiveTab('practice');
      } else if (e.key === '3') {
        setActiveTab('alankars');
      } else if (e.key === '4') {
        setActiveTab('tanpura');
      } else if (e.key === '5') {
        setActiveTab('taal');
      } else if (e.key === '6') {
        setActiveTab('calibrator');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleMic, handleToggleTanpura, handleToggleTaal]);

  return (
    <div className="app-layout">
      {/* Top Application Header */}
      <Header
        isMicActive={isMicActive}
        onToggleMic={handleToggleMic}
        rootPitch={rootPitch}
        onSelectRootPitch={handleSelectRootPitch}
        tuningSystem={tuningSystem}
        onToggleTuningSystem={setTuningSystem}
        isTanpuraActive={isTanpuraActive}
        onToggleTanpura={handleToggleTanpura}
        isTaalActive={isTaalActive}
        onToggleTaal={handleToggleTaal}
      />

      {/* Main Content Area */}
      <main className="main-content-area">
        {activeTab === 'studio' && (
          <div className="studio-view-container">
            {/* Top Row: Dial Meter & Quick Controls */}
            <div className="studio-top-grid">
              <SurMeter
                detectedPitch={detectedPitch}
                volumePercent={volumePercent}
                isMicActive={isMicActive}
                onStartMic={handleToggleMic}
              />

              {/* Side Quick Companion Box */}
              <div className="quick-companion-card">
                <div className="companion-header">
                  <Sparkles size={16} className="text-gold" />
                  <h4>Live Accompaniment (संगत)</h4>
                </div>

                {/* Tanpura Quick Control */}
                <div className="companion-item">
                  <div className="item-row">
                    <div className="item-info">
                      <Music2 size={16} className={isTanpuraActive ? 'text-emerald' : 'text-muted'} />
                      <span className="item-title">Acoustic Tanpura</span>
                    </div>
                    <button
                      className={`mini-toggle-btn ${isTanpuraActive ? 'active' : ''}`}
                      onClick={handleToggleTanpura}
                    >
                      {isTanpuraActive ? 'Playing' : 'Start'}
                    </button>
                  </div>
                  <span className="item-desc">
                    Tuned to {rootPitch.note}{rootPitch.octave} • Pa-Sa-Sa-Sa drone
                  </span>
                </div>

                {/* Taal Quick Control */}
                <div className="companion-item">
                  <div className="item-row">
                    <div className="item-info">
                      <Volume2 size={16} className={isTaalActive ? 'text-emerald' : 'text-muted'} />
                      <span className="item-title">Tabla / Taal</span>
                    </div>
                    <button
                      className={`mini-toggle-btn ${isTaalActive ? 'active' : ''}`}
                      onClick={handleToggleTaal}
                    >
                      {isTaalActive ? 'Playing' : 'Start'}
                    </button>
                  </div>
                  <span className="item-desc">
                    {taalService.getTaal().name} • {taalService.getBpm()} BPM
                  </span>
                </div>

                {/* Keyboard Shortcut Cheatsheet */}
                <div className="keyboard-shortcuts-pill">
                  <span className="shortcut-title">⚡ Quick Keys:</span>
                  <div className="shortcuts-list">
                    <span><kbd>Space</kbd> Mic</span>
                    <span><kbd>T</kbd> Tanpura</span>
                    <span><kbd>B</kbd> Taal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: Continuous Live Scrolling Pitch Roll */}
            <div className="studio-canvas-row">
              <PitchCanvas currentPitch={detectedPitch} />
            </div>
          </div>
        )}

        {activeTab === 'practice' && (
          <div className="tab-view-wrapper">
            <GuruLessonPractice
              currentPitch={detectedPitch}
              rootPitch={rootPitch}
              isMicActive={isMicActive}
              onStartMic={handleToggleMic}
            />
          </div>
        )}

        {activeTab === 'tanpura' && (
          <div className="tab-view-wrapper">
            <TanpuraPanel
              rootPitch={rootPitch}
              isActive={isTanpuraActive}
              onToggleActive={handleToggleTanpura}
            />
          </div>
        )}

        {activeTab === 'taal' && (
          <div className="tab-view-wrapper">
            <TaalPanel
              isActive={isTaalActive}
              onToggleActive={handleToggleTaal}
              baseFrequency={rootPitch.frequency}
            />
          </div>
        )}

        {activeTab === 'alankars' && (
          <div className="tab-view-wrapper">
            <AlankarTrainer
              currentPitch={detectedPitch}
              rootPitch={rootPitch}
            />
          </div>
        )}

        {activeTab === 'calibrator' && (
          <div className="tab-view-wrapper">
            <ScaleCalibrator
              currentPitch={detectedPitch}
              onApplyScale={handleSelectRootPitch}
              onClose={() => setActiveTab('studio')}
            />
          </div>
        )}
      </main>

      {/* Navigation (Sticky Bottom on Mobile / Docked on Desktop) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isTanpuraActive={isTanpuraActive}
        isTaalActive={isTaalActive}
        isMicActive={isMicActive}
      />
    </div>
  );
};

export default App;
