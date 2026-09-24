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
