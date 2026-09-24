import type { TanpuraSettings } from '../types/music';

export type StringPluckCallback = (stringIndex: number) => void;

class TanpuraService {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private intervalId: number | null = null;
  private currentStringIndex: number = 0;

  private baseSaFrequency: number = 138.59; // C#3
  private settings: TanpuraSettings = {
    firstString: 'Pa',
    tempoSeconds: 2.8,
    fineTuneCents: 0,
    volume: 0.75,
    isPlaying: false,
  };

  private onPluckCallbacks: Set<StringPluckCallback> = new Set();

  public subscribePluck(callback: StringPluckCallback): () => void {
    this.onPluckCallbacks.add(callback);
    return () => {
      this.onPluckCallbacks.delete(callback);
    };
  }

  public updateConfig(baseSaFrequency: number, settings: Partial<TanpuraSettings>) {
    this.baseSaFrequency = baseSaFrequency;
    this.settings = { ...this.settings, ...settings };

    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.settings.volume, this.audioCtx.currentTime, 0.05);
    }
  }

  public getSettings(): TanpuraSettings {
    return { ...this.settings, isPlaying: this.isPlaying };
  }

  public async start(): Promise<boolean> {
    if (this.isPlaying) return true;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.settings.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);

      this.isPlaying = true;
      this.currentStringIndex = 0;

      // Start the plucking scheduler
      this.scheduleLoop();
      return true;
    } catch (err) {
      console.error('Failed to start Tanpura:', err);
      this.stop();
      return false;
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
      } catch { /* ignore */ }
    }
    this.onPluckCallbacks.forEach(cb => cb(-1));
  }

  private scheduleLoop() {
    if (!this.isPlaying) return;

    // Pluck the first string immediately
    this.pluckNextString();

    const intervalMs = (this.settings.tempoSeconds * 1000) / 4;
    this.intervalId = window.setInterval(() => {
      if (!this.isPlaying) {
        if (this.intervalId !== null) clearInterval(this.intervalId);
        return;
      }
      this.pluckNextString();
    }, intervalMs);
  }

  public setTempo(newTempoSeconds: number) {
    this.settings.tempoSeconds = newTempoSeconds;
    if (this.isPlaying) {
      if (this.intervalId !== null) clearInterval(this.intervalId);
      const intervalMs = (newTempoSeconds * 1000) / 4;
      this.intervalId = window.setInterval(() => {
        if (!this.isPlaying) return;
        this.pluckNextString();
      }, intervalMs);
    }
  }

  private pluckNextString() {
    if (!this.audioCtx || !this.masterGain) return;

    const stringIdx = this.currentStringIndex;
    this.onPluckCallbacks.forEach(cb => cb(stringIdx));

    // Calculate frequency for current string
    // Fine tune ratio: 2^(cents / 1200)
    const fineTuneMultiplier = Math.pow(2, this.settings.fineTuneCents / 1200);
    const tunedSa = this.baseSaFrequency * fineTuneMultiplier;

    let targetFreq = tunedSa;
    let detuneCents = 0;

    switch (stringIdx) {
      case 0: // 1st String: Pa (3/2), Ma (4/3), or Ni (15/8 / 2)
        if (this.settings.firstString === 'Pa') {
          targetFreq = tunedSa * (3 / 2);
        } else if (this.settings.firstString === 'Ma') {
          targetFreq = tunedSa * (4 / 3);
        } else {
          targetFreq = tunedSa * (15 / 16); // Mandra Ni
        }
        break;
      case 1: // 2nd String: Jodi Sa (Middle)
        targetFreq = tunedSa;
        detuneCents = -1.5; // subtle shimmer
        break;
      case 2: // 3rd String: Jodi Sa (Middle)
        targetFreq = tunedSa;
        detuneCents = +1.5; // subtle shimmer
        break;
      case 3: // 4th String: Kharaj Sa (Lower Octave)
        targetFreq = tunedSa * 0.5;
        break;
    }

    this.synthesizeTanpuraPluck(targetFreq, detuneCents);

    // Advance to next string (0 -> 1 -> 2 -> 3 -> 0)
    this.currentStringIndex = (this.currentStringIndex + 1) % 4;
  }

  /**
   * Synthesize acoustic tanpura string with rich jawari buzzing harmonics
   */
  private synthesizeTanpuraPluck(frequency: number, detuneCents: number) {
    if (!this.audioCtx || !this.masterGain) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const duration = 4.8; // long organic sustain

    // Pluck Gain Envelope
    const pluckGain = ctx.createGain();
    pluckGain.gain.setValueAtTime(0.0001, now);
    pluckGain.gain.exponentialRampToValueAtTime(0.28, now + 0.02); // quick pluck attack
    pluckGain.gain.exponentialRampToValueAtTime(0.12, now + 0.4); // body bloom
    pluckGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Jawari Resonant Peaking Filter (simulates curved bridge buzz)
    const jawariFilter = ctx.createBiquadFilter();
    jawariFilter.type = 'peaking';
    jawariFilter.frequency.setValueAtTime(frequency * 3.5, now);
    jawariFilter.frequency.exponentialRampToValueAtTime(frequency * 2.2, now + duration);
    jawariFilter.Q.value = 6.0;
    jawariFilter.gain.value = 8.0;

    // Warm Lowpass to emulate the hollow pumpkin tumba resonator
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(Math.min(3800, frequency * 8), now);
    bodyFilter.Q.value = 2.0;

    // Connect node chain: oscillators -> pluckGain -> jawariFilter -> bodyFilter -> masterGain
    pluckGain.connect(jawariFilter);
    jawariFilter.connect(bodyFilter);
    bodyFilter.connect(this.masterGain);

    // Harmonic Oscillators for rich overtone swirl
    // 1. Fundamental Triangle (warm foundation)
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(frequency, now);
    osc1.detune.setValueAtTime(detuneCents, now);

    // 2. Harmonic Sawtooth (provides rich partials for the jawari)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(frequency, now);
    osc2.detune.setValueAtTime(detuneCents + 2.5, now);

    // 3. Second harmonic (Pancham / Octave presence)
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(frequency * 2, now);
    osc3.detune.setValueAtTime(detuneCents - 2, now);

    const sawGain = ctx.createGain();
    sawGain.gain.value = 0.55;

    const sineGain = ctx.createGain();
    sineGain.gain.value = 0.35;

    osc1.connect(pluckGain);
    osc2.connect(sawGain);
    sawGain.connect(pluckGain);
    osc3.connect(sineGain);
    sineGain.connect(pluckGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  }
}

export const tanpuraService = new TanpuraService();
