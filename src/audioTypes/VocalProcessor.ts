/**
 * Voice Processor with Advanced Formant Tracking
 * Specialized processing for vocal audio with vibrato, formant enhancement,
 * and Indian classical ornament detection
 */

import { FFT } from '../algorithms/FFT';
import { YIN } from '../algorithms/YIN';
import { WindowFunctions } from '../utils/WindowFunctions';
import { MathUtils } from '../utils/MathUtils';
import { AudioFeatures } from './AutoDetector';

export interface VocalConfig {
  vibrato?: {
    detect: boolean;
    stabilize: boolean;
    range: [number, number]; // Hz
  };
  formants?: {
    enhance: boolean;
    track: boolean;
    count: number;
  };
  glissando?: {
    track: boolean;
    quantize: boolean;
    minDuration: number; // ms
  };
  ornaments?: {
    detectGamaka: boolean;
    detectMeend: boolean;
    detectKan: boolean;
  };
}

export interface VocalAnalysisResult {
  // Basic vocal characteristics
  fundamentalFrequency: number;
  confidence: number;
  
  // Formant information
  formants: FormantData[];
  vowelClassification: VowelClass;
  
  // Vibrato analysis
  vibrato: VibratoData;
  
  // Ornament detection (Indian classical)
  ornaments: OrnamentsData;
  
  // Voice quality metrics
  voiceQuality: {
    breathiness: number;
    roughness: number;
    brightness: number;
    strain: number;
  };
  
  // Glissando/Meend detection
  glissando: GlissandoData;
}

export interface FormantData {
  frequency: number;
  bandwidth: number;
  amplitude: number;
  confidence: number;
}

export interface VowelClass {
  vowel: 'a' | 'e' | 'i' | 'o' | 'u' | 'unknown';
  confidence: number;
  formantRatios: number[];
}

export interface VibratoData {
  present: boolean;
  rate: number;           // Hz (oscillations per second)
  extent: number;         // Cents (pitch variation)
  regularity: number;     // 0-1 (how regular the vibrato is)
  onset: number;          // ms (when vibrato starts)
}

export interface OrnamentsData {
  gamaka: GamakaData[];
  meend: MeendData | null;
  kan: KanData[];
}

export interface GamakaData {
  type: 'kampita' | 'nokku' | 'sphurita' | 'namita' | 'andolana';
  startTime: number;      // ms
  duration: number;       // ms
  frequency: number;      // Hz
  amplitude: number;      // 0-1
  confidence: number;     // 0-1
}

export interface MeendData {
  startFrequency: number; // Hz
  endFrequency: number;   // Hz
  duration: number;       // ms
  smoothness: number;     // 0-1
  confidence: number;     // 0-1
}

export interface KanData {
  frequency: number;      // Hz
  duration: number;       // ms (very short, typically < 50ms)
  position: number;       // ms (position in phrase)
  confidence: number;     // 0-1
}

export interface GlissandoData {
  present: boolean;
  startFrequency: number;
  endFrequency: number;
  duration: number;
  smoothness: number;
  direction: 'up' | 'down' | 'complex';
}

export class VocalProcessor {
  private fft: FFT;
  private yin: YIN;
  private sampleRate: number;
  private frameSize: number;
  private hopSize: number;
  private config: Required<VocalConfig>;
  
  // Internal state for tracking
  private pitchHistory: number[] = [];
  private formantHistory: FormantData[][] = [];
  private vibratoBuffer: number[] = [];
  
  constructor(config: { sampleRate?: number; frameSize?: number; [key: string]: any } = {}) {
    this.sampleRate = config.sampleRate ?? 44100;
    this.frameSize = config.frameSize ?? 2048;
    this.hopSize = config.frameSize ? Math.floor(config.frameSize / 4) : 512;
    
    this.config = {
      vibrato: {
        detect: true,
        stabilize: false,
        range: [3, 12] // Hz
      },
      formants: {
        enhance: true,
        track: true,
        count: 4
      },
      glissando: {
        track: true,
        quantize: false,
        minDuration: 100 // ms
      },
      ornaments: {
        detectGamaka: true,
        detectMeend: true,
        detectKan: true
      },
      ...config.vocalConfig || {}
    };
    
    this.fft = new FFT(this.frameSize, this.sampleRate);
    this.yin = new YIN(this.sampleRate);
  }
  
