/**
 * Traditional Carnatic Shruti Detection System
 * Implements the authentic Sa-Pa-Sa+1-Pa-Sa-Pa-1-Sa pattern detection
 * Spans three octaves: Mandra Sthayi, Madhya Sthayi, Tara Sthayi
 */

export interface FrequencyCluster {
  frequency: number;
  samples: number;
  stability: number;
  octaveRole?: 'Sa' | 'Pa' | 'Sa+1' | 'Pa-1'; // Role in the pattern
}

export interface ShrutiDetectionResult {
  success: boolean;
  saFrequency?: number;
  paFrequency?: number;
  saHighFrequency?: number; // Sa+1 (Tara Sthayi)
  paLowFrequency?: number;  // Pa-1 (Mandra Sthayi)
  ratio?: number;
  octavePattern?: boolean;   // True if full octave pattern detected
  confidence: number;
  message: string;
  clusters: FrequencyCluster[];
}

export interface ShrutiDetectionConfig {
  minSamples: number;
  clusterTolerance: number;
  minClusterSize: number;
  perfectFifthRatio: number;
  ratioTolerance: number;
}

export class ShrutiDetector {
  private config: ShrutiDetectionConfig;
  
  constructor(config: Partial<ShrutiDetectionConfig> = {}) {
    this.config = {
      minSamples: 50,
      clusterTolerance: 30, // Hz
      minClusterSize: 3,
      perfectFifthRatio: 1.5, // 3:2 ratio for perfect fifth (theoretical ideal)
      ratioTolerance: 0.12, // ±12% tolerance (more forgiving for human voices)
      ...config
    };
    
    // Note: Human vocal Sa-Pa can range from 1.45 to 1.55 (±50 cents)
    // This accounts for individual differences and cultural variations
  }
  
  /**
   * Detect Shruti using traditional Sa-Pa-Sa+1-Pa-Sa-Pa-1-Sa pattern
   * @param frequencies Array of frequency samples from user singing
   * @returns ShrutiDetectionResult with detection outcome
   */
  public detectShruti(frequencies: number[]): ShrutiDetectionResult {
    // Validate input
    if (frequencies.length < this.config.minSamples) {
      return {
        success: false,
        confidence: 0,
        message: `Too few samples (${frequencies.length}). Need at least ${this.config.minSamples}. Sing louder or closer to microphone.`,
        clusters: []
      };
    }
    
    // Filter valid frequencies
    const validFreqs = frequencies.filter(f => f > 50 && f < 2000);
    if (validFreqs.length < this.config.minSamples) {
      return {
        success: false,
        confidence: 0,
        message: `Too few valid frequencies (${validFreqs.length}). Check microphone and sing clearly.`,
        clusters: []
      };
    }
    
    // Find frequency clusters
    const clusters = this.findFrequencyClusters(validFreqs);
    
    if (clusters.length === 0) {
      return {
        success: false,
        confidence: 0,
        message: 'No stable pitch clusters found. Hold each note steady for 2-3 seconds.',
        clusters: []
      };
    }
    
    if (clusters.length === 1) {
      return {
        success: false,
        confidence: 0.2,
        message: `Only one pitch detected: ${clusters[0].frequency.toFixed(1)} Hz. Sing both Sa (lower) AND Pa (perfect fifth higher).`,
        clusters
      };
    }
    
    // Try to detect the complete octave pattern first
    const octaveResult = this.detectOctavePattern(clusters);
    if (octaveResult.success) {
      return octaveResult;
    }
    
    // Fallback to simple Sa-Pa detection
    const saCluster = clusters[0]; // Lowest frequency
    const paCluster = clusters[1]; // Next frequency
    const ratio = paCluster.frequency / saCluster.frequency;
    
    // Check if ratio is close to perfect fifth (1.5)
    const ratioError = Math.abs(ratio - this.config.perfectFifthRatio);
    const isValidFifth = ratioError < this.config.ratioTolerance;
    
    // Calculate how close the ratio is to perfect (for feedback)
    const cents = 1200 * Math.log2(ratio / this.config.perfectFifthRatio);
    const ratioQuality = this.getRatioQualityFeedback(ratio, cents);
    
    if (isValidFifth) {
      // Calculate confidence based on cluster stability and ratio accuracy
      const ratioConfidence = 1 - (ratioError / this.config.ratioTolerance);
      const stabilityConfidence = Math.min(saCluster.stability, paCluster.stability);
      const confidence = Math.min(0.95, (ratioConfidence + stabilityConfidence) / 2);
      
      saCluster.octaveRole = 'Sa';
      paCluster.octaveRole = 'Pa';
      
      return {
        success: true,
        saFrequency: saCluster.frequency,
        paFrequency: paCluster.frequency,
        ratio,
        octavePattern: false,
        confidence,
        message: `✅ Shruti detected! Sa = ${saCluster.frequency.toFixed(1)} Hz, Pa = ${paCluster.frequency.toFixed(1)} Hz\nRatio: ${ratio.toFixed(3)} ${ratioQuality}\nTry the complete octave pattern for better accuracy.`,
        clusters
      };
    } else {
      return {
        success: false,
        confidence: 0.3,
        octavePattern: false,
        message: `Two pitches found but interval not recognized.\nSa: ${saCluster.frequency.toFixed(1)} Hz, Pa: ${paCluster.frequency.toFixed(1)} Hz\nRatio: ${ratio.toFixed(3)} ${ratioQuality}\nTip: The Pa should be about 1.5x your Sa frequency. Keep practicing!`,
        clusters
      };
    }
  }
  
