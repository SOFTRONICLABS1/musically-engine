/**
 * Tests for MathUtils
 */

import { MathUtils } from '../../src/utils/MathUtils';

describe('MathUtils', () => {
    describe('Music Theory Conversions', () => {
        test('should convert frequency to MIDI note correctly', () => {
            expect(MathUtils.frequencyToMidi(440)).toBeCloseTo(69, 5); // A4
            expect(MathUtils.frequencyToMidi(261.63)).toBeCloseTo(60, 1); // C4
            expect(MathUtils.frequencyToMidi(523.25)).toBeCloseTo(72, 1); // C5
        });
        
        test('should convert MIDI note to frequency correctly', () => {
            expect(MathUtils.midiToFrequency(69)).toBeCloseTo(440, 5); // A4
            expect(MathUtils.midiToFrequency(60)).toBeCloseTo(261.63, 1); // C4
            expect(MathUtils.midiToFrequency(72)).toBeCloseTo(523.25, 1); // C5
        });
        
        test('should convert frequency to cents correctly', () => {
            expect(MathUtils.frequencyToCents(440, 440)).toBeCloseTo(0, 5);
            expect(MathUtils.frequencyToCents(440, 220)).toBeCloseTo(1200, 5);
            expect(MathUtils.frequencyToCents(466.16, 440)).toBeCloseTo(100, 1);
        });
        
        test('should convert cents to ratio correctly', () => {
            expect(MathUtils.centsToRatio(0)).toBeCloseTo(1, 5);
            expect(MathUtils.centsToRatio(1200)).toBeCloseTo(2, 5);
            expect(MathUtils.centsToRatio(100)).toBeCloseTo(1.059463, 5);
        });
    });
    
    describe('Basic Math Operations', () => {
        test('should perform linear interpolation correctly', () => {
            expect(MathUtils.lerp(0, 10, 0.5)).toBeCloseTo(5, 5);
            expect(MathUtils.lerp(0, 10, 0)).toBeCloseTo(0, 5);
            expect(MathUtils.lerp(0, 10, 1)).toBeCloseTo(10, 5);
            expect(MathUtils.lerp(-5, 5, 0.75)).toBeCloseTo(2.5, 5);
        });
        
        test('should clamp values correctly', () => {
            expect(MathUtils.clamp(5, 0, 10)).toBe(5);
            expect(MathUtils.clamp(-5, 0, 10)).toBe(0);
            expect(MathUtils.clamp(15, 0, 10)).toBe(10);
            expect(MathUtils.clamp(7.5, 0, 10)).toBe(7.5);
        });
    });
    
    describe('Array Statistics', () => {
        test('should calculate RMS correctly', () => {
            const array = new Float32Array([3, 4]);
            expect(MathUtils.rms(array)).toBeCloseTo(3.536, 3); // sqrt((9+16)/2)
            
            const zeros = new Float32Array([0, 0, 0]);
            expect(MathUtils.rms(zeros)).toBe(0);
        });
        
        test('should calculate mean correctly', () => {
            const array = new Float32Array([1, 2, 3, 4, 5]);
            expect(MathUtils.mean(array)).toBe(3);
            
            const negative = new Float32Array([-2, -1, 0, 1, 2]);
            expect(MathUtils.mean(negative)).toBe(0);
        });
        
        test('should calculate variance correctly', () => {
            const array = new Float32Array([1, 2, 3, 4, 5]);
            const mean = 3;
            const expectedVariance = (4 + 1 + 0 + 1 + 4) / 5; // 2
            expect(MathUtils.variance(array)).toBeCloseTo(expectedVariance, 5);
        });
        
        test('should calculate standard deviation correctly', () => {
            const array = new Float32Array([1, 2, 3, 4, 5]);
            const variance = MathUtils.variance(array);
            expect(MathUtils.standardDeviation(array)).toBeCloseTo(Math.sqrt(variance), 5);
        });
    });
    
    describe('Peak Detection', () => {
        test('should find single peak correctly', () => {
            const array = new Float32Array([1, 3, 5, 2, 1]);
            const peak = MathUtils.findPeak(array);
            
            expect(peak.value).toBe(5);
            expect(peak.index).toBe(2);
        });
        
        test('should find multiple peaks correctly', () => {
            const array = new Float32Array([1, 3, 1, 5, 1, 4, 1]);
            const peaks = MathUtils.findPeaks(array, 2, 1);
            
            expect(peaks.length).toBe(3);
            expect(peaks[0].value).toBe(5); // Highest peak first
            expect(peaks[0].index).toBe(3);
            expect(peaks[1].value).toBe(4);
            expect(peaks[1].index).toBe(5);
            expect(peaks[2].value).toBe(3);
            expect(peaks[2].index).toBe(1);
        });
        
        test('should respect minimum distance between peaks', () => {
            const array = new Float32Array([1, 3, 2, 4, 1]);
            const peaks = MathUtils.findPeaks(array, 1, 3);
            
            // Should only find one peak due to minimum distance constraint
            expect(peaks.length).toBe(1);
            expect(peaks[0].value).toBe(4); // Higher peak
        });
    });
    
    describe('Array Processing', () => {
        test('should normalize array correctly', () => {
            const array = new Float32Array([2, 4, 6, 8]);
            const normalized = MathUtils.normalize(array);
            
            expect(normalized[0]).toBeCloseTo(0, 5);
            expect(normalized[1]).toBeCloseTo(1/3, 5);
            expect(normalized[2]).toBeCloseTo(2/3, 5);
            expect(normalized[3]).toBeCloseTo(1, 5);
        });
        
        test('should handle constant array in normalization', () => {
            const array = new Float32Array([5, 5, 5, 5]);
            const normalized = MathUtils.normalize(array);
            
            expect(Array.from(normalized)).toEqual([0, 0, 0, 0]);
        });
        
        test('should apply moving average correctly', () => {
            const array = new Float32Array([1, 2, 3, 4, 5]);
            const smoothed = MathUtils.movingAverage(array, 3);
            
            expect(smoothed[0]).toBeCloseTo(1.5, 5); // (1+2)/2
            expect(smoothed[1]).toBeCloseTo(2, 5);   // (1+2+3)/3
            expect(smoothed[2]).toBeCloseTo(3, 5);   // (2+3+4)/3
            expect(smoothed[3]).toBeCloseTo(4, 5);   // (3+4+5)/3
            expect(smoothed[4]).toBeCloseTo(4.5, 5); // (4+5)/2
        });
        
        test('should apply exponential smoothing correctly', () => {
            const array = new Float32Array([1, 2, 3, 4]);
            const alpha = 0.5;
            const smoothed = MathUtils.exponentialSmoothing(array, alpha);
            
            expect(smoothed[0]).toBe(1);
            expect(smoothed[1]).toBeCloseTo(1.5, 5); // 0.5*2 + 0.5*1
            expect(smoothed[2]).toBeCloseTo(2.25, 5); // 0.5*3 + 0.5*1.5
            expect(smoothed[3]).toBeCloseTo(3.125, 5); // 0.5*4 + 0.5*2.25
        });
    });
    
    describe('Correlation', () => {
        test('should calculate perfect correlation correctly', () => {
            const a = new Float32Array([1, 2, 3, 4]);
            const b = new Float32Array([2, 4, 6, 8]);
            
            const correlation = MathUtils.correlation(a, b);
            expect(correlation).toBeCloseTo(1, 5);
        });
        
        test('should calculate negative correlation correctly', () => {
            const a = new Float32Array([1, 2, 3, 4]);
            const b = new Float32Array([4, 3, 2, 1]);
            
            const correlation = MathUtils.correlation(a, b);
            expect(correlation).toBeCloseTo(-1, 5);
        });
        
        test('should calculate no correlation correctly', () => {
            const a = new Float32Array([1, 1, 1, 1]);
            const b = new Float32Array([1, 2, 3, 4]);
            
            const correlation = MathUtils.correlation(a, b);
            expect(correlation).toBeCloseTo(0, 5);
        });
        
        test('should handle mismatched array lengths', () => {
            const a = new Float32Array([1, 2, 3]);
            const b = new Float32Array([1, 2]);
            
            expect(() => MathUtils.correlation(a, b)).toThrow();
        });
    });
    
    describe('Array Manipulation', () => {
        test('should zero-pad correctly', () => {
            const array = new Float32Array([1, 2, 3]);
            const padded = MathUtils.zeroPad(array, 6);
            
            expect(padded.length).toBe(6);
            expect(Array.from(padded)).toEqual([1, 2, 3, 0, 0, 0]);
        });
        
        test('should truncate when target is smaller', () => {
            const array = new Float32Array([1, 2, 3, 4, 5]);
            const truncated = MathUtils.zeroPad(array, 3);
            
            expect(truncated.length).toBe(3);
            expect(Array.from(truncated)).toEqual([1, 2, 3]);
        });
        
        test('should downsample correctly', () => {
            const array = new Float32Array([1, 2, 3, 4, 5, 6]);
            const downsampled = MathUtils.downsample(array, 2);
            
            expect(downsampled.length).toBe(3);
            expect(Array.from(downsampled)).toEqual([1, 3, 5]);
        });
        
        test('should upsample correctly', () => {
            const array = new Float32Array([1, 2, 3]);
            const upsampled = MathUtils.upsample(array, 2);
            
            expect(upsampled.length).toBe(6);
            expect(Array.from(upsampled)).toEqual([1, 0, 2, 0, 3, 0]);
        });
    });
    
    describe('Spectral Analysis', () => {
        test('should calculate spectral centroid correctly', () => {
            const magnitude = new Float32Array([0, 1, 2, 1, 0]);
            const frequencies = new Float32Array([0, 100, 200, 300, 400]);
            
            const centroid = MathUtils.spectralCentroid(magnitude, frequencies);
            const expected = (0*0 + 1*100 + 2*200 + 1*300 + 0*400) / (0+1+2+1+0);
            
            expect(centroid).toBeCloseTo(expected, 5);
        });
        
        test('should handle zero magnitude in spectral centroid', () => {
            const magnitude = new Float32Array([0, 0, 0]);
            const frequencies = new Float32Array([100, 200, 300]);
            
            const centroid = MathUtils.spectralCentroid(magnitude, frequencies);
            expect(centroid).toBe(0);
        });
        
        test('should calculate spectral rolloff correctly', () => {
            const magnitude = new Float32Array([1, 2, 3, 4, 0]);
            const frequencies = new Float32Array([0, 100, 200, 300, 400]);
            
            const rolloff = MathUtils.spectralRolloff(magnitude, frequencies, 0.85);
            
            // Total energy = 1 + 4 + 9 + 16 + 0 = 30
            // 85% of 30 = 25.5
            // Cumulative: 1, 5, 14, 30
            // Should rolloff at 300Hz
            expect(rolloff).toBe(300);
        });
    });
    
    describe('Utility Functions', () => {
        test('should detect power of two correctly', () => {
            expect(MathUtils.isPowerOfTwo(1)).toBe(true);
            expect(MathUtils.isPowerOfTwo(2)).toBe(true);
            expect(MathUtils.isPowerOfTwo(4)).toBe(true);
            expect(MathUtils.isPowerOfTwo(1024)).toBe(true);
            expect(MathUtils.isPowerOfTwo(3)).toBe(false);
            expect(MathUtils.isPowerOfTwo(1000)).toBe(false);
            expect(MathUtils.isPowerOfTwo(0)).toBe(false);
        });
        
        test('should find next power of two correctly', () => {
            expect(MathUtils.nextPowerOfTwo(1)).toBe(1);
            expect(MathUtils.nextPowerOfTwo(3)).toBe(4);
            expect(MathUtils.nextPowerOfTwo(1000)).toBe(1024);
            expect(MathUtils.nextPowerOfTwo(1024)).toBe(1024);
        });
        
        test('should convert between dB and linear correctly', () => {
            expect(MathUtils.dbToLinear(0)).toBeCloseTo(1, 5);
            expect(MathUtils.dbToLinear(20)).toBeCloseTo(10, 5);
            expect(MathUtils.dbToLinear(-20)).toBeCloseTo(0.1, 5);
            
            expect(MathUtils.linearToDb(1)).toBeCloseTo(0, 5);
            expect(MathUtils.linearToDb(10)).toBeCloseTo(20, 5);
            expect(MathUtils.linearToDb(0.1)).toBeCloseTo(-20, 5);
        });
        
        test('should handle very small values in linearToDb', () => {
            const result = MathUtils.linearToDb(0);
            expect(result).toBeLessThan(-100); // Should be very negative
            expect(isFinite(result)).toBe(true); // Should not be -Infinity
        });
    });
});