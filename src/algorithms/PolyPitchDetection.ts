/**
 * Advanced Polyphonic Pitch Detection
 * 
 * Enhanced polyphonic pitch detection using multiple complementary techniques:
 * - Spectral peak picking with harmonic validation
 * - Iterative fundamental frequency estimation
 * - Harmonic template matching
 * - Voice separation using source filtering
 */

import { FFT } from './FFT';
import { HPS } from './HPS';

export interface PolyphonicConfig {
    /** Maximum number of simultaneous notes to detect */
    maxNotes?: number;
    
    /** Minimum frequency to consider (Hz) */
    minFrequency?: number;
    
    /** Maximum frequency to consider (Hz) */
    maxFrequency?: number;
    
    /** Number of harmonics to consider per note */
    numHarmonics?: number;
    
    /** Minimum peak prominence for detection */
    minPeakProminence?: number;
    
    /** Harmonic tolerance in cents */
    harmonicToleranceCents?: number;
    
    /** Enable spectral subtraction for voice separation */
    enableSpectralSubtraction?: boolean;
    
    /** Confidence threshold for accepting a note */
    confidenceThreshold?: number;
}

export interface DetectedNote {
    /** Fundamental frequency */
    frequency: number;
    
    /** Note confidence (0-1) */
    confidence: number;
    
    /** Amplitude/volume */
    amplitude: number;
    
    /** Harmonic amplitudes */
    harmonics: number[];
    
    /** Inharmonicity measure */
    inharmonicity: number;
    
    /** Spectral centroid for timbre */
    spectralCentroid: number;
    
    /** Note name (if applicable) */
    noteName?: string;
}

export interface PolyphonicResult {
    /** Detected notes */
    notes: DetectedNote[];
    
    /** Overall polyphonic confidence */
    polyphonicConfidence: number;
    
    /** Estimated number of voices */
    voiceCount: number;
    
    /** Spectral complexity measure */
    spectralComplexity: number;
    
    /** Processing method used */
    method: 'spectral_peaks' | 'iterative_subtraction' | 'template_matching';
    
    /** Residual energy after note extraction */
    residualEnergy: number;
}

export class PolyPitchDetection {
    private fft: FFT;
    private hps: HPS;
    private config: Required<PolyphonicConfig>;
    private harmonicTemplates: Map<number, Float32Array> = new Map();
    
    constructor(
        fftSize: number = 4096,
        sampleRate: number = 44100,
        config: PolyphonicConfig = {}
    ) {
        this.fft = new FFT(fftSize, sampleRate);
        this.hps = new HPS(fftSize, sampleRate);
        
        this.config = {
            maxNotes: config.maxNotes ?? 6,
            minFrequency: config.minFrequency ?? 80,
            maxFrequency: config.maxFrequency ?? 2000,
            numHarmonics: config.numHarmonics ?? 8,
            minPeakProminence: config.minPeakProminence ?? 0.3,
            harmonicToleranceCents: config.harmonicToleranceCents ?? 20,
            enableSpectralSubtraction: config.enableSpectralSubtraction ?? true,
            confidenceThreshold: config.confidenceThreshold ?? 0.4
        };
        
        this.initializeHarmonicTemplates();
    }
    
    /**
     * Detect multiple simultaneous pitches
     */
    public detectNotes(buffer: Float32Array): PolyphonicResult {
        // Compute spectrum
        const windowed = this.applyWindow(buffer);
        const { real, imag } = this.fft.forward(windowed);
        const magnitude = this.fft.getMagnitudeSpectrum(real, imag);
        const powerSpectrum = this.fft.getPowerSpectrum(real, imag);
        
        // Assess spectral complexity
        const spectralComplexity = this.assessSpectralComplexity(magnitude);
        
        // Choose detection method based on complexity
        let result: PolyphonicResult;
        
        if (spectralComplexity < 0.3) {
            // Simple spectrum - use spectral peaks
            result = this.detectUsingSpectralPeaks(magnitude, powerSpectrum);
            result.method = 'spectral_peaks';
        } else if (spectralComplexity < 0.7) {
            // Moderate complexity - use iterative subtraction
            result = this.detectUsingIterativeSubtraction(magnitude, powerSpectrum);
            result.method = 'iterative_subtraction';
        } else {
            // High complexity - use template matching
            result = this.detectUsingTemplateMatching(magnitude, powerSpectrum);
            result.method = 'template_matching';
        }
        
        result.spectralComplexity = spectralComplexity;
        
        // Post-process results
        result.notes = this.postProcessNotes(result.notes);
        result.polyphonicConfidence = this.calculatePolyphonicConfidence(result.notes);
        result.voiceCount = this.estimateVoiceCount(result.notes);
        
        return result;
    }
    
