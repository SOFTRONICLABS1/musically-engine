/**
 * Harmonic Product Spectrum (HPS) algorithm for pitch detection
 * Effective for polyphonic pitch detection and chord analysis
 */

import { FFT } from './FFT';

export class HPS {
    private fft: FFT;
    private sampleRate: number;
    private harmonics: number;
    private minFrequency: number;
    private maxFrequency: number;
    
    constructor(
        fftSize: number = 4096,
        sampleRate: number = 44100,
        harmonics: number = 5,
        minFrequency: number = 50,
        maxFrequency: number = 4000
    ) {
        this.fft = new FFT(fftSize, sampleRate);
        this.sampleRate = sampleRate;
        this.harmonics = harmonics;
        this.minFrequency = minFrequency;
        this.maxFrequency = maxFrequency;
    }
    
    /**
     * Detect fundamental frequency using HPS
     * @param buffer Audio buffer
     * @returns Detected frequencies with their strengths
     */
    public detectPitch(buffer: Float32Array): { 
        frequency: number; 
        strength: number; 
        harmonicAmplitudes: Float32Array 
    } {
        // Apply window function
        const windowed = this.applyWindow(buffer);
        
        // Perform FFT
        const { real, imag } = this.fft.forward(windowed);
        const spectrum = this.fft.getPowerSpectrum(real, imag);
        
        // Apply HPS algorithm
        const hps = this.computeHPS(spectrum);
        
        // Find peak in HPS
        const { frequency, strength } = this.findPeak(hps);
        
        // Extract harmonic amplitudes
        const harmonicAmplitudes = this.extractHarmonicAmplitudes(spectrum, frequency);
        
        return { frequency, strength, harmonicAmplitudes };
    }
    
    /**
     * Detect multiple pitches (polyphonic)
     * @param buffer Audio buffer
     * @param maxPitches Maximum number of pitches to detect
     * @returns Array of detected pitches
     */
    public detectMultiplePitches(buffer: Float32Array, maxPitches: number = 5): Array<{
        frequency: number;
        strength: number;
        harmonicAmplitudes: Float32Array;
    }> {
        const windowed = this.applyWindow(buffer);
        const { real, imag } = this.fft.forward(windowed);
        const spectrum = this.fft.getPowerSpectrum(real, imag);
        const hps = this.computeHPS(spectrum);
        
        // Find multiple peaks
        const peaks = this.findMultiplePeaks(hps, maxPitches);
        
        return peaks.map(peak => ({
            frequency: peak.frequency,
            strength: peak.strength,
            harmonicAmplitudes: this.extractHarmonicAmplitudes(spectrum, peak.frequency)
        }));
    }
    
    /**
     * Compute Harmonic Product Spectrum
     * @param spectrum Power spectrum from FFT
     * @returns HPS array
     */
    private computeHPS(spectrum: Float32Array): Float32Array {
        const fftSize = this.fft.getSize();
        const hps = new Float32Array(spectrum.length);
        
        // Copy original spectrum
        for (let i = 0; i < spectrum.length; i++) {
            hps[i] = spectrum[i];
        }
        
        // Multiply with downsampled versions
        for (let h = 2; h <= this.harmonics; h++) {
            for (let i = 0; i < Math.floor(spectrum.length / h); i++) {
                hps[i] *= spectrum[i * h];
            }
        }
        
        // Apply frequency range limits
        const minBin = Math.floor(this.minFrequency * fftSize / this.sampleRate);
        const maxBin = Math.ceil(this.maxFrequency * fftSize / this.sampleRate);
        
        for (let i = 0; i < minBin; i++) {
            hps[i] = 0;
        }
        for (let i = maxBin; i < hps.length; i++) {
            hps[i] = 0;
        }
        
        return hps;
    }
    
    /**
     * Find peak in HPS
     * @param hps Harmonic Product Spectrum
     * @returns Peak frequency and strength
     */
    private findPeak(hps: Float32Array): { frequency: number; strength: number } {
        let maxIndex = 0;
        let maxValue = 0;
        
        for (let i = 1; i < hps.length - 1; i++) {
            // Check for local maximum
            if (hps[i] > hps[i - 1] && hps[i] > hps[i + 1] && hps[i] > maxValue) {
                maxValue = hps[i];
                maxIndex = i;
            }
        }
        
        // Parabolic interpolation for refined frequency
        const refinedIndex = this.parabolicInterpolation(hps, maxIndex);
        const frequency = refinedIndex * this.sampleRate / this.fft.getSize();
        
        return { frequency, strength: maxValue };
    }
    
    /**
     * Find multiple peaks in HPS
     * @param hps Harmonic Product Spectrum
     * @param maxPeaks Maximum number of peaks to find
     * @returns Array of peaks
     */
    private findMultiplePeaks(hps: Float32Array, maxPeaks: number): Array<{
        frequency: number;
        strength: number;
    }> {
        const peaks: Array<{ index: number; value: number }> = [];
        
        // Find all local maxima
        for (let i = 2; i < hps.length - 2; i++) {
            if (hps[i] > hps[i - 1] && hps[i] > hps[i + 1] &&
                hps[i] > hps[i - 2] && hps[i] > hps[i + 2]) {
                peaks.push({ index: i, value: hps[i] });
            }
        }
        
        // Sort by value and take top peaks
        peaks.sort((a, b) => b.value - a.value);
        const topPeaks = peaks.slice(0, maxPeaks);
        
        return topPeaks.map(peak => {
            const refinedIndex = this.parabolicInterpolation(hps, peak.index);
            return {
                frequency: refinedIndex * this.sampleRate / this.fft.getSize(),
                strength: peak.value
            };
        });
    }
    
