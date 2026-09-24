import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RotateCcw, Headphones, Mic, BarChart3, Sparkles, ChevronRight, Zap, Volume2, Award, UserCheck } from 'lucide-react';
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

type PracticeStage = 'idle' | 'demo' | 'countdown' | 'singing' | 'round_transition' | 'analysis';

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
  const [countdown, setCountdown] = useState<number>(3);
  const [customSaDuration, setCustomSaDuration] = useState<number>(4.5);

  // Padhanisa 5-Round Practice Cycle
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundHistory, setRoundHistory] = useState<RoundPerformance[]>([]);
  const [roundTransitionText, setRoundTransitionText] = useState<string>('');
  const [voiceTimbre, setVoiceTimbre] = useState<VoiceTimbre>('male_vocal');

  // Real-time audio levels
  const [guruAudioLevel, setGuruAudioLevel] = useState<number>(0);
  const [userMicLevel, setUserMicLevel] = useState<number>(0);

  // Highway timing and state
  const [exerciseStartTimeMs, setExerciseStartTimeMs] = useState<number | null>(null);
  const [isHitActive, setIsHitActive] = useState<boolean>(false);
  const [activeBlock, setActiveBlock] = useState<HighwayTargetBlock | null>(null);
  const [activeBlockRemainingSec, setActiveBlockRemainingSec] = useState<number>(0);

  // Analysis state
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [noteBreakdowns, setNoteBreakdowns] = useState<NotePerformanceSummary[]>([]);

  const recordedPointsRef = useRef<RecordedPitchPoint[]>([]);
  const allSessionPointsRef = useRef<RecordedPitchPoint[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);
  const roundTimeoutRef = useRef<number | null>(null);
  const currentModeRef = useRef<'listen_sing' | 'direct_sing'>('listen_sing');

  // Subscribe to Guru voice audio level & note events
  useEffect(() => {
    const unsubNote = guruVocalService.subscribeNote((idx) => {
      setIsHitActive(idx !== -1);
    });
    const unsubLevel = guruVocalService.subscribeAudioLevel((lvl) => {
      setGuruAudioLevel(lvl);
    });
    return () => {
      unsubNote();
      unsubLevel();
      guruVocalService.stop();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (roundTimeoutRef.current) clearTimeout(roundTimeoutRef.current);
    };
  }, []);

  // Monitor microphone volume level during singing
  useEffect(() => {
    if (stage === 'singing' && currentPitch) {
      // Map dB RMS (-60dB to 0dB) into 0.0 to 1.0
      const vol = Math.max(0, Math.min(1, (currentPitch.volumeDb + 52) / 45));
      setUserMicLevel(vol);
    } else {
      setUserMicLevel(0);
    }
  }, [currentPitch, stage]);

  // Compute effective target notes
  const effectiveTargetNotes: LessonNote[] = useMemo(() => {
    if (selectedLesson.id === 'lesson_sa') {
      return [{ ...selectedLesson.targetNotes[0], durationSec: customSaDuration }];
    }
    return selectedLesson.targetNotes;
  }, [selectedLesson, customSaDuration]);

  // Compute target blocks for the scrolling highway
  const targetBlocks: HighwayTargetBlock[] = useMemo(() => {
    let curSec = 1.0;
    return effectiveTargetNotes.map(n => {
      const block: HighwayTargetBlock = {
        swaraId: n.swaraId,
        startTimeSec: curSec,
        durationSec: n.durationSec,
        label: n.label,
      };
      curSec += n.durationSec + 0.35;
      return block;
    });
  }, [effectiveTargetNotes]);

  // Total exercise duration in seconds
  const totalExerciseSec = useMemo(() => {
    if (targetBlocks.length === 0) return 5;
    const last = targetBlocks[targetBlocks.length - 1];
    return last.startTimeSec + last.durationSec + 0.6;
  }, [targetBlocks]);

  // Main singing loop
  useEffect(() => {
    if (stage !== 'singing' || exerciseStartTimeMs === null) return;

    let animId: number;

    const tick = () => {
      const now = performance.now();
      const elapsedSec = (now - exerciseStartTimeMs) / 1000;

      // Record pitch point
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

      // Check which block is crossing the playhead
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

      // When note completes
      if (elapsedSec >= totalExerciseSec) {
        handleRoundSingingComplete();
        return;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [stage, exerciseStartTimeMs, targetBlocks, totalExerciseSec, currentPitch]);

  // Start 3-2-1 countdown into singing
  const triggerSingingCountdown = (roundNum: number) => {
    guruVocalService.stop();
    setStage('countdown');
    setCountdown(3);
    setExerciseStartTimeMs(null);
    setIsHitActive(false);
    setActiveBlock(null);

    let count = 3;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = window.setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        // Start singing phase for this round
        setStage('singing');
        setCurrentRound(roundNum);
        setExerciseStartTimeMs(performance.now());
      }
    }, 900);
  };

  // Launch a round (demo -> countdown -> sing, or direct sing)
  const launchRound = (roundNum: number, mode: 'listen_sing' | 'direct_sing') => {
    setCurrentRound(roundNum);
    recordedPointsRef.current = [];
    setActiveBlock(null);
    setIsHitActive(false);

    if (mode === 'listen_sing') {
      // Step 1: Guru Sings
      setStage('demo');
      const startT = performance.now();
      setExerciseStartTimeMs(startT);

      guruVocalService.playDemonstration(
        effectiveTargetNotes,
        rootPitch.frequency,
        () => {
          // Step 2: Now Your Turn to Sing!
          triggerSingingCountdown(roundNum);
        },
        1000,
        350
      );
    } else {
      // Direct Sing: Skip demo
      triggerSingingCountdown(roundNum);
    }
  };

  // Start entire multi-round practice session
  const startFullPracticeSession = (mode: 'listen_sing' | 'direct_sing') => {
    if (!isMicActive) onStartMic();
    currentModeRef.current = mode;
    setRoundHistory([]);
    setAnalysis(null);
    setNoteBreakdowns([]);
    allSessionPointsRef.current = [];
    launchRound(1, mode);
  };

  // When user finishes singing the current round
  const handleRoundSingingComplete = () => {
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

    // If more rounds remain, celebrate round and trigger next round!
    if (currentRound < totalRounds) {
      setStage('round_transition');
      const nextR = currentRound + 1;
      setRoundTransitionText(
        `✨ Round ${currentRound} of ${totalRounds} Complete (${roundAcc}% Pure Sur)! Get ready for Round ${nextR}...`
      );

      if (roundTimeoutRef.current) clearTimeout(roundTimeoutRef.current);
      roundTimeoutRef.current = window.setTimeout(() => {
        launchRound(nextR, currentModeRef.current);
      }, 1600);
    } else {
      // Completed all 5 rounds! Compile comprehensive Riyaz Report
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

    // Note by note breakdown across entire session
    const breakdowns: NotePerformanceSummary[] = targetBlocks.map(block => {
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
      const bInSur = blockPts.filter(p => p.isInSur);
      const acc = Math.min(100, Math.round((bInSur.length / blockPts.length) * 100));
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

    // Hindustani Guru feedback
    let feedbackHindi = '';
    let feedbackEnglish = '';

    if (avgRoundAcc >= 85) {
      feedbackHindi = `✨ अद्भुत साधना! सभी ${totalRounds} चक्रों में आपका सुर एकदम अचूक और स्थिर रहा। आपका नाद ब्रह्म में विलीन होने योग्य है।`;
      feedbackEnglish = `Masterful performance! Across all ${totalRounds} rounds, your pitch accuracy and breath stability remained locked in pure shruti.`;
      confetti({
        particleCount: 120,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#10B981', '#F59E0B', '#FBBF24'],
      });
    } else if (avgRoundAcc >= 60) {
      if (trend === 'flat') {
        feedbackHindi = `सुंदर प्रयास! ${totalRounds} चक्रों के रियाज़ में स्वर थोड़ा उतरा हुआ (Flat) रहा। कंठ को खुला रखें और वायु प्रवाह बढ़ाएं।`;
        feedbackEnglish = `Good effort across ${totalRounds} rounds! You tended slightly flat. Lift your palate and engage steady breath support.`;
      } else if (trend === 'sharp') {
        feedbackHindi = `अच्छा अभ्यास! स्वर थोड़ा चढ़ा हुआ (Sharp) रहा। गले के खिंचाव को शांत कर स्वर को सहजता से लगने दें।`;
        feedbackEnglish = `Solid practice! Pitch tended slightly sharp. Relax any vocal tension and let the note settle peacefully.`;
      } else {
        feedbackHindi = `उत्तम रियाज़! सुर का स्थान सही था, कंपन कम करने के लिए लंबे श्वास से नाद साधना करें।`;
        feedbackEnglish = `Good pitch alignment! Deepen breath support to eliminate micro-fluctuations.`;
      }
    } else {
      feedbackHindi = `निराश न हों! भारतीय संगीत में रियाज़ ही सिद्धि है। पहले ऐप का मानव स्वर ध्यान से सुनें, फिर दोहराएं।`;
      feedbackEnglish = `Keep practicing! Listen carefully to the demonstration voice for each round, then match without strain.`;
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
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (roundTimeoutRef.current) clearTimeout(roundTimeoutRef.current);
    setStage('idle');
    setCurrentRound(1);
    setRoundHistory([]);
    setExerciseStartTimeMs(null);
    setIsHitActive(false);
    setActiveBlock(null);
    setActiveBlockRemainingSec(0);
    setAnalysis(null);
    setNoteBreakdowns([]);
    setGuruAudioLevel(0);
    setUserMicLevel(0);
  };

  const handleVoiceTimbreChange = (timbre: VoiceTimbre) => {
    setVoiceTimbre(timbre);
    guruVocalService.setVoiceTimbre(timbre);
  };

  const currentActiveLevel = stage === 'demo' ? guruAudioLevel : userMicLevel;

  return (
    <div className="guru-practice-container">
      {/* Top Header */}
      <div className="guru-header-card">
        <div className="guru-header-title">
          <div className="icon-badge">🎧</div>
          <div>
            <h2>Listen & Sing Riyaz (सुनो और गाओ • ५ चक्र साधना)</h2>
            <p>Padhanisa-style Call-and-Response: App sings with authentic human voice, then you sing. Repeats for 5 continuous rounds.</p>
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
            {stage === 'demo' && (
              <span className="stage-pill demo animate-pulse">
                <Headphones size={14} /> 1. GURU SINGS (सुनिए) • ROUND {currentRound}/{totalRounds}
              </span>
            )}
            {stage === 'countdown' && (
              <span className="stage-pill countdown">
                ⏳ PREPARE TO SING ROUND {currentRound}/{totalRounds} IN {countdown}...
              </span>
            )}
            {stage === 'singing' && (
              <span className="stage-pill sing animate-pulse">
                <Mic size={14} /> 2. YOUR TURN (गाइए!) • ROUND {currentRound}/{totalRounds}
              </span>
            )}
            {stage === 'round_transition' && (
              <span className="stage-pill transition animate-pulse">
                <Award size={14} /> {roundTransitionText}
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
                      { dur: 4.5, label: '4.5s' },
                      { dur: 8.0, label: '8s' },
                      { dur: 12.0, label: '12s' },
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
              stage={stage === 'round_transition' ? 'idle' : stage}
              isHitActive={isHitActive}
              audioLevel={currentActiveLevel}
            />

            {/* Countdown Overlay */}
            {stage === 'countdown' && (
              <div className="highway-countdown-overlay">
                <span className="countdown-subtext">Round {currentRound} of {totalRounds}: Take a breath... Get ready!</span>
                <div className="countdown-giant-digit">{countdown}</div>
              </div>
            )}

            {/* Round Transition Toast */}
            {stage === 'round_transition' && (
              <div className="highway-countdown-overlay">
                <span className="countdown-subtext">{roundTransitionText}</span>
                <div className="round-next-spinner animate-pulse">Next Round Starting...</div>
              </div>
            )}
          </div>
        )}

        {/* Live Audio Level Meter (VU Meter) */}
        {stage !== 'analysis' && (
          <div className="live-vocal-meter-card">
            <div className="meter-header">
              <span className="meter-title">
                {stage === 'demo' ? '🎙️ GURU HUMAN VOICE LEVEL' : stage === 'singing' ? '🎤 YOUR MICROPHONE INPUT LEVEL' : '🔊 AUDIO MONITOR'}
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
                    className={`meter-segment ${isLit ? (stage === 'demo' ? 'lit-gold' : isHigh ? 'lit-red' : isMid ? 'lit-amber' : 'lit-green') : ''}`}
                  />
                );
              })}
            </div>

            <div className="meter-footer-hint">
              {stage === 'demo' && (
                <span>App is demonstrating pure vocal resonance with acoustic human voice synthesis.</span>
              )}
              {stage === 'singing' && (
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
        {stage === 'singing' && (
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
                  style={{ color: isHitActive ? '#34D399' : currentPitch?.isInSur ? '#FBBF24' : '#F87171' }}
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
                <span className="score-number" style={{ color: analysis.accuracyScore >= 80 ? '#34D399' : '#FBBF24' }}>
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

            {/* Round-by-Round Progression Bar Chart (Padhanisa Style) */}
            {roundHistory.length > 0 && (
              <div className="multi-round-card">
                <h4 className="breakdown-title">
                  <Award size={16} /> Round-by-Round Improvement ({roundHistory.length} Rounds)
                </h4>
                <div className="round-progress-grid">
                  {roundHistory.map((rh) => (
                    <div key={rh.round} className="round-progress-col">
                      <span className="round-col-label">Round {rh.round}</span>
                      <div className="round-meter-vertical">
                        <div
                          className="round-meter-fill"
                          style={{
                            height: `${rh.accuracy}%`,
                            backgroundColor: rh.accuracy >= 80 ? '#10B981' : rh.accuracy >= 55 ? '#F59E0B' : '#EF4444'
                          }}
                        />
                      </div>
                      <span className="round-score-text">{rh.accuracy}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note-by-note Breakdown Strip */}
            {noteBreakdowns.length > 0 && (
              <div className="note-breakdown-card">
                <h4 className="breakdown-title">
                  <Zap size={16} /> Note Intonation & Duration Breakdown
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
                <h4>Guru's Guidance (गुरु मार्गदर्शन)</h4>
              </div>
              <p className="feedback-hindi">{analysis.feedbackHindi}</p>
              <p className="feedback-english">{analysis.feedbackEnglish}</p>
            </div>

            {/* Action Buttons */}
            <div className="analysis-actions-row">
              <button className="analysis-retry-btn" onClick={() => startFullPracticeSession('listen_sing')}>
                <RotateCcw size={16} />
                <span>Repeat {totalRounds} Rounds (पुनः अभ्यास)</span>
              </button>

              <button className="secondary-action-btn" onClick={() => startFullPracticeSession('direct_sing')}>
                <Mic size={16} />
                <span>Direct Sing {totalRounds} Rounds</span>
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
