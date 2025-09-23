/**
 * Mathematical utilities for signal processing
 * Platform-agnostic mathematical operations
 */

/**
 * Mathematical utility functions for audio processing
 */
export class MathUtils {
    /**
     * Convert frequency to MIDI note number
     * @param frequency Frequency in Hz
     * @returns MIDI note number
     */
    public static frequencyToMidi(frequency: number): number {
        return 69 + 12 * Math.log2(frequency / 440);
    }
    
    /**
     * Convert MIDI note number to frequency
     * @param midiNote MIDI note number
     * @returns Frequency in Hz
     */
    public static midiToFrequency(midiNote: number): number {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }
    
    /**
     * Convert frequency to cents relative to reference
     * @param frequency Frequency in Hz
     * @param reference Reference frequency in Hz
     * @returns Cents deviation
     */
    public static frequencyToCents(frequency: number, reference: number): number {
        return 1200 * Math.log2(frequency / reference);
    }
    
    /**
     * Convert cents to frequency ratio
     * @param cents Cents value
     * @returns Frequency ratio
     */
    public static centsToRatio(cents: number): number {
        return Math.pow(2, cents / 1200);
    }
    
    /**
     * Linear interpolation
     * @param a Start value
     * @param b End value
     * @param t Interpolation factor (0-1)
     * @returns Interpolated value
     */
    public static lerp(a: number, b: number, t: number): number {
        return a + t * (b - a);
    }
    
    /**
     * Clamp value between min and max
     * @param value Input value
     * @param min Minimum value
     * @param max Maximum value
     * @returns Clamped value
     */
    public static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
    
