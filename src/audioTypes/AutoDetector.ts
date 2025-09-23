/**
 * Universal Audio Type Detection System
 * Uses feature extraction and pattern recognition to identify audio sources
 */

import { FFT } from '../algorithms/FFT';
import { WindowFunctions } from '../utils/WindowFunctions';
import { MathUtils } from '../utils/MathUtils';

export interface AutoDetectorConfig {
  /** Sample rate of audio data */
  sampleRate?: number;
  
  /** Frame size for analysis */
  frameSize?: number;
  
  /** Confidence threshold for classification */
  confidenceThreshold?: number;
  
  /** Whether to enable voice detection */
  enableVoiceDetection?: boolean;
  
  /** Whether to enable instrument detection */
  enableInstrumentDetection?: boolean;
}

export interface AudioTypeResult {
  audioType: AudioType;
  confidence: number;
  subType?: string;
  features: AudioFeatures;
}

export type AudioType = 
  | 'voice' 
  | 'string'
  | 'keyboard' 
  | 'wind'
  | 'percussion'
  | 'unknown';

export interface AudioFeatures {
  // Spectral features
  spectralCentroid: number;
  spectralBandwidth: number;
  spectralRolloff: number;
  spectralFlux: number;
  
  // Harmonic features
  harmonicRatio: number;
  fundamentalStrength: number;
  harmonicComplexity: number;
  inharmonicity: number;
  
  // Temporal features
  attackTime: number;
  decayTime: number;
  sustainLevel: number;
  zeroCrossingRate: number;
  
  // Voice-specific features
  formantFrequencies?: number[];
  vibratoRate?: number;
  vibratoExtent?: number;
  breathiness?: number;
  
  // Instrument-specific features
  pluckiness?: number;
  bowingness?: number;
  breathiness_wind?: number;
  percussiveness?: number;
}

export interface InstrumentProfile {
  audioType: AudioType;
  confidenceThreshold: number;
  frequencyRange: [number, number];
  expectedFeatures: Partial<AudioFeatures>;
  indicators: string[];
}

export class AutoDetector {
  private fft: FFT;
  private sampleRate: number;
  private frameSize: number;
  private instrumentProfiles: Map<AudioType, InstrumentProfile>;
  private config: Required<AutoDetectorConfig>;
  
  constructor(config: AutoDetectorConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 44100,
      frameSize: config.frameSize ?? 2048,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      enableVoiceDetection: config.enableVoiceDetection ?? true,
      enableInstrumentDetection: config.enableInstrumentDetection ?? true
    };
    
    this.sampleRate = this.config.sampleRate;
    this.frameSize = this.config.frameSize;
    this.fft = new FFT(this.frameSize, this.sampleRate);
    this.instrumentProfiles = new Map();
    
