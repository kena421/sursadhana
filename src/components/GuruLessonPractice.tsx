import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  RotateCcw,
  Mic,
  BarChart3,
  Sparkles,
  ChevronRight,
  Award,
  UserCheck,
  Star,
  BookOpen,
  ArrowRight,
  Flame,
  Zap,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PRACTICE_LESSONS, SWARAS } from '../types/music';
import type {
  PracticeLesson,
  DetectedPitch,
  RootPitchConfig,
  PerformanceAnalysis,
  RecordedPitchPoint,
  HighwayTargetBlock,
} from '../types/music';
import { NoteHighwayCanvas } from './NoteHighwayCanvas';

interface GuruLessonPracticeProps {
  currentPitch: DetectedPitch | null;
  rootPitch: RootPitchConfig;
  isMicActive: boolean;
  onStartMic: () => void;
  isTanpuraActive?: boolean;
  onToggleTanpura?: () => void;
}

type PracticeStage = 'idle' | 'practicing' | 'analysis';

export interface RoundPerformance {
  round: number;
  accuracy: number;
  stability: number;
  avgDeviation: number;
  timeInSurSec: number;
  totalSec: number;
  recordedPoints: RecordedPitchPoint[];
  targetBlocks: HighwayTargetBlock[];
}

interface NotePerformanceSummary {
  swaraId: string;
  label: string;
  durationSec: number;
  accuracy: number;
  avgDeviation: number;
  trend: 'centered' | 'flat' | 'sharp';
}

interface LessonScoreRecord {
  bestAccuracy: number;
  bestStability: number;
  roundsCount: number;
  lastPracticedDate: string;
}

interface SingerProfile {
  scores: Record<string, LessonScoreRecord>;
  totalRoundsOverall: number;
  totalSingingSec: number;
}

const STORAGE_KEY = 'sur_singer_mastery_profile_v2';

const loadSavedProfile = (): SingerProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load singer profile:', e);
  }
  return {
    scores: {},
    totalRoundsOverall: 0,
    totalSingingSec: 0,
  };
};

