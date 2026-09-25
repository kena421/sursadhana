// Indian Classical Music Definitions & Types

export type RootNoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export interface RootPitchConfig {
  note: RootNoteName;
  octave: number; // e.g. 2, 3, 4
  frequency: number; // calculated in Hz (A4 = 440Hz standard reference)
  indianName: string; // e.g. 'Safed 1' (C), 'Kali 1' (C#), etc.
}

export type TuningSystem = 'just' | 'equal'; // Just Intonation (Gandharva/Shruti) vs Equal Temperament (12-TET)

export interface SwaraInfo {
  id: string; // 'S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N', 'S_taar'
  shortName: string; // S, r, R, g, G, m, M, P, d, D, n, N
  devanagari: string; // सा, रे॒, रे, ग॒, ग, म, म॑, प, ध॒, ध, नि॒, नि, सां
  fullName: string; // Shadja, Komal Rishabh, Shuddha Rishabh, etc.
  type: 'shuddha' | 'komal' | 'teevra' | 'achala';
  semitoneOffset: number; // 0 to 12
  justRatio: number; // ratio to base Sa frequency
  centsOffsetJust: number; // exact cents in Just Intonation
  centsOffsetEqual: number; // exact cents in 12-TET (0, 100, 200, ...)
}

export const SWARAS: SwaraInfo[] = [
  { id: 'S', shortName: 'S', devanagari: 'सा', fullName: 'Shadja', type: 'achala', semitoneOffset: 0, justRatio: 1.0, centsOffsetJust: 0, centsOffsetEqual: 0 },
  { id: 'r', shortName: 'r', devanagari: 'रे॒', fullName: 'Komal Rishabh', type: 'komal', semitoneOffset: 1, justRatio: 16 / 15, centsOffsetJust: 112, centsOffsetEqual: 100 },
  { id: 'R', shortName: 'R', devanagari: 'रे', fullName: 'Shuddha Rishabh', type: 'shuddha', semitoneOffset: 2, justRatio: 9 / 8, centsOffsetJust: 204, centsOffsetEqual: 200 },
  { id: 'g', shortName: 'g', devanagari: 'ग॒', fullName: 'Komal Gandhar', type: 'komal', semitoneOffset: 3, justRatio: 6 / 5, centsOffsetJust: 316, centsOffsetEqual: 300 },
  { id: 'G', shortName: 'G', devanagari: 'ग', fullName: 'Shuddha Gandhar', type: 'shuddha', semitoneOffset: 4, justRatio: 5 / 4, centsOffsetJust: 386, centsOffsetEqual: 400 },
  { id: 'm', shortName: 'm', devanagari: 'म', fullName: 'Shuddha Madhyam', type: 'shuddha', semitoneOffset: 5, justRatio: 4 / 3, centsOffsetJust: 498, centsOffsetEqual: 500 },
  { id: 'M', shortName: 'M', devanagari: 'म॑', fullName: 'Teevra Madhyam', type: 'teevra', semitoneOffset: 6, justRatio: 45 / 32, centsOffsetJust: 590, centsOffsetEqual: 600 },
  { id: 'P', shortName: 'P', devanagari: 'प', fullName: 'Pancham', type: 'achala', semitoneOffset: 7, justRatio: 3 / 2, centsOffsetJust: 702, centsOffsetEqual: 700 },
  { id: 'd', shortName: 'd', devanagari: 'ध॒', fullName: 'Komal Dhaivat', type: 'komal', semitoneOffset: 8, justRatio: 8 / 5, centsOffsetJust: 814, centsOffsetEqual: 800 },
  { id: 'D', shortName: 'D', devanagari: 'ध', fullName: 'Shuddha Dhaivat', type: 'shuddha', semitoneOffset: 9, justRatio: 5 / 3, centsOffsetJust: 884, centsOffsetEqual: 900 },
  { id: 'n', shortName: 'n', devanagari: 'नि॒', fullName: 'Komal Nishad', type: 'komal', semitoneOffset: 10, justRatio: 9 / 5, centsOffsetJust: 1018, centsOffsetEqual: 1000 },
  { id: 'N', shortName: 'N', devanagari: 'नि', fullName: 'Shuddha Nishad', type: 'shuddha', semitoneOffset: 11, justRatio: 15 / 8, centsOffsetJust: 1088, centsOffsetEqual: 1100 },
  { id: 'S_taar', shortName: 'Ṡ', devanagari: 'सां', fullName: 'Taar Shadja', type: 'achala', semitoneOffset: 12, justRatio: 2.0, centsOffsetJust: 1200, centsOffsetEqual: 1200 },
];

export interface DetectedPitch {
  frequency: number; // detected Hz
  clarity: number; // 0 to 1
  volumeDb: number; // dB RMS
  swara: SwaraInfo;
  centsDeviation: number; // -50 to +50 cents relative to nearest swara
  octaveOffset: number; // -1: Mandra, 0: Madhya, +1: Taar
  isInSur: boolean; // within tolerance (e.g. ±15 cents)
  timestamp: number;
}

export interface TaalMatra {
  matra: number; // 1-indexed (1, 2, 3...)
  bol: string; // Dha, Dhin, Ge, Tin, etc.
  bolDevanagari: string;
  type: 'sam' | 'tali' | 'khali' | 'normal';
  vibhagNumber: number;
  sign: string; // 'X', '2', '0', '3', etc.
}

export interface TaalDefinition {
  id: string;
  name: string;
  hindiName: string;
  totalMatras: number;
  vibhagPattern: number[]; // e.g. [4, 4, 4, 4] for Teental
  matras: TaalMatra[];
  defaultBpm: number;
  description: string;
}