  /**
   * Process vocal audio buffer
   * @param buffer Audio buffer to process
   * @returns Vocal analysis result
   */
  public processVoice(buffer: Float32Array): VocalAnalysisResult {
    // Handle empty buffer
    if (buffer.length === 0) {
      return this.getDefaultVocalResult();
    }
    
    // Ensure buffer size matches FFT size
    let processedBuffer: Float32Array;
    if (buffer.length < this.frameSize) {
      // Zero-pad if too small
      processedBuffer = new Float32Array(this.frameSize);
      processedBuffer.set(buffer);
    } else if (buffer.length > this.frameSize) {
      // Truncate if too large
      processedBuffer = buffer.slice(0, this.frameSize);
    } else {
      processedBuffer = new Float32Array(buffer);
    }
    
    // Pre-process audio for vocal analysis
    processedBuffer = this.preProcessVocal(processedBuffer);
    
    // Extract fundamental frequency using YIN with fallback
    let pitchResult = this.yin.detectPitch(processedBuffer);
    
    // If YIN fails (common with test signals), use FFT-based pitch detection as fallback
    if (pitchResult.frequency === 0) {
      pitchResult = this.detectPitchFFT(processedBuffer);
    }
    
    // Track pitch history for ornament detection
    this.updatePitchHistory(pitchResult.frequency);
    
    // Extract and track formants
    const formants = this.extractFormants(processedBuffer);
    this.updateFormantHistory(formants);
    
    // Classify vowel based on formants
    const vowelClass = this.classifyVowel(formants);
    
    // Analyze vibrato
    const vibrato = this.analyzeVibrato(this.pitchHistory);
    
    // Detect ornaments (Indian classical)
    const ornaments = this.detectOrnaments(this.pitchHistory);
    
    // Analyze voice quality
    const voiceQuality = this.analyzeVoiceQuality(processedBuffer);
    
    // Detect glissando/meend
    const glissando = this.detectGlissando(this.pitchHistory);
    
    return {
      fundamentalFrequency: pitchResult.frequency,
      confidence: pitchResult.confidence,
      formants,
      vowelClassification: vowelClass,
      vibrato,
      ornaments,
      voiceQuality: {
        breathiness: voiceQuality.breathiness,
        roughness: voiceQuality.roughness,
        brightness: voiceQuality.brightness,
        strain: voiceQuality.strain || 0
      },
      glissando
    };
  }
  
  /**
   * Pre-process audio specifically for vocal analysis
   */
  private preProcessVocal(buffer: Float32Array): Float32Array {
    // Apply gentle high-pass filter to remove low-frequency noise
    const filtered = this.highPassFilter(buffer, 80); // Remove below 80Hz
    
    // Normalize amplitude
    const normalized = MathUtils.normalize(filtered);
    
    // Optional: Enhance formant regions
    if (this.config.formants.enhance) {
      return this.enhanceFormants(normalized);
    }
    
    return normalized;
  }
  
  /**
   * Extract formant frequencies and characteristics
   */
  private extractFormants(buffer: Float32Array): FormantData[] {
    // Apply window function
    const window = WindowFunctions.hann(buffer.length);
    const windowed = WindowFunctions.apply(buffer, window);
    
    // Compute FFT
    const { real, imag } = this.fft.forward(windowed);
    const magnitude = this.fft.getMagnitudeSpectrum(real, imag);
    
    // Pre-emphasize spectrum for formant detection
    const preEmphasized = this.preEmphasizeSpectrum(magnitude);
    
    // Find formant peaks
    return this.findFormantPeaks(preEmphasized);
  }
  
  /**
   * Find formant peaks in spectrum
   */
  private findFormantPeaks(spectrum: Float32Array): FormantData[] {
    const formants: FormantData[] = [];
    const binWidth = this.sampleRate / (2 * spectrum.length);
    
    // Expected formant frequency ranges for adult speakers
    const formantRanges = [
      { min: 200, max: 1000, name: 'F1' },   // First formant
      { min: 800, max: 3000, name: 'F2' },   // Second formant  
      { min: 1500, max: 4000, name: 'F3' },  // Third formant
      { min: 2500, max: 5000, name: 'F4' }   // Fourth formant
    ];
    
    for (const range of formantRanges.slice(0, this.config.formants.count)) {
      const minBin = Math.floor(range.min / binWidth);
      const maxBin = Math.min(Math.floor(range.max / binWidth), spectrum.length - 1);
      
      // Find the highest peak in this range
      const peak = this.findSpectralPeak(spectrum, minBin, maxBin);
      
      if (peak.magnitude > 0.1) { // Threshold for formant detection
        const formant: FormantData = {
          frequency: peak.frequency,
          bandwidth: this.estimateFormantBandwidth(spectrum, peak.bin, binWidth),
          amplitude: peak.magnitude,
          confidence: this.calculateFormantConfidence(spectrum, peak.bin)
        };
        
        formants.push(formant);
      }
    }
    
    return formants;
  }
  
