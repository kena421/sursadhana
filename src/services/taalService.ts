import { TAALS } from '../types/music';
import type { TaalDefinition, TaalMatra } from '../types/music';

export type BeatCallback = (matra: TaalMatra, totalMatras: number, bpm: number) => void;

class TaalService {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private timerId: number | null = null;

  private currentTaal: TaalDefinition = TAALS[0]; // Teental default
  private currentMatraIndex: number = 0;
  private bpm: number = 80;
  private volume: number = 0.8;
  private basePitchHz: number = 138.59; // Sa base for tuning Dayan drum

  private nextNoteTime: number = 0;
  private readonly lookaheadMs: number = 25.0; // how frequently to call scheduling (ms)
  private readonly scheduleAheadTime: number = 0.1; // how far ahead to schedule audio (sec)

  private onBeatCallbacks: Set<BeatCallback> = new Set();

  public subscribeBeat(callback: BeatCallback): () => void {
    this.onBeatCallbacks.add(callback);
    return () => {
      this.onBeatCallbacks.delete(callback);
    };
  }

  public setTaal(taalId: string) {
    const found = TAALS.find(t => t.id === taalId);
    if (found) {
      this.currentTaal = found;
      this.currentMatraIndex = 0;
      this.bpm = found.defaultBpm;
    }
  }

  public getTaal(): TaalDefinition {
    return this.currentTaal;
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(30, Math.min(260, newBpm));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.05);
    }
  }

  public setBasePitch(freq: number) {
    this.basePitchHz = freq;
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
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);

      this.isPlaying = true;
      this.currentMatraIndex = 0;
      this.nextNoteTime = this.audioCtx.currentTime + 0.05;

      this.scheduler();
      return true;
    } catch (err) {
      console.error('Failed to start Taal metronome:', err);
      this.stop();
      return false;
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.currentMatraIndex = 0;
  }

  public getPlayingState(): boolean {
    return this.isPlaying;
  }

  private scheduler = () => {
    if (!this.isPlaying || !this.audioCtx) return;

    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleBeat(this.currentMatraIndex, this.nextNoteTime);
      this.advanceMatra();
    }

    this.timerId = window.setTimeout(this.scheduler, this.lookaheadMs);
  };

  private advanceMatra() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentMatraIndex = (this.currentMatraIndex + 1) % this.currentTaal.totalMatras;
  }

  private scheduleBeat(matraIdx: number, time: number) {
    if (!this.audioCtx || !this.masterGain) return;

    const matraObj = this.currentTaal.matras[matraIdx];
    if (!matraObj) return;

    // Synthesize authentic Tabla sound according to bol
    this.playTablaBol(matraObj.bol, time, matraObj.type === 'sam');

    // Notify UI slightly ahead / synchronously with visual time
    const timeDeltaMs = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
    setTimeout(() => {
      if (this.isPlaying) {
        this.onBeatCallbacks.forEach(cb => cb(matraObj, this.currentTaal.totalMatras, this.bpm));
      }
    }, timeDeltaMs);
  }

  /**
   * Procedural Web Audio synthesis of Tabla bols
   */
  private playTablaBol(bol: string, time: number, isSam: boolean) {
    if (!this.audioCtx || !this.masterGain) return;

    const lowerBol = bol.toLowerCase();

    // 1. Bayan (Bass Drum) for Dha, Dhin, Ge, Dhi
    const hasBayan = ['dha', 'dhin', 'ge', 'ghi', 'dhi', 'dhe'].some(b => lowerBol.includes(b));
    if (hasBayan) {
      this.synthesizeBayan(time, isSam ? 1.2 : 1.0);
    }

    // 2. Dayan (Treble Drum) for Dha, Dhin, Tin, Ta, Na, Te, Dhi
    const hasDayanOpen = ['dha', 'dhin', 'tin', 'na', 'ta', 'tu', 'dhi', 'ti'].some(b => lowerBol.includes(b));
    if (hasDayanOpen) {
      const isHighRim = ['tin', 'ti'].some(b => lowerBol.includes(b));
      this.synthesizeDayan(time, isHighRim ? 1.3 : 1.0);
    }

    // 3. Muted / Slap stroke for Kat, Ke, Ka
    const isMuted = ['ke', 'ka', 'kat', 'te'].some(b => lowerBol.includes(b));
    if (isMuted) {
      this.synthesizeMutedSlap(time);
    }
  }

  /**
   * Bayan: deep resonant bass pitch dive (Gumki)
   */
  private synthesizeBayan(time: number, accent: number) {
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Classic Bayan downward glide
    const startFreq = 125 * accent;
    const endFreq = 68;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.18);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.7 * accent, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.38);
  }

  /**
   * Dayan: tuned singing harmonic strike (tuned to Sa)
   */
  private synthesizeDayan(time: number, harmonicPitchFactor: number) {
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    // Dayan pitch centered around 2x base Sa (octave 4)
    const baseDayanFreq = Math.min(600, Math.max(200, this.basePitchHz * 2 * harmonicPitchFactor));
    osc.frequency.setValueAtTime(baseDayanFreq * 1.08, time);
    osc.frequency.exponentialRampToValueAtTime(baseDayanFreq, time + 0.03);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseDayanFreq * 1.5, time);
    filter.Q.value = 5.0;

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.45, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  /**
   * Muted slap (Ke / Kat)
   */
  private synthesizeMutedSlap(time: number) {
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;

    // Filtered noise click
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 850;
    filter.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
  }
}

export const taalService = new TaalService();