    this.initializeInstrumentProfiles();
  }
  
  /**
   * Detect audio type from audio buffer
   * @param buffer Audio buffer to analyze
   * @returns Audio type classification result
   */
  public detectAudioType(buffer: Float32Array): AudioTypeResult {
    // Extract comprehensive features
    const features = this.extractFeatures(buffer);
    
    // Calculate confidence scores for each instrument type
    const scores = this.calculateConfidenceScores(features);
    
    // Find the best match
    const bestMatch = this.findBestMatch(scores);
    
    return {
      audioType: bestMatch.audioType,
      confidence: bestMatch.confidence,
      subType: bestMatch.subType,
      features
    };
  }
  
  /**
   * Extract comprehensive audio features
   * @param buffer Audio buffer
   * @returns Audio features object
   */
  private extractFeatures(buffer: Float32Array): AudioFeatures {
    // Apply window function
    const window = WindowFunctions.hann(buffer.length);
    const windowed = WindowFunctions.apply(buffer, window);
    
    // Compute FFT
    const { real, imag } = this.fft.forward(windowed);
    const magnitude = this.fft.getMagnitudeSpectrum(real, imag);
    const powerSpectrum = magnitude.map(m => m * m);
    
    // Extract spectral features
    const spectralFeatures = this.extractSpectralFeatures(powerSpectrum);
    
    // Extract harmonic features
    const harmonicFeatures = this.extractHarmonicFeatures(magnitude);
    
    // Extract temporal features
    const temporalFeatures = this.extractTemporalFeatures(buffer);
    
    // Extract specialized features
    const voiceFeatures = this.extractVoiceFeatures(magnitude, buffer);
    const instrumentFeatures = this.extractInstrumentFeatures(magnitude, buffer);
    
    return {
      ...spectralFeatures,
      ...harmonicFeatures,
      ...temporalFeatures,
      ...voiceFeatures,
      ...instrumentFeatures
    };
  }
  
  /**
   * Extract spectral features
   */
  private extractSpectralFeatures(powerSpectrum: Float32Array): Partial<AudioFeatures> {
    const freqBins = powerSpectrum.length;
    const binWidth = this.sampleRate / (2 * freqBins);
    
    // Spectral centroid (center of mass)
    let weightedSum = 0;
    let totalPower = 0;
    
    for (let i = 0; i < freqBins; i++) {
      const freq = i * binWidth;
      weightedSum += freq * powerSpectrum[i];
      totalPower += powerSpectrum[i];
    }
    
    const spectralCentroid = totalPower > 0 ? weightedSum / totalPower : 0;
    
    // Spectral bandwidth (spread around centroid)
    let variance = 0;
    for (let i = 0; i < freqBins; i++) {
      const freq = i * binWidth;
      const deviation = freq - spectralCentroid;
      variance += deviation * deviation * powerSpectrum[i];
    }
    const spectralBandwidth = totalPower > 0 ? Math.sqrt(variance / totalPower) : 0;
    
    // Spectral rolloff (95% of energy)
    const targetEnergy = totalPower * 0.95;
    let cumulativeEnergy = 0;
    let rolloffBin = 0;
    
    for (let i = 0; i < freqBins && cumulativeEnergy < targetEnergy; i++) {
      cumulativeEnergy += powerSpectrum[i];
      rolloffBin = i;
    }
    const spectralRolloff = rolloffBin * binWidth;
    
    // Spectral flux (change in spectrum)
    const spectralFlux = this.calculateSpectralFlux(powerSpectrum);
    
    return {
      spectralCentroid,
      spectralBandwidth,
      spectralRolloff,
      spectralFlux
    };
  }
  
  /**
   * Extract harmonic features
   */
  private extractHarmonicFeatures(magnitude: Float32Array): Partial<AudioFeatures> {
    const fundamental = this.findFundamentalFrequency(magnitude);
    const harmonics = this.findHarmonics(magnitude, fundamental);
    
    // Harmonic ratio (harmonic vs non-harmonic energy)
    const harmonicEnergy = harmonics.reduce((sum, h) => sum + h.magnitude, 0);
    const totalEnergy = magnitude.reduce((sum, m) => sum + m * m, 0);
    const harmonicRatio = totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
    
    // Fundamental strength
    const fundamentalStrength = harmonics.length > 0 ? harmonics[0].magnitude / totalEnergy : 0;
    
    // Harmonic complexity (deviation from perfect harmonic series)
    const harmonicComplexity = this.calculateHarmonicComplexity(harmonics, fundamental);
    
    // Inharmonicity (deviation from integer multiples)
    const inharmonicity = this.calculateInharmonicity(harmonics, fundamental);
    
    return {
      harmonicRatio,
      fundamentalStrength,
      harmonicComplexity,
      inharmonicity
    };
  }
  
  /**
   * Extract temporal features from time domain signal
   */
  private extractTemporalFeatures(buffer: Float32Array): Partial<AudioFeatures> {
    // Attack time (time to reach 90% of peak)
    const attackTime = this.calculateAttackTime(buffer);
    
    // Decay time (time to decay to 10% of peak)
    const decayTime = this.calculateDecayTime(buffer);
    
    // Sustain level (average level during sustain phase)
    const sustainLevel = this.calculateSustainLevel(buffer);
    
    // Zero crossing rate
    const zeroCrossingRate = this.calculateZeroCrossingRate(buffer);
    
    return {
      attackTime,
      decayTime,
      sustainLevel,
      zeroCrossingRate
    };
  }
  
  /**
   * Extract voice-specific features
   */
  private extractVoiceFeatures(magnitude: Float32Array, buffer: Float32Array): Partial<AudioFeatures> {
    const formantFrequencies = this.findFormants(magnitude);
    const vibrato = this.analyzeVibrato(buffer);
    const breathiness = this.calculateBreathiness(magnitude);
    
    return {
      formantFrequencies,
      vibratoRate: vibrato.rate,
      vibratoExtent: vibrato.extent,
      breathiness
    };
  }
  
  /**
   * Extract instrument-specific features
   */
  private extractInstrumentFeatures(magnitude: Float32Array, buffer: Float32Array): Partial<AudioFeatures> {
    const pluckiness = this.calculatePluckiness(buffer);
    const bowingness = this.calculateBowingness(buffer);
    const breathiness_wind = this.calculateWindBreathiness(magnitude);
    const percussiveness = this.calculatePercussiveness(buffer);
    
    return {
      pluckiness,
      bowingness,
      breathiness_wind,
      percussiveness
    };
  }
  
  /**
   * Calculate confidence scores for each instrument type
   */
  private calculateConfidenceScores(features: AudioFeatures): Map<AudioType, number> {
    const scores = new Map<AudioType, number>();
    
    for (const [audioType, profile] of this.instrumentProfiles) {
      const score = this.calculateProfileScore(features, profile);
      scores.set(audioType, score);
    }
    
    return scores;
  }
  
  /**
   * Calculate how well features match an instrument profile
   */
  private calculateProfileScore(features: AudioFeatures, profile: InstrumentProfile): number {
    let score = 0;
    let totalWeight = 0;
    
    // Spectral features weight
    if (features.spectralCentroid > 0) {
      const centroidScore = this.normalizeFeatureScore(
        features.spectralCentroid, 
        profile.expectedFeatures.spectralCentroid || 1000,
        500
      );
      score += centroidScore * 0.2;
      totalWeight += 0.2;
    }
    
    // Harmonic features weight
    if (features.harmonicRatio > 0) {
      const harmonicScore = Math.min(features.harmonicRatio, 1.0);
      score += harmonicScore * 0.3;
      totalWeight += 0.3;
    }
    
    // Temporal features weight
    if (features.attackTime > 0) {
      const attackScore = this.normalizeFeatureScore(
        features.attackTime,
        profile.expectedFeatures.attackTime || 0.1,
        0.05
      );
      score += attackScore * 0.2;
      totalWeight += 0.2;
    }
    
    // Type-specific features
    const typeScore = this.calculateTypeSpecificScore(features, profile.audioType);
    score += typeScore * 0.3;
    totalWeight += 0.3;
    
    return totalWeight > 0 ? score / totalWeight : 0;
  }
  
  /**
   * Calculate type-specific feature scores
   */
  private calculateTypeSpecificScore(features: AudioFeatures, audioType: AudioType): number {
    switch (audioType) {
      case 'voice':
        return this.calculateVoiceScore(features);
      case 'piano':
        return this.calculatePianoScore(features);
      case 'guitar':
        return this.calculateGuitarScore(features);
      case 'violin':
        return this.calculateViolinScore(features);
      case 'flute':
        return this.calculateFluteScore(features);
      case 'drums':
        return this.calculateDrumsScore(features);
      default:
        return 0.5; // Neutral score for unknown types
    }
  }
  
  /**
   * Voice-specific scoring
   */
  private calculateVoiceScore(features: AudioFeatures): number {
    let score = 0;
    
    // Formant presence
    if (features.formantFrequencies && features.formantFrequencies.length >= 2) {
      score += 0.4;
    }
    
    // Vibrato characteristics
    if (features.vibratoRate && features.vibratoRate > 3 && features.vibratoRate < 12) {
      score += 0.3;
    }
    
    // Harmonic structure typical of voice
    if (features.harmonicRatio > 0.6 && features.harmonicRatio < 0.9) {
      score += 0.3;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Piano-specific scoring
   */
  private calculatePianoScore(features: AudioFeatures): number {
    let score = 0;
    
    // Sharp attack typical of piano
    if (features.attackTime < 0.05) {
      score += 0.4;
    }
    
    // Rich harmonic content
    if (features.harmonicRatio > 0.7) {
      score += 0.3;
    }
    
    // Percussive characteristics
    if (features.percussiveness && features.percussiveness > 0.6) {
      score += 0.3;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Guitar-specific scoring
   */
  private calculateGuitarScore(features: AudioFeatures): number {
    let score = 0;
    
    // Pluck characteristics
    if (features.pluckiness && features.pluckiness > 0.5) {
      score += 0.4;
    }
    
    // String resonance patterns
    if (features.harmonicComplexity > 0.3 && features.harmonicComplexity < 0.7) {
      score += 0.3;
    }
    
    // Typical frequency range and decay
    if (features.decayTime > 0.5 && features.decayTime < 3.0) {
      score += 0.3;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Violin-specific scoring
   */
  private calculateViolinScore(features: AudioFeatures): number {
    let score = 0;
    
    // Bowing characteristics
    if (features.bowingness && features.bowingness > 0.5) {
      score += 0.4;
    }
    
    // Sustained tones
    if (features.sustainLevel > 0.6) {
      score += 0.3;
    }
    
    // Vibrato typical of violin
    if (features.vibratoRate && features.vibratoRate > 4 && features.vibratoRate < 8) {
      score += 0.3;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Flute-specific scoring
   */
  private calculateFluteScore(features: AudioFeatures): number {
    let score = 0;
    
    // Breath noise characteristics
    if (features.breathiness_wind && features.breathiness_wind > 0.3) {
      score += 0.4;
    }
    
    // Pure tone characteristics
    if (features.harmonicRatio < 0.7 && features.fundamentalStrength > 0.7) {
      score += 0.3;
    }
    
    // Gradual attack
    if (features.attackTime > 0.1 && features.attackTime < 0.3) {
      score += 0.3;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Drums-specific scoring
   */
  private calculateDrumsScore(features: AudioFeatures): number {
    let score = 0;
    
    // High percussiveness
    if (features.percussiveness && features.percussiveness > 0.8) {
      score += 0.5;
    }
    
    // Low harmonic ratio (noise-like)
    if (features.harmonicRatio < 0.3) {
      score += 0.3;
    }
    
    // Very short attack
    if (features.attackTime < 0.02) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Find the best matching audio type
   */
  private findBestMatch(scores: Map<AudioType, number>): { audioType: AudioType; confidence: number; subType?: string } {
    let bestType: AudioType = 'unknown';
    let bestScore = 0;
    
    for (const [audioType, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestType = audioType;
      }
    }
    
    // Apply confidence threshold
    const profile = this.instrumentProfiles.get(bestType);
    const threshold = profile?.confidenceThreshold || 0.6;
    
    if (bestScore < threshold) {
      return { audioType: 'unknown', confidence: bestScore };
    }
    
    return { 
      audioType: bestType, 
      confidence: bestScore,
      subType: this.getSubType(bestType, scores)
    };
  }
  
  /**
   * Get more specific sub-type based on additional analysis
   */
  private getSubType(audioType: AudioType, scores: Map<AudioType, number>): string | undefined {
    switch (audioType) {
      case 'voice':
        // Could distinguish male/female, singing style, etc.
        return undefined;
      case 'string_instrument':
        // Could distinguish between guitar, violin, etc.
        const guitarScore = scores.get('guitar') || 0;
        const violinScore = scores.get('violin') || 0;
        if (guitarScore > violinScore) return 'guitar';
        if (violinScore > guitarScore) return 'violin';
        return undefined;
      default:
        return undefined;
    }
  }
  
  /**
   * Initialize instrument profiles database
   */
  private initializeInstrumentProfiles(): void {
    // Voice profile
    this.instrumentProfiles.set('voice', {
      audioType: 'voice',
      confidenceThreshold: 0.7,
      frequencyRange: [80, 1200],
      expectedFeatures: {
        spectralCentroid: 500,
        harmonicRatio: 0.75,
        attackTime: 0.1,
        vibratoRate: 6
      },
      indicators: ['formants', 'vibrato', 'breath_noise', 'vocal_tract_resonance']
    });
    
    // Keyboard profile (includes piano)
    this.instrumentProfiles.set('keyboard', {
      audioType: 'keyboard',
      confidenceThreshold: 0.6,
      frequencyRange: [27.5, 4186],
      expectedFeatures: {
        spectralCentroid: 800,
        harmonicRatio: 0.8,
        attackTime: 0.02,
        percussiveness: 0.8
      },
      indicators: ['sharp_attack', 'harmonic_decay', 'percussive_envelope']
    });
    
    // String profile (includes guitar, violin, etc.)
    this.instrumentProfiles.set('string', {
      audioType: 'string',
      confidenceThreshold: 0.6,
      frequencyRange: [82, 3136],
      expectedFeatures: {
        spectralCentroid: 800,
        harmonicRatio: 0.75,
        attackTime: 0.1,
        pluckiness: 0.6
      },
      indicators: ['string_resonance', 'harmonic_overtones', 'decay_pattern']
    });
    
    // Wind profile (includes flute, etc.)
    this.instrumentProfiles.set('wind', {
      audioType: 'wind',
      confidenceThreshold: 0.7,
      frequencyRange: [262, 2093],
      expectedFeatures: {
        spectralCentroid: 800,
        harmonicRatio: 0.6,
        attackTime: 0.2,
        breathiness_wind: 0.4
      },
      indicators: ['breath_noise', 'pure_tones', 'air_turbulence']
    });
    
    // Percussion profile (includes drums, etc.)
    this.instrumentProfiles.set('percussion', {
      audioType: 'percussion',
      confidenceThreshold: 0.8,
      frequencyRange: [20, 2000],
      expectedFeatures: {
        spectralCentroid: 400,
        harmonicRatio: 0.2,
        attackTime: 0.01,
        percussiveness: 0.9
      },
      indicators: ['transient_attack', 'noise_content', 'short_decay']
    });
  }
  
  // Helper methods for feature extraction
  
  private calculateSpectralFlux(spectrum: Float32Array): number {
    // Simplified spectral flux calculation
    let flux = 0;
    for (let i = 1; i < spectrum.length; i++) {
      const diff = spectrum[i] - spectrum[i-1];
      if (diff > 0) flux += diff;
    }
    return flux / spectrum.length;
  }
  
  private findFundamentalFrequency(magnitude: Float32Array): number {
    // Simple peak detection for fundamental
    let maxBin = 0;
    let maxMag = 0;
    
    for (let i = 1; i < magnitude.length / 2; i++) {
      if (magnitude[i] > maxMag) {
        maxMag = magnitude[i];
        maxBin = i;
      }
    }
    
    return maxBin * this.sampleRate / (2 * magnitude.length);
  }
  
  private findHarmonics(magnitude: Float32Array, fundamental: number): Array<{frequency: number, magnitude: number}> {
    const harmonics: Array<{frequency: number, magnitude: number}> = [];
    const binWidth = this.sampleRate / (2 * magnitude.length);
    
    for (let harmonic = 1; harmonic <= 8; harmonic++) {
      const targetFreq = fundamental * harmonic;
      const targetBin = Math.round(targetFreq / binWidth);
      
      if (targetBin < magnitude.length) {
        harmonics.push({
          frequency: targetFreq,
          magnitude: magnitude[targetBin]
        });
      }
    }
    
    return harmonics;
  }
  
  private calculateHarmonicComplexity(harmonics: Array<{frequency: number, magnitude: number}>, fundamental: number): number {
    if (harmonics.length < 2) return 0;
    
    let complexity = 0;
    const fundamentalMag = harmonics[0]?.magnitude || 0;
    
    for (let i = 1; i < harmonics.length; i++) {
      const ratio = harmonics[i].magnitude / fundamentalMag;
      complexity += ratio * (i + 1);
    }
    
    return complexity / harmonics.length;
  }
  
  private calculateInharmonicity(harmonics: Array<{frequency: number, magnitude: number}>, fundamental: number): number {
    if (harmonics.length < 2) return 0;
    
    let inharmonicity = 0;
    for (let i = 1; i < harmonics.length; i++) {
      const expectedFreq = fundamental * (i + 1);
      const actualFreq = harmonics[i].frequency;
      const deviation = Math.abs(actualFreq - expectedFreq) / expectedFreq;
      inharmonicity += deviation;
    }
    
    return inharmonicity / (harmonics.length - 1);
  }
  
  private calculateAttackTime(buffer: Float32Array): number {
    const envelope = this.calculateEnvelope(buffer);
    const peak = Math.max(...envelope);
    const target = peak * 0.9;
    
    for (let i = 0; i < envelope.length; i++) {
      if (envelope[i] >= target) {
        return (i / this.sampleRate) * 1000; // Return in milliseconds
      }
    }
    
    return 0;
  }
  
  private calculateDecayTime(buffer: Float32Array): number {
    const envelope = this.calculateEnvelope(buffer);
    const peak = Math.max(...envelope);
    const peakIndex = envelope.indexOf(peak);
    const target = peak * 0.1;
    
    for (let i = peakIndex; i < envelope.length; i++) {
      if (envelope[i] <= target) {
        return ((i - peakIndex) / this.sampleRate) * 1000; // Return in milliseconds
      }
    }
    
    return 0;
  }
  
  private calculateSustainLevel(buffer: Float32Array): number {
    const envelope = this.calculateEnvelope(buffer);
    const sustainStart = Math.floor(envelope.length * 0.3);
    const sustainEnd = Math.floor(envelope.length * 0.8);
    
    let sum = 0;
    for (let i = sustainStart; i < sustainEnd; i++) {
      sum += envelope[i];
    }
    
    return sum / (sustainEnd - sustainStart);
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
  
  private calculateEnvelope(buffer: Float32Array): Float32Array {
    const windowSize = Math.floor(this.sampleRate * 0.01); // 10ms windows
    const envelope = new Float32Array(Math.floor(buffer.length / windowSize));
    
    for (let i = 0; i < envelope.length; i++) {
      let sum = 0;
      const start = i * windowSize;
      const end = Math.min(start + windowSize, buffer.length);
      
      for (let j = start; j < end; j++) {
        sum += Math.abs(buffer[j]);
      }
      
      envelope[i] = sum / (end - start);
    }
    
    return envelope;
  }
  
  private findFormants(magnitude: Float32Array): number[] {
    // Simplified formant detection using peak picking
    const formants: number[] = [];
    const binWidth = this.sampleRate / (2 * magnitude.length);
    
    // Look for peaks in typical formant ranges
    const formantRanges = [
      [200, 1000],   // F1
      [800, 3000],   // F2
      [1500, 4000],  // F3
      [2500, 5000]   // F4
    ];
    
    for (const [minFreq, maxFreq] of formantRanges) {
      const minBin = Math.floor(minFreq / binWidth);
      const maxBin = Math.min(Math.floor(maxFreq / binWidth), magnitude.length - 1);
      
      let peakBin = minBin;
      let peakMag = magnitude[minBin];
      
      for (let i = minBin; i <= maxBin; i++) {
        if (magnitude[i] > peakMag) {
          peakMag = magnitude[i];
          peakBin = i;
        }
      }
      
      if (peakMag > 0.1) { // Threshold for formant detection
        formants.push(peakBin * binWidth);
      }
    }
    
    return formants;
  }
  
  private analyzeVibrato(buffer: Float32Array): { rate: number; extent: number } {
    // Simplified vibrato analysis using autocorrelation
    const frameSize = Math.floor(this.sampleRate * 0.1); // 100ms frames
    const numFrames = Math.floor(buffer.length / frameSize);
    
    if (numFrames < 3) {
      return { rate: 0, extent: 0 };
    }
    
    // Calculate pitch for each frame (simplified)
    const pitches: number[] = [];
    for (let i = 0; i < numFrames; i++) {
      const start = i * frameSize;
      const frame = buffer.slice(start, start + frameSize);
      const pitch = this.estimatePitch(frame);
      if (pitch > 0) pitches.push(pitch);
    }
    
    if (pitches.length < 3) {
      return { rate: 0, extent: 0 };
    }
    
    // Analyze pitch variation
    const meanPitch = pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
    const deviations = pitches.map(p => p - meanPitch);
    
    // Simple periodicity detection for vibrato rate
    const rate = this.detectPeriodicityRate(deviations, 10); // 10 frames per second
    
    // Vibrato extent (pitch variation)
    const maxDeviation = Math.max(...deviations.map(Math.abs));
    const extent = maxDeviation / meanPitch * 100; // Percentage
    
    return { rate, extent };
  }
  
  private calculateBreathiness(magnitude: Float32Array): number {
    // Measure high-frequency noise content
    const totalEnergy = magnitude.reduce((sum, m) => sum + m * m, 0);
    const highFreqStart = Math.floor(magnitude.length * 0.7);
    let highFreqEnergy = 0;
    
    for (let i = highFreqStart; i < magnitude.length; i++) {
      highFreqEnergy += magnitude[i] * magnitude[i];
    }
    
    return totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
  }
  
  private calculatePluckiness(buffer: Float32Array): number {
    // Measure sharp attack characteristics
    const envelope = this.calculateEnvelope(buffer);
    if (envelope.length < 5) return 0;
    
    const peak = Math.max(...envelope);
    const peakIndex = envelope.indexOf(peak);
    
    // Check for sharp rise to peak
    const attackSlope = peakIndex > 0 ? peak / peakIndex : 0;
    
    // Normalize to 0-1 range
    return Math.min(attackSlope / 10, 1.0);
  }
  
  private calculateBowingness(buffer: Float32Array): number {
    // Measure sustained, smooth characteristics
    const envelope = this.calculateEnvelope(buffer);
    if (envelope.length < 10) return 0;
    
    // Calculate envelope smoothness
    let smoothness = 0;
    for (let i = 1; i < envelope.length - 1; i++) {
      const variation = Math.abs(envelope[i+1] - envelope[i]);
      smoothness += variation;
    }
    smoothness = smoothness / (envelope.length - 2);
    
    // Lower variation = more bowing-like
    return Math.max(0, 1 - smoothness * 10);
  }
  
  private calculateWindBreathiness(magnitude: Float32Array): number {
    // Similar to vocal breathiness but tuned for wind instruments
    return this.calculateBreathiness(magnitude) * 1.2; // Slightly more sensitive
  }
  
  private calculatePercussiveness(buffer: Float32Array): number {
    // Measure sharp transients and quick decay
    const envelope = this.calculateEnvelope(buffer);
    if (envelope.length < 5) return 0;
    
    const peak = Math.max(...envelope);
    const peakIndex = envelope.indexOf(peak);
    
    // Sharp attack
    const attackScore = peakIndex < envelope.length * 0.1 ? 1 : 0;
    
    // Quick decay
    const decayIndex = envelope.findIndex((val, idx) => idx > peakIndex && val < peak * 0.1);
    const decayScore = decayIndex > 0 && (decayIndex - peakIndex) < envelope.length * 0.3 ? 1 : 0;
    
    return (attackScore + decayScore) / 2;
  }
  
  private estimatePitch(buffer: Float32Array): number {
    // Simplified pitch estimation using autocorrelation
    const minPeriod = Math.floor(this.sampleRate / 1000); // 1000 Hz max
    const maxPeriod = Math.floor(this.sampleRate / 50);   // 50 Hz min
    
    let bestPeriod = 0;
    let bestCorrelation = 0;
    
    for (let period = minPeriod; period <= maxPeriod && period < buffer.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < buffer.length - period; i++) {
        correlation += buffer[i] * buffer[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return bestPeriod > 0 ? this.sampleRate / bestPeriod : 0;
  }
  
  private detectPeriodicityRate(values: number[], samplesPerSecond: number): number {
    // Simple periodicity detection for vibrato rate
    if (values.length < 6) return 0;
    
    // Find zero crossings in the deviation signal
    let crossings = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] >= 0) !== (values[i-1] >= 0)) {
        crossings++;
      }
    }
    
    // Vibrato rate = crossings per second / 2 (full cycle)
    const duration = values.length / samplesPerSecond;
    return crossings / duration / 2;
  }
  
  private normalizeFeatureScore(value: number, expected: number, tolerance: number): number {
    const deviation = Math.abs(value - expected);
    const score = Math.max(0, 1 - deviation / tolerance);
    return score;
  }
  
  /**
   * Find the best matching audio type from confidence scores
   */
  private findBestMatch(scores: Map<AudioType, number>): { audioType: AudioType; confidence: number; subType?: string } {
    let bestAudioType: AudioType = 'unknown';
    let bestConfidence = 0;
    let subType: string | undefined;
    
    for (const [audioType, confidence] of scores.entries()) {
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestAudioType = audioType;
        
        // Determine subtype based on specific audio type
        switch (audioType) {
          case 'string':
            subType = this.determineStringSubtype(confidence);
            break;
          case 'wind':
            subType = this.determineWindSubtype(confidence);
            break;
          case 'keyboard':
            subType = this.determineKeyboardSubtype(confidence);
            break;
          case 'percussion':
            subType = this.determinePercussionSubtype(confidence);
            break;
          default:
            subType = undefined;
        }
      }
    }
    
    return {
      audioType: bestAudioType,
      confidence: bestConfidence,
      subType
    };
  }
  
  private determineStringSubtype(confidence: number): string {
    // Simple subtype classification - could be enhanced with more sophisticated analysis
    return confidence > 0.8 ? 'guitar' : 'string';
  }
  
  private determineWindSubtype(confidence: number): string {
    return confidence > 0.8 ? 'flute' : 'wind';
  }
  
  private determineKeyboardSubtype(confidence: number): string {
    return confidence > 0.8 ? 'piano' : 'keyboard';
  }
  
  private determinePercussionSubtype(confidence: number): string {
    return confidence > 0.8 ? 'drums' : 'percussion';
  }
  
  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AutoDetectorConfig>): void {
    Object.assign(this.config, newConfig);
  }
}

export default AutoDetector;