    /**
     * Detect notes using spectral peak picking
     */
    private detectUsingSpectralPeaks(
        magnitude: Float32Array, 
        powerSpectrum: Float32Array
    ): PolyphonicResult {
        const notes: DetectedNote[] = [];
        
        // Find spectral peaks
        const peaks = this.findSpectralPeaks(magnitude);
        
        // Group peaks by harmonic relationships
        const fundamentalPeaks = this.findFundamentalFrequencies(peaks, magnitude);
        
        // Create notes from fundamental frequencies
        for (const peak of fundamentalPeaks) {
            const note = this.createNoteFromFundamental(peak.frequency, magnitude, powerSpectrum);
            if (note.confidence > this.config.confidenceThreshold) {
                notes.push(note);
            }
        }
        
        return {
            notes: notes.slice(0, this.config.maxNotes),
            polyphonicConfidence: 0,
            voiceCount: 0,
            spectralComplexity: 0,
            method: 'spectral_peaks',
            residualEnergy: this.calculateResidualEnergy(magnitude, notes)
        };
    }
    
    /**
     * Detect notes using iterative spectral subtraction
     */
    private detectUsingIterativeSubtraction(
        magnitude: Float32Array,
        powerSpectrum: Float32Array
    ): PolyphonicResult {
        const notes: DetectedNote[] = [];
        let residualSpectrum = new Float32Array(magnitude);
        
        for (let i = 0; i < this.config.maxNotes; i++) {
            // Find strongest fundamental in residual spectrum
            const fundamental = this.findStrongestFundamental(residualSpectrum);
            
            if (!fundamental || fundamental.confidence < this.config.confidenceThreshold) {
                break;
            }
            
            // Create note
            const note = this.createNoteFromFundamental(
                fundamental.frequency, 
                residualSpectrum, 
                powerSpectrum
            );
            notes.push(note);
            
            // Subtract harmonic series from residual spectrum
            if (this.config.enableSpectralSubtraction) {
                this.subtractHarmonicSeries(residualSpectrum, fundamental.frequency);
            }
        }
        
        return {
            notes,
            polyphonicConfidence: 0,
            voiceCount: 0,
            spectralComplexity: 0,
            method: 'iterative_subtraction',
            residualEnergy: this.calculateResidualEnergy(magnitude, notes)
        };
    }
    
    /**
     * Detect notes using harmonic template matching
     */
    private detectUsingTemplateMatching(
        magnitude: Float32Array,
        powerSpectrum: Float32Array
    ): PolyphonicResult {
        const notes: DetectedNote[] = [];
        const binWidth = this.fft.getSampleRate() / this.fft.getSize();
        
        // Test each harmonic template
        for (const [templateFreq, template] of this.harmonicTemplates) {
            if (templateFreq < this.config.minFrequency || 
                templateFreq > this.config.maxFrequency) {
                continue;
            }
            
            const correlation = this.correlateTemplate(magnitude, template, templateFreq);
            
            if (correlation.confidence > this.config.confidenceThreshold) {
                const note = this.createNoteFromTemplate(
                    templateFreq, 
                    correlation.confidence,
                    magnitude,
                    powerSpectrum
                );
                notes.push(note);
            }
        }
        
        // Sort by confidence and take top notes
        notes.sort((a, b) => b.confidence - a.confidence);
        
        return {
            notes: notes.slice(0, this.config.maxNotes),
            polyphonicConfidence: 0,
            voiceCount: 0,
            spectralComplexity: 0,
            method: 'template_matching',
            residualEnergy: this.calculateResidualEnergy(magnitude, notes)
        };
    }
    