  /**
   * Find spectral peak in given range
   */
  private findSpectralPeak(spectrum: Float32Array, minBin: number, maxBin: number): 
    { frequency: number; magnitude: number; bin: number } {
    
    let peakBin = minBin;
    let peakMag = spectrum[minBin];
    
    for (let i = minBin; i <= maxBin; i++) {
      if (spectrum[i] > peakMag) {
        peakMag = spectrum[i];
        peakBin = i;
      }
    }
    
    // Parabolic interpolation for more accurate frequency
    const refinedBin = this.parabolicInterpolation(spectrum, peakBin);
    const binWidth = this.sampleRate / (2 * spectrum.length);
    
    return {
      frequency: refinedBin * binWidth,
      magnitude: peakMag,
      bin: peakBin
    };
  }
  
  /**
   * Estimate formant bandwidth using spectral shape
   */
  private estimateFormantBandwidth(spectrum: Float32Array, peakBin: number, binWidth: number): number {
    const peakMag = spectrum[peakBin];
    const halfPower = peakMag * 0.707; // -3dB point
    
    // Find left and right -3dB points
    let leftBin = peakBin;
    let rightBin = peakBin;
    
    while (leftBin > 0 && spectrum[leftBin] > halfPower) {
      leftBin--;
    }
    
    while (rightBin < spectrum.length - 1 && spectrum[rightBin] > halfPower) {
      rightBin++;
    }
    
    return (rightBin - leftBin) * binWidth;
  }
  
  /**
   * Calculate confidence of formant detection
   */
  private calculateFormantConfidence(spectrum: Float32Array, peakBin: number): number {
    const peakMag = spectrum[peakBin];
    
    // Calculate signal-to-noise ratio in the vicinity
    const windowSize = 10;
    let noiseFloor = 0;
    let count = 0;
    
    for (let i = Math.max(0, peakBin - windowSize * 2); 
         i < Math.min(spectrum.length, peakBin + windowSize * 2); i++) {
      if (Math.abs(i - peakBin) > windowSize) {
        noiseFloor += spectrum[i];
        count++;
      }
    }
    
    noiseFloor = count > 0 ? noiseFloor / count : 0.001;
    const snr = peakMag / (noiseFloor + 0.001);
    
    return Math.min(1.0, snr / 10); // Normalize to 0-1
  }
  
  /**
   * Classify vowel based on formant frequencies
   */
  private classifyVowel(formants: FormantData[]): VowelClass {
    if (formants.length < 2) {
      return { vowel: 'unknown', confidence: 0, formantRatios: [] };
    }
    
    const f1 = formants[0].frequency;
    const f2 = formants[1].frequency;
    const f3 = formants.length > 2 ? formants[2].frequency : 0;
    
    // Vowel classification based on F1/F2 ratios (simplified)
    const vowelMap = [
      { vowel: 'i' as const, f1Range: [200, 400], f2Range: [2000, 3200] },
      { vowel: 'e' as const, f1Range: [300, 600], f2Range: [1800, 2600] },
      { vowel: 'a' as const, f1Range: [600, 1000], f2Range: [1000, 1800] },
      { vowel: 'o' as const, f1Range: [400, 800], f2Range: [600, 1200] },
      { vowel: 'u' as const, f1Range: [200, 400], f2Range: [600, 1200] }
    ];
    
    let bestMatch = { vowel: 'unknown' as const, confidence: 0 };
    
    for (const vowelDef of vowelMap) {
      const f1Match = f1 >= vowelDef.f1Range[0] && f1 <= vowelDef.f1Range[1];
      const f2Match = f2 >= vowelDef.f2Range[0] && f2 <= vowelDef.f2Range[1];
      
      if (f1Match && f2Match) {
        const confidence = this.calculateVowelConfidence(f1, f2, vowelDef);
        if (confidence > bestMatch.confidence) {
          bestMatch = { vowel: vowelDef.vowel, confidence };
        }
      }
    }
    
    return {
      vowel: bestMatch.vowel,
      confidence: bestMatch.confidence,
      formantRatios: [f2 / f1, f3 / f1].filter(r => r > 0)
    };
  }
  