  /**
   * Detect the complete Sa-Pa-Sa+1-Pa-Sa-Pa-1-Sa octave pattern
   * @param clusters Frequency clusters to analyze
   * @returns ShrutiDetectionResult with octave pattern detection
   */
  private detectOctavePattern(clusters: FrequencyCluster[]): ShrutiDetectionResult {
    if (clusters.length < 3) {
      return {
        success: false,
        confidence: 0,
        octavePattern: false,
        message: 'Need at least 3 distinct pitches for octave pattern detection.',
        clusters
      };
    }
    
    // Sort clusters by frequency
    const sorted = clusters.sort((a, b) => a.frequency - b.frequency);
    
    // Try to identify the pattern components
    let saFreq: number | null = null;
    let paFreq: number | null = null;
    let saHighFreq: number | null = null;
    let paLowFreq: number | null = null;
    
    // Check all possible Sa candidates
    for (let i = 0; i < sorted.length; i++) {
      const candidateSa = sorted[i].frequency;
      
      // Look for Pa (1.5x Sa)
      const expectedPa = candidateSa * this.config.perfectFifthRatio;
      const paMatch = sorted.find(c => 
        Math.abs(c.frequency - expectedPa) / expectedPa < this.config.ratioTolerance
      );
      
      if (paMatch) {
        // Look for Sa+1 (2x Sa - octave above)
        const expectedSaHigh = candidateSa * 2;
        const saHighMatch = sorted.find(c => 
          Math.abs(c.frequency - expectedSaHigh) / expectedSaHigh < this.config.ratioTolerance
        );
        
        // Look for Pa-1 (Pa/2 - octave below Pa)
        const expectedPaLow = paMatch.frequency / 2;
        const paLowMatch = sorted.find(c => 
          Math.abs(c.frequency - expectedPaLow) / expectedPaLow < this.config.ratioTolerance
        );
        
        // Check if we have at least 3 of the 4 components
        const componentsFound = [true, true, !!saHighMatch, !!paLowMatch].filter(x => x).length;
        
        if (componentsFound >= 3) {
          saFreq = candidateSa;
          paFreq = paMatch.frequency;
          saHighFreq = saHighMatch?.frequency || null;
          paLowFreq = paLowMatch?.frequency || null;
          
          // Assign octave roles
          sorted.find(c => c.frequency === saFreq)!.octaveRole = 'Sa';
          sorted.find(c => c.frequency === paFreq)!.octaveRole = 'Pa';
          if (saHighMatch) saHighMatch.octaveRole = 'Sa+1';
          if (paLowMatch) paLowMatch.octaveRole = 'Pa-1';
          
          break;
        }
      }
    }
    
    if (saFreq && paFreq && (saHighFreq || paLowFreq)) {
      const ratio = paFreq / saFreq;
      const confidence = Math.min(0.95, 0.7 + (saHighFreq && paLowFreq ? 0.25 : 0.1));
      
      let message = `✅ Complete octave Shruti pattern detected!\n`;
      message += `• Sa (Madhya): ${saFreq.toFixed(1)} Hz\n`;
      message += `• Pa (Madhya): ${paFreq.toFixed(1)} Hz\n`;
      if (saHighFreq) message += `• Sa+1 (Tara): ${saHighFreq.toFixed(1)} Hz\n`;
      if (paLowFreq) message += `• Pa-1 (Mandra): ${paLowFreq.toFixed(1)} Hz\n`;
      message += `• Perfect fifth ratio: ${ratio.toFixed(3)}`;
      
      return {
        success: true,
        saFrequency: saFreq,
        paFrequency: paFreq,
        saHighFrequency: saHighFreq || undefined,
        paLowFrequency: paLowFreq || undefined,
        ratio,
        octavePattern: true,
        confidence,
        message,
        clusters: sorted
      };
    }
    
    return {
      success: false,
      confidence: 0,
      octavePattern: false,
      message: 'Could not detect complete octave pattern. Sing: Sa → Pa → Sa+1 → Pa → Sa → Pa-1 → Sa',
      clusters
    };
  }
  
