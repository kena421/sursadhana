import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Headphones, Mic, BarChart3, Sparkles, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PRACTICE_LESSONS, SWARAS } from '../types/music';
import type { PracticeLesson, DetectedPitch, RootPitchConfig, PerformanceAnalysis, RecordedPitchPoint } from '../types/music';
import { guruVocalService } from '../services/guruVocalService';

interface GuruLessonPracticeProps {
  currentPitch: DetectedPitch | null;
  rootPitch: RootPitchConfig;
  isMicActive: boolean;
  onStartMic: () => void;
}

type PracticeStage = 'idle' | 'demo' | 'countdown' | 'singing' | 'analysis';

export const GuruLessonPractice: React.FC<GuruLessonPracticeProps> = ({
  currentPitch,
  rootPitch,
  isMicActive,
  onStartMic,
}) => {
  const [selectedLesson, setSelectedLesson] = useState<PracticeLesson>(PRACTICE_LESSONS[0]);
  const [stage, setStage] = useState<PracticeStage>('idle');
  const [activeDemoNoteIdx, setActiveDemoNoteIdx] = useState<number>(-1);
  const [countdown, setCountdown] = useState<number>(3);

  // User singing state
  const [currentSingNoteIdx, setCurrentSingNoteIdx] = useState<number>(0);
  const [noteSingProgressMs, setNoteSingProgressMs] = useState<number>(0);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);

  const recordedPointsRef = useRef<RecordedPitchPoint[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const countdownIntervalRef = useRef<number | null>(null);

  // Subscribe to demo callbacks
  useEffect(() => {
    const unsub = guruVocalService.subscribeNote((idx) => {
      setActiveDemoNoteIdx(idx);
    });
    return () => {
      unsub();
      guruVocalService.stop();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Singing phase loop
  useEffect(() => {
    if (stage !== 'singing') return;

    const now = performance.now();
    const dt = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    const currentTarget = selectedLesson.targetNotes[currentSingNoteIdx];
    if (!currentTarget) return;

    // Record pitch point for final analysis
    if (currentPitch) {
      recordedPointsRef.current.push({
        timeSec: (performance.now() - lastFrameTimeRef.current) / 1000,
        frequency: currentPitch.frequency,
        centsDeviation: currentPitch.centsDeviation,
        isInSur: currentPitch.isInSur,
        swaraId: currentPitch.swara.id,
      });
    }

    const isMatch = currentPitch && currentPitch.swara.id === currentTarget.swaraId && currentPitch.isInSur;

    if (isMatch) {
      setNoteSingProgressMs(prev => {
        const next = prev + dt;
        const requiredMs = currentTarget.durationSec * 1000;
        if (next >= requiredMs) {
          // Completed this note!
          if (currentSingNoteIdx + 1 < selectedLesson.targetNotes.length) {
            setCurrentSingNoteIdx(i => i + 1);
            return 0;
          } else {
            // Completed all notes! Run analysis
            finishLessonSinging();
            return requiredMs;
          }
        }
        return next;
      });
    } else {
      // Decay slightly if paused
      setNoteSingProgressMs(prev => Math.max(0, prev - dt * 0.35));
    }
  }, [currentPitch, stage, currentSingNoteIdx, selectedLesson]);

  // Start the Listen -> Sing pipeline
  const startLessonPipeline = async () => {
    if (!isMicActive) {
      onStartMic();
    }

    setStage('demo');
    setActiveDemoNoteIdx(-1);
    setAnalysis(null);
    recordedPointsRef.current = [];

    // Step 1: App sings first
    guruVocalService.playDemonstration(
      selectedLesson.targetNotes,
      rootPitch.frequency,
      () => {
        // Step 2: Demo finished, trigger countdown to sing
        setStage('countdown');
        setCountdown(3);

        let count = 3;
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = window.setInterval(() => {
          count -= 1;
          setCountdown(count);
          if (count <= 0) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            // Step 3: Start singing phase
            setStage('singing');
            setCurrentSingNoteIdx(0);
            setNoteSingProgressMs(0);
            lastFrameTimeRef.current = performance.now();
          }
        }, 900);
      }
    );
  };

  const finishLessonSinging = () => {
    setStage('analysis');

    const points = recordedPointsRef.current;
    if (points.length === 0) {
      setAnalysis({
        accuracyScore: 0,
        stabilityScore: 0,
        averageCentsDeviation: 0,
        centsTrend: 'centered',
        totalSingingTimeSec: 0,
        timeInSurSec: 0,
        feedbackHindi: 'कोई स्वर रिकॉर्ड नहीं हुआ। कृपया पुनः प्रयास करें और माइक के करीब गाएं।',
        feedbackEnglish: 'No vocal pitch was detected. Please try again and sing clearly into the microphone.',
        points: [],
      });
      return;
    }

    const inSurPoints = points.filter(p => p.isInSur);
    const accuracyScore = Math.min(100, Math.round((inSurPoints.length / points.length) * 100));

    // Calculate average deviation
    let sumDev = 0;
    points.forEach(p => sumDev += p.centsDeviation);
    const avgDev = Math.round((sumDev / points.length) * 10) / 10;

    // Calculate stability (variance of cents)
    let varianceSum = 0;
    points.forEach(p => {
      const diff = p.centsDeviation - avgDev;
      varianceSum += diff * diff;
    });
    const stdDev = Math.sqrt(varianceSum / points.length);
    const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - stdDev * 2.2)));

    const trend: 'centered' | 'sharp' | 'flat' =
      avgDev > 8 ? 'sharp' : avgDev < -8 ? 'flat' : 'centered';

    // Construct personalized Hindustani feedback
    let feedbackHindi = '';
    let feedbackEnglish = '';

    if (accuracyScore >= 85) {
      feedbackHindi = '✨ लाजवाब रियाज़! आपका सुर एकदम अचूक और स्थिर है। षड्ज पर आपकी पकड़ बहुत मजबूत है।';
      feedbackEnglish = 'Exceptional performance! Your pitch is locked into the pure shruti with superb stability.';
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10B981', '#F59E0B', '#FBBF24'],
      });
    } else if (accuracyScore >= 60) {
      if (trend === 'flat') {
        feedbackHindi = 'सुंदर प्रयास! स्वर थोड़ा "उतरा हुआ" (Flat) था। गले को ढीला रखें और हवा का प्रवाह थोड़ा बढ़ाएं।';
        feedbackEnglish = 'Good attempt! You were leaning slightly flat. Lift your palate and support with more breath.';
      } else if (trend === 'sharp') {
        feedbackHindi = 'अच्छा प्रयास! स्वर थोड़ा "चढ़ा हुआ" (Sharp) था। स्वर को थोड़ा शांत और विश्राम देकर साधें।';
        feedbackEnglish = 'Good effort! You were leaning slightly sharp. Relax throat tension to settle on the note.';
      } else {
        feedbackHindi = 'अच्छा प्रयास! सुर सही था, परंतु कंपन (vibrations) के कारण स्थिरता कम रही। लंबी सांस भरकर अभ्यास करें।';
        feedbackEnglish = 'Good pitch alignment! Focus on steady breath support to reduce micro-wavering.';
      }
    } else {
      feedbackHindi = 'निराश न हों! भारतीय शास्त्रीय संगीत में सुर साधना अभ्यास से आती है। पहले ऐप का सुर ध्यान से सुनें, फिर दोहराएं।';
      feedbackEnglish = 'Keep practicing! Listen carefully to the demonstration once more, then match the pitch without straining.';
    }

    setAnalysis({
      accuracyScore,
      stabilityScore,
      averageCentsDeviation: avgDev,
      centsTrend: trend,
      totalSingingTimeSec: Math.round((points.length * 0.05) * 10) / 10,
      timeInSurSec: Math.round((inSurPoints.length * 0.05) * 10) / 10,
      feedbackHindi,
      feedbackEnglish,
      points,
    });
  };

  const handleStopOrReset = () => {
    guruVocalService.stop();
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setStage('idle');
    setAnalysis(null);
  };

  const currentTargetNote = selectedLesson.targetNotes[currentSingNoteIdx] || selectedLesson.targetNotes[0];
  const targetSwaraObj = SWARAS.find(s => s.id === currentTargetNote.swaraId) || SWARAS[0];
  const singPercent = Math.min(100, (noteSingProgressMs / (currentTargetNote.durationSec * 1000)) * 100);

  return (
    <div className="guru-practice-container">
      {/* Top Header */}
      <div className="guru-header-card">
        <div className="guru-header-title">
          <div className="icon-badge">🎧</div>
          <div>
            <h2>Listen & Sing Riyaz (सुनो और गाओ)</h2>
            <p>1. App sings the note first • 2. Your turn to sing with realtime pitch check • 3. Instant analysis & feedback</p>
          </div>
        </div>

        {stage !== 'idle' && (
          <button className="reset-pipeline-btn" onClick={handleStopOrReset}>
            <RotateCcw size={16} /> Stop Practice
          </button>
        )}
      </div>

      {/* Lesson Selection Strip */}
      <div className="lesson-selection-grid">
        {PRACTICE_LESSONS.map((lesson) => {
          const isSelected = selectedLesson.id === lesson.id;
          return (
            <button
              key={lesson.id}
              className={`lesson-card-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                if (stage === 'idle' || stage === 'analysis') {
                  setSelectedLesson(lesson);
                  handleStopOrReset();
                }
              }}
            >
              <div className="lesson-badge-row">
                <span className={`badge-level ${lesson.level.toLowerCase()}`}>{lesson.level}</span>
                <span className="lesson-note-count">{lesson.targetNotes.length} Note{lesson.targetNotes.length > 1 ? 's' : ''}</span>
              </div>
              <h4 className="lesson-card-title">{lesson.title}</h4>
              <p className="lesson-card-desc">{lesson.description}</p>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Practice Arena */}
      <div className="interactive-arena-card">
        {/* Stage 1: IDLE */}
        {stage === 'idle' && (
          <div className="stage-idle-box">
            <div className="lesson-meta-header">
              <span className="lesson-hindi-name">{selectedLesson.hindiTitle}</span>
              <h3 className="arena-selected-title">{selectedLesson.title}</h3>
              <p className="lesson-instruction-text">{selectedLesson.instructions}</p>
            </div>

            {/* Target notes visual preview */}
            <div className="target-notes-row">
              {selectedLesson.targetNotes.map((n, idx) => {
                const sw = SWARAS.find(s => s.id === n.swaraId) || SWARAS[0];
                return (
                  <div key={idx} className="preview-note-bubble">
                    <span className="bubble-dev">{sw.devanagari}</span>
                    <span className="bubble-name">{sw.fullName}</span>
                    <span className="bubble-dur">{n.durationSec}s hold</span>
                  </div>
                );
              })}
            </div>

            <button className="start-pipeline-btn" onClick={startLessonPipeline}>
              <Play size={22} />
              <span>Start Practice (पहले सुनो, फिर गाओ)</span>
            </button>
          </div>
        )}

        {/* Stage 2: DEMO (App Sings) */}
        {stage === 'demo' && (
          <div className="stage-demo-box">
            <div className="stage-badge-pill demo">
              <Headphones size={18} className="animate-pulse" />
              <span>STEP 1: LISTEN CAREFULLY (सुनिए)</span>
            </div>

            <h3 className="stage-prompt-title">The App is singing the target pitch...</h3>
            <p className="stage-prompt-sub">Absorb the exact intonation and tone of the Swara.</p>

            <div className="demo-notes-display">
              {selectedLesson.targetNotes.map((n, idx) => {
                const sw = SWARAS.find(s => s.id === n.swaraId) || SWARAS[0];
                const isPlayingThis = activeDemoNoteIdx === idx;
                return (
                  <div key={idx} className={`demo-note-bubble ${isPlayingThis ? 'playing-now' : ''}`}>
                    <span className="bubble-dev">{sw.devanagari}</span>
                    <span className="bubble-name">{sw.fullName}</span>
                    {isPlayingThis && (
                      <div className="audio-soundwaves">
                        <span /><span /><span /><span />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stage 3: COUNTDOWN */}
        {stage === 'countdown' && (
          <div className="stage-countdown-box">
            <span className="countdown-prompt">Take a deep breath... Get ready to sing in:</span>
            <div className="countdown-number-circle">
              <span>{countdown}</span>
            </div>
          </div>
        )}

        {/* Stage 4: SINGING (User sings with real-time feedback) */}
        {stage === 'singing' && (
          <div className="stage-singing-box">
            <div className="stage-badge-pill sing">
              <Mic size={18} className="animate-pulse" />
              <span>STEP 2: YOUR TURN TO SING (गाइए!)</span>
            </div>

            <div className="singing-target-hero">
              <span className="singing-hint">Sing and hold this Swara:</span>
              <div className="singing-giant-swar">
                <span className="swar-big-dev">{targetSwaraObj.devanagari}</span>
                <span className="swar-big-eng">({targetSwaraObj.fullName})</span>
              </div>
            </div>

            {/* Realtime Live Deviation Feedback */}
            <div className="singing-live-metrics">
              <div className="metric-box">
                <span className="metric-label">Your Live Pitch</span>
                <span className="metric-value">
                  {currentPitch ? `${currentPitch.swara.devanagari} (${currentPitch.frequency} Hz)` : 'Listening...'}
                </span>
              </div>

              <div className="metric-box">
                <span className="metric-label">Sur Accuracy</span>
                <span className="metric-value" style={{ color: currentPitch?.isInSur ? '#34D399' : '#FBBF24' }}>
                  {currentPitch ? (currentPitch.isInSur ? '✨ In-Tune!' : `${currentPitch.centsDeviation > 0 ? '+' : ''}${currentPitch.centsDeviation}¢`) : '--'}
                </span>
              </div>
            </div>

            {/* Hold In-Sur Progress Bar */}
            <div className="sing-hold-track-wrap">
              <div className="track-labels">
                <span>Hold in Pure Sur:</span>
                <span>{Math.round(singPercent)}%</span>
              </div>
              <div className="sing-hold-track">
                <div
                  className="sing-hold-fill"
                  style={{ width: `${singPercent}%` }}
                />
              </div>
              <span className="track-sub-hint">
                {currentPitch?.isInSur && currentPitch.swara.id === currentTargetNote.swaraId
                  ? '✨ Perfect! Keep steady breath...'
                  : 'Align your voice to match the target note'}
              </span>
            </div>
          </div>
        )}

        {/* Stage 5: ANALYSIS (Post-performance report) */}
        {stage === 'analysis' && analysis && (
          <div className="stage-analysis-box">
            <div className="analysis-header-row">
              <div className="badge-analysis">
                <BarChart3 size={18} />
                <span>STEP 3: RIYAZ ANALYSIS REPORT (विश्लेषण)</span>
              </div>
              <span className="analysis-lesson-tag">{selectedLesson.title}</span>
            </div>

            {/* Scores Overview Row */}
            <div className="scores-cards-row">
              <div className="score-card primary">
                <span className="score-title">Sur Accuracy (सटीकता)</span>
                <span className="score-number" style={{ color: analysis.accuracyScore >= 80 ? '#34D399' : '#FBBF24' }}>
                  {analysis.accuracyScore}%
                </span>
                <span className="score-sub">Time locked in Sur: {analysis.timeInSurSec}s</span>
              </div>

              <div className="score-card">
                <span className="score-title">Stability (स्थिरता)</span>
                <span className="score-number">{analysis.stabilityScore}%</span>
                <span className="score-sub">Voice steadiness</span>
              </div>

              <div className="score-card">
                <span className="score-title">Pitch Tendency</span>
                <span className={`score-number trend-${analysis.centsTrend}`}>
                  {analysis.centsTrend === 'centered' ? 'Centered (सम)' :
                   analysis.centsTrend === 'flat' ? `Flat (${analysis.averageCentsDeviation}¢)` :
                   `Sharp (+${analysis.averageCentsDeviation}¢)`}
                </span>
                <span className="score-sub">Avg deviation from Sa</span>
              </div>
            </div>

            {/* Personalized Guru Feedback */}
            <div className="guru-feedback-card">
              <div className="feedback-top">
                <Sparkles size={20} className="sparkle-gold" />
                <h4>Guru's Feedback (मार्गदर्शन)</h4>
              </div>
              <p className="feedback-hindi">{analysis.feedbackHindi}</p>
              <p className="feedback-english">{analysis.feedbackEnglish}</p>
            </div>

            {/* Action Buttons */}
            <div className="analysis-actions-row">
              <button className="analysis-retry-btn" onClick={startLessonPipeline}>
                <RotateCcw size={16} />
                <span>Try Again (पुनः अभ्यास)</span>
              </button>

              <button
                className="analysis-next-btn"
                onClick={() => {
                  const currentIdx = PRACTICE_LESSONS.findIndex(l => l.id === selectedLesson.id);
                  const nextLesson = PRACTICE_LESSONS[(currentIdx + 1) % PRACTICE_LESSONS.length];
                  setSelectedLesson(nextLesson);
                  handleStopOrReset();
                }}
              >
                <span>Next Lesson (अगला पाठ)</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