    /**
     * Find spectral peaks using adaptive thresholding
     */
    private findSpectralPeaks(magnitude: Float32Array): Array<{frequency: number, amplitude: number, bin: number}> {
        const peaks = [];
        const binWidth = this.fft.getSampleRate() / this.fft.getSize();
        const minBin = Math.floor(this.config.minFrequency / binWidth);
        const maxBin = Math.floor(this.config.maxFrequency / binWidth);
        
        // Calculate adaptive threshold
        const avgMagnitude = magnitude.slice(minBin, maxBin)
            .reduce((sum, val) => sum + val, 0) / (maxBin - minBin);
        const threshold = avgMagnitude * this.config.minPeakProminence;
        
        // Find local maxima
        for (let i = minBin + 2; i < maxBin - 2; i++) {
            if (magnitude[i] > threshold &&
                magnitude[i] > magnitude[i-1] && magnitude[i] > magnitude[i+1] &&
                magnitude[i] > magnitude[i-2] && magnitude[i] > magnitude[i+2]) {
                
                // Use parabolic interpolation for more precise frequency
                const refinedBin = this.parabolicInterpolation(magnitude, i);
                
                peaks.push({
                    frequency: refinedBin * binWidth,
                    amplitude: magnitude[i],
                    bin: refinedBin
                });
            }
        }
        
        return peaks.sort((a, b) => b.amplitude - a.amplitude);
    }
    
    /**
     * Find fundamental frequencies from spectral peaks
     */
    private findFundamentalFrequencies(
        peaks: Array<{frequency: number, amplitude: number, bin: number}>,
        magnitude: Float32Array
    ): Array<{frequency: number, confidence: number}> {
        const fundamentals = [];
        const usedPeaks = new Set<number>();
        
        for (const peak of peaks) {
            if (usedPeaks.has(peak.bin)) continue;
            
            // Check if this peak could be a fundamental
            const harmonicStrength = this.evaluateHarmonicSeries(peak.frequency, magnitude);
            
            if (harmonicStrength > 0.4) {
                fundamentals.push({
                    frequency: peak.frequency,
                    confidence: harmonicStrength
                });
                
                // Mark harmonics as used
                this.markHarmonicsAsUsed(peak.frequency, peaks, usedPeaks);
            }
        }
        
        return fundamentals.sort((a, b) => b.confidence - a.confidence);
    }
    
    /**
     * Evaluate harmonic series strength
     */
    private evaluateHarmonicSeries(fundamental: number, magnitude: Float32Array): number {
        const binWidth = this.fft.getSampleRate() / this.fft.getSize();
        let harmonicStrength = 0;
        let totalWeight = 0;
        
        for (let h = 1; h <= this.config.numHarmonics; h++) {
            const harmonicFreq = fundamental * h;
            const bin = Math.round(harmonicFreq / binWidth);
            
            if (bin >= magnitude.length) break;
            
            // Check for peak around expected harmonic frequency
            const tolerance = Math.ceil(this.config.harmonicToleranceCents / 100 * harmonicFreq / binWidth);
            let maxAmp = 0;
            
            for (let i = Math.max(0, bin - tolerance); 
                 i <= Math.min(magnitude.length - 1, bin + tolerance); i++) {
                maxAmp = Math.max(maxAmp, magnitude[i]);
            }
            
            const weight = 1.0 / h; // Lower harmonics weighted more
            harmonicStrength += maxAmp * weight;
            totalWeight += weight;
        }
        
        return totalWeight > 0 ? harmonicStrength / totalWeight : 0;
    }
    
    /**
     * Create a note from fundamental frequency
     */
    private createNoteFromFundamental(
        frequency: number,
        magnitude: Float32Array,
        powerSpectrum: Float32Array
    ): DetectedNote {
        const binWidth = this.fft.getSampleRate() / this.fft.getSize();
        const harmonics: number[] = [];
        
        // Extract harmonic amplitudes
        for (let h = 1; h <= this.config.numHarmonics; h++) {
            const harmonicFreq = frequency * h;
            const bin = Math.round(harmonicFreq / binWidth);
            
            if (bin < magnitude.length) {
                harmonics.push(magnitude[bin]);
            } else {
                harmonics.push(0);
            }
        }
        
        // Calculate metrics
        const amplitude = harmonics[0]; // Fundamental amplitude
        const inharmonicity = this.calculateInharmonicity(frequency, harmonics);
        const spectralCentroid = this.calculateSpectralCentroid(frequency, harmonics);
        const confidence = this.calculateNoteConfidence(frequency, harmonics, magnitude);
        
        return {
            frequency,
            confidence,
            amplitude,
            harmonics,
            inharmonicity,
            spectralCentroid,
            noteName: this.frequencyToNote(frequency)
        };
    }
    
    /**
     * Calculate inharmonicity measure
     */
    private calculateInharmonicity(fundamental: number, harmonics: number[]): number {
        let inharmonicity = 0;
        let count = 0;
        
        for (let h = 2; h < harmonics.length; h++) {
            if (harmonics[h] > 0) {
                const expectedRatio = h;
                const actualRatio = harmonics[h] / harmonics[0];
                const deviation = Math.abs(actualRatio - expectedRatio) / expectedRatio;
                inharmonicity += deviation;
                count++;
            }
        }
        
        return count > 0 ? inharmonicity / count : 0;
    }
    