    /**
     * Calculate RMS (Root Mean Square) of array
     * @param array Input array
     * @returns RMS value
     */
    public static rms(array: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
            sum += array[i] * array[i];
        }
        return Math.sqrt(sum / array.length);
    }
    
    /**
     * Calculate mean of array
     * @param array Input array
     * @returns Mean value
     */
    public static mean(array: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
            sum += array[i];
        }
        return sum / array.length;
    }
    
    /**
     * Calculate variance of array
     * @param array Input array
     * @returns Variance
     */
    public static variance(array: Float32Array): number {
        const meanVal = this.mean(array);
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
            const diff = array[i] - meanVal;
            sum += diff * diff;
        }
        return sum / array.length;
    }
    
    /**
     * Calculate standard deviation of array
     * @param array Input array
     * @returns Standard deviation
     */
    public static standardDeviation(array: Float32Array): number {
        return Math.sqrt(this.variance(array));
    }
    
    /**
     * Find peak (maximum) in array
     * @param array Input array
     * @returns Peak value and index
     */
    public static findPeak(array: Float32Array): { value: number; index: number } {
        let maxValue = array[0];
        let maxIndex = 0;
        
        for (let i = 1; i < array.length; i++) {
            if (array[i] > maxValue) {
                maxValue = array[i];
                maxIndex = i;
            }
        }
        
        return { value: maxValue, index: maxIndex };
    }
    
    /**
     * Find multiple peaks in array
     * @param array Input array
     * @param threshold Minimum peak height
     * @param minDistance Minimum distance between peaks
     * @returns Array of peaks
     */
    public static findPeaks(
        array: Float32Array, 
        threshold: number = 0.1, 
        minDistance: number = 1
    ): Array<{ value: number; index: number }> {
        const peaks: Array<{ value: number; index: number }> = [];
        
        for (let i = 1; i < array.length - 1; i++) {
            // Check if it's a local maximum above threshold
            if (array[i] > array[i - 1] && 
                array[i] > array[i + 1] && 
                array[i] > threshold) {
                
                // Check minimum distance from other peaks
                let conflictIndex = -1;
                for (let j = 0; j < peaks.length; j++) {
                    if (Math.abs(i - peaks[j].index) < minDistance) {
                        conflictIndex = j;
                        break;
                    }
                }
                
                if (conflictIndex === -1) {
                    // No conflict, add the peak
                    peaks.push({ value: array[i], index: i });
                } else if (array[i] > peaks[conflictIndex].value) {
                    // Current peak is higher, replace the conflicting one
                    peaks[conflictIndex] = { value: array[i], index: i };
                }
            }
        }
        
        return peaks.sort((a, b) => b.value - a.value);
    }
    
    /**
     * Normalize array to range [0, 1]
     * @param array Input array
     * @returns Normalized array
     */
    public static normalize(array: Float32Array): Float32Array {
        const result = new Float32Array(array.length);
        const max = Math.max(...Array.from(array));
        const min = Math.min(...Array.from(array));
        const range = max - min;
        
        if (range === 0) {
            result.fill(0);
            return result;
        }
        
        for (let i = 0; i < array.length; i++) {
            result[i] = (array[i] - min) / range;
        }
        
        return result;
    }
    
    /**
     * Smooth array using moving average
     * @param array Input array
     * @param windowSize Window size for averaging
     * @returns Smoothed array
     */
    public static movingAverage(array: Float32Array, windowSize: number): Float32Array {
        const result = new Float32Array(array.length);
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < array.length; i++) {
            let sum = 0;
            let count = 0;
            
            for (let j = Math.max(0, i - halfWindow); 
                 j <= Math.min(array.length - 1, i + halfWindow); j++) {
                sum += array[j];
                count++;
            }
            
            result[i] = sum / count;
        }
        
        return result;
    }
    
    /**
     * Apply exponential smoothing
     * @param array Input array
     * @param alpha Smoothing factor (0-1)
     * @returns Smoothed array
     */
    public static exponentialSmoothing(array: Float32Array, alpha: number): Float32Array {
        const result = new Float32Array(array.length);
        result[0] = array[0];
        
        for (let i = 1; i < array.length; i++) {
            result[i] = alpha * array[i] + (1 - alpha) * result[i - 1];
        }
        
        return result;
    }
    
    /**
     * Calculate correlation between two arrays
     * @param a First array
     * @param b Second array
     * @returns Correlation coefficient (-1 to 1)
     */
    public static correlation(a: Float32Array, b: Float32Array): number {
        if (a.length !== b.length) {
            throw new Error('Arrays must have the same length');
        }
        
        const meanA = this.mean(a);
        const meanB = this.mean(b);
        
        let numerator = 0;
        let sumSquareA = 0;
        let sumSquareB = 0;
        
        for (let i = 0; i < a.length; i++) {
            const diffA = a[i] - meanA;
            const diffB = b[i] - meanB;
            
            numerator += diffA * diffB;
            sumSquareA += diffA * diffA;
            sumSquareB += diffB * diffB;
        }
        
        const denominator = Math.sqrt(sumSquareA * sumSquareB);
        
        if (denominator === 0) {
            return 0;
        }
        
        return numerator / denominator;
    }
    
    /**
     * Zero-pad array to specified length
     * @param array Input array
     * @param targetLength Target length
     * @returns Zero-padded array
     */
    public static zeroPad(array: Float32Array, targetLength: number): Float32Array {
        if (array.length >= targetLength) {
            return array.slice(0, targetLength);
        }
        
        const padded = new Float32Array(targetLength);
        padded.set(array);
        return padded;
    }
    
    /**
     * Downsample array by factor
     * @param array Input array
     * @param factor Downsampling factor
     * @returns Downsampled array
     */
    public static downsample(array: Float32Array, factor: number): Float32Array {
        const newLength = Math.floor(array.length / factor);
        const result = new Float32Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
            result[i] = array[i * factor];
        }
        
        return result;
    }
    
    /**
     * Upsample array by factor (zero-insertion)
     * @param array Input array
     * @param factor Upsampling factor
     * @returns Upsampled array
     */
    public static upsample(array: Float32Array, factor: number): Float32Array {
        const result = new Float32Array(array.length * factor);
        
        for (let i = 0; i < array.length; i++) {
            result[i * factor] = array[i];
        }
        
        return result;
    }
    
    /**
     * Apply median filter to array
     * @param array Input array
     * @param windowSize Window size (should be odd)
     * @returns Median filtered array
     */
    public static medianFilter(array: Float32Array, windowSize: number): Float32Array {
        const result = new Float32Array(array.length);
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < array.length; i++) {
            const window: number[] = [];
            
            for (let j = Math.max(0, i - halfWindow); 
                 j <= Math.min(array.length - 1, i + halfWindow); j++) {
                window.push(array[j]);
            }
            
            window.sort((a, b) => a - b);
            result[i] = window[Math.floor(window.length / 2)];
        }
        
        return result;
    }
    
    /**
     * Calculate spectral centroid
     * @param magnitude Magnitude spectrum
     * @param frequencies Frequency bins
     * @returns Spectral centroid in Hz
     */
    public static spectralCentroid(magnitude: Float32Array, frequencies: Float32Array): number {
        if (magnitude.length !== frequencies.length) {
            throw new Error('Magnitude and frequency arrays must have the same length');
        }
        
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < magnitude.length; i++) {
            numerator += magnitude[i] * frequencies[i];
            denominator += magnitude[i];
        }
        
        return denominator === 0 ? 0 : numerator / denominator;
    }
    
    /**
     * Calculate spectral rolloff frequency
     * @param magnitude Magnitude spectrum
     * @param frequencies Frequency bins
     * @param threshold Rolloff threshold (e.g., 0.85 for 85%)
     * @returns Rolloff frequency in Hz
     */
    public static spectralRolloff(
        magnitude: Float32Array, 
        frequencies: Float32Array, 
        threshold: number = 0.85
    ): number {
        if (magnitude.length !== frequencies.length) {
            throw new Error('Magnitude and frequency arrays must have the same length');
        }
        
        const totalEnergy = magnitude.reduce((sum, mag) => sum + mag * mag, 0);
        const targetEnergy = totalEnergy * threshold;
        
        let cumulativeEnergy = 0;
        
        for (let i = 0; i < magnitude.length; i++) {
            cumulativeEnergy += magnitude[i] * magnitude[i];
            
            if (cumulativeEnergy >= targetEnergy) {
                return frequencies[i];
            }
        }
        
        return frequencies[frequencies.length - 1];
    }
    
    /**
     * Check if number is power of 2
     * @param n Number to check
     * @returns True if power of 2
     */
    public static isPowerOfTwo(n: number): boolean {
        return n > 0 && (n & (n - 1)) === 0;
    }
    
    /**
     * Find next power of 2
     * @param n Input number
     * @returns Next power of 2
     */
    public static nextPowerOfTwo(n: number): number {
        let power = 1;
        while (power < n) {
            power *= 2;
        }
        return power;
    }
    
    /**
     * Convert decibels to linear scale
     * @param db Decibel value
     * @returns Linear value
     */
    public static dbToLinear(db: number): number {
        return Math.pow(10, db / 20);
    }
    
    /**
     * Convert linear scale to decibels
     * @param linear Linear value
     * @returns Decibel value
     */
    public static linearToDb(linear: number): number {
        return 20 * Math.log10(Math.max(linear, 1e-10));
    }
}

export default MathUtils;