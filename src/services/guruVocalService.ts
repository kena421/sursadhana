import { getSwaraTargetFrequency } from '../utils/pitchMath';
import type { LessonNote } from '../types/music';

export type NoteDemonstrationCallback = (noteIdx: number, note: LessonNote | null) => void;
export type AudioLevelCallback = (level: number) => void;
export type VoiceTimbre = 'male_vocal' | 'female_vocal' | 'bansuri' | 'harmonium';

class GuruVocalService {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isDemonstrating: boolean = false;
  private currentTimeoutIds: number[] = [];
  private onNoteCallbacks: Set<NoteDemonstrationCallback> = new Set();
  private onLevelCallbacks: Set<AudioLevelCallback> = new Set();
  private animFrameId: number | null = null;
  private voiceTimbre: VoiceTimbre = 'male_vocal';

  public setVoiceTimbre(timbre: VoiceTimbre) {
    this.voiceTimbre = timbre;
  }

  public getVoiceTimbre(): VoiceTimbre {
    return this.voiceTimbre;
  }

  public subscribeNote(cb: NoteDemonstrationCallback): () => void {
    this.onNoteCallbacks.add(cb);
    return () => {
      this.onNoteCallbacks.delete(cb);
    };
  }

  public subscribeAudioLevel(cb: AudioLevelCallback): () => void {
    this.onLevelCallbacks.add(cb);
    return () => {
      this.onLevelCallbacks.delete(cb);
    };
  }