  /**
   * Analyze vibrato characteristics
   */
  private analyzeVibrato(pitchHistory: number[]): VibratoData {
    if (pitchHistory.length < 50) { // Need enough history
      return {
        present: false,
        rate: 0,
        extent: 0,
        regularity: 0,
        onset: 0
      };
    }
    
    // Remove DC component and normalize
    const meanPitch = pitchHistory.reduce((sum, p) => sum + p, 0) / pitchHistory.length;
    const deviations = pitchHistory.map(p => p - meanPitch);
    
    // Detect periodicity using autocorrelation
    const vibratoData = this.detectVibratoPattern(deviations);
    
    if (!vibratoData.present) {
      return vibratoData;
    }
    
    // Calculate vibrato extent in cents
    const maxDeviation = Math.max(...deviations.map(Math.abs));
    const extent = (maxDeviation / meanPitch) * 1200; // Convert to cents
    
    // Calculate regularity (consistency of vibrato pattern)
    const regularity = this.calculateVibratoRegularity(deviations, vibratoData.rate);
    
    return {
      ...vibratoData,
      extent,
      regularity
    };
  }
  
  /**
   * Detect ornaments in Indian classical music
   */
  private detectOrnaments(pitchHistory: number[]): OrnamentsData {
    const gamaka = this.detectGamaka(pitchHistory);
    const meend = this.detectMeend(pitchHistory);
    const kan = this.detectKan(pitchHistory);
    
    return { gamaka, meend, kan };
  }
  
  /**
   * Detect Gamaka ornaments
   */
  private detectGamaka(pitchHistory: number[]): GamakaData[] {
    const gamakas: GamakaData[] = [];
    
    if (!this.config.ornaments.detectGamaka || pitchHistory.length < 20) {
      return gamakas;
    }
    
    const frameTime = this.hopSize / this.sampleRate * 1000; // ms per frame
    
    // Detect different types of gamakas
    for (let i = 0; i < pitchHistory.length - 10; i++) {
      const segment = pitchHistory.slice(i, i + 10);
      const gamakaType = this.classifyGamakaSegment(segment);
      
      if (gamakaType) {
        gamakas.push({
          type: gamakaType,
          startTime: i * frameTime,
          duration: 10 * frameTime,
          frequency: segment[Math.floor(segment.length / 2)],
          amplitude: this.calculateGamakaAmplitude(segment),
          confidence: this.calculateGamakaConfidence(segment, gamakaType)
        });
      }
    }
    
    return this.mergeOverlappingGamakas(gamakas);
  }
  
