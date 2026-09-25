import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RotateCcw, Headphones, Mic, BarChart3, Sparkles, ChevronRight, Volume2, Award, UserCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PRACTICE_LESSONS } from '../types/music';
import type { PracticeLesson, DetectedPitch, RootPitchConfig, PerformanceAnalysis, RecordedPitchPoint, LessonNote } from '../types/music';
import { guruVocalService } from '../services/guruVocalService';
import type { VoiceTimbre } from '../services/guruVocalService';
import { NoteHighwayCanvas } from './NoteHighwayCanvas';
import type { HighwayTargetBlock } from './NoteHighwayCanvas';

interface GuruLessonPracticeProps {
  currentPitch: DetectedPitch | null;
  rootPitch: RootPitchConfig;
  isMicActive: boolean;
  onStartMic: () => void;
}

type PracticeStage = 'idle' | 'practicing' | 'analysis';

export interface RoundPerformance {
  round: number;
  accuracy: number;
  stability: number;
  avgDeviation: number;
  timeInSurSec: number;
  totalSec: number;
}

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
  const [practiceMode, setPracticeMode] = useState<'listen_sing' | 'direct_sing'>('listen_sing');
  const [customSaDuration, setCustomSaDuration] = useState<number>(4.0);

  // Padhanisa 5-Round Practice Cycle
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundHistory, setRoundHistory] = useState<RoundPerformance[]>([]);
  const [roundToast, setRoundToast] = useState<string | null>(null);
  const [voiceTimbre, setVoiceTimbre] = useState<VoiceTimbre>('male_vocal');

  // Real-time audio levels
  const [guruAudioLevel, setGuruAudioLevel] = useState<number>(0);
  const [userMicLevel, setUserMicLevel] = useState<number>(0);

  // Highway timing and state
  const [exerciseStartTimeMs, setExerciseStartTimeMs] = useState<number | null>(null);
  const [elapsedExerciseSec, setElapsedExerciseSec] = useState<number>(0);
  const [isHitActive, setIsHitActive] = useState<boolean>(false);
  const [activeBlock, setActiveBlock] = useState<HighwayTargetBlock | null>(null);
  const [activeBlockRemainingSec, setActiveBlockRemainingSec] = useState<number>(0);

  // Analysis state
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [noteBreakdowns, setNoteBreakdowns] = useState<NotePerformanceSummary[]>([]);

  const recordedPointsRef = useRef<RecordedPitchPoint[]>([]);
  const allSessionPointsRef = useRef<RecordedPitchPoint[]>([]);
  const roundTransitionTimeoutRef = useRef<number | null>(null);

  // Subscribe to Guru voice audio level & note events
  useEffect(() => {
    const unsubNote = guruVocalService.subscribeNote((idx) => {
      // During assisted phase, if Guru is demonstrating, mark as active
      if (activeBlock?.type === 'assisted') {
        setIsHitActive(idx !== -1);
      }
    });
    const unsubLevel = guruVocalService.subscribeAudioLevel((lvl) => {
      setGuruAudioLevel(lvl);
    });
    return () => {
      unsubNote();
      unsubLevel();
      guruVocalService.stop();
      if (roundTransitionTimeoutRef.current) clearTimeout(roundTransitionTimeoutRef.current);
    };
  }, [activeBlock]);

  // Monitor microphone volume level during user turn
  useEffect(() => {
    if (stage === 'practicing' && activeBlock?.type === 'user' && currentPitch) {
      // Map dB RMS (-60dB to 0dB) into 0.0 to 1.0
      const vol = Math.max(0, Math.min(1, (currentPitch.volumeDb + 52) / 45));
      setUserMicLevel(vol);
    } else {
      setUserMicLevel(0);
    }
  }, [currentPitch, stage, activeBlock]);

  // Compute effective target notes
  const effectiveTargetNotes: LessonNote[] = useMemo(() => {
    if (selectedLesson.id === 'lesson_sa') {
      return [{ ...selectedLesson.targetNotes[0], durationSec: customSaDuration }];
    }
    return selectedLesson.targetNotes;
  }, [selectedLesson, customSaDuration]);

  // Compute target blocks for the scrolling highway:
  // In listen_sing mode:
  // 1. Assisted (Guru) note blocks (Saffron / Gold)
  // 2. Continuous breath gap (1.4s) where upcoming user notes are already visible scrolling towards playhead!
  // 3. User note blocks (Padhanisa Orange / Green)
  const targetBlocks: HighwayTargetBlock[] = useMemo(() => {
    const blocks: HighwayTargetBlock[] = [];

    if (practiceMode === 'listen_sing') {
      // Phase 1: Guru Guide Notes (1.0s lead-in)
      let curSec = 1.0;
      effectiveTargetNotes.forEach(n => {
        blocks.push({
          swaraId: n.swaraId,
          startTimeSec: curSec,
          durationSec: n.durationSec,
          label: n.label,
          type: 'assisted',
        });
        curSec += n.durationSec + 0.35;
      });

      // Breath transition gap (1.4s natural breathing space)
      curSec += 1.4;

      // Phase 2: User Notes (Padhanisa Orange / Green)
      effectiveTargetNotes.forEach(n => {
        blocks.push({
          swaraId: n.swaraId,
          startTimeSec: curSec,
          durationSec: n.durationSec,
          label: n.label,
          type: 'user',
        });
        curSec += n.durationSec + 0.35;
      });
    } else {
      // Direct Sing: User blocks only (1.0s lead-in)
      let curSec = 1.0;
      effectiveTargetNotes.forEach(n => {
        blocks.push({
          swaraId: n.swaraId,
          startTimeSec: curSec,
          durationSec: n.durationSec,
          label: n.label,
          type: 'user',
        });
        curSec += n.durationSec + 0.35;
      });
    }

    return blocks;
  }, [effectiveTargetNotes, practiceMode]);

  // Total duration of one complete round in seconds
  const totalRoundSec = useMemo(() => {
    if (targetBlocks.length === 0) return 6;
    const last = targetBlocks[targetBlocks.length - 1];
    return last.startTimeSec + last.durationSec + 0.6;
  }, [targetBlocks]);

  // Main continuous animation loop (Zero freezing, continuous scrolling)
  useEffect(() => {
    if (stage !== 'practicing' || exerciseStartTimeMs === null) return;

    let animId: number;

    const tick = () => {
      const now = performance.now();
      const elapsedSec = (now - exerciseStartTimeMs) / 1000;
      setElapsedExerciseSec(elapsedSec);

      // Check which block is currently crossing the playhead
      const crossingBlock = targetBlocks.find(
        b => elapsedSec >= b.startTimeSec && elapsedSec <= b.startTimeSec + b.durationSec
      );

      if (crossingBlock) {
        setActiveBlock(crossingBlock);
        setActiveBlockRemainingSec(Math.max(0, (crossingBlock.startTimeSec + crossingBlock.durationSec) - elapsedSec));

        if (crossingBlock.type === 'assisted') {
          // Guru is singing
          setIsHitActive(true);
        } else {
          // User is singing! Evaluate pitch match against target swara
          const isMatch = currentPitch && currentPitch.swara.id === crossingBlock.swaraId && currentPitch.isInSur;
          setIsHitActive(!!isMatch);

          // Record user singing data
          if (currentPitch) {
            const pt: RecordedPitchPoint = {
              timeSec: elapsedSec,
              frequency: currentPitch.frequency,
              centsDeviation: currentPitch.centsDeviation,
              isInSur: currentPitch.isInSur,
              swaraId: currentPitch.swara.id,
            };
            recordedPointsRef.current.push(pt);
            allSessionPointsRef.current.push(pt);
          }
        }
      } else {
        setActiveBlock(null);
        setActiveBlockRemainingSec(0);
        setIsHitActive(false);
      }

      // Check if current round has completed
      if (elapsedSec >= totalRoundSec) {
        handleRoundComplete();
        return;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [stage, exerciseStartTimeMs, targetBlocks, totalRoundSec, currentPitch]);

  // Launch a round seamlessly (Starts Guru voice and continuous scroll)
  const launchRound = (roundNum: number, mode: 'listen_sing' | 'direct_sing') => {
    setCurrentRound(roundNum);
    recordedPointsRef.current = [];
    setActiveBlock(null);
    setIsHitActive(false);
    setStage('practicing');
    setElapsedExerciseSec(0);

    const startT = performance.now();
    setExerciseStartTimeMs(startT);

    if (mode === 'listen_sing') {
      // Guru starts singing precisely at t = 1.0s when the Assisted block hits playhead!
      guruVocalService.playDemonstration(
        effectiveTargetNotes,
        rootPitch.frequency,
        () => {
          // Guru finished demonstration; timeline continues seamlessly into User block
        },
        1000,
        350
      );
    }
  };

  // Start entire multi-round practice session
  const startFullPracticeSession = (mode: 'listen_sing' | 'direct_sing') => {
    if (!isMicActive) onStartMic();
    setPracticeMode(mode);
    setRoundHistory([]);
    setAnalysis(null);
    setRoundToast(null);
    setNoteBreakdowns([]);
    allSessionPointsRef.current = [];
    launchRound(1, mode);
  };

  // Handle completion of a single round
  const handleRoundComplete = () => {
    guruVocalService.stop();
    setExerciseStartTimeMs(null);
    setIsHitActive(false);
    setActiveBlock(null);

    const points = recordedPointsRef.current;
    const inSurPts = points.filter(p => p.isInSur);
    const roundAcc = points.length > 0 ? Math.min(100, Math.round((inSurPts.length / points.length) * 100)) : 0;

    let sumDev = 0;
    points.forEach(p => sumDev += p.centsDeviation);
    const avgDev = points.length > 0 ? Math.round((sumDev / points.length) * 10) / 10 : 0;

    let varSum = 0;
    points.forEach(p => {
      const diff = p.centsDeviation - avgDev;
      varSum += diff * diff;
    });
    const stdDev = points.length > 0 ? Math.sqrt(varSum / points.length) : 0;
    const roundStab = Math.max(0, Math.min(100, Math.round(100 - stdDev * 2.2)));

    const roundPerf: RoundPerformance = {
      round: currentRound,
      accuracy: roundAcc,
      stability: roundStab,
      avgDeviation: avgDev,
      timeInSurSec: Math.round((inSurPts.length * 0.05) * 10) / 10,
      totalSec: Math.round((points.length * 0.05) * 10) / 10,
    };

    const nextHistory = [...roundHistory, roundPerf];
    setRoundHistory(nextHistory);

    // If more rounds remain, trigger next round seamlessly
    if (currentRound < totalRounds) {
      const nextR = currentRound + 1;
      setRoundToast(`✨ Round ${currentRound} Complete (${roundAcc}% Sur)! Starting Round ${nextR} of ${totalRounds}...`);

      if (roundTransitionTimeoutRef.current) clearTimeout(roundTransitionTimeoutRef.current);
      roundTransitionTimeoutRef.current = window.setTimeout(() => {
        setRoundToast(null);
        launchRound(nextR, practiceMode);
      }, 750);
    } else {
      // Completed all 5 rounds! Compile comprehensive Riyaz Report
      setRoundToast(null);
      finishFullSessionAnalysis(nextHistory);
    }
  };

  // Compile final 5-round analysis report
  const finishFullSessionAnalysis = (completedRounds: RoundPerformance[]) => {
    setStage('analysis');
    setExerciseStartTimeMs(null);
    setIsHitActive(false);
    setActiveBlock(null);

    const allPts = allSessionPointsRef.current;
    if (allPts.length === 0) {
      setAnalysis({
        accuracyScore: 0,
        stabilityScore: 0,
        averageCentsDeviation: 0,
        centsTrend: 'centered',
        totalSingingTimeSec: 0,
        timeInSurSec: 0,
        feedbackHindi: 'कोई स्वर रिकॉर्ड नहीं हुआ। कृपया माइक के करीब गाएं।',
        feedbackEnglish: 'No vocal pitch was detected. Please try singing clearly into the microphone.',
        points: [],
      });
      return;
    }

    const inSurPoints = allPts.filter(p => p.isInSur);
    const avgRoundAcc = Math.round(completedRounds.reduce((acc, r) => acc + r.accuracy, 0) / completedRounds.length);
    const avgRoundStab = Math.round(completedRounds.reduce((acc, r) => acc + r.stability, 0) / completedRounds.length);

    let sumDev = 0;
    allPts.forEach(p => sumDev += p.centsDeviation);
    const avgDev = Math.round((sumDev / allPts.length) * 10) / 10;
    const trend: 'centered' | 'sharp' | 'flat' =
      avgDev > 8 ? 'sharp' : avgDev < -8 ? 'flat' : 'centered';

    // Note by note breakdown
    const userBlocks = targetBlocks.filter(b => b.type === 'user');
    const breakdowns: NotePerformanceSummary[] = userBlocks.map(block => {
      const blockPts = allPts.filter(p => p.swaraId === block.swaraId);
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
      const blockInSur = blockPts.filter(p => p.isInSur).length;
      const acc = Math.round((blockInSur / blockPts.length) * 100);
      let bSum = 0;
      blockPts.forEach(p => bSum += p.centsDeviation);
      const bAvg = Math.round((bSum / blockPts.length) * 10) / 10;
      return {
        swaraId: block.swaraId,
        label: block.label,
        durationSec: block.durationSec,
        accuracy: acc,
        avgDeviation: bAvg,
        trend: bAvg > 8 ? 'sharp' : bAvg < -8 ? 'flat' : 'centered',
      };
    });
    setNoteBreakdowns(breakdowns);

    let feedbackHindi = '';
    let feedbackEnglish = '';
    if (avgRoundAcc >= 85) {
      feedbackHindi = `अद्भुत रियाज़! आपका स्वर बहुत सटीक (${avgRoundAcc}%) और स्थिर था।`;
      feedbackEnglish = `Outstanding Riyaz! Your pitch adherence was remarkably pure (${avgRoundAcc}% in sur).`;
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
    } else if (avgRoundAcc >= 65) {
      feedbackHindi = `अच्छा प्रयास! सुर मिला (${avgRoundAcc}%), लेकिन थोड़ा सा ध्यान देने की आवश्यकता है।`;
      feedbackEnglish = `Good singing! You maintained solid intonation (${avgRoundAcc}%). Keep practicing steady breath.`;
    } else {
      feedbackHindi = `रियाज़ जारी रखें! गुरु के स्वर को ध्यान से सुनें और तालमेल बिठाएं।`;
      feedbackEnglish = `Keep practicing! Listen closely to the Guru guide notes and match the pitch line.`;
    }

    setAnalysis({
      accuracyScore: avgRoundAcc,
      stabilityScore: avgRoundStab,
      averageCentsDeviation: avgDev,
      centsTrend: trend,
      totalSingingTimeSec: Math.round((allPts.length * 0.05) * 10) / 10,
      timeInSurSec: Math.round((inSurPoints.length * 0.05) * 10) / 10,
      feedbackHindi,
      feedbackEnglish,
      points: allPts,
    });
  };

  const handleStopOrReset = () => {
    guruVocalService.stop();
    if (roundTransitionTimeoutRef.current) clearTimeout(roundTransitionTimeoutRef.current);
    setStage('idle');
    setCurrentRound(1);
    setRoundHistory([]);
    setExerciseStartTimeMs(null);
    setElapsedExerciseSec(0);
    setIsHitActive(false);
    setActiveBlock(null);
    setActiveBlockRemainingSec(0);
    setRoundToast(null);
    setAnalysis(null);
    setNoteBreakdowns([]);
    setGuruAudioLevel(0);
    setUserMicLevel(0);
  };

  const handleVoiceTimbreChange = (timbre: VoiceTimbre) => {
    setVoiceTimbre(timbre);
    guruVocalService.setVoiceTimbre(timbre);
  };

  const isAssistedPhase = activeBlock?.type === 'assisted';
  const currentActiveLevel = isAssistedPhase ? guruAudioLevel : userMicLevel;

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="guru-practice-container">
      {/* Top Header */}
      <div className="guru-header-card">
        <div className="guru-header-title">
          <div className="icon-badge">🎧</div>
          <div>
            <h2>Listen & Sing Riyaz (सुनो और गाओ • ५ चक्र साधना)</h2>
            <p>Padhanisa-style Call-and-Response: App sings first, then you sing. Repeats for 5 continuous rounds without interruptions.</p>
          </div>
        </div>

        {stage !== 'idle' && (
          <button className="reset-pipeline-btn" onClick={handleStopOrReset}>
            <RotateCcw size={16} /> Stop Practice
          </button>
        )}
      </div>

      {/* Main Interactive Arena Card */}
      <div className="interactive-arena-card">
        {/* Top Arena Control Bar */}
        <div className="arena-top-controls-bar">
          <div className="arena-stage-status">
            {stage === 'idle' && (
              <span className="stage-pill idle">
                <Sparkles size={14} /> RIYAZ HIGHWAY READY ({totalRounds} ROUNDS)
              </span>
            )}
            {stage === 'practicing' && isAssistedPhase && (
              <span className="stage-pill demo animate-pulse">
                <Headphones size={14} /> 1. GURU GUIDE (सुनिए) • ROUND {currentRound}/{totalRounds}
              </span>
            )}
            {stage === 'practicing' && !isAssistedPhase && activeBlock && (
              <span className="stage-pill sing animate-pulse">
                <Mic size={14} /> 2. YOUR TURN (गाइए!) • ROUND {currentRound}/{totalRounds}
              </span>
            )}
            {stage === 'practicing' && !activeBlock && (
              <span className="stage-pill countdown">
                ⏳ ROUND {currentRound}/{totalRounds} • TAKE A BREATH
              </span>
            )}
            {stage === 'analysis' && (
              <span className="stage-pill analysis">
                <BarChart3 size={14} /> 3. {totalRounds}-ROUND RIYAZ ANALYSIS REPORT
              </span>
            )}

            <span className="arena-active-lesson-name">
              {selectedLesson.hindiTitle} • {selectedLesson.title}
            </span>
          </div>

          {/* Practice Settings Controls (when idle) */}
          {stage === 'idle' && (
            <div className="arena-config-cluster">
              {/* Voice Timbre Selector */}
              <div className="config-item">
                <span className="config-label"><Volume2 size={12} /> Guru Voice:</span>
                <select
                  className="voice-select-dropdown"
                  value={voiceTimbre}
                  onChange={(e) => handleVoiceTimbreChange(e.target.value as VoiceTimbre)}
                >
                  <option value="male_vocal">🎙️ Classical Male Voice (शास्त्रीय पुरुष स्वर)</option>
                  <option value="female_vocal">🎙️ Classical Female Voice (स्त्री स्वर)</option>
                  <option value="bansuri">🪈 Bamboo Bansuri (बांसुरी)</option>
                  <option value="harmonium">🎻 Acoustic Harmonium (हारमोनियम)</option>
                </select>
              </div>

              {/* Rounds Selector (Padhanisa 5-Rounds Default) */}
              <div className="config-item">
                <span className="config-label"><UserCheck size={12} /> Rounds:</span>
                <div className="sa-dur-btns">
                  {[
                    { rounds: 1, label: '1 Round' },
                    { rounds: 3, label: '3 Rounds' },
                    { rounds: 5, label: '5 Rounds ⭐' },
                  ].map(({ rounds, label }) => (
                    <button
                      key={rounds}
                      className={`dur-chip ${totalRounds === rounds ? 'active' : ''}`}
                      onClick={() => setTotalRounds(rounds)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sa Duration Selector for Lesson 1 */}
              {selectedLesson.id === 'lesson_sa' && (
                <div className="config-item">
                  <span className="config-label">Sa Hold:</span>
                  <div className="sa-dur-btns">
                    {[
                      { dur: 3.0, label: '3s' },
                      { dur: 4.0, label: '4s' },
                      { dur: 6.0, label: '6s' },
                      { dur: 8.0, label: '8s' },
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
          )}
        </div>

        {/* Live Scrolling Note Highway (Centerpiece) */}
        {stage !== 'analysis' && (
          <div className="highway-arena-wrapper">
            <NoteHighwayCanvas
              currentPitch={currentPitch}
              targetBlocks={targetBlocks}
              exerciseStartTimeMs={exerciseStartTimeMs}
              stage={stage}
              isHitActive={isHitActive}
              audioLevel={currentActiveLevel}
              totalRoundSec={totalRoundSec}
              isUserTurn={activeBlock?.type === 'user'}
            />

            {/* Non-blocking Floating Toast for Seamless Round Transitions */}
            {roundToast && (
              <div className="highway-floating-toast animate-bounce">
                <span>{roundToast}</span>
              </div>
            )}

            {/* Padhanisa-style Lyrics / Syllable Subtitle Card */}
            <div className="highway-subtitles-card">
              <div className="subtitle-main-row">
                <span className={`subtitle-active-syllable ${isAssistedPhase ? 'gold-theme' : isHitActive ? 'green-theme' : 'orange-theme'}`}>
                  {activeBlock ? activeBlock.label : '...'}
                </span>
                <span className="subtitle-devanagari">
                  {activeBlock ? selectedLesson.hindiTitle : 'तैयार रहें...'}
                </span>
              </div>
              <div className="subtitle-hint-pill">
                {isAssistedPhase ? (
                  <span className="pill-gold">🎧 Guru is Singing (Listen closely to the pitch)</span>
                ) : activeBlock ? (
                  <span className="pill-green">🎤 Sing into microphone now ({activeBlockRemainingSec.toFixed(1)}s left)</span>
                ) : (
                  <span className="pill-blue">👀 Take a breath... Next note arriving!</span>
                )}
              </div>
            </div>

            {/* Padhanisa-style Bottom Scrubber Bar & Timestamps */}
            <div className="padhanisa-scrubber-track">
              <span className="scrubber-time">{formatTime(elapsedExerciseSec)}</span>
              <div className="scrubber-bar-container">
                <div
                  className="scrubber-fill-bar"
                  style={{ width: `${Math.min(100, (elapsedExerciseSec / totalRoundSec) * 100)}%` }}
                />
                <div
                  className="scrubber-knob"
                  style={{ left: `${Math.min(100, (elapsedExerciseSec / totalRoundSec) * 100)}%` }}
                />
              </div>
              <span className="scrubber-time total">{formatTime(totalRoundSec)}</span>
              <span className="scrubber-round-badge">Round {currentRound}/{totalRounds}</span>
            </div>
          </div>
        )}

        {/* Live Audio Level Meter (VU Meter) */}
        {stage !== 'analysis' && (
          <div className="live-vocal-meter-card">
            <div className="meter-header">
              <span className="meter-title">
                {isAssistedPhase ? '🎙️ GURU HUMAN VOICE LEVEL' : activeBlock ? '🎤 YOUR MICROPHONE INPUT LEVEL' : '🔊 AUDIO MONITOR'}
              </span>
              <span className="meter-percent">{(currentActiveLevel * 100).toFixed(0)}%</span>
            </div>

            <div className="meter-led-bar-track">
              {Array.from({ length: 24 }).map((_, i) => {
                const threshold = (i + 1) / 24;
                const isLit = currentActiveLevel >= threshold;
                const isHigh = i >= 18;
                const isMid = i >= 12 && i < 18;
                return (
                  <div
                    key={i}
                    className={`meter-segment ${isLit ? (isAssistedPhase ? 'lit-gold' : isHigh ? 'lit-red' : isMid ? 'lit-amber' : 'lit-green') : ''}`}
                  />
                );
              })}
            </div>

            <div className="meter-footer-hint">
              {isAssistedPhase && (
                <span>App is demonstrating vocal resonance with acoustic human voice synthesis.</span>
              )}
              {!isAssistedPhase && activeBlock && (
                userMicLevel < 0.12
                  ? <span className="warning-text">⚠️ Voice level is low — please sing louder or move closer to the mic.</span>
                  : <span className="success-text">✨ Clean vocal volume detected! Keep steady breath.</span>
              )}
              {stage === 'idle' && (
                <span>Ready to begin {totalRounds} Call-and-Response practice rounds.</span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons Footer (when idle) */}
        {stage === 'idle' && (
          <div className="arena-idle-action-footer">
            <div className="action-buttons-group">
              <button className="primary-action-btn listen-sing" onClick={() => startFullPracticeSession('listen_sing')}>
                <Headphones size={20} />
                <div className="btn-text-col">
                  <span className="btn-main-text">Start {totalRounds}-Round Practice (सुनो और गाओ)</span>
                  <span className="btn-sub-text">App sings first, then you sing • {totalRounds} continuous rounds</span>
                </div>
              </button>

              <button className="secondary-action-btn direct-sing" onClick={() => startFullPracticeSession('direct_sing')}>
                <Mic size={18} />
                <div className="btn-text-col">
                  <span className="btn-main-text">Direct Sing ({totalRounds} Rounds)</span>
                  <span className="btn-sub-text">Skip demo and sing directly</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Singing HUD Metrics Strip */}
        {stage === 'practicing' && (
          <div className="arena-singing-footer">
            <div className="singing-live-strip">
              <div className="strip-metric">
                <span className="strip-metric-title">Round</span>
                <span className="strip-metric-val highlight">
                  Round {currentRound} of {totalRounds}
                </span>
              </div>

              <div className="strip-metric">
                <span className="strip-metric-title">Target Swara</span>
                <span className="strip-metric-val highlight">
                  {activeBlock ? `${activeBlock.label} (${activeBlock.durationSec}s)` : 'Approaching...'}
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
                <span className="strip-metric-title">Intonation</span>
                <span
                  className="strip-metric-val"
                  style={{ color: isHitActive ? '#22C55E' : currentPitch?.isInSur ? '#FBBF24' : '#F87171' }}
                >
                  {isHitActive ? '✨ IN SUR!' : currentPitch ? `${currentPitch.centsDeviation > 0 ? '+' : ''}${currentPitch.centsDeviation}¢` : '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Round Performance Analysis Report */}
        {stage === 'analysis' && analysis && (
          <div className="stage-analysis-box">
            <div className="analysis-header-row">
              <div className="badge-analysis">
                <BarChart3 size={18} />
                <span>{totalRounds}-ROUND RIYAZ MASTERY REPORT (५ चक्र साधना परिणाम)</span>
              </div>
              <span className="analysis-lesson-tag">{selectedLesson.title}</span>
            </div>

            {/* Scores Overview Row */}
            <div className="scores-cards-row">
              <div className="score-card primary">
                <span className="score-title">Overall Accuracy (सटीकता)</span>
                <span className="score-number" style={{ color: analysis.accuracyScore >= 80 ? '#22C55E' : '#FBBF24' }}>
                  {analysis.accuracyScore}%
                </span>
                <span className="score-sub">Across all {totalRounds} rounds</span>
              </div>

              <div className="score-card">
                <span className="score-title">Breath Stability (स्थिरता)</span>
                <span className="score-number">{analysis.stabilityScore}%</span>
                <span className="score-sub">Voice steadiness & control</span>
              </div>

              <div className="score-card">
                <span className="score-title">Pitch Tendency</span>
                <span className={`score-number trend-${analysis.centsTrend}`}>
                  {analysis.centsTrend === 'centered' ? 'Centered (सम)' :
                   analysis.centsTrend === 'flat' ? `Flat (${analysis.averageCentsDeviation}¢)` :
                   `Sharp (+${analysis.averageCentsDeviation}¢)`}
                </span>
                <span className="score-sub">Average pitch drift</span>
              </div>
            </div>

            {/* Round by Round Progression Bar Chart */}
            {roundHistory.length > 1 && (
              <div className="multi-round-card">
                <div className="multi-round-header">
                  <Award size={18} />
                  <span>Round-by-Round Progression (चक्रवार तुलना)</span>
                </div>
                <div className="rounds-bar-chart">
                  {roundHistory.map((r) => (
                    <div key={r.round} className="round-chart-col">
                      <span className="round-chart-score">{r.accuracy}%</span>
                      <div className="round-chart-track">
                        <div
                          className="round-chart-fill"
                          style={{
                            height: `${Math.max(10, r.accuracy)}%`,
                            backgroundColor: r.accuracy >= 80 ? '#22C55E' : r.accuracy >= 60 ? '#FBBF24' : '#F87171'
                          }}
                        />
                      </div>
                      <span className="round-chart-label">R{r.round}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback Message */}
            <div className="analysis-feedback-card">
              <span className="feedback-badge">Guru Guidance (गुरु का मार्गदर्शन)</span>
              <p className="feedback-hindi">{analysis.feedbackHindi}</p>
              <p className="feedback-english">{analysis.feedbackEnglish}</p>
            </div>

            {/* Note by Note Breakdown */}
            {noteBreakdowns.length > 0 && (
              <div className="breakdown-card">
                <span className="breakdown-card-title">Swara Intonation Breakdown</span>
                <div className="breakdown-grid">
                  {noteBreakdowns.map((nb, i) => (
                    <div key={i} className="breakdown-item">
                      <div className="breakdown-item-top">
                        <span className="breakdown-note-label">{nb.label} ({nb.durationSec}s)</span>
                        <span className="breakdown-note-score" style={{ color: nb.accuracy >= 80 ? '#22C55E' : '#FBBF24' }}>
                          {nb.accuracy}%
                        </span>
                      </div>
                      <div className="breakdown-progress-track">
                        <div
                          className="breakdown-progress-fill"
                          style={{
                            width: `${nb.accuracy}%`,
                            backgroundColor: nb.accuracy >= 80 ? '#22C55E' : nb.accuracy >= 60 ? '#FBBF24' : '#F87171',
                          }}
                        />
                      </div>
                      <span className="breakdown-note-sub">
                        {nb.trend === 'centered' ? 'In pure sur' : nb.trend === 'flat' ? `Flat ${nb.avgDeviation}¢` : `Sharp +${nb.avgDeviation}¢`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="analysis-actions-row">
              <button className="primary-action-btn listen-sing" onClick={() => startFullPracticeSession('listen_sing')}>
                <RotateCcw size={18} /> Practice Again (५ चक्र पुनः अभ्यास)
              </button>
              <button className="secondary-action-btn direct-sing" onClick={() => startFullPracticeSession('direct_sing')}>
                <Mic size={18} /> Direct Sing Only
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lesson Selection Cards (when idle) */}
      {stage === 'idle' && (
        <div className="practice-lessons-section">
          <div className="section-title-row">
            <h3>Choose a Riyaz Lesson (अभ्यास चुनें)</h3>
            <span className="lesson-count-tag">{PRACTICE_LESSONS.length} Guided Lessons</span>
          </div>

          <div className="lessons-grid">
            {PRACTICE_LESSONS.map((lesson) => {
              const isSelected = selectedLesson.id === lesson.id;
              return (
                <div
                  key={lesson.id}
                  className={`lesson-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedLesson(lesson)}
                >
                  <div className="lesson-card-header">
                    <span className="lesson-badge-category">{lesson.category}</span>
                    <span className={`lesson-difficulty-badge ${lesson.level.toLowerCase()}`}>
                      {lesson.level}
                    </span>
                  </div>

                  <h4 className="lesson-title">{lesson.title}</h4>
                  <span className="lesson-hindi-title">{lesson.hindiTitle}</span>
                  <p className="lesson-description">{lesson.description}</p>

                  <div className="lesson-target-notes-row">
                    {lesson.targetNotes.map((note, idx) => (
                      <span key={idx} className="note-capsule-tag">
                        {note.label}
                      </span>
                    ))}
                  </div>

                  <div className="lesson-card-footer">
                    <span className="lesson-duration-est">
                      {lesson.targetNotes.reduce((acc, n) => acc + n.durationSec, 0)}s per round
                    </span>
                    <span className="lesson-action-hint">
                      {isSelected ? '✓ Selected' : 'Select'} <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