export const TAALS: TaalDefinition[] = [
  {
    id: 'teental',
    name: 'Teental',
    hindiName: 'तीनताल',
    totalMatras: 16,
    vibhagPattern: [4, 4, 4, 4],
    defaultBpm: 80,
    description: '16 Beats (4+4+4+4) - The king of Hindustani taals. 3 Claps (Tali) and 1 Wave (Khali).',
    matras: [
      { matra: 1, bol: 'Dha', bolDevanagari: 'धा', type: 'sam', vibhagNumber: 1, sign: 'X' },
      { matra: 2, bol: 'Dhin', bolDevanagari: 'धिं', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 3, bol: 'Dhin', bolDevanagari: 'धिं', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 4, bol: 'Dha', bolDevanagari: 'धा', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 5, bol: 'Dha', bolDevanagari: 'धा', type: 'tali', vibhagNumber: 2, sign: '2' },
      { matra: 6, bol: 'Dhin', bolDevanagari: 'धिं', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 7, bol: 'Dhin', bolDevanagari: 'धिं', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 8, bol: 'Dha', bolDevanagari: 'धा', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 9, bol: 'Dha', bolDevanagari: 'धा', type: 'khali', vibhagNumber: 3, sign: '0' },
      { matra: 10, bol: 'Tin', bolDevanagari: 'तिं', type: 'normal', vibhagNumber: 3, sign: '' },
      { matra: 11, bol: 'Tin', bolDevanagari: 'तिं', type: 'normal', vibhagNumber: 3, sign: '' },
      { matra: 12, bol: 'Ta', bolDevanagari: 'ता', type: 'normal', vibhagNumber: 3, sign: '' },
      { matra: 13, bol: 'Ta', bolDevanagari: 'ता', type: 'tali', vibhagNumber: 4, sign: '3' },
      { matra: 14, bol: 'Dhin', bolDevanagari: 'धिं', type: 'normal', vibhagNumber: 4, sign: '' },
      { matra: 15, bol: 'Dhin', bolDevanagari: 'धिं', type: 'normal', vibhagNumber: 4, sign: '' },
      { matra: 16, bol: 'Dha', bolDevanagari: 'धा', type: 'normal', vibhagNumber: 4, sign: '' },
    ]
  },
  {
    id: 'keharwa',
    name: 'Keharwa',
    hindiName: 'कहरवा',
    totalMatras: 8,
    vibhagPattern: [4, 4],
    defaultBpm: 95,
    description: '8 Beats (4+4) - Popular in Bhajans, Ghazals, and light classical music.',
    matras: [
      { matra: 1, bol: 'Dha', bolDevanagari: 'धा', type: 'sam', vibhagNumber: 1, sign: 'X' },
      { matra: 2, bol: 'Ge', bolDevanagari: 'गे', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 3, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 4, bol: 'Tin', bolDevanagari: 'तीं', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 5, bol: 'Na', bolDevanagari: 'ना', type: 'khali', vibhagNumber: 2, sign: '0' },
      { matra: 6, bol: 'Ke', bolDevanagari: 'के', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 7, bol: 'Dhin', bolDevanagari: 'धीं', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 8, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 2, sign: '' },
    ]
  },
  {
    id: 'dadra',
    name: 'Dadra',
    hindiName: 'दादरा',
    totalMatras: 6,
    vibhagPattern: [3, 3],
    defaultBpm: 110,
    description: '6 Beats (3+3) - Lyrical and lively 6-beat cycle with 1 Tali and 1 Khali.',
    matras: [
      { matra: 1, bol: 'Dha', bolDevanagari: 'धा', type: 'sam', vibhagNumber: 1, sign: 'X' },
      { matra: 2, bol: 'Dhi', bolDevanagari: 'धी', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 3, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 4, bol: 'Dha', bolDevanagari: 'धा', type: 'khali', vibhagNumber: 2, sign: '0' },
      { matra: 5, bol: 'Tu', bolDevanagari: 'तू', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 6, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 2, sign: '' },
    ]
  },
  {
    id: 'roopak',
    name: 'Roopak',
    hindiName: 'रूपक',
    totalMatras: 7,
    vibhagPattern: [3, 2, 2],
    defaultBpm: 75,
    description: '7 Beats (3+2+2) - Unique taal that starts on a Khali on beat 1.',
    matras: [
      { matra: 1, bol: 'Tin', bolDevanagari: 'तीं', type: 'khali', vibhagNumber: 1, sign: '0' },
      { matra: 2, bol: 'Tin', bolDevanagari: 'तीं', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 3, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 4, bol: 'Dhi', bolDevanagari: 'धी', type: 'tali', vibhagNumber: 2, sign: '1' },
      { matra: 5, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 6, bol: 'Dhi', bolDevanagari: 'धी', type: 'tali', vibhagNumber: 3, sign: '2' },
      { matra: 7, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 3, sign: '' },
    ]
  },
  {
    id: 'jhaptal',
    name: 'Jhaptal',
    hindiName: 'झपताल',
    totalMatras: 10,
    vibhagPattern: [2, 3, 2, 3],
    defaultBpm: 80,
    description: '10 Beats (2+3+2+3) - Classical cadence for bandishes and compositions.',
    matras: [
      { matra: 1, bol: 'Dhi', bolDevanagari: 'धी', type: 'sam', vibhagNumber: 1, sign: 'X' },
      { matra: 2, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 3, bol: 'Dhi', bolDevanagari: 'धी', type: 'tali', vibhagNumber: 2, sign: '2' },
      { matra: 4, bol: 'Dhi', bolDevanagari: 'धी', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 5, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 6, bol: 'Ti', bolDevanagari: 'ती', type: 'khali', vibhagNumber: 3, sign: '0' },
      { matra: 7, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 3, sign: '' },
      { matra: 8, bol: 'Dhi', bolDevanagari: 'धी', type: 'tali', vibhagNumber: 4, sign: '3' },
      { matra: 9, bol: 'Dhi', bolDevanagari: 'धी', type: 'normal', vibhagNumber: 4, sign: '' },
      { matra: 10, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 4, sign: '' },
    ]
  },
  {
    id: 'ektaal',
    name: 'Ektaal',
    hindiName: 'एकताल',
    totalMatras: 12,
    vibhagPattern: [2, 2, 2, 2, 2, 2],
    defaultBpm: 70,
    description: '12 Beats (2+2+2+2+2+2) - Essential for Khayal and Vilambit singing.',
    matras: [
      { matra: 1, bol: 'Dhin', bolDevanagari: 'धिं', type: 'sam', vibhagNumber: 1, sign: 'X' },
      { matra: 2, bol: 'Dhin', bolDevanagari: 'धिं', type: 'normal', vibhagNumber: 1, sign: '' },
      { matra: 3, bol: 'Dha', bolDevanagari: 'धा', type: 'khali', vibhagNumber: 2, sign: '0' },
      { matra: 4, bol: 'Dha', bolDevanagari: 'धा', type: 'normal', vibhagNumber: 2, sign: '' },
      { matra: 5, bol: 'Tu', bolDevanagari: 'तू', type: 'tali', vibhagNumber: 3, sign: '2' },
      { matra: 6, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 3, sign: '' },
      { matra: 7, bol: 'Kat', bolDevanagari: 'कत', type: 'khali', vibhagNumber: 4, sign: '0' },
      { matra: 8, bol: 'Ta', bolDevanagari: 'ता', type: 'normal', vibhagNumber: 4, sign: '' },
      { matra: 9, bol: 'Dhe', bolDevanagari: 'धे', type: 'tali', vibhagNumber: 5, sign: '3' },
      { matra: 10, bol: 'Te', bolDevanagari: 'ते', type: 'normal', vibhagNumber: 5, sign: '' },
      { matra: 11, bol: 'Dhi', bolDevanagari: 'धी', type: 'tali', vibhagNumber: 6, sign: '4' },
      { matra: 12, bol: 'Na', bolDevanagari: 'ना', type: 'normal', vibhagNumber: 6, sign: '' },
    ]
  }
];

