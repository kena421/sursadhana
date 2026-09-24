import React, { useState, useEffect } from 'react';
import { CheckCircle, Sparkles, RefreshCw } from 'lucide-react';
import type { RootNoteName, DetectedPitch } from '../types/music';
import { NOTE_NAMES, INDIAN_NOTE_NAMES, getRootFrequency } from '../utils/pitchMath';

interface ScaleCalibratorProps {
  currentPitch: DetectedPitch | null;
  onApplyScale: (note: RootNoteName, octave: number) => void;
  onClose: () => void;
}

export const ScaleCalibrator: React.FC<ScaleCalibratorProps> = ({
  currentPitch,
  onApplyScale,
  onClose,
}) => {
  const [step, setStep] = useState<'low' | 'high' | 'result'>('low');
  const [lowFreq, setLowFreq] = useState<number | null>(null);
  const [highFreq, setHighFreq] = useState<number | null>(null);
  const [sampledNotes, setSampledNotes] = useState<number[]>([]);

  // Capture stable frequencies for current step
  useEffect(() => {
    if (!currentPitch || step === 'result') return;

    if (currentPitch.clarity > 0.85 && currentPitch.frequency > 50 && currentPitch.frequency < 1200) {
      setSampledNotes(prev => [...prev.slice(-15), currentPitch.frequency]);
    }
  }, [currentPitch, step]);

  const recordStepNote = () => {
    if (sampledNotes.length === 0) return;
    // Calculate median frequency
    const sorted = [...sampledNotes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    if (step === 'low') {
      setLowFreq(median);
      setSampledNotes([]);
      setStep('high');
    } else if (step === 'high') {
      setHighFreq(median);
      setStep('result');
    }
  };

  // Find best Sa: Typically 1/3 to 1/2 of the range from the lowest note (Madhya Sa)
  let recommendedNote: RootNoteName = 'C#';
  let recommendedOctave = 3;
  let recommendedFreq = 138.59;
  let voiceClassification = 'Male (Baritone/Tenor)';

  if (lowFreq && highFreq) {
    // Vocal center estimate: Sa is typically around 1.33x to 1.4x the lowest comfortable note
    const estimatedSa = lowFreq * 1.35;

    // Search for closest note in standard octaves
    let closestDiff = 9999;
    for (let oct = 2; oct <= 4; oct++) {
      for (const note of NOTE_NAMES) {
        const freq = getRootFrequency(note, oct);
        const diff = Math.abs(freq - estimatedSa);
        if (diff < closestDiff) {
          closestDiff = diff;
          recommendedNote = note;
          recommendedOctave = oct;
          recommendedFreq = freq;
        }
      }
    }

    if (recommendedOctave === 4 || (recommendedOctave === 3 && (recommendedNote === 'G' || recommendedNote === 'G#' || recommendedNote === 'A' || recommendedNote === 'B'))) {
      voiceClassification = 'Female (Soprano/Mezzo-Soprano) or High Voice';
    } else {
      voiceClassification = 'Male (Baritone/Tenor) or Low Voice';
    }
  }

  return (
    <div className="calibrator-card">
      <div className="calibrator-header">
        <div className="calibrator-title-row">
          <Sparkles className="sparkle-icon" size={22} />
          <div>
            <h3>Voice Range & Scale Finder (प्राकृतिक स्वर चयन)</h3>
            <p>Sing two comfortable notes to find your perfect Indian Classical <strong>Sa (आधार षड्ज)</strong>.</p>
          </div>
        </div>
      </div>

      {step === 'low' && (
        <div className="calibration-step-box">
          <div className="step-tag">Step 1 of 2: Lowest Note (मंद्र स्वर)</div>
          <p className="step-instruction">
            Hum or sing your <strong>lowest comfortable sustained note</strong> without straining.
          </p>

          <div className="current-sample-display">
            <span className="sample-label">Detected Pitch:</span>
            <span className="sample-value">
              {currentPitch ? `${currentPitch.frequency} Hz` : 'Listening for your voice...'}
            </span>
          </div>

          <div className="step-btn-row">
            <button
              className="confirm-step-btn"
              disabled={sampledNotes.length < 5}
              onClick={recordStepNote}
            >
              {sampledNotes.length >= 5 ? 'Confirm Lowest Note' : 'Sing a note into mic...'}
            </button>
          </div>
        </div>
      )}

      {step === 'high' && (
        <div className="calibration-step-box">
          <div className="step-tag">Step 2 of 2: Highest Note (तार स्वर)</div>
          <p className="step-instruction">
            Now sing your <strong>highest comfortable sustained note</strong> in full voice.
          </p>

          <div className="current-sample-display">
            <span className="sample-label">Detected Pitch:</span>
            <span className="sample-value">
              {currentPitch ? `${currentPitch.frequency} Hz` : 'Listening for your voice...'}
            </span>
          </div>

          <div className="step-btn-row">
            <button
              className="confirm-step-btn"
              disabled={sampledNotes.length < 5}
              onClick={recordStepNote}
            >
              {sampledNotes.length >= 5 ? 'Confirm Highest Note' : 'Sing highest note...'}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="calibration-result-box">
          <CheckCircle size={44} className="result-check" />
          <h4 className="result-title">Vocal Calibration Complete!</h4>

          <div className="recommended-sa-card">
            <span className="rec-label">Recommended Base Sa:</span>
            <div className="rec-note-highlight">
              <span className="rec-note">{recommendedNote}{recommendedOctave}</span>
              <span className="rec-indian">({INDIAN_NOTE_NAMES[recommendedNote]})</span>
            </div>
            <p className="rec-freq">{recommendedFreq.toFixed(1)} Hz • {voiceClassification}</p>
          </div>

          <p className="range-summary">
            Your vocal range spans from <strong>{lowFreq?.toFixed(0)} Hz</strong> to <strong>{highFreq?.toFixed(0)} Hz</strong>. This base Sa gives you optimal room to comfortably sing in both Mandra and Taar Saptaks.
          </p>

          <div className="result-actions">
            <button
              className="apply-sa-btn"
              onClick={() => {
                onApplyScale(recommendedNote, recommendedOctave);
                onClose();
              }}
            >
              Set as My Base Sa ({recommendedNote}{recommendedOctave})
            </button>
            <button
              className="restart-btn"
              onClick={() => {
                setStep('low');
                setLowFreq(null);
                setHighFreq(null);
                setSampledNotes([]);
              }}
            >
              <RefreshCw size={15} /> Retest
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