  /**
   * Find stable frequency clusters from raw frequency data
   * @param frequencies Raw frequency samples
   * @returns Array of frequency clusters sorted by frequency
   */
  private findFrequencyClusters(frequencies: number[]): FrequencyCluster[] {
    if (frequencies.length < this.config.minClusterSize) {
      return [];
    }
    
    // Sort frequencies
    const sorted = frequencies.sort((a, b) => a - b);
    const clusters: FrequencyCluster[] = [];
    let currentCluster: number[] = [sorted[0]];
    
    // Group nearby frequencies
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] < this.config.clusterTolerance) {
        currentCluster.push(sorted[i]);
      } else {
        // Process current cluster
        if (currentCluster.length >= this.config.minClusterSize) {
          clusters.push(this.processCluster(currentCluster));
        }
        currentCluster = [sorted[i]];
      }
    }
    
    // Don't forget the last cluster
    if (currentCluster.length >= this.config.minClusterSize) {
      clusters.push(this.processCluster(currentCluster));
    }
    
    // Sort clusters by frequency and return top candidates
    return clusters
      .sort((a, b) => a.frequency - b.frequency)
      .slice(0, 5); // Keep top 5 clusters for octave pattern detection
  }
  
  /**
   * Process a group of similar frequencies into a cluster
   * @param frequencies Array of similar frequencies
   * @returns FrequencyCluster with average frequency and stability metrics
   */
  private processCluster(frequencies: number[]): FrequencyCluster {
    const avgFreq = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
    
    // Calculate stability (lower variance = higher stability)
    const variance = frequencies.reduce((sum, f) => sum + Math.pow(f - avgFreq, 2), 0) / frequencies.length;
    const stability = Math.max(0, 1 - (Math.sqrt(variance) / this.config.clusterTolerance));
    
    return {
      frequency: avgFreq,
      samples: frequencies.length,
      stability: Math.min(1, stability)
    };
  }
  
  /**
   * Convert detected Sa frequency to Western note name
   * @param saFrequency The detected Sa frequency in Hz
   * @returns Note name (e.g., "C", "D", "F#")
   */
  public getShrutiNote(saFrequency: number): string {
    // Standard Western note frequencies (A4 = 440Hz)
    const A4 = 440;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Calculate semitones from A4
    const semitones = 12 * Math.log2(saFrequency / A4);
    const noteIndex = Math.round(semitones + 9) % 12; // +9 to align with C
    
    return noteNames[noteIndex];
  }
  
  /**
   * Update detection configuration
   * @param newConfig Partial configuration to update
   */
  public updateConfig(newConfig: Partial<ShrutiDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current configuration
   * @returns Current detection configuration
   */
  public getConfig(): ShrutiDetectionConfig {
    return { ...this.config };
  }
  
  /**
   * Provide quality feedback based on ratio and cents deviation
   * @param ratio The detected frequency ratio
   * @param cents Cents deviation from perfect fifth
   * @returns Human-friendly feedback string
   */
  private getRatioQualityFeedback(ratio: number, cents: number): string {
    const absCents = Math.abs(cents);
    
    if (absCents < 10) {
      return '(Perfect! 🎯)';
    } else if (absCents < 25) {
      return '(Very good! ✨)';
    } else if (absCents < 50) {
      return '(Good - typical for vocal)';
    } else if (absCents < 75) {
      return `(${cents > 0 ? 'Slightly sharp' : 'Slightly flat'})`;
    } else if (absCents < 100) {
      return `(${cents > 0 ? 'Too sharp' : 'Too flat'} - adjust your Pa)`;
    } else {
      // Provide specific guidance
      if (ratio < 1.3) {
        return '(Interval too small - sing Pa higher)';
      } else if (ratio > 1.7) {
        return '(Interval too large - sing Pa lower)';
      } else {
        return '(Keep practicing the Sa-Pa relationship)';
      }
    }
  }
  
  /**
   * Generate demo frequencies for the Sa-Pa-Sa+1-Pa-Sa-Pa-1-Sa pattern
   * @param baseSaFreq Base Sa frequency (default: C4 = 261.63 Hz)
   * @returns Object with all frequencies in the pattern
   */
  public getDemoFrequencies(baseSaFreq: number = 261.63): {
    sa: number;
    pa: number;
    saHigh: number;
    paLow: number;
    pattern: Array<{ note: string; frequency: number; octave: string }>;
  } {
    const sa = baseSaFreq;
    const pa = sa * this.config.perfectFifthRatio; // 1.5x for perfect fifth
    const saHigh = sa * 2; // Octave above Sa
    const paLow = pa / 2; // Octave below Pa
    
    return {
      sa,
      pa,
      saHigh,
      paLow,
      pattern: [
        { note: 'Sa', frequency: sa, octave: 'Madhya' },
        { note: 'Pa', frequency: pa, octave: 'Madhya' },
        { note: 'Sa+1', frequency: saHigh, octave: 'Tara' },
        { note: 'Pa', frequency: pa, octave: 'Madhya' },
        { note: 'Sa', frequency: sa, octave: 'Madhya' },
        { note: 'Pa-1', frequency: paLow, octave: 'Mandra' },
        { note: 'Sa', frequency: sa, octave: 'Madhya' }
      ]
    };
  }
}