export interface AlankarExercise {
  id: string;
  title: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  notesSequence: string[]; // ['S', 'R', 'G', 'M', 'P', 'D', 'N', 'S_taar', 'N', 'D', 'P', 'M', 'G', 'R', 'S']
  displayAroha: string;
  displayAvroha: string;
  beatsPerNote?: number;
}

export const ALANKARS: AlankarExercise[] = [
  {
    id: 'alankar_1',
    title: 'Alankar 1: Pure Scale (Aroha & Avroha)',
    level: 'Beginner',
    description: 'The primary foundation of riyaz. Steady singing of each shuddha swar from Madhya Sa to Taar Sa.',
    notesSequence: ['S', 'R', 'G', 'M', 'P', 'D', 'N', 'S_taar', 'N', 'D', 'P', 'M', 'G', 'R', 'S'],
    displayAroha: 'सा रे ग म प ध नि सां',
    displayAvroha: 'सां नि ध प म ग रे सा',
  },
  {
    id: 'alankar_2',
    title: 'Alankar 2: Double Swara (Jodi Swar)',
    level: 'Beginner',
    description: 'Singing each note twice to master vocal articulation and breath support.',
    notesSequence: ['S', 'S', 'R', 'R', 'G', 'G', 'M', 'M', 'P', 'P', 'D', 'D', 'N', 'N', 'S_taar', 'S_taar', 'N', 'N', 'D', 'D', 'P', 'P', 'M', 'M', 'G', 'G', 'R', 'R', 'S', 'S'],
    displayAroha: 'सा-सा रे-रे ग-ग म-म प-प ध-ध नि-नि सां-सां',
    displayAvroha: 'सां-सां नि-नि ध-ध प-प म-म ग-ग रे-रे सा-सा',
  },
  {
    id: 'alankar_3',
    title: 'Alankar 3: Three-Note Steps (Triplets)',
    level: 'Intermediate',
    description: 'Ascending and descending clusters of 3 swaras for fluid vocal transitions.',
    notesSequence: ['S', 'R', 'G', 'R', 'G', 'M', 'G', 'M', 'P', 'M', 'P', 'D', 'P', 'D', 'N', 'D', 'N', 'S_taar', 'S_taar', 'N', 'D', 'N', 'D', 'P', 'D', 'P', 'M', 'P', 'M', 'G', 'M', 'G', 'R', 'G', 'R', 'S'],
    displayAroha: 'सा-रे-ग, रे-ग-म, ग-म-प, म-प-ध, प-ध-नि, ध-नि-सां',
    displayAvroha: 'सां-नि-ध, नि-ध-प, ध-प-म, प-म-ग, म-ग-रे, ग-रे-सा',
  },
  {
    id: 'alankar_4',
    title: 'Alankar 4: Skip-Note Steps (Swar Chhalang)',
    level: 'Intermediate',
    description: 'Singing alternating notes to develop agility and pitch accuracy over intervals.',
    notesSequence: ['S', 'G', 'R', 'M', 'G', 'P', 'M', 'D', 'P', 'N', 'D', 'S_taar', 'S_taar', 'D', 'N', 'P', 'D', 'M', 'P', 'G', 'M', 'R', 'G', 'S'],
    displayAroha: 'सा-ग, रे-म, ग-प, म-ध, प-नि, ध-सां',
    displayAvroha: 'सां-ध, नि-प, ध-म, प-ग, म-रे, ग-सा',
  },
  {
    id: 'alankar_5',
    title: 'Alankar 5: Four-Note Quartets (Chatuswari)',
    level: 'Advanced',
    description: 'Challenging 4-note patterns essential for taan preparation and vocal velocity.',
    notesSequence: ['S', 'R', 'G', 'M', 'R', 'G', 'M', 'P', 'G', 'M', 'P', 'D', 'M', 'P', 'D', 'N', 'P', 'D', 'N', 'S_taar', 'S_taar', 'N', 'D', 'P', 'N', 'D', 'P', 'M', 'D', 'P', 'M', 'G', 'P', 'M', 'G', 'R', 'M', 'G', 'R', 'S'],
    displayAroha: 'सा-रे-ग-म, रे-ग-म-प, ग-म-प-ध, म-प-ध-नि, प-ध-नि-सां',
    displayAvroha: 'सां-नि-ध-प, नि-ध-प-म, ध-प-म-ग, प-म-ग-रे, म-ग-रे-सा',
  }
];

export interface TanpuraSettings {
  firstString: 'Pa' | 'Ma' | 'Ni';
  tempoSeconds: number; // e.g. 2.2 seconds per cycle
  fineTuneCents: number; // -50 to +50
  volume: number; // 0 to 1
  isPlaying: boolean;
}

export const COMMON_SCALE_PRESETS = [
  { label: 'Male Medium (C#3 / Kali Ek)', note: 'C#' as RootNoteName, octave: 3 },
  { label: 'Male Low (C3 / Safed Ek)', note: 'C' as RootNoteName, octave: 3 },
  { label: 'Male High (D3 / Safed Do)', note: 'D' as RootNoteName, octave: 3 },
  { label: 'Female Medium (G#3 / Kali Char)', note: 'G#' as RootNoteName, octave: 3 },
  { label: 'Female High (A3 / Safed Panch)', note: 'A' as RootNoteName, octave: 3 },
  { label: 'Female Low (G3 / Safed Char)', note: 'G' as RootNoteName, octave: 3 },
  { label: 'Deep Kharaj (A2)', note: 'A' as RootNoteName, octave: 2 },
];

export interface LessonNote {
  swaraId: string;
  durationSec: number;
  label: string;
}

export interface VocalTechniqueTip {
  focusArea: string;
  breathPlacement: string;
  secretTip: string;
  targetRaga?: string;
}

export interface PracticeLesson {
  id: string;
  stageNumber: number;
  stageTitle: string;
  stageHindi: string;
  title: string;
  hindiTitle: string;
  category: 'single_swara' | 'intervals' | 'combinations' | 'vikrit';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  instructions: string;
  technique: VocalTechniqueTip;
  targetNotes: LessonNote[];
}

export interface RecordedPitchPoint {
  timeSec: number;
  frequency: number;
  centsDeviation: number;
  isInSur: boolean;
  swaraId: string;
}

export interface PerformanceAnalysis {
  accuracyScore: number; // 0 to 100%
  stabilityScore: number; // 0 to 100%
  averageCentsDeviation: number; // e.g. +3.2 or -8.5
  centsTrend: 'centered' | 'sharp' | 'flat';
  totalSingingTimeSec: number;
  timeInSurSec: number;
  feedbackHindi: string;
  feedbackEnglish: string;
  points: RecordedPitchPoint[];
}