  public getAudioLevel(): number {
    if (!this.analyser || !this.isDemonstrating) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const val = (data[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / data.length);
    return Math.min(1, rms * 5.0);
  }

  private startLevelMonitoring() {
    if (this.animFrameId !== null) return;
    const update = () => {
      if (this.isDemonstrating) {
        const level = this.getAudioLevel();
        this.onLevelCallbacks.forEach(cb => cb(level));
        this.animFrameId = requestAnimationFrame(update);
      } else {
        this.onLevelCallbacks.forEach(cb => cb(0));
        this.animFrameId = null;
      }
    };
    this.animFrameId = requestAnimationFrame(update);
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

      if (!this.analyser) {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.5;
        this.analyser.connect(this.audioCtx.destination);
      }

      this.isDemonstrating = true;
      this.startLevelMonitoring();

      let cumulativeTimeMs = initialDelayMs;

      notes.forEach((note, idx) => {
        // Visual callback when note begins
        const noteStartTimeout = window.setTimeout(() => {
          if (!this.isDemonstrating) return;
          this.onNoteCallbacks.forEach(cb => cb(idx, note));
        }, cumulativeTimeMs);
        this.currentTimeoutIds.push(noteStartTimeout);

        // Vocal synthesis
        const audioPlayTimeout = window.setTimeout(() => {
          if (!this.isDemonstrating || !this.audioCtx) return;
          this.synthesizeHumanVoice(note.swaraId, baseSaFrequency, note.durationSec);
        }, cumulativeTimeMs);
        this.currentTimeoutIds.push(audioPlayTimeout);

        cumulativeTimeMs += note.durationSec * 1000 + gapMs;
      });

      // Completion callback
      const completeTimeout = window.setTimeout(() => {
        if (!this.isDemonstrating) return;
        this.isDemonstrating = false;
        this.onNoteCallbacks.forEach(cb => cb(-1, null));
        this.onLevelCallbacks.forEach(cb => cb(0));
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
    this.onLevelCallbacks.forEach(cb => cb(0));
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public isPlaying(): boolean {
    return this.isDemonstrating;
  }

  /**
   * Synthesize an authentic acoustic human singing voice using Fant/Klatt vocal tract formant modeling
   */
  private synthesizeHumanVoice(swaraId: string, baseSaFrequency: number, durationSec: number) {
    if (!this.audioCtx || !this.analyser) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const freq = getSwaraTargetFrequency(swaraId, baseSaFrequency, 'just');

    // 1. Master Vocal Volume & Dynamic Envelope
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    // Smooth natural breath swell (140ms attack)
    masterGain.gain.exponentialRampToValueAtTime(0.42, now + 0.14);
    masterGain.gain.setValueAtTime(0.40, now + durationSec - 0.22);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    // 2. Glottal Pulse Generator (Human vocal cord excitation)
    // Human vocal cords produce a rich harmonic spectrum with -12dB/octave glottal slope
    const glottalGain = ctx.createGain();
    glottalGain.gain.value = 0.55;

    // Delayed natural human singing vibrato (starts after 0.5s at 5.1Hz, depth ~14 cents)
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 5.1;
    vibratoGain.gain.setValueAtTime(0.0001, now);
    vibratoGain.gain.linearRampToValueAtTime(freq * 0.012, now + 0.55); // ~14 cents vibrato depth
    vibrato.connect(vibratoGain);

    // Harmonic generator (simulating vocal cord periodic pulses)
    const fundamental = ctx.createOscillator();
    fundamental.type = 'sawtooth';
    fundamental.frequency.setValueAtTime(freq, now);
    vibratoGain.connect(fundamental.frequency);

    // Subtle pitch scoop into the note (natural human vocal onset glide: 25 cents up)
    fundamental.frequency.setValueAtTime(freq * 0.985, now);
    fundamental.frequency.exponentialRampToValueAtTime(freq, now + 0.12);

    // Lowpass filter to shape sawtooth into smooth glottal flow wave
    const glottalShaper = ctx.createBiquadFilter();
    glottalShaper.type = 'lowpass';
    glottalShaper.frequency.setValueAtTime(freq * 6.5, now);

    fundamental.connect(glottalShaper);
    glottalShaper.connect(glottalGain);

    // 3. Human Vocal Formant Filter Bank (Oral & Pharyngeal tract resonances)
    // Formant values customized for vowel phonetics:
    // "Saa", "Paa", "Gaa", "Dhaa" -> open /a/ vowel (720Hz, 1240Hz, 2500Hz, Singer's formant 3100Hz)
    // "Ree" -> /e/ vowel (500Hz, 1850Hz, 2550Hz, 3200Hz)
    // "Nii" -> /i/ vowel (320Hz, 2350Hz, 3000Hz)
    let f1Freq = 720;
    let f2Freq = 1240;
    let f3Freq = 2500;
    const f4SingerFreq = 3100; // Singer's Formant ("chhed/ring" in Hindustani classical voice)

    if (swaraId === 'r' || swaraId === 'R') {
      f1Freq = 500; f2Freq = 1850; f3Freq = 2550;
    } else if (swaraId === 'n' || swaraId === 'N') {
      f1Freq = 320; f2Freq = 2350; f3Freq = 3000;
    }

    if (this.voiceTimbre === 'female_vocal') {
      // Female vocal tract is ~15% shorter, raising formants
      f1Freq *= 1.18; f2Freq *= 1.18; f3Freq *= 1.15;
    }

    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'peaking';
    formant1.frequency.setValueAtTime(f1Freq, now);
    formant1.Q.value = 4.2;
    formant1.gain.value = 14;

    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'peaking';
    formant2.frequency.setValueAtTime(f2Freq, now);
    formant2.Q.value = 4.8;
    formant2.gain.value = 10;

    const formant3 = ctx.createBiquadFilter();
    formant3.type = 'peaking';
    formant3.frequency.setValueAtTime(f3Freq, now);
    formant3.Q.value = 5.5;
    formant3.gain.value = 6;

    const formant4Singer = ctx.createBiquadFilter();
    formant4Singer.type = 'peaking';
    formant4Singer.frequency.setValueAtTime(f4SingerFreq, now);
    formant4Singer.Q.value = 6.0;
    formant4Singer.gain.value = 9;

    glottalGain.connect(formant1);
    formant1.connect(formant2);
    formant2.connect(formant3);
    formant3.connect(formant4Singer);
    formant4Singer.connect(masterGain);

    // 4. Initial Consonant Phonetic Attack ("sss" for Sa, plosive for Pa, etc.)
    if (swaraId === 'S' || swaraId === 'S_taar') {
      // Unvoiced sibilant 's' burst (75ms noise bandpassed at 5500Hz)
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.4;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const sibilantFilter = ctx.createBiquadFilter();
      sibilantFilter.type = 'bandpass';
      sibilantFilter.frequency.setValueAtTime(5800, now);
      sibilantFilter.Q.value = 3.0;

      const sibilantGain = ctx.createGain();
      sibilantGain.gain.setValueAtTime(0.001, now);
      sibilantGain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      sibilantGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      noiseSource.connect(sibilantFilter);
      sibilantFilter.connect(sibilantGain);
      sibilantGain.connect(masterGain);
      noiseSource.start(now);
      noiseSource.stop(now + 0.09);
    }

    // Connect to Analyser for live visual level meter & audio output
    masterGain.connect(this.analyser);

    fundamental.start(now);
    vibrato.start(now);

    const stopTime = now + durationSec + 0.05;
    fundamental.stop(stopTime);
    vibrato.stop(stopTime);
  }
}

export const guruVocalService = new GuruVocalService();