export const GuruLessonPractice: React.FC<GuruLessonPracticeProps> = ({
  currentPitch,
  rootPitch,
  isMicActive,
  onStartMic,
  isTanpuraActive = false,
  onToggleTanpura,
}) => {
  const [selectedLesson, setSelectedLesson] = useState<PracticeLesson>(PRACTICE_LESSONS[0]);
  const [stage, setStage] = useState<PracticeStage>('idle');

  // Singer Curriculum & Profile
  const [singerProfile, setSingerProfile] = useState<SingerProfile>(loadSavedProfile);
  const [stageFilter, setStageFilter] = useState<number | 'all'>('all');

  // Padhanisa Multi-Round Practice Cycle
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundHistory, setRoundHistory] = useState<RoundPerformance[]>([]);
  const [roundToast, setRoundToast] = useState<string | null>(null);

  // User microphone level
  const [userMicLevel, setUserMicLevel] = useState<number>(0);

  // Highway timing and live state
  const [exerciseStartTimeMs, setExerciseStartTimeMs] = useState<number | null>(null);
  const [elapsedExerciseSec, setElapsedExerciseSec] = useState<number>(0);
  const [isHitActive, setIsHitActive] = useState<boolean>(false);
  const [activeBlock, setActiveBlock] = useState<HighwayTargetBlock | null>(null);
  const [activeBlockRemainingSec, setActiveBlockRemainingSec] = useState<number>(0);

  // Scrollback & Review State
  const [reviewRoundIndex, setReviewRoundIndex] = useState<number>(0);
  const [reviewElapsedSec, setReviewElapsedSec] = useState<number>(0);
  const [isReviewPlaying, setIsReviewPlaying] = useState<boolean>(false);
  const [showIdleReview, setShowIdleReview] = useState<boolean>(false);
  const reviewAnimIdRef = useRef<number | null>(null);
  const reviewLastTimeRef = useRef<number | null>(null);

  // Analysis state
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [noteBreakdowns, setNoteBreakdowns] = useState<NotePerformanceSummary[]>([]);

  const allSessionPointsRef = useRef<RecordedPitchPoint[]>([]);
  const roundTransitionTimeoutRef = useRef<number | null>(null);

  // Clean up round transitions & animations on unmount
  useEffect(() => {
    return () => {
      if (roundTransitionTimeoutRef.current) clearTimeout(roundTransitionTimeoutRef.current);
      if (reviewAnimIdRef.current) cancelAnimationFrame(reviewAnimIdRef.current);
    };
  }, []);

  // Save profile helper
  const saveProfileUpdate = (updater: (prev: SingerProfile) => SingerProfile) => {
    setSingerProfile(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save singer profile:', e);
      }
      return next;
    });
  };

  // Calculate overall singer mastery statistics
  const masteryStats = useMemo(() => {
    const scores = singerProfile.scores;
    const totalLessons = PRACTICE_LESSONS.length;
    let masteredCount = 0;
    let attemptedCount = 0;

    PRACTICE_LESSONS.forEach(l => {
      const sc = scores[l.id];
      if (sc) {
        attemptedCount++;
        if (sc.bestAccuracy >= 80) masteredCount++;
      }
    });

    const masteryPercent = Math.round((masteredCount / totalLessons) * 100);

    let rankTitle = '🎵 Shishya (आरंभिक शिष्य / Apprentice Vocalist)';
    let rankBadge = 'Shishya';
    let rankColor = '#FBBF24';
    let nextMilestone = 'Master 4 lessons to become a Sadhak';

    if (masteredCount >= 18) {
      rankTitle = '🏆 Sur-Samrat (सुर-सम्राट / Virtuoso Classical Singer)';
      rankBadge = 'Virtuoso';
      rankColor = '#F59E0B';
      nextMilestone = 'Mastered full curriculum! Maintain daily riyaz.';
    } else if (masteredCount >= 13) {
      rankTitle = '👑 Pandit / Vidwan (विद्वान गायक / Master Vocalist)';
      rankBadge = 'Master';
      rankColor = '#8B5CF6';
      nextMilestone = `${18 - masteredCount} more lessons to reach Sur-Samrat`;
    } else if (masteredCount >= 8) {
      rankTitle = '🌟 Gayak (कुशल गायक / Skilled Classical Singer)';
      rankBadge = 'Skilled Singer';
      rankColor = '#10B981';
      nextMilestone = `${13 - masteredCount} more lessons to reach Pandit/Vidwan`;
    } else if (masteredCount >= 4) {
      rankTitle = '🎶 Sadhak (सुर साधक / Dedicated Vocalist)';
      rankBadge = 'Sadhak';
      rankColor = '#38BDF8';
      nextMilestone = `${8 - masteredCount} more lessons to reach Gayak rank`;
    }

    const nextLesson = PRACTICE_LESSONS.find(l => {
      const sc = scores[l.id];
      return !sc || sc.bestAccuracy < 80;
    }) || PRACTICE_LESSONS[0];

    return {
      masteredCount,
      attemptedCount,
      totalLessons,
      masteryPercent,
      rankTitle,
      rankBadge,
      rankColor,
      nextMilestone,
      nextLesson,
    };
  }, [singerProfile]);

  // Filtered lessons list
  const filteredLessons = useMemo(() => {
    if (stageFilter === 'all') return PRACTICE_LESSONS;
    return PRACTICE_LESSONS.filter(l => l.stageNumber === stageFilter);
  }, [stageFilter]);

  // Monitor microphone volume level during practice
  useEffect(() => {
    if (stage === 'practicing' && currentPitch) {
      const vol = Math.max(0, Math.min(1, (currentPitch.volumeDb + 52) / 45));
      setUserMicLevel(vol);
    } else {
      setUserMicLevel(0);
    }
  }, [currentPitch, stage]);

  // Single round duration and total multi-round session duration
  const singleRoundSec: number = selectedLesson.totalRoundSec;
  const totalSessionSec: number = totalRounds * singleRoundSec;

  // Seamless continuous target blocks tiled for all rounds in the practice session
  const continuousTargetBlocks = useMemo<HighwayTargetBlock[]>(() => {
    const blocks: HighwayTargetBlock[] = [];
    for (let r = 0; r < totalRounds; r++) {
      const rOffset = r * singleRoundSec;
      for (const b of selectedLesson.targetBlocks) {
        blocks.push({
          ...b,
          startTimeSec: b.startTimeSec + rOffset,
        });
      }
    }
    return blocks;
  }, [selectedLesson, totalRounds, singleRoundSec]);

  // Live breath hold tracking for Long Sa
  const liveHeldSec = useMemo(() => {
    if (!activeBlock || activeBlock.type !== 'user') return 0;
    const pts = allSessionPointsRef.current.filter(
      p => p.swaraId === activeBlock.swaraId &&
           p.isInSur &&
           p.timeSec >= activeBlock.startTimeSec &&
           p.timeSec <= activeBlock.startTimeSec + activeBlock.durationSec
    );
    return Math.min(activeBlock.durationSec, Math.round(pts.length * 0.05 * 10) / 10);
  }, [activeBlock, elapsedExerciseSec]);

  // Live pitch stability percentage
  const liveStability = useMemo(() => {
    if (!activeBlock || activeBlock.type !== 'user') return 100;
    const pts = allSessionPointsRef.current.filter(
      p => p.swaraId === activeBlock.swaraId &&
           p.timeSec >= activeBlock.startTimeSec &&
           p.timeSec <= activeBlock.startTimeSec + activeBlock.durationSec
    );
    if (pts.length === 0) return 100;
    const inSur = pts.filter(p => p.isInSur).length;
    return Math.round((inSur / pts.length) * 100);
  }, [activeBlock, elapsedExerciseSec]);

  // Active Review Round selection & bounds
  const activeReviewRound = useMemo(() => {
    if (roundHistory.length === 0) return null;
    const safeIdx = Math.max(0, Math.min(roundHistory.length - 1, reviewRoundIndex));
    return roundHistory[safeIdx];
  }, [roundHistory, reviewRoundIndex]);

  const activeReviewTotalSec = useMemo(() => {
    if (activeReviewRound && activeReviewRound.totalSec > 0) {
      return activeReviewRound.totalSec;
    }
    return singleRoundSec;
  }, [activeReviewRound, singleRoundSec]);

  const activeReviewTargetBlocks = useMemo(() => {
    if (activeReviewRound?.targetBlocks && activeReviewRound.targetBlocks.length > 0) {
      return activeReviewRound.targetBlocks;
    }
    return selectedLesson.targetBlocks;
  }, [activeReviewRound, selectedLesson]);

  const activeReviewRecordedPoints = useMemo(() => {
    if (activeReviewRound?.recordedPoints && activeReviewRound.recordedPoints.length > 0) {
      return activeReviewRound.recordedPoints;
    }
    return allSessionPointsRef.current;
  }, [activeReviewRound]);

  // Inspection at scrubber position in review mode
  const currentExpectedBlock = useMemo(() => {
    return activeReviewTargetBlocks.find(
      b => reviewElapsedSec >= b.startTimeSec && reviewElapsedSec <= b.startTimeSec + b.durationSec
    );
  }, [activeReviewTargetBlocks, reviewElapsedSec]);

  const currentRecordedPoint = useMemo(() => {
    if (!activeReviewRecordedPoints || activeReviewRecordedPoints.length === 0) return null;
    return activeReviewRecordedPoints.find(p => Math.abs(p.timeSec - reviewElapsedSec) <= 0.15);
  }, [activeReviewRecordedPoints, reviewElapsedSec]);

  // Play/Pause Replay Animation Loop for Scrollback Review
  useEffect(() => {
    if (!isReviewPlaying) {
      if (reviewAnimIdRef.current) cancelAnimationFrame(reviewAnimIdRef.current);
      reviewLastTimeRef.current = null;
      return;
    }

    const tickReview = (now: number) => {
      if (reviewLastTimeRef.current !== null) {
        const dt = (now - reviewLastTimeRef.current) / 1000;
        setReviewElapsedSec(prev => {
          const next = prev + dt;
          if (next >= activeReviewTotalSec) {
            setIsReviewPlaying(false);
            return activeReviewTotalSec;
          }
          return next;
        });
      }
      reviewLastTimeRef.current = now;
      reviewAnimIdRef.current = requestAnimationFrame(tickReview);
    };

    reviewAnimIdRef.current = requestAnimationFrame(tickReview);
    return () => {
      if (reviewAnimIdRef.current) cancelAnimationFrame(reviewAnimIdRef.current);
    };
  }, [isReviewPlaying, activeReviewTotalSec]);

  // Ref for currentPitch so RAF loop does not need currentPitch in deps
  const currentPitchRef = useRef<DetectedPitch | null>(currentPitch);
  useEffect(() => {
    currentPitchRef.current = currentPitch;
  }, [currentPitch]);

  // Trackers for round transitions and throttled UI updates
  const lastCompletedRoundRef = useRef<number>(0);
  const lastUiUpdateMsRef = useRef<number>(0);

  // Main continuous animation loop during live practice
  useEffect(() => {
    if (stage !== 'practicing' || exerciseStartTimeMs === null) return;

    let animId: number;

    const tick = () => {
      const now = performance.now();
      const elapsedSec = (now - exerciseStartTimeMs) / 1000;

      // Throttle UI timer/scrubber state updates to ~15 FPS to keep main thread silky smooth
      if (now - lastUiUpdateMsRef.current >= 66) {
        lastUiUpdateMsRef.current = now;
        setElapsedExerciseSec(elapsedSec);
      }

      // Check which block is currently crossing the playhead across the entire continuous session
      const crossingBlock = continuousTargetBlocks.find(
        b => elapsedSec >= b.startTimeSec && elapsedSec <= b.startTimeSec + b.durationSec
      );

      const pitch = currentPitchRef.current;

      if (crossingBlock) {
        setActiveBlock(crossingBlock);
        setActiveBlockRemainingSec(Math.max(0, (crossingBlock.startTimeSec + crossingBlock.durationSec) - elapsedSec));

        // Evaluate pitch match against target swara
        const isMatch = pitch && pitch.swara.id === crossingBlock.swaraId && pitch.isInSur;
        setIsHitActive(!!isMatch);
      } else {
        setActiveBlock(null);
        setActiveBlockRemainingSec(0);
        setIsHitActive(false);
      }

      // Record singing pitch continuously throughout practice
      if (pitch) {
        const swaraIndex = SWARAS.findIndex(s => s.id === pitch.swara.id);
        const semitonePos = (swaraIndex !== -1 ? swaraIndex : 0) + pitch.centsDeviation / 100;

        const pt: RecordedPitchPoint = {
          timeSec: elapsedSec,
          frequency: pitch.frequency,
          centsDeviation: pitch.centsDeviation,
          isInSur: pitch.isInSur,
          swaraId: pitch.swara.id,
          semitonePos,
        };
        allSessionPointsRef.current.push(pt);
      }

      // Dynamically update currentRound state for UI display
      const currentR = Math.min(totalRounds, Math.floor(elapsedSec / singleRoundSec) + 1);
      setCurrentRound(currentR);

      // Check round boundaries seamlessly without stopping or resetting the highway!
      for (let r = 1; r < totalRounds; r++) {
        if (elapsedSec >= r * singleRoundSec && lastCompletedRoundRef.current < r) {
          lastCompletedRoundRef.current = r;

          // Compute round r stats
          const rStart = (r - 1) * singleRoundSec;
          const rEnd = r * singleRoundSec;
          const rPts = allSessionPointsRef.current.filter(p => p.timeSec >= rStart && p.timeSec < rEnd);
          const normalizedPts = rPts.map(p => ({
            ...p,
            timeSec: Math.max(0, p.timeSec - rStart),
          }));
          const inSurPts = normalizedPts.filter(p => p.isInSur);
          const roundAcc = normalizedPts.length > 0 ? Math.min(100, Math.round((inSurPts.length / normalizedPts.length) * 100)) : 0;

          let sumDev = 0;
          normalizedPts.forEach(p => sumDev += p.centsDeviation);
          const avgDev = normalizedPts.length > 0 ? Math.round((sumDev / normalizedPts.length) * 10) / 10 : 0;

          let varSum = 0;
          normalizedPts.forEach(p => {
            const diff = p.centsDeviation - avgDev;
            varSum += diff * diff;
          });
          const stdDev = normalizedPts.length > 0 ? Math.sqrt(varSum / normalizedPts.length) : 0;
          const roundStab = Math.max(0, Math.min(100, Math.round(100 - stdDev * 2.2)));

          const roundPerf: RoundPerformance = {
            round: r,
            accuracy: roundAcc,
            stability: roundStab,
            avgDeviation: avgDev,
            timeInSurSec: Math.round(inSurPts.length * 0.05 * 10) / 10,
            totalSec: singleRoundSec,
            recordedPoints: normalizedPts,
            targetBlocks: [...selectedLesson.targetBlocks],
          };

          setRoundHistory(prev => [...prev, roundPerf]);
          setRoundToast(`✨ Round ${r}/${totalRounds} Complete (${roundAcc}% Sur)! Keep singing into Round ${r + 1}...`);
          if (roundTransitionTimeoutRef.current) clearTimeout(roundTransitionTimeoutRef.current);
          roundTransitionTimeoutRef.current = window.setTimeout(() => {
            setRoundToast(null);
          }, 3000);
          break;
        }
      }

      // Check if entire multi-round session has completed
      if (elapsedSec >= totalSessionSec) {
        handleFullSessionCompletion();
        return;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [stage, exerciseStartTimeMs, continuousTargetBlocks, totalSessionSec, singleRoundSec, totalRounds]);

  // Helper to compile round performance history from recorded session points
  const compileRoundsFromPoints = (points: RecordedPitchPoint[], numRounds: number, elapsed: number): RoundPerformance[] => {
    const history: RoundPerformance[] = [];
    for (let r = 1; r <= numRounds; r++) {
      const rStart = (r - 1) * singleRoundSec;
      const rEnd = Math.min(elapsed, r * singleRoundSec);
      const rPts = points.filter(p => p.timeSec >= rStart && p.timeSec <= rEnd);
      const normalizedPts = rPts.map(p => ({
        ...p,
        timeSec: Math.max(0, p.timeSec - rStart),
      }));
      const inSurPts = normalizedPts.filter(p => p.isInSur);
      const roundAcc = normalizedPts.length > 0
        ? Math.min(100, Math.round((inSurPts.length / normalizedPts.length) * 100))
        : 0;

      let sumDev = 0;
      normalizedPts.forEach(p => sumDev += p.centsDeviation);
      const avgDev = normalizedPts.length > 0 ? Math.round((sumDev / normalizedPts.length) * 10) / 10 : 0;

      let varSum = 0;
      normalizedPts.forEach(p => {
        const diff = p.centsDeviation - avgDev;
        varSum += diff * diff;
      });
      const stdDev = normalizedPts.length > 0 ? Math.sqrt(varSum / normalizedPts.length) : 0;
      const roundStab = Math.max(0, Math.min(100, Math.round(100 - stdDev * 2.2)));

      history.push({
        round: r,
        accuracy: roundAcc,
        stability: roundStab,
        avgDeviation: avgDev,
        timeInSurSec: Math.round(inSurPts.length * 0.05 * 10) / 10,
        totalSec: singleRoundSec,
        recordedPoints: normalizedPts,
        targetBlocks: [...selectedLesson.targetBlocks],
      });
    }
    return history;
  };

  // Start entire multi-round practice session (does not auto-trigger Tanpura)
  const startFullPracticeSession = () => {
    if (!isMicActive) onStartMic();
    setRoundHistory([]);
    setAnalysis(null);
    setRoundToast(null);
    setNoteBreakdowns([]);
    setShowIdleReview(false);
    allSessionPointsRef.current = [];
    lastCompletedRoundRef.current = 0;
    setCurrentRound(1);
    setActiveBlock(null);
    setIsHitActive(false);
    setElapsedExerciseSec(0);
    setStage('practicing');

    const startT = performance.now();
    setExerciseStartTimeMs(startT);
  };

  // Handle completion of the full multi-round practice session
  const handleFullSessionCompletion = () => {
    setIsHitActive(false);
    setActiveBlock(null);
    setRoundToast(null);
    setElapsedExerciseSec(totalSessionSec);

    const completed = compileRoundsFromPoints(allSessionPointsRef.current, totalRounds, totalSessionSec);
    setRoundHistory(completed);
    finishFullSessionAnalysis(completed);
  };

  // Compile final analysis report & save persistent mastery progress
  const finishFullSessionAnalysis = (completedRounds: RoundPerformance[]) => {
    setStage('analysis');
    setExerciseStartTimeMs(null);
    setIsHitActive(false);
    setActiveBlock(null);
    setIsReviewPlaying(false);
    setReviewRoundIndex(Math.max(0, completedRounds.length - 1));
    setReviewElapsedSec(0);

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
    const userBlocks = selectedLesson.targetBlocks.filter(b => b.type === 'user');
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

    // Save score in persistent profile
    saveProfileUpdate(prev => {
      const existing = prev.scores[selectedLesson.id];
      const bestAcc = Math.max(existing?.bestAccuracy || 0, avgRoundAcc);
      const bestStab = Math.max(existing?.bestStability || 0, avgRoundStab);
      const roundsCount = (existing?.roundsCount || 0) + completedRounds.length;

      return {
        ...prev,
        totalRoundsOverall: prev.totalRoundsOverall + completedRounds.length,
        totalSingingSec: prev.totalSingingSec + Math.round(allPts.length * 0.05),
        scores: {
          ...prev.scores,
          [selectedLesson.id]: {
            bestAccuracy: bestAcc,
            bestStability: bestStab,
            roundsCount,
            lastPracticedDate: new Date().toISOString(),
          },
        },
      };
    });

    let feedbackHindi = '';
    let feedbackEnglish = '';
    if (avgRoundAcc >= 85) {
      feedbackHindi = `अद्भुत साधना! आपकी सटीकता (${avgRoundAcc}%) उत्तम है। आपने इस पाठ में महारत (Mastery) हासिल कर ली है!`;
      feedbackEnglish = `Outstanding vocal mastery! Your intonation (${avgRoundAcc}%) is exceptionally centered. Lesson Mastered!`;
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    } else if (avgRoundAcc >= 65) {
      feedbackHindi = `अच्छा प्रयास (${avgRoundAcc}%)! स्वर मिल रहे हैं, लेकिन श्वास स्थिरता और नाभि आधार पर और अभ्यास करें।`;
      feedbackEnglish = `Good progress (${avgRoundAcc}%)! Keep your vocal tract open and sustain breath from your diaphragm.`;
    } else {
      feedbackHindi = `रियाज़ जारी रखें! तानपूरे के सुर को ध्यान से सुनें और पिच लाइन के केंद्र से तालमेल बिठाएं।`;
      feedbackEnglish = `Keep practicing! Listen closely to the Tanpura drone harmonics and center your voice on the highway.`;
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
    if (roundTransitionTimeoutRef.current) clearTimeout(roundTransitionTimeoutRef.current);
    if (reviewAnimIdRef.current) cancelAnimationFrame(reviewAnimIdRef.current);
    setIsReviewPlaying(false);
    setStage('idle');
    setCurrentRound(1);
    setExerciseStartTimeMs(null);
    setElapsedExerciseSec(0);
    setIsHitActive(false);
    setActiveBlock(null);
    setActiveBlockRemainingSec(0);
    setRoundToast(null);
    setAnalysis(null);
    setNoteBreakdowns([]);
    setUserMicLevel(0);
    setShowIdleReview(false);
  };

  // Immediate Stop & Jump directly to Review Mode
  const handleStopAndReview = () => {
    if (stage !== 'practicing' || exerciseStartTimeMs === null) return;
    const now = performance.now();
    const elapsed = (now - exerciseStartTimeMs) / 1000;
    const numRounds = Math.min(totalRounds, Math.max(1, Math.ceil(elapsed / singleRoundSec)));

    const completed = compileRoundsFromPoints(allSessionPointsRef.current, numRounds, elapsed);
    setRoundHistory(completed);
    finishFullSessionAnalysis(completed);
  };

  // Note jump handlers
  const handleJumpPrevNote = () => {
    const cur = reviewElapsedSec;
    const prev = [...activeReviewTargetBlocks].reverse().find(b => b.startTimeSec < cur - 0.25);
    if (prev) {
      setReviewElapsedSec(prev.startTimeSec);
    } else {
      setReviewElapsedSec(0);
    }
  };

  const handleJumpNextNote = () => {
    const cur = reviewElapsedSec;
    const next = activeReviewTargetBlocks.find(b => b.startTimeSec > cur + 0.25);
    if (next) {
      setReviewElapsedSec(next.startTimeSec);
    }
  };

  const handleStepTime = (deltaSec: number) => {
    setReviewElapsedSec(prev =>
      Math.max(0, Math.min(activeReviewTotalSec, Math.round((prev + deltaSec) * 10) / 10))
    );
  };

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ds = Math.floor((sec % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ds}`;
  };

  // Stages configuration
  const STAGES = [
    { id: 'all' as const, num: 0, label: 'All Lessons', hindi: 'समस्त पाठ', count: 20 },
    { id: 1, num: 1, label: 'Stage 1: Foundation', hindi: 'स्वर नींव', count: 4 },
    { id: 2, num: 2, label: 'Stage 2: Shuddha Swar', hindi: 'शुद्ध स्वर', count: 4 },
    { id: 3, num: 3, label: 'Stage 3: Intervals', hindi: 'स्वर छलांग', count: 3 },
    { id: 4, num: 4, label: 'Stage 4: Vikrit', hindi: 'कोमल व तीव्र', count: 4 },
    { id: 5, num: 5, label: 'Stage 5: Agility', hindi: 'पलटे व तान', count: 3 },
    { id: 6, num: 6, label: 'Stage 6: Ragas', hindi: 'राग रस', count: 2 },
  ];

  const isReviewingActive = stage === 'analysis' || showIdleReview;

  return (
    <div className="guru-practice-container">
      {/* ========================================================================= */}
      {/* SINGER JOURNEY HERO DASHBOARD */}
      {/* ========================================================================= */}
      <div className="singer-journey-hero-card">
        <div className="singer-hero-left">
          <div className="singer-rank-badge" style={{ borderColor: masteryStats.rankColor }}>
            <Award size={20} color={masteryStats.rankColor} />
            <div className="singer-rank-text">
              <span className="rank-label">SINGER LEVEL / साधक स्तर</span>
              <h3 style={{ color: masteryStats.rankColor }}>{masteryStats.rankTitle}</h3>
            </div>
          </div>

          <div className="singer-progress-bar-wrap">
            <div className="progress-info-row">
              <span className="progress-text">
                <strong>{masteryStats.masteredCount}</strong> of <strong>{masteryStats.totalLessons}</strong> Lessons Mastered (80%+ Sur)
              </span>
              <span className="progress-percent" style={{ color: masteryStats.rankColor }}>
                {masteryStats.masteryPercent}% Complete
              </span>
            </div>
            <div className="singer-progress-track">
              <div
                className="singer-progress-fill"
                style={{
                  width: `${masteryStats.masteryPercent}%`,
                  backgroundColor: masteryStats.rankColor,
                }}
              />
            </div>
            <span className="milestone-hint">⚡ {masteryStats.nextMilestone}</span>
          </div>
        </div>

        {/* Hero Right: Next Recommended Lesson or Review Toggle */}
        {stage === 'idle' && (
          <div className="singer-hero-right">
            {roundHistory.length > 0 && !showIdleReview ? (
              <div className="next-lesson-box review-promo-box">
                <span className="next-tag"><Search size={14} /> PREVIOUS PRACTICE READY</span>
                <h4 className="next-title">Review Expected vs Recorded</h4>
                <span className="next-stage">{roundHistory.length} round(s) recorded</span>
                <button
                  className="next-lesson-btn review-btn"
                  onClick={() => setShowIdleReview(true)}
                >
                  <Search size={14} /> <span>Open Highway Scrollback</span>
                </button>
              </div>
            ) : (
              <div className="next-lesson-box">
                <span className="next-tag"><Flame size={14} /> RECOMMENDED NEXT LESSON</span>
                <h4 className="next-title">{masteryStats.nextLesson.title}</h4>
                <span className="next-stage">{masteryStats.nextLesson.stageHindi}</span>
                <button
                  className="next-lesson-btn"
                  onClick={() => {
                    setSelectedLesson(masteryStats.nextLesson);
                    window.scrollTo({ top: 380, behavior: 'smooth' });
                  }}
                >
                  <span>Select This Lesson</span> <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Interactive Arena Card */}
      <div className="interactive-arena-card">
        {/* Top Arena Control Bar */}
        <div className="arena-top-controls-bar">
          <div className="arena-stage-status">
            {stage === 'idle' && !showIdleReview && (
              <span className="stage-pill idle">
                <Sparkles size={14} /> RIYAZ HIGHWAY READY ({totalRounds} ROUNDS)
              </span>
            )}
            {stage === 'idle' && showIdleReview && (
              <span className="stage-pill review animate-pulse">
                <Search size={14} /> HIGHWAY REVIEW MODE (अपेक्षित बनाम रिकॉर्डेड)
              </span>
            )}
            {stage === 'practicing' && activeBlock && (
              <span className="stage-pill sing animate-pulse">
                <Mic size={14} /> YOUR TURN: Sing "{activeBlock.label}" • ROUND {currentRound}/{totalRounds}
              </span>
            )}
            {stage === 'practicing' && !activeBlock && (
              <span className="stage-pill countdown">
                ⏳ ROUND {currentRound}/{totalRounds} • TAKE A BREATH
              </span>
            )}
            {stage === 'analysis' && (
              <span className="stage-pill analysis">
                <BarChart3 size={14} /> {totalRounds}-ROUND RIYAZ ANALYSIS REPORT
              </span>
            )}

            <span className="arena-active-lesson-name">
              {selectedLesson.hindiTitle} • {selectedLesson.title} (Sa: {rootPitch.note}{rootPitch.octave})
            </span>
          </div>

          {/* Practice Settings Controls (when idle and not reviewing) */}
          {stage === 'idle' && !showIdleReview && (
            <div className="arena-config-cluster">
              {/* Tanpura Drone Toggle */}
              {onToggleTanpura && (
                <div className="config-item">
                  <button
                    className={`tanpura-drone-chip ${isTanpuraActive ? 'active' : ''}`}
                    onClick={onToggleTanpura}
                    title="Toggle continuous background Tanpura drone for traditional riyaz"
                  >
                    <Sparkles size={12} />
                    <span>Tanpura Drone: {isTanpuraActive ? 'ON (सुर चालू)' : 'OFF'}</span>
                  </button>
                </div>
              )}

              {/* Rounds Selector */}
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
            </div>
          )}

          {/* Close review button if reviewing during idle */}
          {stage === 'idle' && showIdleReview && (
            <button className="reset-pipeline-btn" onClick={() => setShowIdleReview(false)}>
              <RotateCcw size={14} /> Back to Practice Setup
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE HIGHWAY SCROLLBACK & REVIEWER COMPONENT */}
        {/* Shown in analysis stage OR when user clicks 'Review Highway' */}
        {/* ========================================================================= */}
        {isReviewingActive && (
          <div className="scrollback-reviewer-container">
            <div className="reviewer-top-bar">
              <div className="reviewer-title-col">
                <div className="reviewer-header-title">
                  <Search size={18} className="text-sky" />
                  <h4>Expected vs. Recorded Highway Review (अपेक्षित बनाम रिकॉर्डेड स्वर समीक्षा)</h4>
                </div>
                <p className="reviewer-subtitle">
                  Drag the slider or click anywhere on the highway to scrub through time and inspect expected notes vs your exact singing pitch.
                </p>
              </div>

              {/* Round Selector Tabs */}
              {roundHistory.length > 0 && (
                <div className="reviewer-round-tabs">
                  {roundHistory.map((r, idx) => (
                    <button
                      key={r.round}
                      className={`round-tab-btn ${reviewRoundIndex === idx ? 'active' : ''}`}
                      onClick={() => {
                        setReviewRoundIndex(idx);
                        setReviewElapsedSec(0);
                        setIsReviewPlaying(false);
                      }}
                    >
                      <span>Round {r.round}</span>
                      <span className="round-tab-acc" style={{ color: r.accuracy >= 80 ? '#22C55E' : '#FBBF24' }}>
                        {r.accuracy}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Highway Canvas in Review Mode */}
            <div className="highway-arena-wrapper review-canvas-wrapper">
              <NoteHighwayCanvas
                currentPitch={currentPitch}
                targetBlocks={activeReviewTargetBlocks}
                exerciseStartTimeMs={null}
                stage={stage}
                isHitActive={false}
                totalRoundSec={activeReviewTotalSec}
                isUserTurn={false}
                isReviewMode={true}
                reviewElapsedSec={reviewElapsedSec}
                recordedPoints={activeReviewRecordedPoints}
                onScrubTime={setReviewElapsedSec}
              />
            </div>

            {/* Interactive Timeline & Scrubber Bar */}
            <div className="review-scrubber-panel">
              <div className="scrubber-controls-row">
                {/* Play / Pause Replay Button */}
                <button
                  className={`scrubber-play-btn ${isReviewPlaying ? 'playing' : ''}`}
                  onClick={() => setIsReviewPlaying(!isReviewPlaying)}
                  title={isReviewPlaying ? 'Pause replay' : 'Play back performance'}
                >
                  {isReviewPlaying ? <Pause size={18} /> : <Play size={18} />}
                  <span>{isReviewPlaying ? 'Pause' : 'Replay (पुनरावलोकन)'}</span>
                </button>

                {/* Step Backward 1s */}
                <button
                  className="scrubber-step-btn"
                  onClick={() => handleStepTime(-1.0)}
                  title="Step backward 1 second"
                >
                  <SkipBack size={15} />
                  <span>-1s</span>
                </button>

                {/* Step Forward 1s */}
                <button
                  className="scrubber-step-btn"
                  onClick={() => handleStepTime(1.0)}
                  title="Step forward 1 second"
                >
                  <SkipForward size={15} />
                  <span>+1s</span>
                </button>

                {/* Jump to Previous Note */}
                <button
                  className="scrubber-step-btn note-jump"
                  onClick={handleJumpPrevNote}
                  title="Jump to previous target note"
                >
                  <ChevronLeft size={16} />
                  <span>Prev Note</span>
                </button>

                {/* Jump to Next Note */}
                <button
                  className="scrubber-step-btn note-jump"
                  onClick={handleJumpNextNote}
                  title="Jump to next target note"
                >
                  <span>Next Note</span>
                  <ChevronRight size={16} />
                </button>

                {/* Timestamp readout */}
                <span className="scrubber-timestamp">
                  {formatTime(reviewElapsedSec)} / {formatTime(activeReviewTotalSec)}
                </span>
              </div>

              {/* Range Slider for Smooth Horizontal Scrubbing */}
              <div className="scrubber-slider-track-wrap">
                <input
                  type="range"
                  min="0"
                  max={activeReviewTotalSec}
                  step="0.05"
                  value={reviewElapsedSec}
                  onChange={(e) => {
                    setReviewElapsedSec(parseFloat(e.target.value));
                    setIsReviewPlaying(false);
                  }}
                  className="review-range-slider"
                />
              </div>

              {/* Real-time Playhead Inspection Callout Pill */}
              <div className="scrubber-inspection-card">
                <div className="inspection-item expected">
                  <span className="inspection-label">🎯 EXPECTED NOTE:</span>
                  <span className="inspection-val">
                    {currentExpectedBlock ? (
                      <strong>
                        {currentExpectedBlock.label} ({currentExpectedBlock.durationSec}s)
                      </strong>
                    ) : (
                      <em className="text-muted">[Transition / Gap]</em>
                    )}
                  </span>
                </div>

                <div className="inspection-divider" />

                <div className="inspection-item recorded">
                  <span className="inspection-label">🎤 YOUR RECORDED VOICE:</span>
                  <span className="inspection-val">
                    {currentRecordedPoint ? (
                      <strong>
                        {currentRecordedPoint.swaraId} ({currentRecordedPoint.frequency.toFixed(1)} Hz,{' '}
                        {currentRecordedPoint.centsDeviation >= 0
                          ? `+${currentRecordedPoint.centsDeviation}¢`
                          : `${currentRecordedPoint.centsDeviation}¢`}
                        )
                      </strong>
                    ) : (
                      <em className="text-muted">[No Voice / Breath Gap]</em>
                    )}
                  </span>
                </div>

                <div className="inspection-divider" />

                <div className="inspection-item result">
                  <span className="inspection-label">STATUS / सुर मिलान:</span>
                  {currentExpectedBlock && currentRecordedPoint ? (
                    currentRecordedPoint.swaraId === currentExpectedBlock.swaraId &&
                    currentRecordedPoint.isInSur ? (
                      <span className="match-pill green">✨ IN SUR (शुद्ध सुर • ±15¢)</span>
                    ) : currentRecordedPoint.centsDeviation > 15 ? (
                      <span className="match-pill amber">⚠️ SHARP (तीव्र झुकाव • थोड़ा नीचे आएं)</span>
                    ) : (
                      <span className="match-pill cyan">⚠️ FLAT (कोमल झुकाव • सुर ऊंचा उठाएं)</span>
                    )
                  ) : currentExpectedBlock && !currentRecordedPoint ? (
                    <span className="match-pill gray">⏳ Silence / Breath Gap</span>
                  ) : (
                    <span className="match-pill blue">👀 Resting Between Notes</span>
                  )}
                </div>
              </div>

              {/* Expected vs Recorded Legend */}
              <div className="reviewer-legend-row">
                <span className="legend-title">Legend:</span>
                <span className="legend-chip in-sur">🟩 In Sur (Pure ±15¢ Match)</span>
                <span className="legend-chip sharp">🟧 Sharp (&gt; +15¢ High)</span>
                <span className="legend-chip flat">🟦 Flat (&lt; -15¢ Low)</span>
                <span className="legend-chip target">🟨 Target Note Lane</span>
                <span className="legend-hint">🖱️ Drag canvas or slider to scroll</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Scrolling Note Highway (During live practice) */}
        {!isReviewingActive && (
          <div className="highway-arena-wrapper">
            <NoteHighwayCanvas
              currentPitch={currentPitch}
              targetBlocks={continuousTargetBlocks}
              exerciseStartTimeMs={exerciseStartTimeMs}
              stage={stage}
              isHitActive={isHitActive}
              audioLevel={userMicLevel}
              totalRoundSec={totalSessionSec}
              singleRoundSec={singleRoundSec}
              totalRounds={totalRounds}
              isUserTurn={stage === 'practicing'}
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
                <span className={`subtitle-active-syllable ${isHitActive ? 'green-theme' : activeBlock ? 'orange-theme' : ''}`}>
                  {activeBlock ? activeBlock.label : '...'}
                </span>
                <span className="subtitle-devanagari">
                  {activeBlock ? selectedLesson.hindiTitle : 'तैयार रहें...'}
                </span>
              </div>
              <div className="subtitle-hint-pill">
                {activeBlock ? (
                  <span className="pill-green">🎤 Sing "{activeBlock.label}" into microphone ({activeBlockRemainingSec.toFixed(1)}s left)</span>
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
                  style={{ width: `${Math.min(100, (elapsedExerciseSec / totalSessionSec) * 100)}%` }}
                />
                <div
                  className="scrubber-knob"
                  style={{ left: `${Math.min(100, (elapsedExerciseSec / totalSessionSec) * 100)}%` }}
                />
              </div>
              <span className="scrubber-time total">{formatTime(totalSessionSec)}</span>
              <span className="scrubber-round-badge">Round {currentRound}/{totalRounds}</span>
            </div>
          </div>
        )}

        {/* Live Audio Level Meter (VU Meter during live practice) */}
        {!isReviewingActive && (
          <div className="live-vocal-meter-card">
            <div className="meter-header">
              <span className="meter-title">
                {stage === 'practicing' ? '🎤 YOUR MICROPHONE INPUT LEVEL' : '🔊 MICROPHONE MONITOR'}
              </span>
              <span className="meter-percent">{(userMicLevel * 100).toFixed(0)}%</span>
            </div>

            <div className="meter-led-bar-track">
              {Array.from({ length: 24 }).map((_, i) => {
                const threshold = (i + 1) / 24;
                const isLit = userMicLevel >= threshold;
                const isHigh = i >= 18;
                const isMid = i >= 12 && i < 18;
                return (
                  <div
                    key={i}
                    className={`meter-segment ${isLit ? (isHigh ? 'lit-red' : isMid ? 'lit-amber' : 'lit-green') : ''}`}
                  />
                );
              })}
            </div>

            <div className="meter-footer-hint">
              {stage === 'practicing' && activeBlock && (
                userMicLevel < 0.12
                  ? <span className="warning-text">⚠️ Voice level is low — please sing louder or move closer to the mic.</span>
                  : <span className="success-text">✨ Clean vocal volume detected! Keep steady breath.</span>
              )}
              {stage === 'idle' && (
                <span>Ready to begin {totalRounds}-round Riyaz practice. Tanpura drone accompanies your pitch.</span>
              )}
            </div>
          </div>
        )}

        {/* Vocal Technique & Guru Guidance Card (Idle state before singing) */}
        {stage === 'idle' && !showIdleReview && selectedLesson.technique && (
          <div className="lesson-technique-guidance-card">
            <div className="technique-header">
              <BookOpen size={18} className="text-amber" />
              <h4>Vocal Technique Guidance (रियाज़ व गायकी मार्गदर्शन)</h4>
              <span className="technique-stage-badge">{selectedLesson.stageHindi}</span>
            </div>

            <div className="technique-grid">
              <div className="tech-box">
                <span className="tech-title"><Zap size={14} /> Voice Placement (स्वर संधान):</span>
                <p>{selectedLesson.technique.focusArea}</p>
              </div>

              <div className="tech-box">
                <span className="tech-title"><Flame size={14} /> Breath Support (श्वास आधार):</span>
                <p>{selectedLesson.technique.breathPlacement}</p>
              </div>

              <div className="tech-box full-width">
                <span className="tech-title"><Sparkles size={14} /> Guru's Secret (साधना का रहस्य):</span>
                <p className="secret-tip-text">"{selectedLesson.technique.secretTip}"</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button Footer (when idle and not reviewing) */}
        {stage === 'idle' && !showIdleReview && (
          <div className="arena-idle-action-footer">
            <div className="action-buttons-group">
              <button className="primary-action-btn single-full-btn" onClick={startFullPracticeSession}>
                <Mic size={22} />
                <div className="btn-text-col">
                  <span className="btn-main-text">Start {totalRounds}-Round Riyaz (रियाज़ शुरू करें)</span>
                  <span className="btn-sub-text">Sing directly on the pitch highway • {totalRounds} continuous rounds with live feedback</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Singing HUD Metrics Strip (During practice) */}
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

              {selectedLesson.id === 'lesson_sa' && activeBlock?.type === 'user' ? (
                <div className="strip-metric breath-hold-metric">
                  <span className="strip-metric-title">Breath Held (श्वास स्थिरता)</span>
                  <div className="breath-hold-val-wrap">
                    <span className="strip-metric-val highlight" style={{ color: '#22C55E' }}>
                      {liveHeldSec.toFixed(1)}s / {activeBlock.durationSec}s
                    </span>
                    <div className="mini-breath-bar">
                      <div
                        className="mini-breath-fill"
                        style={{ width: `${Math.min(100, (liveHeldSec / activeBlock.durationSec) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="strip-metric">
                  <span className="strip-metric-title">Note Hold Remaining</span>
                  <span className="strip-metric-val">
                    {activeBlock ? `${activeBlockRemainingSec.toFixed(1)}s` : '--'}
                  </span>
                </div>
              )}

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

              {selectedLesson.id === 'lesson_sa' && activeBlock?.type === 'user' && (
                <div className="strip-metric">
                  <span className="strip-metric-title">Stability (स्थिरता)</span>
                  <span className="strip-metric-val" style={{ color: liveStability >= 80 ? '#22C55E' : '#F59E0B' }}>
                    {liveStability}%
                  </span>
                </div>
              )}
            </div>

            <div className="stop-practice-bar">
              <button className="review-now-btn" onClick={handleStopAndReview}>
                <Search size={16} /> Stop & Review Highway (रोकें और विश्लेषण देखें)
              </button>
              <button className="reset-pipeline-btn" onClick={handleStopOrReset}>
                <RotateCcw size={16} /> Exit
              </button>
            </div>
          </div>
        )}

        {/* Multi-Round Performance Analysis Report (In addition to the reviewer above) */}
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
                  {roundHistory.map((r, idx) => (
                    <div
                      key={r.round}
                      className={`round-chart-col ${reviewRoundIndex === idx ? 'selected-col' : ''}`}
                      onClick={() => {
                        setReviewRoundIndex(idx);
                        setReviewElapsedSec(0);
                        setIsReviewPlaying(false);
                      }}
                      title={`Click to review Round ${r.round} on the highway`}
                      style={{ cursor: 'pointer' }}
                    >
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
              <span className="feedback-badge">Riyaz Guidance (मार्गदर्शन)</span>
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
              <button className="primary-action-btn" onClick={startFullPracticeSession}>
                <RotateCcw size={18} /> Practice Again ({totalRounds} चक्र पुनः अभ्यास)
              </button>

              <button className="secondary-action-btn" onClick={handleStopOrReset}>
                <BookOpen size={18} /> Choose Another Lesson (पाठ सूची)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 20-LESSON VOCAL MASTERY CURRICULUM GRID (when idle and not reviewing) */}
      {/* ========================================================================= */}
      {stage === 'idle' && !showIdleReview && (
        <div className="practice-lessons-section">
          <div className="section-title-row">
            <div>
              <h3>Singer Mastery Curriculum (सम्पूर्ण गायकी पाठ्यक्रम)</h3>
              <p className="section-subtext">
                Master all 6 stages from breath stability to classical raga phrases to build an agile, pitch-perfect singing voice.
              </p>
            </div>
            <span className="lesson-count-tag">{PRACTICE_LESSONS.length} Master Lessons</span>
          </div>

          {/* Stage Filter Chips */}
          <div className="stage-filter-row">
            {STAGES.map(st => {
              const isActive = stageFilter === (st.id === 'all' ? 'all' : st.num);
              return (
                <button
                  key={st.id}
                  className={`stage-filter-chip ${isActive ? 'active' : ''}`}
                  onClick={() => setStageFilter(st.id === 'all' ? 'all' : st.num)}
                >
                  <span className="stage-chip-title">{st.label}</span>
                  <span className="stage-chip-hindi">{st.hindi}</span>
                  <span className="stage-chip-count">{st.count}</span>
                </button>
              );
            })}
          </div>

          {/* Lessons Grid */}
          <div className="lessons-grid">
            {filteredLessons.map((lesson) => {
              const isSelected = selectedLesson.id === lesson.id;
              const saved = singerProfile.scores[lesson.id];
              const isMastered = saved && saved.bestAccuracy >= 80;
              const isRecommended = masteryStats.nextLesson.id === lesson.id;

              return (
                <div
                  key={lesson.id}
                  className={`lesson-card ${isSelected ? 'selected' : ''} ${isMastered ? 'mastered' : ''} ${isRecommended ? 'recommended-glow' : ''}`}
                  onClick={() => setSelectedLesson(lesson)}
                >
                  <div className="lesson-card-header">
                    <span className="lesson-badge-category">{lesson.stageHindi}</span>
                    <div className="header-badges-right">
                      {isMastered ? (
                        <span className="mastery-star-badge" title="Mastered (80%+ Accuracy)">
                          <Star size={12} fill="#F59E0B" color="#F59E0B" /> Mastered
                        </span>
                      ) : saved ? (
                        <span className="practiced-badge">
                          Best: {saved.bestAccuracy}%
                        </span>
                      ) : isRecommended ? (
                        <span className="recommended-badge">Next Step</span>
                      ) : (
                        <span className={`lesson-difficulty-badge ${lesson.level.toLowerCase()}`}>
                          {lesson.level}
                        </span>
                      )}
                    </div>
                  </div>

                  <h4 className="lesson-title">{lesson.title}</h4>
                  <span className="lesson-hindi-title">{lesson.hindiTitle}</span>
                  <p className="lesson-description">{lesson.description}</p>

                  <div className="lesson-target-notes-row">
                    {lesson.targetBlocks.map((block, idx) => (
                      <span key={idx} className="note-capsule-tag">
                        {block.label}
                      </span>
                    ))}
                  </div>

                  <div className="lesson-card-footer">
                    <span className="lesson-duration-est">
                      {lesson.totalRoundSec}s per round
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
