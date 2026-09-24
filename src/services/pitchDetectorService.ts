import { PitchDetector } from 'pitchy';
import type { TuningSystem, DetectedPitch } from '../types/music';
import { mapFrequencyToSwara } from '../utils/pitchMath';

export type PitchCallback = (pitch: DetectedPitch | null) => void;
export type VolumeCallback = (volumePercent: number) => void;

class PitchDetectorService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private pitchDetector: PitchDetector<Float32Array> | null = null;
  private inputBuffer: Float32Array | null = null;
  private animFrameId: number | null = null;
  private isListening: boolean = false;

  private onPitchCallbacks: Set<PitchCallback> = new Set();
  private onVolumeCallbacks: Set<VolumeCallback> = new Set();

  private smoothedFrequency: number = 0;
  private baseSaFrequency: number = 138.59; // Default C#3
  private tuningSystem: TuningSystem = 'just';

  public updateConfig(baseSaFrequency: number, tuningSystem: TuningSystem) {
    this.baseSaFrequency = baseSaFrequency;
    this.tuningSystem = tuningSystem;
  }

  public subscribePitch(callback: PitchCallback): () => void {
    this.onPitchCallbacks.add(callback);
    return () => {
      this.onPitchCallbacks.delete(callback);
    };
  }

  public subscribeVolume(callback: VolumeCallback): () => void {
    this.onVolumeCallbacks.add(callback);
    return () => {
      this.onVolumeCallbacks.delete(callback);
    };
  }

  public async start(): Promise<boolean> {
    if (this.isListening) return true;

    try {
      // Create or resume AudioContext
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtxClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: true,
          noiseSuppression: false, // keep natural vocal harmonics
        },
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Setup Analyser
      const bufferSize = 2048;
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = bufferSize;
      this.sourceNode.connect(this.analyser);

      // Pitchy MPM detector
      this.pitchDetector = PitchDetector.forFloat32Array(bufferSize);
      this.pitchDetector.clarityThreshold = 0.8;
      this.pitchDetector.minVolumeDecibels = -45;

      this.inputBuffer = new Float32Array(bufferSize);
      this.isListening = true;

      this.processLoop();
      return true;
    } catch (err) {
      console.error('Failed to start microphone pitch detector:', err);
      this.stop();
      return false;
    }
  }

  public stop() {
    this.isListening = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* ignore */ }
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch { /* ignore */ }
      this.audioContext = null;
    }
    this.analyser = null;
    this.pitchDetector = null;
    this.inputBuffer = null;
    this.smoothedFrequency = 0;

    this.onPitchCallbacks.forEach(cb => cb(null));
    this.onVolumeCallbacks.forEach(cb => cb(0));
  }

  public getListeningState(): boolean {
    return this.isListening;
  }

  private processLoop = () => {
    if (!this.isListening || !this.analyser || !this.pitchDetector || !this.inputBuffer || !this.audioContext) {
      return;
    }

    this.analyser.getFloatTimeDomainData(this.inputBuffer as Float32Array<ArrayBuffer>);

    // Calculate RMS volume
    let sumSquares = 0;
    const len = this.inputBuffer.length;
    for (let i = 0; i < len; i++) {
      const val = this.inputBuffer[i];
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / len);
    const volumeDb = 20 * Math.log10(Math.max(rms, 1e-5));
    // Normalize volume to 0..100% for visual volume meter
    const volumePercent = Math.min(100, Math.max(0, (volumeDb + 55) * 2.2));
    this.onVolumeCallbacks.forEach(cb => cb(volumePercent));

    // Pitch detection with McLeod Pitch Method
    const [pitchHz, clarity] = this.pitchDetector.findPitch(this.inputBuffer, this.audioContext.sampleRate);

    if (pitchHz > 50 && pitchHz < 1500 && clarity > 0.8 && volumeDb > -45) {
      // Smooth frequency slightly using EMA (exponential moving average)
      if (this.smoothedFrequency === 0 || Math.abs(pitchHz - this.smoothedFrequency) > 50) {
        this.smoothedFrequency = pitchHz;
      } else {
        this.smoothedFrequency = this.smoothedFrequency * 0.4 + pitchHz * 0.6;
      }

      const detected = mapFrequencyToSwara(
        this.smoothedFrequency,
        this.baseSaFrequency,
        clarity,
        volumeDb,
        this.tuningSystem
      );

      this.onPitchCallbacks.forEach(cb => cb(detected));
    } else {
      this.smoothedFrequency = 0;
      this.onPitchCallbacks.forEach(cb => cb(null));
    }

    this.animFrameId = requestAnimationFrame(this.processLoop);
  };
}

export const pitchService = new PitchDetectorService();