  /**
   * Detect Meend (glissando)
   */
  private detectMeend(pitchHistory: number[]): MeendData | null {
    if (!this.config.ornaments.detectMeend || pitchHistory.length < 30) {
      return null;
    }
    
    // Look for sustained pitch slides
    const minMeendFrames = Math.floor(this.config.glissando.minDuration / (this.hopSize / this.sampleRate * 1000));
    
    for (let i = 0; i < pitchHistory.length - minMeendFrames; i++) {
      const segment = pitchHistory.slice(i, i + minMeendFrames);
      const meendData = this.analyzeMeendSegment(segment);
      
      if (meendData && meendData.confidence > 0.7) {
        return {
          startFrequency: segment[0],
          endFrequency: segment[segment.length - 1],
          duration: minMeendFrames * (this.hopSize / this.sampleRate * 1000),
          smoothness: meendData.smoothness,
          confidence: meendData.confidence
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect Kan (grace notes)
   */
  private detectKan(pitchHistory: number[]): KanData[] {
    const kans: KanData[] = [];
    
    if (!this.config.ornaments.detectKan || pitchHistory.length < 10) {
      return kans;
    }
    
    const frameTime = this.hopSize / this.sampleRate * 1000; // ms per frame
    
    // Look for very brief pitch excursions (typical kan duration < 50ms)
    const maxKanFrames = Math.ceil(50 / frameTime);
    
    for (let i = 1; i < pitchHistory.length - maxKanFrames - 1; i++) {
      const before = pitchHistory[i - 1];
      const after = pitchHistory[i + maxKanFrames];
      
      // Check for brief excursion and return
      for (let duration = 1; duration <= maxKanFrames; duration++) {
        const kanNote = pitchHistory[i + Math.floor(duration / 2)];
        
        if (this.isKanPattern(before, kanNote, after)) {
          kans.push({
            frequency: kanNote,
            duration: duration * frameTime,
            position: i * frameTime,
            confidence: this.calculateKanConfidence(before, kanNote, after)
          });
          break;
        }
      }
    }
    
    return kans;
  }
  
  /**
   * Analyze voice quality metrics
   */
  private analyzeVoiceQuality(buffer: Float32Array): { breathiness: number; roughness: number; brightness: number; strain: number } {
    // Compute spectrum
    const window = WindowFunctions.hann(buffer.length);
    const windowed = WindowFunctions.apply(buffer, window);
    const { real, imag } = this.fft.forward(windowed);
    const magnitude = this.fft.getMagnitudeSpectrum(real, imag);
    
    // Breathiness: high-frequency noise content
    const breathiness = this.calculateBreathiness(magnitude);
    
    // Roughness: spectral irregularity and jitter
    const roughness = this.calculateRoughness(buffer, magnitude);
    
    // Brightness: spectral centroid and high-frequency emphasis
    const brightness = this.calculateBrightness(magnitude);
    
    // Strain: high-frequency emphasis and harmonic distortion
    const strain = this.calculateStrain(magnitude);
    
    return { breathiness, roughness, brightness, strain };
  }
  
  /**
   * Detect glissando patterns
   */
  private detectGlissando(pitchHistory: number[]): GlissandoData {
    if (pitchHistory.length < 20) {
      return {
        present: false,
        startFrequency: 0,
        endFrequency: 0,
        duration: 0,
        smoothness: 0,
        direction: 'up'
      };
    }
    
    // Analyze overall pitch trend
    const startPitch = pitchHistory[0];
    const endPitch = pitchHistory[pitchHistory.length - 1];
    const pitchChange = Math.abs(endPitch - startPitch);
    
    // Minimum pitch change threshold for glissando (in cents)
    const minGlissandoCents = 100;
    const changeInCents = (pitchChange / startPitch) * 1200;
    
    if (changeInCents < minGlissandoCents) {
      return {
        present: false,
        startFrequency: startPitch,
        endFrequency: endPitch,
        duration: 0,
        smoothness: 0,
        direction: endPitch > startPitch ? 'up' : 'down'
      };
    }
    
    // Calculate smoothness (how linear the pitch change is)
    const smoothness = this.calculateGlissandoSmoothness(pitchHistory);
    
    return {
      present: true,
      startFrequency: startPitch,
      endFrequency: endPitch,
      duration: pitchHistory.length * (this.hopSize / this.sampleRate * 1000),
      smoothness,
      direction: this.classifyGlissandoDirection(pitchHistory)
    };
  }
  
  // Helper methods
  
  private updatePitchHistory(pitch: number): void {
    this.pitchHistory.push(pitch);
    // Keep only recent history (last 2 seconds)
    const maxFrames = Math.floor(2 * this.sampleRate / this.hopSize);
    if (this.pitchHistory.length > maxFrames) {
      this.pitchHistory.shift();
    }
  }
  
  private updateFormantHistory(formants: FormantData[]): void {
    this.formantHistory.push(formants);
    // Keep only recent history
    const maxFrames = Math.floor(1 * this.sampleRate / this.hopSize);
    if (this.formantHistory.length > maxFrames) {
      this.formantHistory.shift();
    }
  }
  
  private highPassFilter(buffer: Float32Array, cutoffHz: number): Float32Array {
    // Simple first-order high-pass filter
    const alpha = cutoffHz / (cutoffHz + this.sampleRate / (2 * Math.PI));
    const filtered = new Float32Array(buffer.length);
    
    filtered[0] = buffer[0];
    for (let i = 1; i < buffer.length; i++) {
      filtered[i] = alpha * (filtered[i-1] + buffer[i] - buffer[i-1]);
    }
    
    return filtered;
  }
  
  private enhanceFormants(buffer: Float32Array): Float32Array {
    // Apply gentle emphasis to formant regions (300-3000 Hz)
    // This is a simplified implementation
    return buffer; // TODO: Implement formant enhancement
  }
  
  private preEmphasizeSpectrum(spectrum: Float32Array): Float32Array {
    // Pre-emphasis for formant detection (6dB/octave from 300Hz)
    const preEmphasized = new Float32Array(spectrum.length);
    const binWidth = this.sampleRate / (2 * spectrum.length);
    
    for (let i = 0; i < spectrum.length; i++) {
      const freq = i * binWidth;
      const emphasis = freq > 300 ? Math.sqrt(freq / 300) : 1.0;
      preEmphasized[i] = spectrum[i] * emphasis;
    }
    
    return preEmphasized;
  }
  
  private parabolicInterpolation(spectrum: Float32Array, peakBin: number): number {
    if (peakBin === 0 || peakBin === spectrum.length - 1) {
      return peakBin;
    }
    
    const y1 = spectrum[peakBin - 1];
    const y2 = spectrum[peakBin];
    const y3 = spectrum[peakBin + 1];
    
    const x0 = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
    return peakBin + x0;
  }
  
  private calculateVowelConfidence(f1: number, f2: number, vowelDef: any): number {
    const f1Center = (vowelDef.f1Range[0] + vowelDef.f1Range[1]) / 2;
    const f2Center = (vowelDef.f2Range[0] + vowelDef.f2Range[1]) / 2;
    
    const f1Error = Math.abs(f1 - f1Center) / f1Center;
    const f2Error = Math.abs(f2 - f2Center) / f2Center;
    
    return Math.max(0, 1 - (f1Error + f2Error) / 2);
  }
  
  private detectVibratoPattern(deviations: number[]): { present: boolean; rate: number; onset: number } {
    // Simplified vibrato detection using autocorrelation
    const minPeriod = 5;  // Minimum frames for vibrato period
    const maxPeriod = 25; // Maximum frames for vibrato period
    
    let bestPeriod = 0;
    let bestCorrelation = 0;
    
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < deviations.length - period; i++) {
        correlation += deviations[i] * deviations[i + period];
        count++;
      }
      
      correlation = count > 0 ? correlation / count : 0;
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    const isVibrato = bestCorrelation > 0.3 && bestPeriod > 0;
    const rate = isVibrato ? (this.sampleRate / this.hopSize) / bestPeriod : 0;
    
    return {
      present: isVibrato && rate >= this.config.vibrato.range[0] && rate <= this.config.vibrato.range[1],
      rate,
      onset: 0 // TODO: Implement vibrato onset detection
    };
  }
  
  private calculateVibratoRegularity(deviations: number[], rate: number): number {
    // Calculate how regular the vibrato pattern is
    if (rate === 0) return 0;
    
    const expectedPeriod = (this.sampleRate / this.hopSize) / rate;
    let regularity = 0;
    let count = 0;
    
    for (let i = 0; i < deviations.length - expectedPeriod * 2; i += Math.floor(expectedPeriod)) {
      const period1 = deviations.slice(i, i + Math.floor(expectedPeriod));
      const period2 = deviations.slice(i + Math.floor(expectedPeriod), i + Math.floor(expectedPeriod * 2));
      
      const correlation = this.calculateCorrelation(period1, period2);
      regularity += correlation;
      count++;
    }
    
    return count > 0 ? regularity / count : 0;
  }
  
  private calculateCorrelation(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    const meanA = a.reduce((sum, val) => sum + val, 0) / a.length;
    const meanB = b.reduce((sum, val) => sum + val, 0) / b.length;
    
    let numerator = 0;
    let denomA = 0;
    let denomB = 0;
    
    for (let i = 0; i < a.length; i++) {
      const devA = a[i] - meanA;
      const devB = b[i] - meanB;
      numerator += devA * devB;
      denomA += devA * devA;
      denomB += devB * devB;
    }
    
    const denominator = Math.sqrt(denomA * denomB);
    return denominator > 0 ? numerator / denominator : 0;
  }
  
  private classifyGamakaSegment(segment: number[]): GamakaData['type'] | null {
    // Simplified gamaka classification based on pitch patterns
    const mean = segment.reduce((sum, p) => sum + p, 0) / segment.length;
    const deviations = segment.map(p => p - mean);
    const maxDev = Math.max(...deviations.map(Math.abs));
    
    // Kampita: oscillation around a note
    if (this.isOscillationPattern(deviations)) {
      return 'kampita';
    }
    
    // Andolana: wide oscillation
    if (maxDev > mean * 0.05) { // > 5% pitch variation
      return 'andolana';
    }
    
    return null;
  }
  
  private isOscillationPattern(deviations: number[]): boolean {
    let crossings = 0;
    for (let i = 1; i < deviations.length; i++) {
      if ((deviations[i] >= 0) !== (deviations[i-1] >= 0)) {
        crossings++;
      }
    }
    return crossings >= 4; // At least 2 full oscillations
  }
  
  private calculateGamakaAmplitude(segment: number[]): number {
    const mean = segment.reduce((sum, p) => sum + p, 0) / segment.length;
    const maxDev = Math.max(...segment.map(p => Math.abs(p - mean)));
    return maxDev / mean;
  }
  
  private calculateGamakaConfidence(segment: number[], type: GamakaData['type']): number {
    // Simple confidence based on pattern consistency
    return 0.8; // TODO: Implement proper confidence calculation
  }
  
  private mergeOverlappingGamakas(gamakas: GamakaData[]): GamakaData[] {
    // TODO: Implement overlapping gamaka merging
    return gamakas;
  }
  
  private analyzeMeendSegment(segment: number[]): { smoothness: number; confidence: number } | null {
    // Check for smooth pitch transition
    const totalChange = Math.abs(segment[segment.length - 1] - segment[0]);
    if (totalChange < segment[0] * 0.05) return null; // Less than 5% change
    
    // Calculate smoothness (linearity of pitch change)
    const smoothness = this.calculateGlissandoSmoothness(segment);
    
    return {
      smoothness,
      confidence: smoothness > 0.7 ? 0.8 : 0.4
    };
  }
  
  private isKanPattern(before: number, kan: number, after: number): boolean {
    const threshold = before * 0.02; // 2% pitch change threshold
    const kanDeviation = Math.abs(kan - before);
    const returnDeviation = Math.abs(after - before);
    
    return kanDeviation > threshold && returnDeviation < threshold;
  }
  
  private calculateKanConfidence(before: number, kan: number, after: number): number {
    const kanSize = Math.abs(kan - before) / before;
    const returnAccuracy = 1 - Math.abs(after - before) / before;
    
    return Math.min(1.0, kanSize * 10 * returnAccuracy);
  }
  
  private calculateBreathiness(magnitude: Float32Array): number {
    // Measure high-frequency noise content relative to harmonics
    const totalEnergy = magnitude.reduce((sum, m) => sum + m * m, 0);
    const highFreqStart = Math.floor(magnitude.length * 0.7);
    let highFreqEnergy = 0;
    
    for (let i = highFreqStart; i < magnitude.length; i++) {
      highFreqEnergy += magnitude[i] * magnitude[i];
    }
    
    return totalEnergy > 0 ? Math.min(1.0, highFreqEnergy / totalEnergy * 3) : 0;
  }
  
  private calculateRoughness(buffer: Float32Array, magnitude: Float32Array): number {
    // Measure jitter and shimmer (simplified)
    // This would require more sophisticated analysis in a full implementation
    const zcr = this.calculateZeroCrossingRate(buffer);
    return Math.min(1.0, zcr / 0.5); // Normalize based on expected range
  }
  
  private calculateBrightness(magnitude: Float32Array): number {
    // Calculate spectral centroid as measure of brightness
    let weightedSum = 0;
    let totalPower = 0;
    const binWidth = this.sampleRate / (2 * magnitude.length);
    
    for (let i = 0; i < magnitude.length; i++) {
      const freq = i * binWidth;
      const power = magnitude[i] * magnitude[i];
      weightedSum += freq * power;
      totalPower += power;
    }
    
    const centroid = totalPower > 0 ? weightedSum / totalPower : 0;
    return Math.min(1.0, centroid / 2000); // Normalize to 0-1
  }
  
  private calculateStrain(magnitude: Float32Array): number {
    // Calculate strain based on high-frequency emphasis and harmonic distortion
    const binWidth = this.sampleRate / (2 * magnitude.length);
    let highFreqPower = 0;
    let totalPower = 0;
    let harmonicDistortion = 0;
    
    for (let i = 0; i < magnitude.length; i++) {
      const freq = i * binWidth;
      const power = magnitude[i] * magnitude[i];
      totalPower += power;
      
      // High frequency emphasis (above 2kHz indicates strain)
      if (freq > 2000) {
        highFreqPower += power;
      }
      
      // Check for harmonic distortion (irregular harmonics)
      if (i > 0 && freq > 400) {
        const prevPower = magnitude[i-1] * magnitude[i-1];
        const powerRatio = power / (prevPower + 1e-10);
        if (powerRatio > 2.0 || powerRatio < 0.5) {
          harmonicDistortion += Math.abs(Math.log(powerRatio));
        }
      }
    }
    
    const highFreqRatio = totalPower > 0 ? highFreqPower / totalPower : 0;
    const normalizedDistortion = Math.min(1.0, harmonicDistortion / magnitude.length);
    
    return Math.min(1.0, (highFreqRatio * 0.7) + (normalizedDistortion * 0.3));
  }
  
  private calculateZeroCrossingRate(buffer: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0) !== (buffer[i-1] >= 0)) {
        crossings++;
      }
    }
    return crossings / buffer.length;
  }
  