    /**
     * Calculate note confidence based on harmonic structure
     */
    private calculateNoteConfidence(
        frequency: number, 
        harmonics: number[], 
        magnitude: Float32Array
    ): number {
        // Harmonic strength relative to noise
        const harmonicEnergy = harmonics.reduce((sum, amp) => sum + amp * amp, 0);
        const totalEnergy = magnitude.reduce((sum, amp) => sum + amp * amp, 0);
        
        const harmonicRatio = harmonicEnergy / (totalEnergy + 1e-10);
        
        // Harmonic decay pattern (should decrease with higher harmonics)
        let decayScore = 0;
        for (let i = 1; i < harmonics.length - 1; i++) {
            if (harmonics[i] >= harmonics[i + 1]) {
                decayScore++;
            }
        }
        decayScore /= Math.max(1, harmonics.length - 2);
        
        // Combined confidence
        return (harmonicRatio * 0.7 + decayScore * 0.3);
    }
    
    /**
     * Apply window function
     */
    private applyWindow(buffer: Float32Array): Float32Array {
        const windowed = new Float32Array(buffer.length);
        
        // Blackman-Harris window for better spectral resolution
        for (let i = 0; i < buffer.length; i++) {
            const a0 = 0.35875;
            const a1 = 0.48829;
            const a2 = 0.14128;
            const a3 = 0.01168;
            
            const window = a0 - a1 * Math.cos(2 * Math.PI * i / (buffer.length - 1)) +
                          a2 * Math.cos(4 * Math.PI * i / (buffer.length - 1)) -
                          a3 * Math.cos(6 * Math.PI * i / (buffer.length - 1));
            
            windowed[i] = buffer[i] * window;
        }
        
        return windowed;
    }
    
    /**
     * Additional helper methods would continue here...
     * Including: parabolicInterpolation, assessSpectralComplexity, 
     * initializeHarmonicTemplates, etc.
     */
    
    private parabolicInterpolation(array: Float32Array, peakIndex: number): number {
        if (peakIndex === 0 || peakIndex === array.length - 1) {
            return peakIndex;
        }
        
        const y1 = array[peakIndex - 1];
        const y2 = array[peakIndex];
        const y3 = array[peakIndex + 1];
        
        const denominator = y1 - 2 * y2 + y3;
        if (Math.abs(denominator) < 1e-10) {
            return peakIndex;
        }
        
        const p = 0.5 * (y1 - y3) / denominator;
        return peakIndex + Math.max(-0.5, Math.min(0.5, p));
    }
    
    private frequencyToNote(frequency: number): string {
        if (frequency <= 0) return '';
        
        const A4 = 440;
        const semitones = 12 * Math.log2(frequency / A4);
        const noteNum = Math.round(semitones) + 69; // MIDI number
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNum / 12) - 1;
        const noteIndex = noteNum % 12;
        
        return `${noteNames[noteIndex]}${octave}`;
    }
    
    // Placeholder methods - would be implemented in full version
    private assessSpectralComplexity(magnitude: Float32Array): number { return 0.5; }
    private findStrongestFundamental(spectrum: Float32Array): any { return null; }
    private subtractHarmonicSeries(spectrum: Float32Array, freq: number): void {}
    private correlateTemplate(spectrum: Float32Array, template: Float32Array, freq: number): any { return {confidence: 0}; }
    private createNoteFromTemplate(freq: number, conf: number, mag: Float32Array, power: Float32Array): DetectedNote { 
        return { frequency: freq, confidence: conf, amplitude: 0, harmonics: [], inharmonicity: 0, spectralCentroid: 0 };
    }
    private initializeHarmonicTemplates(): void {}
    private postProcessNotes(notes: DetectedNote[]): DetectedNote[] { return notes; }
    private calculatePolyphonicConfidence(notes: DetectedNote[]): number { return 0.8; }
    private estimateVoiceCount(notes: DetectedNote[]): number { return notes.length; }
    private calculateResidualEnergy(mag: Float32Array, notes: DetectedNote[]): number { return 0.1; }
    private markHarmonicsAsUsed(freq: number, peaks: any[], used: Set<number>): void {}
    private calculateSpectralCentroid(freq: number, harmonics: number[]): number { return freq; }
}

export default PolyPitchDetection;