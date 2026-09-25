import { getSwaraTargetFrequency } from '../utils/pitchMath';
import type { LessonNote } from '../types/music';

export type NoteDemonstrationCallback = (noteIdx: number, note: LessonNote | null) => void;
export type AudioLevelCallback = (level: number) => void;
export type VoiceTimbre = 'classical_guru' | 'male_vocal' | 'female_vocal' | 'harmonium' | 'bansuri';

class GuruVocalService {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isDemonstrating: boolean = false;
  private currentTimeoutIds: number[] = [];
  private onNoteCallbacks: Set<NoteDemonstrationCallback> = new Set();
  private onLevelCallbacks: Set<AudioLevelCallback> = new Set();
  private animFrameId: number | null = null;
  private voiceTimbre: VoiceTimbre = 'classical_guru';
  private cachedGlottalWave: PeriodicWave | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();

  public async preloadSamples(ctx?: AudioContext): Promise<void> {
    const context = ctx || this.audioCtx;
    if (!context) return;
    const urls = [
      '/audio/vocals/real_guru_sa_long.mp3',
      '/audio/vocals/real_guru_female_sa_long.mp3',
    ];
    for (const url of urls) {
      if (!this.audioBufferCache.has(url)) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const arr = await resp.arrayBuffer();
            const decoded = await context.decodeAudioData(arr);
            this.audioBufferCache.set(url, decoded);
          }
        } catch { /* ignore */ }
      }
    }
  }

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
    return Math.min(1, rms * 5.5);
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

      await this.preloadSamples(this.audioCtx);

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
          this.synthesizeNote(note.swaraId, baseSaFrequency, note.durationSec);
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
   * Generates natural human vocal fold glottal flow wave (Liljencrants-Fant / Rosenberg model).
   * Warm acoustic harmonic spectrum decaying at natural -12dB/octave rate.
   * Completely avoids electronic buzzing synthesizer sounds.
   */
  private getGlottalPulseWave(ctx: AudioContext): PeriodicWave {
    if (this.cachedGlottalWave) return this.cachedGlottalWave;

    const nHarmonics = 36;
    const real = new Float32Array(nHarmonics);
    const imag = new Float32Array(nHarmonics);
    real[0] = 0;
    imag[0] = 0;

    for (let n = 1; n < nHarmonics; n++) {
      // Natural glottal pulse decay: strong fundamental, warm even/odd harmonics, rapid high rolloff
      const amp = (1.0 / Math.pow(n, 1.4)) * Math.exp(-n * 0.042);
      const phase = (n % 2 === 0 ? 0.35 : -0.35) * Math.PI;
      real[n] = amp * Math.cos(phase);
      imag[n] = amp * Math.sin(phase);
    }

    this.cachedGlottalWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    return this.cachedGlottalWave;
  }

  /**
   * Main synthesis router: Prioritizes real recorded human vocal samples with seamless tuning,
   * falling back to acoustic classical physical formant synthesis if samples are loading.
   */
  private synthesizeNote(swaraId: string, baseSaFrequency: number, durationSec: number) {
    if (this.voiceTimbre === 'bansuri') {
      this.synthesizeBansuri(swaraId, baseSaFrequency, durationSec);
    } else if (this.voiceTimbre === 'harmonium') {
      this.synthesizeHarmonium(swaraId, baseSaFrequency, durationSec);
    } else {
      // Prioritize playing authentic recorded classical Guru vocal sample!
      const played = this.playSampleNote(swaraId, baseSaFrequency, durationSec);
      if (!played) {
        if (this.voiceTimbre === 'classical_guru') {
          this.synthesizeClassicalGuru(swaraId, baseSaFrequency, durationSec);
        } else {
          this.synthesizeHumanVocalSyllable(swaraId, baseSaFrequency, durationSec);
        }
      }
    }
  }

  /**
   * Play Real Human Classical Vocal Sample with Seamless Web Audio Pitch-Tuning and Sustain:
   * 1. 100% Real human classical voice holding sustained Sa with Tanpura
   * 2. Dynamically pitch-shifted via source.playbackRate to match any root Sa (C, C#, D, etc.)
   * 3. Seamless loop sustain so it holds for any duration (4s, 6s, 8s, 10s, 12s, 16s)
   * 4. Natural breath gain envelope
   */
  private playSampleNote(swaraId: string, baseSaFrequency: number, durationSec: number): boolean {
    if (!this.audioCtx || !this.analyser) return false;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    let sampleUrl: string | null = null;
    let sampleRootFreq = 165.81; // Root frequency of the real recording (E3)

    if (swaraId === 'S' || swaraId === 'S_taar') {
      if (this.voiceTimbre === 'female_vocal') {
        sampleUrl = '/audio/vocals/real_guru_female_sa_long.mp3';
        sampleRootFreq = 232.1;
      } else {
        sampleUrl = '/audio/vocals/real_guru_sa_long.mp3';
        sampleRootFreq = 165.81;
      }
    }

    if (!sampleUrl) return false;

    const buffer = this.audioBufferCache.get(sampleUrl);
    if (!buffer) {
      this.preloadSamples(ctx);
      return false;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Pitch-shift to perfectly match user's chosen root Sa frequency
    const targetFreq = getSwaraTargetFrequency(swaraId, baseSaFrequency, 'just');
    source.playbackRate.value = targetFreq / sampleRootFreq;

    // Vowel body loop region so it can sustain smoothly for 4s, 6s, 8s, 10s, 16s!
    source.loop = true;
    source.loopStart = 1.0;
    source.loopEnd = Math.min(buffer.duration - 0.5, 10.5);

    // Natural breath gain envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.85, now + 0.18);
    gainNode.gain.setValueAtTime(0.82, now + Math.max(0.2, durationSec - 0.25));
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.08);

    source.connect(gainNode);
    gainNode.connect(this.analyser);

    source.start(now);
    source.stop(now + durationSec + 0.10);
    return true;
  }

  /**
   * Authentic Indian Classical Guru Voice (शास्त्रीय गुरु स्वर):
   * 1. Warm, soulful Aa-kaar (आकार) vocal fold glottal flow
   * 2. Four Hindustani classical vocal tract formants (F1-F4) + Singer's Formant (Chhed)
   * 3. Deep chest Kharaj cavity resonance (peaking at 185Hz)
   * 4. Acoustic Harmonium riyaz companion (Sur reed, Bhas reed, tremolo beating)
   * 5. Unwavering Sur Sthirata (rock-solid intonation across full duration)
   * 6. Soft, gentle breath sibilant attack (no harsh clicks)
   */
  private synthesizeClassicalGuru(swaraId: string, baseSaFrequency: number, durationSec: number) {
    if (!this.audioCtx || !this.analyser) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const freq = getSwaraTargetFrequency(swaraId, baseSaFrequency, 'just');

    // Master Bus for Guru Voice & Harmonium Bed
    const masterBus = ctx.createGain();
    masterBus.gain.setValueAtTime(0.0001, now);
    // Smooth, breathing natural vocal swell (160ms gentle onset)
    masterBus.gain.linearRampToValueAtTime(0.52, now + 0.16);
    // Unwavering, rock-solid hold all the way to end of duration
    masterBus.gain.setValueAtTime(0.50, now + Math.max(0.2, durationSec - 0.22));
    // Gentle natural breath release
    masterBus.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.08);

    // =========================================================================
    // 1. SOFT, NATURAL VOCAL ATTACK (Soft Dental Sibilant for Sa)
    // =========================================================================
    if (swaraId === 'S' || swaraId === 'S_taar') {
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.22;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.setValueAtTime(5400, now);
      bpFilter.Q.value = 2.0;

      const sibilantGain = ctx.createGain();
      sibilantGain.gain.setValueAtTime(0.0001, now);
      sibilantGain.gain.linearRampToValueAtTime(0.14, now + 0.02);
      sibilantGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

      noiseSource.connect(bpFilter);
      bpFilter.connect(sibilantGain);
      sibilantGain.connect(masterBus);

      noiseSource.start(now);
      noiseSource.stop(now + 0.06);
    }

    // =========================================================================
    // 2. GLOTTAL FLOW EXCITATION (Liljencrants-Fant Vocal Folds - NO SAWTOOTH!)
    // =========================================================================
    const glottalWave = this.getGlottalPulseWave(ctx);
    const vocalCords = ctx.createOscillator();
    vocalCords.setPeriodicWave(glottalWave);

    // Subtle 30ms breath onset landing rock-solid on pure Sur Sthirata
    vocalCords.frequency.setValueAtTime(freq * 0.995, now);
    vocalCords.frequency.linearRampToValueAtTime(freq, now + 0.035);

    const vocalGain = ctx.createGain();
    vocalGain.gain.setValueAtTime(0.0001, now);
    vocalGain.gain.linearRampToValueAtTime(0.68, now + 0.12);
    vocalGain.gain.setValueAtTime(0.65, now + Math.max(0.15, durationSec - 0.20));
    vocalGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.04);
    vocalCords.connect(vocalGain);

    // =========================================================================
    // 3. PARALLEL HINDUSTANI CLASSICAL VOCAL TRACT FORMANTS (Aa-kaar आकार)
    // =========================================================================
    const formantBus = ctx.createGain();
    formantBus.gain.value = 0.85;

    const formants = [
      { freq: 720, q: 5.5, gain: 1.0 },   // F1: Open pharynx Aa vowel cavity
      { freq: 1180, q: 6.2, gain: 0.75 }, // F2: Oral cavity
      { freq: 2520, q: 7.0, gain: 0.40 }, // F3: Singing resonance
      { freq: 3080, q: 8.0, gain: 0.46 }, // F4: Classical Singer's Formant (Chhed)
      { freq: 3950, q: 7.5, gain: 0.18 }, // F5: Brilliance
    ];

    formants.forEach(f => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f.freq, now);
      bp.Q.value = f.q;

      const g = ctx.createGain();
      g.gain.value = f.gain;

      vocalGain.connect(bp);
      bp.connect(g);
      g.connect(formantBus);
    });

    // Deep chest Kharaj warmth resonator
    const chestFilter = ctx.createBiquadFilter();
    chestFilter.type = 'peaking';
    chestFilter.frequency.setValueAtTime(185, now);
    chestFilter.Q.value = 1.8;
    chestFilter.gain.value = 4.0;

    formantBus.connect(chestFilter);
    chestFilter.connect(masterBus);

    // =========================================================================
    // 4. ACOUSTIC HARMONIUM RIYAZ COMPANION (Traditional Riyaz Bed)
    // =========================================================================
    const harmSur = ctx.createOscillator();
    harmSur.type = 'sawtooth';
    harmSur.frequency.setValueAtTime(freq, now);

    const harmBhas = ctx.createOscillator();
    harmBhas.type = 'sawtooth';
    harmBhas.frequency.setValueAtTime(freq * 0.5, now);

    const harmTremolo = ctx.createOscillator();
    harmTremolo.type = 'sawtooth';
    harmTremolo.frequency.setValueAtTime(freq + 0.35, now);

    const harmFilter = ctx.createBiquadFilter();
    harmFilter.type = 'lowpass';
    harmFilter.frequency.setValueAtTime(2000, now);
    harmFilter.Q.value = 1.1;

    const harmBody = ctx.createBiquadFilter();
    harmBody.type = 'peaking';
    harmBody.frequency.setValueAtTime(420, now);
    harmBody.gain.value = 4.5;

    const harmMixGain = ctx.createGain();
    harmMixGain.gain.setValueAtTime(0.0001, now);
    harmMixGain.gain.linearRampToValueAtTime(0.24, now + 0.14);
    harmMixGain.gain.setValueAtTime(0.22, now + Math.max(0.15, durationSec - 0.20));
    harmMixGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.05);

    harmSur.connect(harmFilter);
    harmBhas.connect(harmFilter);
    harmTremolo.connect(harmFilter);
    harmFilter.connect(harmBody);
    harmBody.connect(harmMixGain);
    harmMixGain.connect(masterBus);

    // =========================================================================
    // 5. LIVING BREATH AIR ASPIRATION
    // =========================================================================
    const breathBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * Math.min(durationSec, 8)), ctx.sampleRate);
    const breathData = breathBuf.getChannelData(0);
    for (let i = 0; i < breathData.length; i++) {
      breathData[i] = (Math.random() * 2 - 1) * 0.035;
    }
    const breathSrc = ctx.createBufferSource();
    breathSrc.buffer = breathBuf;
    breathSrc.loop = true;

    const breathLp = ctx.createBiquadFilter();
    breathLp.type = 'lowpass';
    breathLp.frequency.setValueAtTime(1400, now);

    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, now);
    breathGain.gain.linearRampToValueAtTime(0.016, now + 0.2);
    breathGain.gain.setValueAtTime(0.014, now + Math.max(0.15, durationSec - 0.2));
    breathGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    breathSrc.connect(breathLp);
    breathLp.connect(breathGain);
    breathGain.connect(masterBus);

    // Route master bus to VU meter analyser and audio destination
    masterBus.connect(this.analyser);

    // Start all sound generators
    vocalCords.start(now);
    harmSur.start(now);
    harmBhas.start(now);
    harmTremolo.start(now);
    breathSrc.start(now);

    const stopTime = now + durationSec + 0.08;
    vocalCords.stop(stopTime);
    harmSur.stop(stopTime);
    harmBhas.stop(stopTime);
    harmTremolo.stop(stopTime);
    breathSrc.stop(stopTime);
  }

  /**
   * Authentic Acoustic Human Singing Voice:
   * 1. Crisp initial consonant attack ("S" for Sa, "P" for Pa, "R" for Re)
   * 2. Glottal flow wave excitation (no buzzy sawtooth)
   * 3. Parallel acoustic vocal tract formant resonators (eliminating electronic buzz)
   * 4. Pure Sur Sthirata (rock-solid intonation, no wobbling electronic siren vibrato)
   * 5. Natural breath aspiration & throat warmth
   */
  private synthesizeHumanVocalSyllable(swaraId: string, baseSaFrequency: number, durationSec: number) {
    if (!this.audioCtx || !this.analyser) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const freq = getSwaraTargetFrequency(swaraId, baseSaFrequency, 'just');

    // Master Vocal Bus
    const masterVocalBus = ctx.createGain();
    masterVocalBus.gain.setValueAtTime(0.0001, now);
    // Smooth natural breath swell
    masterVocalBus.gain.linearRampToValueAtTime(0.48, now + 0.12);
    masterVocalBus.gain.setValueAtTime(0.46, now + durationSec - 0.18);
    masterVocalBus.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.05);

    // =========================================================================
    // 1. DISTINCT CONSONANT ARTICULATION (Hearing "S" for Sa, "P" for Pa, etc.)
    // =========================================================================
    if (swaraId === 'S' || swaraId === 'S_taar') {
      // Audible dental sibilant /s/ burst (120ms shaped noise)
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.6;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      // Dual-stage sibilant filter: highpass + bandpass at 6200Hz
      const hpFilter = ctx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.setValueAtTime(4200, now);

      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.setValueAtTime(6200, now);
      bpFilter.Q.value = 3.5;

      const sibilantGain = ctx.createGain();
      sibilantGain.gain.setValueAtTime(0.0001, now);
      sibilantGain.gain.linearRampToValueAtTime(0.42, now + 0.025);
      sibilantGain.gain.setValueAtTime(0.38, now + 0.08);
      sibilantGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.135);

      noiseSource.connect(hpFilter);
      hpFilter.connect(bpFilter);
      bpFilter.connect(sibilantGain);
      sibilantGain.connect(masterVocalBus);

      noiseSource.start(now);
      noiseSource.stop(now + 0.15);
    } else if (swaraId === 'P') {
      // Plosive /p/ burst (40ms low-mid labial pop)
      const popOsc = ctx.createOscillator();
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(220, now);
      popOsc.frequency.exponentialRampToValueAtTime(80, now + 0.04);

      const popGain = ctx.createGain();
      popGain.gain.setValueAtTime(0.35, now);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      popOsc.connect(popGain);
      popGain.connect(masterVocalBus);
      popOsc.start(now);
      popOsc.stop(now + 0.05);
    } else if (swaraId === 'r' || swaraId === 'R') {
      // Alveolar tap /r/
      const tapOsc = ctx.createOscillator();
      tapOsc.type = 'sine';
      tapOsc.frequency.setValueAtTime(450, now);
      tapOsc.frequency.exponentialRampToValueAtTime(freq, now + 0.05);

      const tapGain = ctx.createGain();
      tapGain.gain.setValueAtTime(0.28, now);
      tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      tapOsc.connect(tapGain);
      tapGain.connect(masterVocalBus);
      tapOsc.start(now);
      tapOsc.stop(now + 0.065);
    }

    // =========================================================================
    // 2. GLOTTAL FLOW EXCITATION (Natural vocal fold pulses - NO sawtooth!)
    // =========================================================================
    const glottalWave = this.getGlottalPulseWave(ctx);
    const vocalCords = ctx.createOscillator();
    vocalCords.setPeriodicWave(glottalWave);

    // Subtle 35ms breath onset scoop landing rock-solid on pure Sur
    vocalCords.frequency.setValueAtTime(freq * 0.99, now);
    vocalCords.frequency.linearRampToValueAtTime(freq, now + 0.045);

    // Vocal cord gain with natural onset crossfading right after the consonant
    const vocalCordGain = ctx.createGain();
    const vowelStartTime = (swaraId === 'S' || swaraId === 'S_taar') ? now + 0.06 : now;
    vocalCordGain.gain.setValueAtTime(0.0001, now);
    vocalCordGain.gain.linearRampToValueAtTime(0.65, vowelStartTime + 0.09);
    vocalCordGain.gain.setValueAtTime(0.65, now + durationSec - 0.15);
    vocalCordGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.02);

    vocalCords.connect(vocalCordGain);

    // =========================================================================
    // 3. PARALLEL BANDPASS FORMANT RESONATORS (Authentic Vocal Tract)
    // =========================================================================
    // Determine vowel formants:
    // "Sa", "Pa", "Ga", "Dha" -> /a/ open vowel
    // "Re" -> /e/ vowel
    // "Ni" -> /i/ vowel
    let f1 = 780;
    let f2 = 1260;
    let f3 = 2550;
    let f4 = 3150; // Singer's Formant / Chhed
    let f5 = 4100;

    let f1GainVal = 1.0;
    let f2GainVal = 0.68;
    let f3GainVal = 0.35;
    let f4GainVal = 0.48; // Crisp classical singer's presence
    let f5GainVal = 0.18;

    if (swaraId === 'r' || swaraId === 'R') {
      f1 = 520; f2 = 1880; f3 = 2650; f4 = 3250;
      f1GainVal = 0.95; f2GainVal = 0.72; f3GainVal = 0.35; f4GainVal = 0.42;
    } else if (swaraId === 'n' || swaraId === 'N') {
      f1 = 330; f2 = 2320; f3 = 3050; f4 = 3600;
      f1GainVal = 0.90; f2GainVal = 0.75; f3GainVal = 0.40; f4GainVal = 0.30;
    } else if (swaraId === 'm' || swaraId === 'M') {
      // Nasal pole + /a/ vowel
      f1 = 760; f2 = 1250; f3 = 2500; f4 = 3150;
    }

    if (this.voiceTimbre === 'female_vocal') {
      // Female vocal tract: ~18% higher formants
      f1 *= 1.18; f2 *= 1.18; f3 *= 1.16; f4 *= 1.15; f5 *= 1.15;
    }

    const formantSumBus = ctx.createGain();
    formantSumBus.gain.value = 0.9;

    // Helper to create bandpass formant filter
    const createFormant = (frequency: number, qVal: number, gainVal: number) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(frequency, now);
      bp.Q.value = qVal;

      const gain = ctx.createGain();
      gain.gain.value = gainVal;

      vocalCordGain.connect(bp);
      bp.connect(gain);
      gain.connect(formantSumBus);
    };

    // Parallel resonant formants
    createFormant(f1, 6.5, f1GainVal);
    createFormant(f2, 7.5, f2GainVal);
    createFormant(f3, 8.5, f3GainVal);
    createFormant(f4, 9.5, f4GainVal); // Singer's Formant
    createFormant(f5, 8.0, f5GainVal);

    // =========================================================================
    // 4. CHEST / MANDRA WARMTH RESONANCE (Chest Cavity)
    // =========================================================================
    const chestFilter = ctx.createBiquadFilter();
    chestFilter.type = 'peaking';
    chestFilter.frequency.setValueAtTime(this.voiceTimbre === 'female_vocal' ? 260 : 190, now);
    chestFilter.Q.value = 2.0;
    chestFilter.gain.value = 4.5;

    // =========================================================================
    // 5. NATURAL BREATH ASPIRATION NOISE (Air flowing through living throat)
    // =========================================================================
    const breathBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * Math.min(durationSec, 5)), ctx.sampleRate);
    const breathData = breathBuf.getChannelData(0);
    for (let i = 0; i < breathData.length; i++) {
      breathData[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const breathSource = ctx.createBufferSource();
    breathSource.buffer = breathBuf;
    breathSource.loop = true;

    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'lowpass';
    breathFilter.frequency.setValueAtTime(1800, now);

    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, now);
    breathGain.gain.linearRampToValueAtTime(0.026, now + 0.15);
    breathGain.gain.setValueAtTime(0.024, now + durationSec - 0.2);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    breathSource.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(masterVocalBus);

    // Connect Vocal Tract Bus -> Chest Filter -> Master Bus
    formantSumBus.connect(chestFilter);
    chestFilter.connect(masterVocalBus);

    // Route to Analyser for live VU level meter & speakers
    masterVocalBus.connect(this.analyser);

    // Start audio nodes
    vocalCords.start(now);
    breathSource.start(now);

    const stopTime = now + durationSec + 0.08;
    vocalCords.stop(stopTime);
    breathSource.stop(stopTime);
  }

  /**
   * Acoustic Harmonium Simulation (Dual-reed acoustic beating)
   */
  private synthesizeHarmonium(swaraId: string, baseSaFrequency: number, durationSec: number) {
    if (!this.audioCtx || !this.analyser) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const freq = getSwaraTargetFrequency(swaraId, baseSaFrequency, 'just');

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(0.40, now + 0.08);
    masterGain.gain.setValueAtTime(0.38, now + durationSec - 0.1);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.05);

    // Reed 1: Main pitch (Sur reed)
    const reed1 = ctx.createOscillator();
    reed1.type = 'sawtooth';
    reed1.frequency.setValueAtTime(freq, now);

    // Reed 2: Octave pitch (Bhas reed)
    const reed2 = ctx.createOscillator();
    reed2.type = 'sawtooth';
    reed2.frequency.setValueAtTime(freq * 0.5, now);

    // Reed 3: Slight detuned tremolo reed (+0.38 Hz) creating authentic acoustic harmonium beating
    const reed3 = ctx.createOscillator();
    reed3.type = 'sawtooth';
    reed3.frequency.setValueAtTime(freq + 0.38, now);

    // Harmonium wooden box filter (lowpass + warm box resonance)
    const boxFilter = ctx.createBiquadFilter();
    boxFilter.type = 'lowpass';
    boxFilter.frequency.setValueAtTime(2400, now);
    boxFilter.Q.value = 1.2;

    const boxResonance = ctx.createBiquadFilter();
    boxResonance.type = 'peaking';
    boxResonance.frequency.setValueAtTime(450, now);
    boxResonance.gain.value = 5.0;

    const r1Gain = ctx.createGain(); r1Gain.gain.value = 0.45;
    const r2Gain = ctx.createGain(); r2Gain.gain.value = 0.30;
    const r3Gain = ctx.createGain(); r3Gain.gain.value = 0.25;

    reed1.connect(r1Gain); r1Gain.connect(boxFilter);
    reed2.connect(r2Gain); r2Gain.connect(boxFilter);
    reed3.connect(r3Gain); r3Gain.connect(boxFilter);

    boxFilter.connect(boxResonance);
    boxResonance.connect(masterGain);
    masterGain.connect(this.analyser);

    reed1.start(now);
    reed2.start(now);
    reed3.start(now);

    const stopTime = now + durationSec + 0.08;
    reed1.stop(stopTime);
    reed2.stop(stopTime);
    reed3.stop(stopTime);
  }

  /**
   * Acoustic Bamboo Bansuri Simulation (Air breath chiff + cylindrical pipe resonance)
   */
  private synthesizeBansuri(swaraId: string, baseSaFrequency: number, durationSec: number) {
    if (!this.audioCtx || !this.analyser) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const freq = getSwaraTargetFrequency(swaraId, baseSaFrequency, 'just');

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.42, now + 0.10);
    masterGain.gain.setValueAtTime(0.40, now + durationSec - 0.12);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.05);

    // Pure bamboo fundamental
    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq, now);

    // 2nd and 3rd subtle flute harmonics
    const h2 = ctx.createOscillator();
    h2.type = 'sine';
    h2.frequency.setValueAtTime(freq * 2, now);
    const h2Gain = ctx.createGain();
    h2Gain.gain.value = 0.18;

    const h3 = ctx.createOscillator();
    h3.type = 'sine';
    h3.frequency.setValueAtTime(freq * 3, now);
    const h3Gain = ctx.createGain();
    h3Gain.gain.value = 0.08;

    // Breath chiff on attack (air blowing across embouchure hole)
    const chiffBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.09), ctx.sampleRate);
    const chiffData = chiffBuf.getChannelData(0);
    for (let i = 0; i < chiffData.length; i++) {
      chiffData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const chiffSource = ctx.createBufferSource();
    chiffSource.buffer = chiffBuf;

    const chiffFilter = ctx.createBiquadFilter();
    chiffFilter.type = 'bandpass';
    chiffFilter.frequency.setValueAtTime(freq * 3.5, now);
    chiffFilter.Q.value = 2.5;

    const chiffGain = ctx.createGain();
    chiffGain.gain.setValueAtTime(0.25, now);
    chiffGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    fundamental.connect(masterGain);
    h2.connect(h2Gain); h2Gain.connect(masterGain);
    h3.connect(h3Gain); h3Gain.connect(masterGain);

    chiffSource.connect(chiffFilter);
    chiffFilter.connect(chiffGain);
    chiffGain.connect(masterGain);

    masterGain.connect(this.analyser);

    fundamental.start(now);
    h2.start(now);
    h3.start(now);
    chiffSource.start(now);

    const stopTime = now + durationSec + 0.08;
    fundamental.stop(stopTime);
    h2.stop(stopTime);
    h3.stop(stopTime);
  }
}

export const guruVocalService = new GuruVocalService();