  private calculateGlissandoSmoothness(pitchHistory: number[]): number {
    if (pitchHistory.length < 3) return 0;
    
    // Calculate how linear the pitch change is
    const startPitch = pitchHistory[0];
    const endPitch = pitchHistory[pitchHistory.length - 1];
    const expectedSlope = (endPitch - startPitch) / (pitchHistory.length - 1);
    
    let smoothness = 0;
    for (let i = 1; i < pitchHistory.length; i++) {
      const expectedPitch = startPitch + expectedSlope * i;
      const deviation = Math.abs(pitchHistory[i] - expectedPitch);
      const relativeDeviation = deviation / Math.abs(endPitch - startPitch);
      smoothness += 1 - Math.min(1, relativeDeviation * 5);
    }
    
    return smoothness / (pitchHistory.length - 1);
  }
  
  private classifyGlissandoDirection(pitchHistory: number[]): 'up' | 'down' | 'complex' {
    const startPitch = pitchHistory[0];
    const endPitch = pitchHistory[pitchHistory.length - 1];
    
    // Check for simple up/down movement
    if (endPitch > startPitch * 1.05) return 'up';
    if (endPitch < startPitch * 0.95) return 'down';
    
    // Analyze for complex patterns
    let upChanges = 0;
    let downChanges = 0;
    
    for (let i = 1; i < pitchHistory.length; i++) {
      if (pitchHistory[i] > pitchHistory[i-1]) upChanges++;
      if (pitchHistory[i] < pitchHistory[i-1]) downChanges++;
    }
    
    if (upChanges > downChanges * 2) return 'up';
    if (downChanges > upChanges * 2) return 'down';
    
    return 'complex';
  }
  
  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<VocalConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current configuration
   */
  public getConfig(): Required<VocalConfig> {
    return { ...this.config };
  }
  
