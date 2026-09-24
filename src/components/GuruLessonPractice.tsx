import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RotateCcw, Headphones, Mic, BarChart3, Sparkles, ChevronRight, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PRACTICE_LESSONS } from '../types/music';
import type { PracticeLesson, DetectedPitch, RootPitchConfig, PerformanceAnalysis, RecordedPitchPoint, LessonNote } from '../types/music';
import { guruVocalService } from '../services/guruVocalService';
import { NoteHighwayCanvas } from './NoteHighwayCanvas';
import type { HighwayTargetBlock } from './NoteHighwayCanvas';

interface GuruLessonPracticeProps {
  currentPitch: DetectedPitch | null;
  rootPitch: RootPitchConfig;
  isMicActive: boolean;
  onStartMic: () => void;
}

type PracticeStage = 'idle' | 'demo' | 'countdown' | 'singing' | 'analysis';

interface NotePerformanceSummary {
  swaraId: string;
  label: string;
  durationSec: number;
  accuracy: number;
  avgDeviation: number;
  trend: 'centered' | 'flat' | 'sharp';
}

export const GuruLessonPractice: React.FC<GuruLessonPracticeProps> = ({
  currentPitch,
  rootPitch,
  isMicActive,
  onStartMic,
}) => {
  const [selectedLesson, setSelectedLesson] = useState<PracticeLesson>(PRACTICE_LESSONS[0]);
  const [stage, setStage] = useState<PracticeStage>('idle');
  const [countdown, setCountdown] = useState<number>(3);
  const [customSaDuration, setCustomSaDuration] = useState<number>(4.5);

  // Highway timing and state
  const [exerciseStartTimeMs, setExerciseStartTimeMs] = useState<number | null>(null);
  const [isHitActive, setIsHitActive] = useState<boolean>(false);
  const [activeBlock, setActiveBlock] = useState<HighwayTargetBlock | null>(null);
  const [activeBlockRemainingSec, setActiveBlockRemainingSec] = useState<number>(0);

  // Analysis state
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [noteBreakdowns, setNoteBreakdowns] = useState<NotePerformanceSummary[]>([]);

  const recordedPointsRef = useRef<RecordedPitchPoint[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);

  // Compute effective target notes (allowing custom duration for Sa Sadhana)
  const effectiveTargetNotes: LessonNote[] = useMemo(() => {
    if (selectedLesson.id === 'lesson_sa') {
      return [{ ...selectedLesson.targetNotes[0], durationSec: customSaDuration }];
    }
    return selectedLesson.targetNotes;
  }, [selectedLesson, customSaDuration]);

  // Compute target blocks for the scrolling highway
  const targetBlocks: HighwayTargetBlock[] = useMemo(() => {
    let curSec = 1.0; // 1.0 second approach buffer
    return effectiveTargetNotes.map(n => {
      const block: HighwayTargetBlock = {
        swaraId: n.swaraId,
        startTimeSec: curSec,
        durationSec: n.durationSec,
        label: n.label,
      };
      curSec += n.durationSec + 0.35; // 0.35s breath gap
      return block;
    });
  }, [effectiveTargetNotes]);

  // Total exercise duration in seconds
  const totalExerciseSec = useMemo(() => {
    if (targetBlocks.length === 0) return 5;
    const last = targetBlocks[targetBlocks.length - 1];
    return last.startTimeSec + last.durationSec + 0.6;
  }, [targetBlocks]);

  // Subscribe to demo callbacks from guru vocal service
  useEffect(() => {
    const unsub = guruVocalService.subscribeNote((idx) => {
      setIsHitActive(idx !== -1);
    });
    return () => {
      unsub();
      guruVocalService.stop();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Main singing loop with requestAnimationFrame
  useEffect(() => {
    if (stage !== 'singing' || exerciseStartTimeMs === null) return;

    let animId: number;

    const tick = () => {
      const now = performance.now();
      const elapsedSec = (now - exerciseStartTimeMs) / 1000;

      // Record pitch point
      if (currentPitch) {
        recordedPointsRef.current.push({
          timeSec: elapsedSec,
          frequency: currentPitch.frequency,
          centsDeviation: currentPitch.centsDeviation,
          isInSur: currentPitch.isInSur,
          swaraId: currentPitch.swara.id,
        });
      }

      // Find block currently crossing the playhead
      const crossingBlock = targetBlocks.find(
        b => elapsedSec >= b.startTimeSec && elapsedSec <= b.startTimeSec + b.durationSec
      );

      if (crossingBlock) {
        setActiveBlock(crossingBlock);
        setActiveBlockRemainingSec(Math.max(0, (crossingBlock.startTimeSec + crossingBlock.durationSec) - elapsedSec));

        const isMatch = currentPitch && currentPitch.swara.id === crossingBlock.swaraId && currentPitch.isInSur;
        setIsHitActive(!!isMatch);
      } else {
        setActiveBlock(null);
        setActiveBlockRemainingSec(0);
        setIsHitActive(false);
      }

      // Check if finished
      if (elapsedSec >= totalExerciseSec) {
        finishLessonSinging();
        return;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [stage, exerciseStartTimeMs, targetBlocks, totalExerciseSec, currentPitch]);

  // Start 3-2-1 countdown into singing
  const triggerSingingCountdown = () => {
    guruVocalService.stop();
    setStage('countdown');
    setCountdown(3);
    setExerciseStartTimeMs(null);
    setIsHitActive(false);

    let count = 3;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = window.setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        // Start singing stage
        setStage('singing');
        setExerciseStartTimeMs(performance.now());
      }
    }, 900);
  };

  // Flow 1: Listen & Sing (App demonstrates first, then countdown, then user sings)
  const startListenAndSing = async () => {
    if (!isMicActive) onStartMic();

    setStage('demo');
    setAnalysis(null);
    setNoteBreakdowns([]);
    recordedPointsRef.current = [];

    const startT = performance.now();
    setExerciseStartTimeMs(startT);

    guruVocalService.playDemonstration(
      effectiveTargetNotes,
      rootPitch.frequency,
      () => {
        // Demonstration finished -> trigger countdown to sing!
        triggerSingingCountdown();
      },
      1000, // 1000ms delay matches 1.0s startTimeSec
      350   // 350ms gap matches 0.35s gap
    );
  };

  // Flow 2: Direct Sing Riyaz (Skip demo, go straight to singing countdown)
  const startDirectSinging = () => {
    if (!isMicActive) onStartMic();
    setAnalysis(null);
    setNoteBreakdowns([]);
    recordedPointsRef.current = [];
    triggerSingingCountdown();
  };

  // Finish singing phase and compile detailed Riyaz analysis
  const finishLessonSinging = () => {
    setStage('analysis');
    setExerciseStartTimeMs(null);
    setIsHitActive(false);
    setActiveBlock(null);

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

    // Note by note breakdown
    const breakdowns: NotePerformanceSummary[] = targetBlocks.map(block => {
      const blockPts = points.filter(p => p.timeSec >= block.startTimeSec && p.timeSec <= block.startTimeSec + block.durationSec);
      if (blockPts.length === 0) {
        return {
          swaraId: block.swaraId,
          label: block.label,
          durationSec: block.durationSec,
          accuracy: 0,
          avgDeviation: 0,
          trend: 'centered',
        };
      }

      const blockInSur = blockPts.filter(p => p.isInSur && p.swaraId === block.swaraId);
      const noteAcc = Math.min(100, Math.round((blockInSur.length / blockPts.length) * 100));

      let bSum = 0;
      blockPts.forEach(p => bSum += p.centsDeviation);
      const noteAvgDev = Math.round((bSum / blockPts.length) * 10) / 10;
      const noteTrend: 'centered' | 'sharp' | 'flat' =
        noteAvgDev > 8 ? 'sharp' : noteAvgDev < -8 ? 'flat' : 'centered';

      return {
        swaraId: block.swaraId,
        label: block.label,
        durationSec: block.durationSec,
        accuracy: noteAcc,
        avgDeviation: noteAvgDev,
        trend: noteTrend,
      };
    });
    setNoteBreakdowns(breakdowns);

    // Construct personalized Hindustani feedback
    let feedbackHindi = '';
    let feedbackEnglish = '';

    if (accuracyScore >= 85) {
      feedbackHindi = '✨ लाजवाब रियाज़! आपका सुर एकदम अचूक और स्थिर है। षड्ज पर आपकी पकड़ बहुत मजबूत है।';
      feedbackEnglish = 'Exceptional performance! Your pitch is locked into pure shruti with superb breath control.';
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10B981', '#F59E0B', '#FBBF24'],
      });
    } else if (accuracyScore >= 60) {
      if (trend === 'flat') {
        feedbackHindi = 'सुंदर प्रयास! स्वर थोड़ा "उतरा हुआ" (Flat) था। गले को ढीला रखें और हवा का प्रवाह थोड़ा बढ़ाएं।';
        feedbackEnglish = 'Good attempt! You were leaning slightly flat. Lift your palate and support with more steady breath.';
      } else if (trend === 'sharp') {
        feedbackHindi = 'अच्छा प्रयास! स्वर थोड़ा "चढ़ा हुआ" (Sharp) था। स्वर को शांत और विश्राम देकर साधें।';
        feedbackEnglish = 'Good effort! You were leaning slightly sharp. Relax throat tension to settle on the note.';
      } else {
        feedbackHindi = 'अच्छा प्रयास! सुर सही था, परंतु कंपन के कारण स्थिरता कम रही। लंबी सांस भरकर अभ्यास करें।';
        feedbackEnglish = 'Good pitch alignment! Focus on steady diaphragmatic support to reduce pitch wavering.';
      }
    } else {
      feedbackHindi = 'निराश न हों! सुर साधना सतत अभ्यास से आती है। पहले ऐप का सुर ध्यान से सुनें, फिर दोहराएं।';
      feedbackEnglish = 'Keep practicing! Listen carefully to the app demonstration once more, then match the pitch without straining.';
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
    setExerciseStartTimeMs(null);
    setIsHitActive(false);
    setActiveBlock(null);
    setActiveBlockRemainingSec(0);
    setAnalysis(null);
    setNoteBreakdowns([]);
  };

  return (
    <div className="guru-practice-container">
      {/* Top Header */}
      <div className="guru-header-card">
        <div className="guru-header-title">
          <div className="icon-badge">🎧</div>
          <div>
            <h2>Listen & Sing Riyaz (सुनो और गाओ)</h2>
            <p>Live scrolling note highway shows exact pitch and duration. App sings first, then you sing with instant analysis.</p>
          </div>
        </div>

        {stage !== 'idle' && (
          <button className="reset-pipeline-btn" onClick={handleStopOrReset}>
            <RotateCcw size={16} /> Stop Practice
          </button>
        )}
      </div>

      {/* Main Interactive Arena Card (Top Hero) */}
      <div className="interactive-arena-card">
        {/* Top Arena Control Bar */}
        <div className="arena-top-controls-bar">
          <div className="arena-stage-status">
            {stage === 'idle' && (
              <span className="stage-pill idle">
                <Sparkles size={14} /> RIYAZ HIGHWAY READY
              </span>
            )}
            {stage === 'demo' && (
              <span className="stage-pill demo animate-pulse">
                <Headphones size={14} /> 1. LISTEN TO GURU (सुनिए)
              </span>
            )}
            {stage === 'countdown' && (
              <span className="stage-pill countdown">
                ⏳ PREPARE TO SING IN {countdown}...
              </span>
            )}
            {stage === 'singing' && (
              <span className="stage-pill sing animate-pulse">
                <Mic size={14} /> 2. YOUR TURN TO SING (गाइए!)
              </span>
            )}
            {stage === 'analysis' && (
              <span className="stage-pill analysis">
                <BarChart3 size={14} /> 3. RIYAZ ANALYSIS REPORT
              </span>
            )}

            <span className="arena-active-lesson-name">
              {selectedLesson.hindiTitle} • {selectedLesson.title}
            </span>
          </div>

          {/* Sa Duration Selector for Lesson 1 */}
          {selectedLesson.id === 'lesson_sa' && (stage === 'idle' || stage === 'analysis') && (
            <div className="sa-duration-selector">
              <span className="sa-dur-label">Sa Hold Duration:</span>
              <div className="sa-dur-btns">
                {[
                  { dur: 3.0, label: '3s (Quick)' },
                  { dur: 4.5, label: '4.5s (Std)' },
                  { dur: 8.0, label: '8s (Pro)' },
                  { dur: 12.0, label: '12s (Master)' },
                ].map(({ dur, label }) => (
                  <button
                    key={dur}
                    className={`dur-chip ${customSaDuration === dur ? 'active' : ''}`}
                    onClick={() => setCustomSaDuration(dur)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* The Live Scrolling Note Highway (Centerpiece) */}
        {stage !== 'analysis' && (
          <div className="highway-arena-wrapper">
            <NoteHighwayCanvas
              currentPitch={currentPitch}
              targetBlocks={targetBlocks}
              exerciseStartTimeMs={exerciseStartTimeMs}
              stage={stage}
              isHitActive={isHitActive}
            />

            {/* Countdown Overlay when stage is countdown */}
            {stage === 'countdown' && (
              <div className="highway-countdown-overlay">
                <span className="countdown-subtext">Take a breath... Get ready to sing!</span>
                <div className="countdown-giant-digit">{countdown}</div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Arena Panel */}
        {stage === 'idle' && (
          <div className="arena-idle-action-footer">
            <div className="action-buttons-group">
              <button className="primary-action-btn listen-sing" onClick={startListenAndSing}>
                <Headphones size={20} />
                <div className="btn-text-col">
                  <span className="btn-main-text">Listen & Sing (सुनो और गाओ)</span>
                  <span className="btn-sub-text">App sings first, then you sing</span>
                </div>
              </button>

              <button className="secondary-action-btn direct-sing" onClick={startDirectSinging}>
                <Mic size={18} />
                <div className="btn-text-col">
                  <span className="btn-main-text">Direct Sing (सीधे रियाज़)</span>
                  <span className="btn-sub-text">Skip demo and sing right away</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {stage === 'demo' && (
          <div className="arena-demo-footer">
            <div className="demo-status-pill">
              <span className="demo-pulse-dot" />
              <span>The App is demonstrating pure pitch intonation. Watch the golden capsule pass the playhead to see exact duration and pitch.</span>
            </div>
          </div>
        )}

        {stage === 'singing' && (
          <div className="arena-singing-footer">
            <div className="singing-live-strip">
              <div className="strip-metric">
                <span className="strip-metric-title">Target Swara</span>
                <span className="strip-metric-val highlight">
                  {activeBlock ? `${activeBlock.label} (${activeBlock.durationSec}s)` : 'Waiting for note...'}
                </span>
              </div>

              <div className="strip-metric">
                <span className="strip-metric-title">Note Hold Remaining</span>
                <span className="strip-metric-val">
                  {activeBlock ? `${activeBlockRemainingSec.toFixed(1)}s` : '--'}
                </span>
              </div>

              <div className="strip-metric">
                <span className="strip-metric-title">Your Live Pitch</span>
                <span className="strip-metric-val">
                  {currentPitch ? `${currentPitch.swara.devanagari} (${currentPitch.frequency.toFixed(1)} Hz)` : 'Listening...'}
                </span>
              </div>

              <div className="strip-metric">
                <span className="strip-metric-title">Accuracy</span>
                <span
                  className="strip-metric-val"
                  style={{ color: isHitActive ? '#34D399' : currentPitch?.isInSur ? '#FBBF24' : '#F87171' }}
                >
                  {isHitActive ? '✨ IN SUR!' : currentPitch ? `${currentPitch.centsDeviation > 0 ? '+' : ''}${currentPitch.centsDeviation}¢` : '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Post-Performance Analysis Report */}
        {stage === 'analysis' && analysis && (
          <div className="stage-analysis-box">
            <div className="analysis-header-row">
              <div className="badge-analysis">
                <BarChart3 size={18} />
                <span>RIYAZ ANALYSIS REPORT (रियाज़ परिणाम)</span>
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
                <span className="score-sub">Voice steadiness & breath</span>
              </div>

              <div className="score-card">
                <span className="score-title">Pitch Tendency</span>
                <span className={`score-number trend-${analysis.centsTrend}`}>
                  {analysis.centsTrend === 'centered' ? 'Centered (सम)' :
                   analysis.centsTrend === 'flat' ? `Flat (${analysis.averageCentsDeviation}¢)` :
                   `Sharp (+${analysis.averageCentsDeviation}¢)`}
                </span>
                <span className="score-sub">Intonation drift</span>
              </div>
            </div>

            {/* Note-by-note Breakdown Strip */}
            {noteBreakdowns.length > 0 && (
              <div className="note-breakdown-card">
                <h4 className="breakdown-title">
                  <Zap size={16} /> Note-by-Note Duration & Accuracy Breakdown
                </h4>
                <div className="breakdown-grid">
                  {noteBreakdowns.map((nb, i) => (
                    <div key={i} className="breakdown-item">
                      <div className="breakdown-left">
                        <span className="item-swara">{nb.label}</span>
                        <span className="item-dur">{nb.durationSec}s hold</span>
                      </div>
                      <div className="breakdown-bar-wrap">
                        <div className="breakdown-bar-track">
                          <div
                            className="breakdown-bar-fill"
                            style={{
                              width: `${nb.accuracy}%`,
                              backgroundColor: nb.accuracy >= 80 ? '#10B981' : nb.accuracy >= 50 ? '#F59E0B' : '#EF4444'
                            }}
                          />
                        </div>
                        <span className="item-score">{nb.accuracy}%</span>
                      </div>
                      <span className={`item-trend ${nb.trend}`}>
                        {nb.trend === 'centered' ? 'Centered' : nb.trend === 'flat' ? `Flat (${nb.avgDeviation}¢)` : `Sharp (+${nb.avgDeviation}¢)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personalized Guru Feedback */}
            <div className="guru-feedback-card">
              <div className="feedback-top">
                <Sparkles size={20} className="sparkle-gold" />
                <h4>Guru's Guidance (मार्गदर्शन)</h4>
              </div>
              <p className="feedback-hindi">{analysis.feedbackHindi}</p>
              <p className="feedback-english">{analysis.feedbackEnglish}</p>
            </div>

            {/* Action Buttons */}
            <div className="analysis-actions-row">
              <button className="analysis-retry-btn" onClick={startDirectSinging}>
                <RotateCcw size={16} />
                <span>Sing Again (पुनः रियाज़)</span>
              </button>

              <button className="secondary-action-btn" onClick={startListenAndSing}>
                <Headphones size={16} />
                <span>Listen to Guru Again</span>
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

      {/* Lesson Selection Section */}
      <div className="lessons-catalog-section">
        <div className="section-title-strip">
          <h3>Choose Practice Exercise (रियाज़ पाठ चुनें)</h3>
          <p>Select from fundamental Swara holds, intervals, and classical ragas</p>
        </div>

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
      </div>
    </div>
  );
};
