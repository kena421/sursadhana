import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Volume2, Award, CheckCircle2, Sparkles, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ALANKARS, SWARAS } from '../types/music';
import type { AlankarExercise, DetectedPitch, RootPitchConfig } from '../types/music';
import { getSwaraTargetFrequency } from '../utils/pitchMath';

interface AlankarTrainerProps {
  currentPitch: DetectedPitch | null;
  rootPitch: RootPitchConfig;
}

export const AlankarTrainer: React.FC<AlankarTrainerProps> = ({
  currentPitch,
  rootPitch,
}) => {
  const [activeTab, setActiveTab] = useState<'alankars' | 'sadhana'>('alankars');
  const [selectedAlankar, setSelectedAlankar] = useState<AlankarExercise>(ALANKARS[0]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPracticing, setIsPracticing] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [inSurHoldTimeMs, setInSurHoldTimeMs] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Swar Sadhana (Hold the Sa) State
  const [sadhanaTargetSeconds, setSadhanaTargetSeconds] = useState<number>(5);
  const [sadhanaHoldProgressMs, setSadhanaHoldProgressMs] = useState<number>(0);
  const [sadhanaCompleted, setSadhanaCompleted] = useState<boolean>(false);

  const holdTargetMs = 1200; // hold note for 1.2s to pass in Alankar
  const lastCheckTimeRef = useRef<number>(performance.now());

  // Real-time verification loop
  useEffect(() => {
    if (!isPracticing || isCompleted) return;

    const now = performance.now();
    const dt = now - lastCheckTimeRef.current;
    lastCheckTimeRef.current = now;

    if (activeTab === 'alankars') {
      const targetSwaraId = selectedAlankar.notesSequence[currentIndex];

      if (currentPitch && currentPitch.swara.id === targetSwaraId && currentPitch.isInSur) {
        // Singer is matching the target note!
        setInSurHoldTimeMs(prev => {
          const next = prev + dt;
          if (next >= holdTargetMs) {
            // Success! Advance to next note
            advanceNote();
            return 0;
          }
          return next;
        });
      } else {
        // Singer drifted or paused; decay hold time slightly
        setInSurHoldTimeMs(prev => Math.max(0, prev - dt * 0.5));
      }
    } else if (activeTab === 'sadhana') {
      // Sadhana mode: singer must hold base Sa in Madhya Saptak
      if (currentPitch && currentPitch.swara.id === 'S' && currentPitch.octaveOffset === 0 && currentPitch.isInSur) {
        setSadhanaHoldProgressMs(prev => {
          const next = prev + dt;
          if (next >= sadhanaTargetSeconds * 1000) {
            triggerCompletionConfetti();
            setSadhanaCompleted(true);
            setIsPracticing(false);
            return sadhanaTargetSeconds * 1000;
          }
          return next;
        });
      } else {
        setSadhanaHoldProgressMs(prev => Math.max(0, prev - dt * 0.4));
      }
    }
  }, [currentPitch, isPracticing, currentIndex, isCompleted, activeTab, selectedAlankar, sadhanaTargetSeconds]);

  const advanceNote = () => {
    setScore(s => s + 1);
    setTotalAttempts(a => a + 1);

    if (currentIndex + 1 < selectedAlankar.notesSequence.length) {
      setCurrentIndex(c => c + 1);
      setInSurHoldTimeMs(0);
    } else {
      // Completed Alankar!
      setIsCompleted(true);
      setIsPracticing(false);
      triggerCompletionConfetti();
    }
  };

  const triggerCompletionConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#F59E0B', '#FBBF24', '#38BDF8'],
    });
  };

  const handleStartPractice = () => {
    setIsPracticing(true);
    setIsCompleted(false);
    setSadhanaCompleted(false);
    setCurrentIndex(0);
    setInSurHoldTimeMs(0);
    setSadhanaHoldProgressMs(0);
    setScore(0);
    setTotalAttempts(0);
    lastCheckTimeRef.current = performance.now();
  };

  const handleReset = () => {
    setIsPracticing(false);
    setIsCompleted(false);
    setSadhanaCompleted(false);
    setCurrentIndex(0);
    setInSurHoldTimeMs(0);
    setSadhanaHoldProgressMs(0);
  };

  // Play audio reference note using Web Audio
  const playReferenceTone = (swaraId: string) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = getSwaraTargetFrequency(swaraId, rootPitch.frequency, 'just');
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.3);
    } catch (e) {
      console.error('Audio tone preview error:', e);
    }
  };

  const targetNoteId = selectedAlankar.notesSequence[currentIndex];
  const targetSwara = SWARAS.find(s => s.id === targetNoteId) || SWARAS[0];
  const holdPercent = Math.min(100, (inSurHoldTimeMs / holdTargetMs) * 100);

  return (
    <div className="alankar-panel-card">
      {/* Tab Switcher: Alankar Palte vs Swar Sadhana */}
      <div className="alankar-mode-tabs">
        <button
          className={`mode-tab-btn ${activeTab === 'alankars' ? 'active' : ''}`}
          onClick={() => { setActiveTab('alankars'); handleReset(); }}
        >
          <Award size={16} />
          <span>Guided Alankars (अलंकार पलटे)</span>
        </button>
        <button
          className={`mode-tab-btn ${activeTab === 'sadhana' ? 'active' : ''}`}
          onClick={() => { setActiveTab('sadhana'); handleReset(); }}
        >
          <Flame size={16} />
          <span>Swar Sadhana (स्वर साधना • Hold Sa)</span>
        </button>
      </div>

      {activeTab === 'alankars' ? (
        <>
          {/* Alankar Selection Carousel */}
          <div className="alankar-picker-row">
            {ALANKARS.map((a) => (
              <button
                key={a.id}
                className={`alankar-select-card ${selectedAlankar.id === a.id ? 'selected' : ''}`}
                onClick={() => { setSelectedAlankar(a); handleReset(); }}
              >
                <div className="card-top">
                  <span className={`badge-level ${a.level.toLowerCase()}`}>{a.level}</span>
                  <span className="card-len">{a.notesSequence.length} Swaras</span>
                </div>
                <h4 className="card-title">{a.title}</h4>
                <p className="card-desc">{a.description}</p>
              </button>
            ))}
          </div>

          {/* Active Alankar Arena */}
          <div className="alankar-arena">
            <div className="arena-header">
              <div>
                <h3 className="arena-title">{selectedAlankar.title}</h3>
                <p className="aroha-text">आरोह: {selectedAlankar.displayAroha}</p>
              </div>

              <div className="arena-controls">
                <button
                  className="preview-sound-btn"
                  onClick={() => playReferenceTone(targetNoteId)}
                  title="Hear reference pitch"
                >
                  <Volume2 size={16} />
                  <span>Hear Note ({targetSwara.shortName})</span>
                </button>

                {!isPracticing ? (
                  <button className="start-practice-btn" onClick={handleStartPractice}>
                    <Play size={18} />
                    <span>Start Practice (शुरू करें)</span>
                  </button>
                ) : (
                  <button className="reset-practice-btn" onClick={handleReset}>
                    <RotateCcw size={16} />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Note Sequence Flow Line */}
            <div className="notes-flow-strip">
              {selectedAlankar.notesSequence.map((swId, idx) => {
                const sw = SWARAS.find(s => s.id === swId) || SWARAS[0];
                const isCurrent = idx === currentIndex && isPracticing;
                const isPassed = idx < currentIndex;

                return (
                  <div
                    key={idx}
                    className={`flow-note-node ${isCurrent ? 'current-target' : ''} ${isPassed ? 'passed' : ''}`}
                  >
                    <span className="node-dev">{sw.devanagari}</span>
                    <span className="node-short">{sw.shortName}</span>
                    {isPassed && <CheckCircle2 size={12} className="check-icon" />}
                  </div>
                );
              })}
            </div>

            {/* Active Target Hero Box */}
            <div className="target-note-hero">
              <div className="hero-target-swar">
                <span className="target-label">Target Note (गाइए):</span>
                <div className="target-swara-big">
                  <span className="target-dev">{targetSwara.devanagari}</span>
                  <span className="target-eng">({targetSwara.fullName})</span>
                </div>
              </div>

              {/* Hold Progress Bar */}
              <div className="hold-progress-block">
                <div className="hold-labels">
                  <span>Hold in Sur:</span>
                  <span>{Math.round(holdPercent)}%</span>
                </div>
                <div className="hold-bar-track">
                  <div
                    className="hold-bar-fill"
                    style={{ width: `${holdPercent}%` }}
                  />
                </div>
                <span className="hold-hint">
                  {isPracticing
                    ? (currentPitch?.isInSur && currentPitch.swara.id === targetNoteId
                      ? '✨ Good! Keep holding...'
                      : 'Match the target note steadily')
                    : 'Click "Start Practice" to begin'}
                </span>
              </div>
            </div>

            {/* Completion Banner */}
            {isCompleted && (
              <div className="completion-card">
                <Sparkles size={24} className="sparkle-gold" />
                <div className="completion-text">
                  <h4>Riyaz Complete! बधाई हो!</h4>
                  <p>You successfully mastered {selectedAlankar.title} ({score} notes in tune across {totalAttempts} attempts). Practice again to build vocal muscle memory.</p>
                </div>
                <button className="practice-again-btn" onClick={handleStartPractice}>
                  Practice Again
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Swar Sadhana Mode */
        <div className="sadhana-container">
          <div className="sadhana-header">
            <h3>Swar Sadhana: Steady Note Hold (षड्ज साधना)</h3>
            <p>
              Holding a sustained, unwavering <strong>Sa (सा)</strong> is the supreme foundation of Indian classical singing. It builds breath capacity, tonal purity, and pitch stability.
            </p>
          </div>

          <div className="sadhana-settings">
            <span className="settings-label">Target Hold Duration:</span>
            <div className="duration-pills">
              {[3, 5, 10, 15].map(sec => (
                <button
                  key={sec}
                  className={`sec-pill ${sadhanaTargetSeconds === sec ? 'active' : ''}`}
                  onClick={() => { setSadhanaTargetSeconds(sec); handleReset(); }}
                >
                  {sec} Seconds
                </button>
              ))}
            </div>
          </div>

          <div className="sadhana-ring-box">
            <div className="ring-content">
              <span className="sadhana-sa">सा</span>
              <span className="sadhana-timer">
                {((sadhanaHoldProgressMs) / 1000).toFixed(1)}s / {sadhanaTargetSeconds}s
              </span>
            </div>
            <div className="sadhana-progress-bar">
              <div
                className="sadhana-progress-fill"
                style={{ width: `${Math.min(100, (sadhanaHoldProgressMs / (sadhanaTargetSeconds * 1000)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="sadhana-actions">
            {!isPracticing ? (
              <button className="start-practice-btn large" onClick={handleStartPractice}>
                <Play size={20} />
                <span>Begin Sa Sadhana ({sadhanaTargetSeconds}s)</span>
              </button>
            ) : (
              <button className="reset-practice-btn" onClick={handleReset}>
                <RotateCcw size={18} />
                <span>Stop / Reset</span>
              </button>
            )}
          </div>

          {sadhanaCompleted && (
            <div className="completion-card">
              <Award size={28} className="sparkle-gold" />
              <div className="completion-text">
                <h4>Incredible Stability! (उत्कृष्ट स्थिरता!)</h4>
                <p>You maintained a rock-solid Sa for {sadhanaTargetSeconds} continuous seconds.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