  /**
   * Reset internal state
   */
  public reset(): void {
    this.pitchHistory = [];
    this.formantHistory = [];
    this.vibratoBuffer = [];
  }
  
  /**
   * Get default vocal result for empty/invalid buffers
   */
  private getDefaultVocalResult(): VocalAnalysisResult {
    return {
      fundamentalFrequency: 0,
      confidence: 0,
      formants: [],
      vowelClassification: {
        vowel: 'unknown',
        confidence: 0,
        isDiphthong: false
      },
      vibrato: {
        present: false,
        rate: 0,
        depth: 0,
        regularity: 0
      },
      ornaments: {
        gamaka: {
          detected: false,
          type: 'none',
          amplitude: 0,
          rate: 0,
          confidence: 0
        },
        meend: {
          detected: false,
          startFrequency: 0,
          endFrequency: 0,
          duration: 0,
          smoothness: 0
        },
        kan: {
          detected: false,
          duration: 0,
          interval: 0,
          confidence: 0
        }
      },
      voiceQuality: {
        breathiness: 0,
        roughness: 0,
        brightness: 0,
        strain: 0
      },
      glissando: {
        detected: false,
        startTime: 0,
        endTime: 0,
        startFrequency: 0,
        endFrequency: 0,
        smoothness: 0
      }
    };
  }
  
