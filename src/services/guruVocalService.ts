import { getSwaraTargetFrequency } from '../utils/pitchMath';
import type { LessonNote } from '../types/music';

export type NoteDemonstrationCallback = (noteIdx: number, note: LessonNote | null) => void;

class GuruVocalService {
  private audioCtx: AudioContext | null = null;
  private isDemonstrating: boolean = false;
  private currentTimeoutIds: number[] = [];
  private onNoteCallbacks: Set<NoteDemonstrationCallback> = new Set();

  public subscribeNote(cb: NoteDemonstrationCallback): () => void {
    this.onNoteCallbacks.add(cb);
    return () => {
      this.onNoteCallbacks.delete(cb);
    };
  }

  public async playDemonstration(
    notes: LessonNote[],
    baseSaFrequency: number,
    onComplete: () => void,
    initialDelayMs: number = 1000,
    gapMs: number = 350
  ): Promise<void> {
    this.stop();

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.isDemonstrating = true;
      let cumulativeTimeMs = initialDelayMs;

      notes.forEach((note, idx) => {
        // Schedule visual callback
        const noteStartTimeout = window.setTimeout(() => {
          if (!this.isDemonstrating) return;
          this.onNoteCallbacks.forEach(cb => cb(idx, note));
        }, cumulativeTimeMs);
        this.currentTimeoutIds.push(noteStartTimeout);

        // Schedule audio playback
        const audioPlayTimeout = window.setTimeout(() => {
          if (!this.isDemonstrating || !this.audioCtx) return;
          this.synthesizeVocalTone(note.swaraId, baseSaFrequency, note.durationSec);
        }, cumulativeTimeMs);
        this.currentTimeoutIds.push(audioPlayTimeout);

        cumulativeTimeMs += note.durationSec * 1000 + gapMs; // note duration + gap
      });

      // Schedule completion
      const completeTimeout = window.setTimeout(() => {
        if (!this.isDemonstrating) return;
        this.isDemonstrating = false;
        this.onNoteCallbacks.forEach(cb => cb(-1, null));
        onComplete();
      }, cumulativeTimeMs + 100);
      this.currentTimeoutIds.push(completeTimeout);

    } catch (e) {
      console.error('Failed to play vocal demonstration:', e);
      this.stop();
      onComplete();
    }
  }

  public stop() {
    this.isDemonstrating = false;
    this.currentTimeoutIds.forEach(id => clearTimeout(id));
    this.currentTimeoutIds = [];
    this.onNoteCallbacks.forEach(cb => cb(-1, null));
  }

  public isPlaying(): boolean {
    return this.isDemonstrating;
  }

  /**
   * Synthesize a warm, pleasing Indian classical vocal/bansuri harmonic tone
   */
  private synthesizeVocalTone(swaraId: string, baseSaFrequency: number, durationSec: number) {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const freq = getSwaraTargetFrequency(swaraId, baseSaFrequency, 'just');

    // Master envelope for note
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.35, now + 0.12); // smooth vocal onset
    masterGain.gain.setValueAtTime(0.32, now + durationSec - 0.2);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    // Warm formant vocal filter (simulates vocal tract resonance)
    const formantFilter = ctx.createBiquadFilter();
    formantFilter.type = 'peaking';
    formantFilter.frequency.setValueAtTime(freq * 2.5, now);
    formantFilter.Q.value = 3.5;
    formantFilter.gain.value = 6;

    // Subtly warm lowpass
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(Math.min(2800, freq * 6), now);

    masterGain.connect(formantFilter);
    formantFilter.connect(lowpass);
    lowpass.connect(ctx.destination);

    // Subtle gentle vibrato (starts after 0.4s like real singing)
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 5.2; // 5.2 Hz vocal flutter
    vibratoGain.gain.setValueAtTime(0.001, now);
    vibratoGain.gain.linearRampToValueAtTime(1.8, now + 0.6); // delayed vibrato onset

    vibrato.connect(vibratoGain);

    // 1. Fundamental warm sine
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    vibratoGain.connect(osc1.frequency);

    // 2. Harmonic triangle for body
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, now);
    vibratoGain.connect(osc2.frequency);

    // 3. Second harmonic (octave overtone)
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 2, now);

    const gain1 = ctx.createGain(); gain1.gain.value = 0.55;
    const gain2 = ctx.createGain(); gain2.gain.value = 0.35;
    const gain3 = ctx.createGain(); gain3.gain.value = 0.15;

    osc1.connect(gain1); gain1.connect(masterGain);
    osc2.connect(gain2); gain2.connect(masterGain);
    osc3.connect(gain3); gain3.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    vibrato.start(now);

    const stopTime = now + durationSec + 0.05;
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    osc3.stop(stopTime);
    vibrato.stop(stopTime);
  }
}

export const guruVocalService = new GuruVocalService();