export const PRACTICE_LESSONS: PracticeLesson[] = [
  // =========================================================================
  // STAGE 1: FOUNDATION & BREATH STABILITY (चरण १: स्वर नींव व श्वास स्थिरता)
  // =========================================================================
  {
    id: 'lesson_sa',
    stageNumber: 1,
    stageTitle: 'Stage 1: Breath & Root Stability',
    stageHindi: 'चरण १: स्वर नींव व श्वास स्थिरता',
    title: 'Long Sa Sadhana (दीर्घ "सा" - स्वर स्थिरता व खरज)',
    hindiTitle: 'षड्ज (सा) स्थिरता एवं दीर्घ साधना',
    category: 'single_swara',
    level: 'Beginner',
    description: 'The supreme foundation of every singer (स्वर साधना की नींव). Holding pure Sa with diaphragmatic support creates vocal weight, pitch gravity, and timeless resonance.',
    instructions: 'Take a deep belly breath as the bar approaches. Hold pure "सा" steadily on the center pitch line with relaxed jaw and chest resonance.',
    technique: {
      focusArea: 'Chest Resonance & Diaphragmatic Breath (नाभि व छाती की गूंज)',
      breathPlacement: 'Deep belly breath (नाभि श्वास) — fill ribs outward without raising shoulders.',
      secretTip: 'Drop your jaw gently as if drinking warm tea. Do not push air from throat; let the sound float on breath.',
      targetRaga: 'Foundation of all Indian Ragas (सर्व राग मूल)'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 6.0, label: 'सा' }
    ]
  },
  {
    id: 'lesson_pa',
    stageNumber: 1,
    stageTitle: 'Stage 1: Breath & Root Stability',
    stageHindi: 'चरण १: स्वर नींव व श्वास स्थिरता',
    title: 'Anchoring Pancham (केवल "प" साधना - संवादी स्तम्भ)',
    hindiTitle: 'पंचम (प) सुर साधना',
    category: 'single_swara',
    level: 'Beginner',
    description: 'The natural harmonic fifth (3/2 ratio). Perfectly stable achala swara that tunes your hearing and creates harmonious acoustic lock with Tanpura.',
    instructions: 'Aim directly for the exact center of Pancham. Maintain an even, unwavering vocal tone across the entire note hold.',
    technique: {
      focusArea: 'Mask Resonance & Harmonic Alignment (मुख व नासिका संनाद)',
      breathPlacement: 'Upper abdominal engagement; sustained outward rib expansion.',
      secretTip: 'Feel the vibration in your teeth and nasal bridge. Align your sound to disappear into the Tanpura Pa string.',
      targetRaga: 'Universal Harmonic Fifth'
    },
    targetNotes: [
      { swaraId: 'P', durationSec: 5.0, label: 'प' }
    ]
  },
  {
    id: 'lesson_sa_pa_sa',
    stageNumber: 1,
    stageTitle: 'Stage 1: Breath & Root Stability',
    stageHindi: 'चरण १: स्वर नींव व श्वास स्थिरता',
    title: 'The Dual Pillars: Sa - Pa - Sa (षड्ज-पंचम संतुलन)',
    hindiTitle: 'षड्ज-पंचम अचल स्वर साधना',
    category: 'single_swara',
    level: 'Beginner',
    description: 'Alternating between the two unmovable Achala pillars (Shadja and Pancham). Establishes the acoustic axis of classical intonation.',
    instructions: 'Sing Sa from chest, transition smoothly to Pa with mask resonance, then return gracefully to Sa on a single breath.',
    technique: {
      focusArea: 'Vocal Register Balancing (मंद्र व मध्य संतुलन)',
      breathPlacement: 'Continuous smooth breath stream without gasping between notes.',
      secretTip: 'Do not squeeze your throat when shifting to Pa; tilt your chin slightly downward to keep vocal cords relaxed.',
      targetRaga: 'Achala Swara Foundation'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 3.0, label: 'सा' },
      { swaraId: 'P', durationSec: 3.5, label: 'प' },
      { swaraId: 'S', durationSec: 3.0, label: 'सा' }
    ]
  },
  {
    id: 'lesson_sa_taar_sa',
    stageNumber: 1,
    stageTitle: 'Stage 1: Breath & Root Stability',
    stageHindi: 'चरण १: स्वर नींव व श्वास स्थिरता',
    title: 'Octave Expansion: Madhya Sa to Taar Sa (मध्य से तार सा)',
    hindiTitle: 'तार सप्तक सा साधना',
    category: 'single_swara',
    level: 'Beginner',
    description: 'Training vocal cords to bridge the full 2:1 frequency octave from Middle Sa to Upper Taar Sa cleanly without straining the larynx.',
    instructions: 'Sing middle Sa with chest warmth, then elevate your voice to ring pure Taar Sa with head resonance, returning to base Sa.',
    technique: {
      focusArea: 'Head Voice & Pharyngeal Resonance (शिरो भाग गूंज)',
      breathPlacement: 'Firm lower abdominal anchor; let the air speed increase lightly.',
      secretTip: 'Never yell or force high Taar Sa. Imagine placing the note on the crown of your head with a smile.',
      targetRaga: 'Full Range Expansion'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 3.0, label: 'सा' },
      { swaraId: 'S_taar', durationSec: 3.5, label: 'सां' },
      { swaraId: 'S', durationSec: 3.0, label: 'सा' }
    ]
  },

  // =========================================================================
  // STAGE 2: SHUDDHA SWARAS & BILAWAL ARCHITECTURE (चरण २: शुद्ध स्वर रचना)
  // =========================================================================
  {
    id: 'lesson_sa_re',
    stageNumber: 2,
    stageTitle: 'Stage 2: Shuddha Swara Foundation',
    stageHindi: 'चरण २: शुद्ध स्वर रचना व पूर्वांग',
    title: 'First Step: Sa to Re (सा और शुद्ध रे का संवाद)',
    hindiTitle: 'सा से रे का सफर',
    category: 'intervals',
    level: 'Beginner',
    description: 'Mastering the 9/8 Major Second interval. The fundamental building block of Indian scale ascent.',
    instructions: 'Sing Sa for 2.5s and step cleanly up to Shuddha Re for 2.5s without dragging or sliding sharp.',
    technique: {
      focusArea: 'Vocal Micro-Stepping (स्वर क्रम सटीकता)',
      breathPlacement: 'Even airflow; do not push extra air when climbing to Re.',
      secretTip: 'Shuddha Re is 204 cents above Sa. Keep your tongue relaxed and flat against bottom teeth.',
      targetRaga: 'Bilawal, Kalyan, Kafi'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 2.5, label: 'सा' },
      { swaraId: 'R', durationSec: 2.5, label: 'रे' },
      { swaraId: 'S', durationSec: 2.0, label: 'सा' }
    ]
  },
  {
    id: 'lesson_sa_re_ga',
    stageNumber: 2,
    stageTitle: 'Stage 2: Shuddha Swara Foundation',
    stageHindi: 'चरण २: शुद्ध स्वर रचना व पूर्वांग',
    title: 'Classical Triad: Sa - Re - Ga (सा-रे-ग त्रयी आरोह)',
    hindiTitle: 'सा-रे-ग त्रयी साधना',
    category: 'combinations',
    level: 'Beginner',
    description: 'The signature 3-note ascent that opens Bilawal, Kalyan, and Khamaj. Establishes true Major Third (5/4 ratio) intonation.',
    instructions: 'Sing Sa, Re, and Ga consecutively. Give full warmth to Gandhar (ग) for 3 seconds before resolving to Sa.',
    technique: {
      focusArea: 'Major Third Purity (शुद्ध गान्धार शुद्धता)',
      breathPlacement: 'Supported continuous breath column across all 3 notes.',
      secretTip: 'In Just Intonation, Shuddha Ga is at 386 cents (slightly sweeter and lower than Western piano). Keep it pure.',
      targetRaga: 'Bilawal & Kalyan Thaat'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 2.0, label: 'सा' },
      { swaraId: 'R', durationSec: 2.0, label: 'रे' },
      { swaraId: 'G', durationSec: 3.0, label: 'ग' },
      { swaraId: 'S', durationSec: 2.0, label: 'सा' }
    ]
  },
  {
    id: 'lesson_poorvang',
    stageNumber: 2,
    stageTitle: 'Stage 2: Shuddha Swara Foundation',
    stageHindi: 'चरण २: शुद्ध स्वर रचना व पूर्वांग',
    title: 'The Bedrock Poorvang: Sa to Pa (सा रे ग म प - पूर्वांग)',
    hindiTitle: 'पूर्वांग स्वर साधना (सा से प)',
    category: 'combinations',
    level: 'Intermediate',
    description: 'The first five notes (Poorvang) that define 80% of North Indian classical compositions. Balances Shuddha Ma with Pa.',
    instructions: 'Ascend steadily through Sa, Re, Ga, Ma, and settle into Pancham. Keep note durations steady and transitions smooth.',
    technique: {
      focusArea: 'Shuddha Madhyam Intonation (मध्यम शुद्धता व शांति)',
      breathPlacement: 'Take a full breath before the run; sustain through Pa.',
      secretTip: 'Shuddha Madhyam (498 cents) must not lean toward Teevra Ma. Feel its resting, serene calm before reaching Pa.',
      targetRaga: 'Bilawal Poorvang'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 1.8, label: 'सा' },
      { swaraId: 'R', durationSec: 1.8, label: 'रे' },
      { swaraId: 'G', durationSec: 1.8, label: 'ग' },
      { swaraId: 'm', durationSec: 2.0, label: 'म' },
      { swaraId: 'P', durationSec: 2.5, label: 'प' }
    ]
  },
  {
    id: 'lesson_full_saptak',
    stageNumber: 2,
    stageTitle: 'Stage 2: Shuddha Swara Foundation',
    stageHindi: 'चरण २: शुद्ध स्वर रचना व पूर्वांग',
    title: 'Complete Bilawal Saptak: Ascent & Descent (सम्पूर्ण सप्तक)',
    hindiTitle: 'सातों शुद्ध स्वर आरोह-अवरोह',
    category: 'combinations',
    level: 'Intermediate',
    description: 'Singing all 7 natural notes (Shuddha Swaras) up to Taar Sa and descending cleanly back to Madhya Sa.',
    instructions: 'Sing each note with equal duration. Maintain steady rhythm and take a silent breath at Taar Sa before descending.',
    technique: {
      focusArea: 'Breath Economy & Octave Architecture (श्वास प्रबंधन)',
      breathPlacement: 'Pace your air so 50% remains when reaching Taar Sa.',
      secretTip: 'Dhaivat and Nishad must stay bright. Do not drop pitch on the descent from Taar Sa.',
      targetRaga: 'Bilawal Thaat (Natural Major Scale)'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 1.4, label: 'सा' },
      { swaraId: 'R', durationSec: 1.4, label: 'रे' },
      { swaraId: 'G', durationSec: 1.4, label: 'ग' },
      { swaraId: 'm', durationSec: 1.4, label: 'म' },
      { swaraId: 'P', durationSec: 1.4, label: 'प' },
      { swaraId: 'D', durationSec: 1.4, label: 'ध' },
      { swaraId: 'N', durationSec: 1.4, label: 'नि' },
      { swaraId: 'S_taar', durationSec: 2.2, label: 'सां' },
      { swaraId: 'N', durationSec: 1.4, label: 'नि' },
      { swaraId: 'D', durationSec: 1.4, label: 'ध' },
      { swaraId: 'P', durationSec: 1.4, label: 'प' },
      { swaraId: 'm', durationSec: 1.4, label: 'म' },
      { swaraId: 'G', durationSec: 1.4, label: 'ग' },
      { swaraId: 'R', durationSec: 1.4, label: 'रे' },
      { swaraId: 'S', durationSec: 2.2, label: 'सा' }
    ]
  },

  // =========================================================================
  // STAGE 3: VOCAL INTERVALS & CHHALANG (चरण ३: स्वर अन्तराल व छलांग)
  // =========================================================================
  {
    id: 'lesson_sa_pa_leap',
    stageNumber: 3,
    stageTitle: 'Stage 3: Melodic Intervals & Leaps',
    stageHindi: 'चरण ३: स्वर अन्तराल व छलांग साधना',
    title: 'The Great Fifth Leap: Sa to Pa (षड्ज-पंचम छलांग)',
    hindiTitle: 'षड्ज-पंचम छलांग साधना',
    category: 'intervals',
    level: 'Intermediate',
    description: 'Calibrate vocal muscle memory to leap directly across the fifth interval without sliding through intermediate notes.',
    instructions: 'Sing Sa firmly, leap straight to Pa on target, return to Sa, and leap back to Pa cleanly.',
    technique: {
      focusArea: 'Vocal Cord Tension Calibration (स्वर छलांग नियंत्रण)',
      breathPlacement: 'Snappy abdominal support on each leap without coughing.',
      secretTip: 'Hear Pancham inside your mind before singing it. Jump directly onto the pitch bullseye without meend.',
      targetRaga: 'Universal Classical Precision'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 2.0, label: 'सा' },
      { swaraId: 'P', durationSec: 2.5, label: 'प' },
      { swaraId: 'S', durationSec: 2.0, label: 'सा' },
      { swaraId: 'P', durationSec: 2.5, label: 'प' }
    ]
  },
  {
    id: 'lesson_sa_ma_leap',
    stageNumber: 3,
    stageTitle: 'Stage 3: Melodic Intervals & Leaps',
    stageHindi: 'चरण ३: स्वर अन्तराल व छलांग साधना',
    title: 'The Fourth Leap: Sa to Ma (षड्ज-मध्यम छलांग)',
    hindiTitle: 'षड्ज-मध्यम अन्तराल',
    category: 'intervals',
    level: 'Intermediate',
    description: 'The 4/3 perfect fourth leap. Essential for ragas that treat Shuddha Madhyam as Vadi (Malkauns, Bageshree, Megh).',
    instructions: 'Sing base Sa, jump directly to Shuddha Ma without touching Re or Ga, and hold Ma with deep tranquility.',
    technique: {
      focusArea: 'Fourth Interval Muscle Memory (मध्यम स्वर संधान)',
      breathPlacement: 'Gentle, steady breath stream; do not blurt air on Ma.',
      secretTip: 'Shuddha Ma has an inward, meditating quality. Land on its center with soft vocal cords.',
      targetRaga: 'Malkauns, Bageshri, Megh'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 2.0, label: 'सा' },
      { swaraId: 'm', durationSec: 2.5, label: 'म' },
      { swaraId: 'S', durationSec: 2.0, label: 'सा' },
      { swaraId: 'm', durationSec: 2.5, label: 'म' }
    ]
  },
  {
    id: 'lesson_thirds_sixths',
    stageNumber: 3,
    stageTitle: 'Stage 3: Melodic Intervals & Leaps',
    stageHindi: 'चरण ३: स्वर अन्तराल व छलांग साधना',
    title: 'Harmonic Color: Sa-Ga & Sa-Dha (गान्धार व धैवत अन्तराल)',
    hindiTitle: 'तीसरे व छठे स्वर की छलांग',
    category: 'intervals',
    level: 'Intermediate',
    description: 'Alternating major third (Ga) and major sixth (Dha) leaps. Develops flexible vocal agility across wide distances.',
    instructions: 'Sing Sa -> Ga, return to Sa, then leap wide to Shuddha Dhaivat and resolve back to Sa.',
    technique: {
      focusArea: 'Wide Interval Pitch Placement (विस्तृत स्वर छलांग)',
      breathPlacement: 'Lift sound into the palate on Dhaivat while keeping navel engaged.',
      secretTip: 'Dhaivat should feel bright and uplifting. Keep your soft palate lifted like a gentle yawn.',
      targetRaga: 'Bhupali, Deshkar, Pahadi'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 1.8, label: 'सा' },
      { swaraId: 'G', durationSec: 2.2, label: 'ग' },
      { swaraId: 'S', durationSec: 1.8, label: 'सा' },
      { swaraId: 'D', durationSec: 2.5, label: 'ध' },
      { swaraId: 'S', durationSec: 2.0, label: 'सा' }
    ]
  },

  // =========================================================================
  // STAGE 4: VIKRIT SWARAS - KOMAL & TEEVRA (चरण ४: कोमल व तीव्र स्वर साधना)
  // =========================================================================
  {
    id: 'lesson_komal_re',
    stageNumber: 4,
    stageTitle: 'Stage 4: Vikrit Swaras (Komal & Teevra)',
    stageHindi: 'चरण ४: कोमल व तीव्र स्वर - भाव व रस',
    title: 'Bhairav Dawn: Komal Re (कोमल रे॒ साधना - प्रातः काल)',
    hindiTitle: 'कोमल ऋषभ (रे॒) साधना',
    category: 'vikrit',
    level: 'Intermediate',
    description: 'Learn the delicate 16/15 ratio of Komal Re (112 cents), resting like a soft whisper just above Sa. The soul of Raga Bhairav.',
    instructions: 'Notice how close Komal Re is to Sa. Do not sing it too high like Shuddha Re. Keep it subtle and contemplative.',
    technique: {
      focusArea: 'Micro-Tonal Sensitivity (श्रुति सूक्ष्मता)',
      breathPlacement: 'Warm, whispered breath column with deep chest tone on Sa.',
      secretTip: 'Komal Re is only 1 semitone above Sa. Think of it as a shadow of Sa rather than a separate jump.',
      targetRaga: 'Raga Bhairav, Ahir Bhairav'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 2.2, label: 'सा' },
      { swaraId: 'r', durationSec: 3.2, label: 'रे॒' },
      { swaraId: 'S', durationSec: 2.5, label: 'सा' }
    ]
  },
  {
    id: 'lesson_komal_ga_ni',
    stageNumber: 4,
    stageTitle: 'Stage 4: Vikrit Swaras (Komal & Teevra)',
    stageHindi: 'चरण ४: कोमल व तीव्र स्वर - भाव व रस',
    title: 'Kafi Emotion: Komal Ga & Komal Ni (कोमल ग॒ व नि॒ - रस साधना)',
    hindiTitle: 'कोमल गान्धार व निषाद साधना',
    category: 'vikrit',
    level: 'Intermediate',
    description: 'The minor 3rd (Komal Ga) and minor 7th (Komal Ni) create the deeply emotional, romantic aesthetic of Raga Kafi and Pilu.',
    instructions: 'Sing the ascending scale with Komal Ga and Komal Ni. Feel the poignant emotional coloration of the flat intervals.',
    technique: {
      focusArea: 'Komal Swara Emotional Resonance (करुण व शृंगार रस)',
      breathPlacement: 'Gentle, expressive breath flow with smooth transitions.',
      secretTip: 'Komal Ga is 316 cents — 70 cents lower than Shuddha Ga. Let your voice embrace its soft, tender slope.',
      targetRaga: 'Raga Kafi, Bageshree, Pilu'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 1.8, label: 'सा' },
      { swaraId: 'R', durationSec: 1.8, label: 'रे' },
      { swaraId: 'g', durationSec: 2.5, label: 'ग॒' },
      { swaraId: 'm', durationSec: 1.8, label: 'म' },
      { swaraId: 'P', durationSec: 1.8, label: 'प' },
      { swaraId: 'd', durationSec: 1.8, label: 'ध॒' },
      { swaraId: 'n', durationSec: 2.2, label: 'नि॒' },
      { swaraId: 'S_taar', durationSec: 2.5, label: 'सां' }
    ]
  },
  {
    id: 'lesson_teevra_ma',
    stageNumber: 4,
    stageTitle: 'Stage 4: Vikrit Swaras (Komal & Teevra)',
    stageHindi: 'चरण ४: कोमल व तीव्र स्वर - भाव व रस',
    title: 'Yaman Radiance: Teevra Ma (तीव्र म॑ - सायंकालीन दीप्ति)',
    hindiTitle: 'तीव्र मध्यम (म॑) साधना',
    category: 'vikrit',
    level: 'Advanced',
    description: 'The sharp fourth (45/32 ratio, 590 cents). The mystical, luminous swara that illuminates evening ragas like Yaman, Marwa, and Puriya.',
    instructions: 'Sing Sa -> Re -> Ga -> Teevra Ma -> Pa. Hit Teevra Ma boldly above Shuddha Ma and resolve into Pancham.',
    technique: {
      focusArea: 'Teevra Sharp Intonation (तीव्र मध्यम स्थिरता)',
      breathPlacement: 'Forward mask projection; steady abdominal lift on Teevra Ma.',
      secretTip: 'Teevra Ma has a magnetic pull toward Pancham. Sing it proud and bright (590 cents), not shy.',
      targetRaga: 'Raga Yaman, Kalyan, Marwa'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 1.8, label: 'सा' },
      { swaraId: 'R', durationSec: 1.8, label: 'रे' },
      { swaraId: 'G', durationSec: 2.0, label: 'ग' },
      { swaraId: 'M', durationSec: 2.5, label: 'म॑' },
      { swaraId: 'P', durationSec: 2.5, label: 'प' },
      { swaraId: 'M', durationSec: 2.0, label: 'म॑' },
      { swaraId: 'G', durationSec: 1.8, label: 'ग' },
      { swaraId: 'S', durationSec: 2.2, label: 'सा' }
    ]
  },
  {
    id: 'lesson_all_four_komal',
    stageNumber: 4,
    stageTitle: 'Stage 4: Vikrit Swaras (Komal & Teevra)',
    stageHindi: 'चरण ४: कोमल व तीव्र स्वर - भाव व रस',
    title: 'Bhairavi Mastery: All 4 Komal Swaras (सम्पूर्ण भैरवी - रे॒ ग॒ ध॒ नि॒)',
    hindiTitle: 'भैरवी थाट सम्पूर्ण साधना',
    category: 'vikrit',
    level: 'Advanced',
    description: 'All movable notes are flattened (Komal Re, Ga, Dha, Ni). The supreme queen of morning and finale ragas in Indian classical tradition.',
    instructions: 'Traverse the entire octave with all four Komal swaras, anchored purely between unmovable Sa and Pa.',
    technique: {
      focusArea: 'Complex Vikrit Scale Integration (चारों कोमल स्वर संतुलन)',
      breathPlacement: 'Smooth, unbroken air column; maintain equal volume on all notes.',
      secretTip: 'Think of Komal notes as tender petals opening around the sturdy branches of Sa and Pa.',
      targetRaga: 'Raga Bhairavi (Queen of Ragas)'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 1.8, label: 'सा' },
      { swaraId: 'r', durationSec: 1.8, label: 'रे॒' },
      { swaraId: 'g', durationSec: 2.0, label: 'ग॒' },
      { swaraId: 'm', durationSec: 1.8, label: 'म' },
      { swaraId: 'P', durationSec: 1.8, label: 'प' },
      { swaraId: 'd', durationSec: 1.8, label: 'ध॒' },
      { swaraId: 'n', durationSec: 2.0, label: 'नि॒' },
      { swaraId: 'S_taar', durationSec: 2.5, label: 'सां' }
    ]
  },

  // =========================================================================
  // STAGE 5: AGILITY, PALTE & TAAN PREPARATION (चरण ५: स्वर गति व पलटे)
  // =========================================================================
  {
    id: 'lesson_double_palta',
    stageNumber: 5,
    stageTitle: 'Stage 5: Agility, Palte & Velocity',
    stageHindi: 'चरण ५: स्वर गति, पलटे व तान तैयारी',
    title: 'Staccato Articulation: Jodi Swar Palta (जोड़ी स्वर - सा-सा रे-रे)',
    hindiTitle: 'जोड़ी स्वर पलटा (Articulation)',
    category: 'combinations',
    level: 'Intermediate',
    description: 'Singing each note twice consecutively. Builds vocal attack precision, rapid vocal cord reset, and crisp syllabic articulation.',
    instructions: 'Articulate each pair of notes cleanly using light diaphragmatic pulses. Do not slur or slide the repeated notes.',
    technique: {
      focusArea: 'Vocal Cord Attack & Reset (स्वर प्रहार व स्पष्टता)',
      breathPlacement: 'Subtle diaphragmatic bounce for each syllable.',
      secretTip: 'Keep your tongue nimble and teeth slightly parted. Re-attack each note from breath, not by clamping throat.',
      targetRaga: 'Palta Exercise (Alankar 2)'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 1.0, label: 'सा' },
      { swaraId: 'S', durationSec: 1.0, label: 'सा' },
      { swaraId: 'R', durationSec: 1.0, label: 'रे' },
      { swaraId: 'R', durationSec: 1.0, label: 'रे' },
      { swaraId: 'G', durationSec: 1.0, label: 'ग' },
      { swaraId: 'G', durationSec: 1.0, label: 'ग' },
      { swaraId: 'm', durationSec: 1.0, label: 'म' },
      { swaraId: 'm', durationSec: 1.0, label: 'म' },
      { swaraId: 'P', durationSec: 1.0, label: 'प' },
      { swaraId: 'P', durationSec: 1.0, label: 'प' },
      { swaraId: 'S_taar', durationSec: 2.0, label: 'सां' }
    ]
  },
  {
    id: 'lesson_triplet_palta',
    stageNumber: 5,
    stageTitle: 'Stage 5: Agility, Palte & Velocity',
    stageHindi: 'चरण ५: स्वर गति, पलटे व तान तैयारी',
    title: 'Ascending Triplets: Three-Step Waves (त्रयी तरंग - सा-रे-ग, रे-ग-म)',
    hindiTitle: 'त्रयी पलटा (Triplets Agility)',
    category: 'combinations',
    level: 'Advanced',
    description: 'Climbing in interlocking groups of 3 swaras. Prepares the vocal chords for medium-tempo classical taans and drut singing.',
    instructions: 'Sing each 3-note wave fluidly. Accentuate the 3rd note slightly before starting the next cluster.',
    technique: {
      focusArea: 'Interlocking Pattern Fluidity (तान तैयारी व वेग)',
      breathPlacement: 'Continuous spinning breath column that does not stop between waves.',
      secretTip: 'Sing like a cascading waterfall — legato and connected, but with crystal clear pitch landmarks.',
      targetRaga: 'Taan Foundation (Alankar 3)'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 0.8, label: 'सा' },
      { swaraId: 'R', durationSec: 0.8, label: 'रे' },
      { swaraId: 'G', durationSec: 1.2, label: 'ग' },
      { swaraId: 'R', durationSec: 0.8, label: 'रे' },
      { swaraId: 'G', durationSec: 0.8, label: 'ग' },
      { swaraId: 'm', durationSec: 1.2, label: 'म' },
      { swaraId: 'G', durationSec: 0.8, label: 'ग' },
      { swaraId: 'm', durationSec: 0.8, label: 'म' },
      { swaraId: 'P', durationSec: 1.2, label: 'प' },
      { swaraId: 'm', durationSec: 0.8, label: 'म' },
      { swaraId: 'P', durationSec: 0.8, label: 'प' },
      { swaraId: 'D', durationSec: 1.2, label: 'ध' },
      { swaraId: 'P', durationSec: 0.8, label: 'प' },
      { swaraId: 'D', durationSec: 0.8, label: 'ध' },
      { swaraId: 'N', durationSec: 1.2, label: 'नि' },
      { swaraId: 'S_taar', durationSec: 2.0, label: 'सां' }
    ]
  },
  {
    id: 'lesson_skip_palta',
    stageNumber: 5,
    stageTitle: 'Stage 5: Agility, Palte & Velocity',
    stageHindi: 'चरण ५: स्वर गति, पलटे व तान तैयारी',
    title: 'Alternating Leaps: Skip-Step Palta (स्वर छलांग पलटा - सा-ग, रे-म, ग-प)',
    hindiTitle: 'स्वर छलांग पलटा (Vocal Acrobatics)',
    category: 'combinations',
    level: 'Advanced',
    description: 'Alternating leaps of thirds. The quintessential test of a singer’s vocal agility and pinpoint accuracy on dynamic moving targets.',
    instructions: 'Sing each leap pair with agile confidence. Don’t slide; pop each high note cleanly and return down.',
    technique: {
      focusArea: 'Acrobatic Pitch Accuracy (चपल स्वर संधान)',
      breathPlacement: 'Light, buoyant air stream with elastic diaphragm bounce.',
      secretTip: 'Keep your vocal tract domed like an umbrella. Let the higher note ring effortlessly without neck veins bulging.',
      targetRaga: 'Chhalang Palta (Alankar 4)'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 0.9, label: 'सा' },
      { swaraId: 'G', durationSec: 1.1, label: 'ग' },
      { swaraId: 'R', durationSec: 0.9, label: 'रे' },
      { swaraId: 'm', durationSec: 1.1, label: 'म' },
      { swaraId: 'G', durationSec: 0.9, label: 'ग' },
      { swaraId: 'P', durationSec: 1.1, label: 'प' },
      { swaraId: 'm', durationSec: 0.9, label: 'म' },
      { swaraId: 'D', durationSec: 1.1, label: 'ध' },
      { swaraId: 'P', durationSec: 0.9, label: 'प' },
      { swaraId: 'N', durationSec: 1.1, label: 'नि' },
      { swaraId: 'D', durationSec: 0.9, label: 'ध' },
      { swaraId: 'S_taar', durationSec: 2.0, label: 'सां' }
    ]
  },

  // =========================================================================
  // STAGE 6: RAGA PHRASING & BANDISH ESSENCE (चरण ६: राग अंग व शास्त्रीय गायकी)
  // =========================================================================
  {
    id: 'lesson_raga_yaman',
    stageNumber: 6,
    stageTitle: 'Stage 6: Raga Phrasing & Classical Artistry',
    stageHindi: 'चरण ६: राग अंग, चलन व शास्त्रीय गायकी',
    title: 'Raga Yaman Signature Chalan (राग यमन अंग - नि रे ग, रे सा)',
    hindiTitle: 'राग यमन चलन व पकड़',
    category: 'combinations',
    level: 'Advanced',
    description: 'The crowning masterpiece of North Indian evening ragas. Singing authentic classical phrases with Vadi Gandhar and Teevra Ma.',
    instructions: 'Sing with reverence and peaceful devotion. Linger on Gandhar (ग) and Shadja (सा) with pure intonation.',
    technique: {
      focusArea: 'Nyasa & Raga Mood Creation (न्याय स्वर व भाव)',
      breathPlacement: 'Slow, expansive breath matching the dignity of nightfall.',
      secretTip: 'In Yaman, Sa is often omitted in the beginning (नि रे ग). Let Gandhar bloom with sweet, gentle warmth.',
      targetRaga: 'Raga Yaman (Evening Peace)'
    },
    targetNotes: [
      { swaraId: 'N', durationSec: 1.8, label: 'नि' },
      { swaraId: 'R', durationSec: 1.8, label: 'रे' },
      { swaraId: 'G', durationSec: 2.5, label: 'ग' },
      { swaraId: 'R', durationSec: 1.8, label: 'रे' },
      { swaraId: 'S', durationSec: 2.5, label: 'सा' },
      { swaraId: 'M', durationSec: 1.8, label: 'म॑' },
      { swaraId: 'D', durationSec: 1.8, label: 'ध' },
      { swaraId: 'N', durationSec: 2.0, label: 'नि' },
      { swaraId: 'S_taar', durationSec: 2.8, label: 'सां' }
    ]
  },
  {
    id: 'lesson_raga_bhupali',
    stageNumber: 6,
    stageTitle: 'Stage 6: Raga Phrasing & Classical Artistry',
    stageHindi: 'चरण ६: राग अंग, चलन व शास्त्रीय गायकी',
    title: 'Raga Bhupali Pentatonic Purity (राग भूपाली - सा रे ग प ध सां)',
    hindiTitle: 'राग भूपाली औडव साधना',
    category: 'combinations',
    level: 'Advanced',
    description: 'Omitting Ma and Ni (Audav-Audav 5-note scale). One of the most peaceful, ancient, and joyful melodies in world music.',
    instructions: 'Sing each of the 5 notes with deep contentment. Savor the wide intervals between Ga -> Pa and Dha -> Taar Sa.',
    technique: {
      focusArea: 'Audav Pentatonic Expansiveness (औडव शांति व रस)',
      breathPlacement: 'Calm, steady breath like deep ocean swells.',
      secretTip: 'Without Ma and Ni, each note stands bold and tall. Keep Gandhar and Dhaivat ringing like silver bells.',
      targetRaga: 'Raga Bhupali (Joy & Devotion)'
    },
    targetNotes: [
      { swaraId: 'S', durationSec: 1.6, label: 'सा' },
      { swaraId: 'R', durationSec: 1.6, label: 'रे' },
      { swaraId: 'G', durationSec: 2.2, label: 'ग' },
      { swaraId: 'P', durationSec: 1.8, label: 'प' },
      { swaraId: 'D', durationSec: 1.8, label: 'ध' },
      { swaraId: 'S_taar', durationSec: 2.5, label: 'सां' },
      { swaraId: 'S_taar', durationSec: 1.6, label: 'सां' },
      { swaraId: 'D', durationSec: 1.6, label: 'ध' },
      { swaraId: 'P', durationSec: 2.0, label: 'प' },
      { swaraId: 'G', durationSec: 1.8, label: 'ग' },
      { swaraId: 'R', durationSec: 1.6, label: 'रे' },
      { swaraId: 'S', durationSec: 2.8, label: 'सा' }
    ]
  }
];