  /**
   * FFT-based pitch detection as fallback when YIN fails
   * Simple but effective for test signals
   */
  private detectPitchFFT(buffer: Float32Array): { frequency: number; confidence: number } {
    // Basic error checking
    if (buffer.length === 0 || !this.fft) {
      return { frequency: 0, confidence: 0 };
    }
    
    try {
      // Apply window function to reduce spectral leakage
      const windowed = new Float32Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (buffer.length - 1)); // Hamming window
        windowed[i] = buffer[i] * w;
      }
      
      // Perform FFT
      const spectrum = this.fft.forward(windowed);
      if (!spectrum || spectrum.length === 0) {
        return { frequency: 0, confidence: 0 };
      }
      
      const magnitudes = new Float32Array(spectrum.length / 2);
    
    // Calculate magnitude spectrum
    for (let i = 0; i < magnitudes.length; i++) {
      const real = spectrum[2 * i];
      const imag = spectrum[2 * i + 1];
      magnitudes[i] = Math.sqrt(real * real + imag * imag);
    }
    
    // Find peak in the vocal range (80-800 Hz for typical voices)
    const nyquist = this.sampleRate / 2;
    const binFreqResolution = nyquist / magnitudes.length;
    const minBin = Math.max(1, Math.floor(80 / binFreqResolution));
    const maxBin = Math.min(magnitudes.length - 1, Math.floor(800 / binFreqResolution));
    
    let peakBin = minBin;
    let peakMagnitude = magnitudes[minBin];
    
    for (let i = minBin; i < Math.min(maxBin, magnitudes.length); i++) {
      if (magnitudes[i] > peakMagnitude) {
        peakMagnitude = magnitudes[i];
        peakBin = i;
      }
    }
    
    // Convert bin to frequency
    const frequency = peakBin * binFreqResolution;
    
    // Calculate confidence based on peak prominence
    const avgMagnitude = magnitudes.slice(minBin, maxBin).reduce((sum, val) => sum + val, 0) / (maxBin - minBin);
    const confidence = Math.min(1.0, peakMagnitude / (avgMagnitude + 1e-10));
    
    // Return 0 if confidence is too low or frequency is unreasonable
    if (confidence < 0.3 || frequency < 50 || frequency > 1000) {
      return { frequency: 0, confidence: 0 };
    }
    
    return { frequency, confidence };
    } catch (error) {
      // If FFT fails, return 0
      return { frequency: 0, confidence: 0 };
    }
  }
}

export default VocalProcessor;