import { SWARAS } from '../types/music';
import type { RootNoteName, RootPitchConfig, SwaraInfo, TuningSystem, DetectedPitch } from '../types/music';

// Note indices from C = 0
export const NOTE_NAMES: RootNoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const INDIAN_NOTE_NAMES: Record<RootNoteName, string> = {
  'C': 'Safed 1 (White 1)',
  'C#': 'Kali 1 (Black 1)',
  'D': 'Safed 2 (White 2)',
  'D#': 'Kali 2 (Black 2)',
  'E': 'Safed 3 (White 3)',
  'F': 'Safed 4 (White 4)',
  'F#': 'Kali 3 (Black 3)',
  'G': 'Safed 5 (White 5)',
  'G#': 'Kali 4 (Black 4)',
  'A': 'Safed 6 (White 6)',
  'A#': 'Kali 5 (Black 5)',
  'B': 'Safed 7 (White 7)',
};

/**
 * Calculate frequency in Hz for a standard Western note + octave (A4 = 440 Hz)
 */
export function getRootFrequency(note: RootNoteName, octave: number): number {
  const noteIndex = NOTE_NAMES.indexOf(note);
  // MIDI note for C4 is 60. A4 is 69.
  // NoteIndex 0 is C. For octave 4: midi = 60 + 0 = 60.
  const midiNote = 12 * (octave + 1) + noteIndex;
  // A4 (midi 69) = 440Hz
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export function createRootConfig(note: RootNoteName, octave: number): RootPitchConfig {
  return {
    note,
    octave,
    frequency: getRootFrequency(note, octave),
    indianName: INDIAN_NOTE_NAMES[note] || note,
  };
}

/**
 * Calculates cents difference between two frequencies: 1200 * log2(f / fBase)
 */
export function getCentsBetween(f: number, fBase: number): number {
  if (f <= 0 || fBase <= 0) return 0;
  return 1200 * Math.log2(f / fBase);
}

/**
 * Given a detected frequency (Hz) and the singer's root Sa (e.g. C#3 = 138.59 Hz),
 * identify which Swara in the Indian classical scale is being sung, its octave,
 * and the cents deviation (-50 to +50 cents) from the pure target pitch.
 */
export function mapFrequencyToSwara(
  frequency: number,
  baseSaFrequency: number,
  clarity: number,
  volumeDb: number,
  tuningSystem: TuningSystem = 'just'
): DetectedPitch | null {
  if (frequency <= 20 || frequency >= 2500 || clarity < 0.65 || volumeDb < -55) {
    return null;
  }

  // Cents relative to base Sa
  const totalCents = getCentsBetween(frequency, baseSaFrequency);

  // Determine octave offset (-2: Ati-mandra, -1: Mandra, 0: Madhya, 1: Taar, 2: Ati-taar)
  let octaveOffset = Math.floor(totalCents / 1200);
  let centsInOctave = totalCents - octaveOffset * 1200;

  // Bound check for edge values close to 1200
  if (centsInOctave < 0) {
    centsInOctave += 1200;
    octaveOffset -= 1;
  }

  // Find closest Swara in SWARAS list
  let closestSwara: SwaraInfo = SWARAS[0];
  let minDeviation = 9999;

  for (const swara of SWARAS) {
    const targetCents = tuningSystem === 'just' ? swara.centsOffsetJust : swara.centsOffsetEqual;
    const deviation = centsInOctave - targetCents;

    if (Math.abs(deviation) < Math.abs(minDeviation)) {
      minDeviation = deviation;
      closestSwara = swara;
    }
  }

  // Special handle wrap around for Taar Sa (1200 cents) vs Madhya Sa (0 cents)
  const wrapDeviation = centsInOctave - 1200;
  if (Math.abs(wrapDeviation) < Math.abs(minDeviation)) {
    minDeviation = wrapDeviation;
    closestSwara = SWARAS[SWARAS.length - 1]; // S_taar
  }

  // Clamp deviation to -50..+50 cents for needle rendering
  const clampedDeviation = Math.max(-50, Math.min(50, minDeviation));
  const isInSur = Math.abs(clampedDeviation) <= 15;

  return {
    frequency: Math.round(frequency * 10) / 10,
    clarity,
    volumeDb: Math.round(volumeDb),
    swara: closestSwara,
    centsDeviation: Math.round(clampedDeviation * 10) / 10,
    octaveOffset,
    isInSur,
    timestamp: Date.now(),
  };
}

/**
 * Target frequency of a specific Swara given the base Sa frequency and tuning system
 */
export function getSwaraTargetFrequency(
  swaraId: string,
  baseSaFrequency: number,
  tuningSystem: TuningSystem = 'just'
): number {
  const swara = SWARAS.find(s => s.id === swaraId) || SWARAS[0];
  if (tuningSystem === 'just') {
    return baseSaFrequency * swara.justRatio;
  } else {
    return baseSaFrequency * Math.pow(2, swara.semitoneOffset / 12);
  }
}