    /**
     * Parabolic interpolation for refined peak position
     * @param array Data array
     * @param peakIndex Peak index
     * @returns Refined index
     */
    private parabolicInterpolation(array: Float32Array, peakIndex: number): number {
        if (peakIndex === 0 || peakIndex === array.length - 1) {
            return peakIndex;
        }
        
        const y1 = array[peakIndex - 1];
        const y2 = array[peakIndex];
        const y3 = array[peakIndex + 1];
        
        const a = (y1 - 2 * y2 + y3) / 2;
        const b = (y3 - y1) / 2;
        
        if (a === 0) {
            return peakIndex;
        }
        
        const xOffset = -b / (2 * a);
        return peakIndex + xOffset;
    }
    
    /**
     * Extract harmonic amplitudes for a given fundamental frequency
     * @param spectrum Power spectrum
     * @param fundamental Fundamental frequency
     * @returns Harmonic amplitudes
     */
    private extractHarmonicAmplitudes(spectrum: Float32Array, fundamental: number): Float32Array {
        const harmonicAmps = new Float32Array(this.harmonics);
        const binWidth = this.sampleRate / this.fft.getSize();
        
        for (let h = 0; h < this.harmonics; h++) {
            const harmonicFreq = fundamental * (h + 1);
            const bin = Math.round(harmonicFreq / binWidth);
            
            if (bin < spectrum.length) {
                // Take maximum in a small window around expected harmonic
                const windowSize = 2;
                let maxAmp = 0;
                
                for (let i = Math.max(0, bin - windowSize); 
                     i <= Math.min(spectrum.length - 1, bin + windowSize); i++) {
                    maxAmp = Math.max(maxAmp, spectrum[i]);
                }
                
                harmonicAmps[h] = maxAmp;
            }
        }
        
        return harmonicAmps;
    }
    
    /**
     * Apply window function
     * @param buffer Input buffer
     * @returns Windowed buffer
     */
    private applyWindow(buffer: Float32Array): Float32Array {
        const windowed = new Float32Array(buffer.length);
        const N = buffer.length;
        
        // Blackman-Harris window for better frequency resolution
        for (let i = 0; i < N; i++) {
            const a0 = 0.35875;
            const a1 = 0.48829;
            const a2 = 0.14128;
            const a3 = 0.01168;
            
            const window = a0 - a1 * Math.cos(2 * Math.PI * i / (N - 1)) +
                          a2 * Math.cos(4 * Math.PI * i / (N - 1)) -
                          a3 * Math.cos(6 * Math.PI * i / (N - 1));
            
            windowed[i] = buffer[i] * window;
        }
        
        return windowed;
    }
    
    /**
     * Analyze chord from detected pitches
     * @param buffer Audio buffer
     * @returns Chord analysis result
     */
    public analyzeChord(buffer: Float32Array): {
        fundamentals: number[];
        chordType: string;
        confidence: number;
    } {
        const pitches = this.detectMultiplePitches(buffer, 6);
        
        // Filter out weak pitches
        const strongPitches = pitches
            .filter(p => p.strength > pitches[0].strength * 0.3)
            .map(p => p.frequency);
        
        // Sort frequencies
        strongPitches.sort((a, b) => a - b);
        
        // Simple chord identification (can be extended)
        const chordType = this.identifyChordType(strongPitches);
        
        // Calculate confidence based on harmonic relationships
        const confidence = this.calculateChordConfidence(strongPitches);
        
        return {
            fundamentals: strongPitches,
            chordType,
            confidence
        };
    }
    
    /**
     * Identify chord type from frequencies
     * @param frequencies Array of frequencies
     * @returns Chord type string
     */
    private identifyChordType(frequencies: number[]): string {
        if (frequencies.length < 2) {
            return 'single note';
        }
        
        if (frequencies.length === 2) {
            const interval = frequencies[1] / frequencies[0];
            if (Math.abs(interval - 1.5) < 0.05) return 'perfect fifth';
            if (Math.abs(interval - 1.25) < 0.05) return 'major third';
            if (Math.abs(interval - 1.2) < 0.05) return 'minor third';
            return 'interval';
        }
        
        // More complex chord identification would go here
        // This is a simplified version
        return `${frequencies.length}-note chord`;
    }
    
    /**
     * Calculate confidence for chord detection
     * @param frequencies Detected frequencies
     * @returns Confidence score (0-1)
     */
    private calculateChordConfidence(frequencies: number[]): number {
        if (frequencies.length < 2) {
            return 1;
        }
        
        // Check for harmonic relationships
        let harmonicScore = 0;
        for (let i = 0; i < frequencies.length - 1; i++) {
            for (let j = i + 1; j < frequencies.length; j++) {
                const ratio = frequencies[j] / frequencies[i];
                
                // Check common harmonic ratios
                const commonRatios = [1.5, 1.25, 1.2, 1.33, 1.67, 2.0];
                for (const target of commonRatios) {
                    if (Math.abs(ratio - target) < 0.05) {
                        harmonicScore += 1;
                        break;
                    }
                }
            }
        }
        
        const maxScore = (frequencies.length * (frequencies.length - 1)) / 2;
        return Math.min(1, harmonicScore / maxScore);
    }
    
    /**
     * Get configuration
     */
    public getConfig(): {
        fftSize: number;
        sampleRate: number;
        harmonics: number;
        minFrequency: number;
        maxFrequency: number;
    } {
        return {
            fftSize: this.fft.getSize(),
            sampleRate: this.sampleRate,
            harmonics: this.harmonics,
            minFrequency: this.minFrequency,
            maxFrequency: this.maxFrequency
        };
    }
}

export default HPS;