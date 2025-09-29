/**
 * Unit Tests for Psychoacoustic Model
 */

import { PsychoacousticModel, PsychoacousticConfig } from '../../src/utils/PsychoacousticModel';

describe('PsychoacousticModel', () => {
    let model: PsychoacousticModel;
    const sampleRate = 44100;
    const fftSize = 2048;
    
    beforeEach(() => {
        model = new PsychoacousticModel({
            sampleRate,
            fftSize,
            enableTemporalMasking: true,
            enableSimultaneousMasking: true,
            maskingThreshold: -20
        });
    });
    
    describe('Initialization', () => {
        test('should initialize with required configuration', () => {
            const requiredConfig = {
                sampleRate: 44100,
                fftSize: 2048,
                enableTemporalMasking: true,
                enableSimultaneousMasking: true,
                maskingThreshold: -20
            };
            const defaultModel = new PsychoacousticModel(requiredConfig);
            const config = defaultModel.getConfig();
            
            expect(config.fftSize).toBe(2048);
            expect(config.sampleRate).toBe(44100);
            expect(config.enableTemporalMasking).toBe(true);
            expect(config.enableSimultaneousMasking).toBe(true);
            expect(config.maskingThreshold).toBe(-20);
        });
        
        test('should initialize with custom configuration', () => {
            const customConfig: PsychoacousticConfig = {
                fftSize: 1024,
                sampleRate: 48000,
                enableTemporalMasking: false,
                enableSimultaneousMasking: false,
                maskingThreshold: -15
            };
            
            const customModel = new PsychoacousticModel(customConfig);
            const config = customModel.getConfig();
            
            expect(config.fftSize).toBe(1024);
            expect(config.sampleRate).toBe(48000);
            expect(config.enableTemporalMasking).toBe(false);
            expect(config.maskingThreshold).toBe(-15);
        });
    });
    
    describe('Masking Threshold Calculation', () => {
        test('should calculate masking thresholds for spectrum', () => {
            const spectrum = generateTestSpectrum(fftSize / 2);
            
            const maskingResult = model.calculateMaskingThresholds(spectrum);
            
            expect(maskingResult.thresholds).toHaveLength(spectrum.length);
            expect(maskingResult.frequencies).toHaveLength(spectrum.length);
            expect(maskingResult.barkScale).toHaveLength(spectrum.length);
            expect(maskingResult.thresholds.every(value => !isNaN(value))).toBe(true);
        });
        
        test('should calculate masking thresholds with temporal component', () => {
            const spectrum1 = generateTestSpectrum(fftSize / 2);
            const spectrum2 = generateTestSpectrum(fftSize / 2);
            
            // First frame
            const result1 = model.calculateMaskingThresholds(spectrum1);
            
            // Second frame with temporal masking
            const result2 = model.calculateMaskingThresholds(spectrum2, spectrum1);
            
            expect(result2.thresholds).toHaveLength(spectrum2.length);
            expect(result2.thresholds.every(value => !isNaN(value))).toBe(true);
        });
        
        test('should handle zero spectrum', () => {
            const zeroSpectrum = new Float32Array(fftSize / 2);
            
            expect(() => {
                const result = model.calculateMaskingThresholds(zeroSpectrum);
                expect(result.thresholds).toHaveLength(zeroSpectrum.length);
            }).not.toThrow();
        });
    });
    
    describe('Perceptual Masking', () => {
        test('should apply perceptual masking to signal', () => {
            const signal = generateTestSignal(fftSize);
            const noise = generateTestNoise(fftSize, 0.1);
            
            const maskedSignal = model.applyPerceptualMasking(signal, noise);
            
            expect(maskedSignal).toHaveLength(signal.length);
            expect(maskedSignal.every(value => !isNaN(value) && isFinite(value))).toBe(true);
        });
        
        test('should handle silent signal', () => {
            const silentSignal = new Float32Array(fftSize);
            const noise = generateTestNoise(fftSize);
            
            expect(() => {
                const maskedSignal = model.applyPerceptualMasking(silentSignal, noise);
                expect(maskedSignal).toHaveLength(silentSignal.length);
            }).not.toThrow();
        });
    });
    
    describe('Perceptual Quality Assessment', () => {
        test('should calculate perceptual quality score', () => {
            const signal = generateTestSignal(fftSize);
            
            const quality = model.calculatePerceptualQuality(signal);
            
            expect(quality).toBeGreaterThanOrEqual(0);
            expect(quality).toBeLessThanOrEqual(1);
        });
        
        test('should return lower quality for noisy signal', () => {
            const cleanSignal = generateTestSignal(fftSize);
            const noisySignal = addNoise(cleanSignal, 0.5);
            
            const cleanQuality = model.calculatePerceptualQuality(cleanSignal);
            const noisyQuality = model.calculatePerceptualQuality(noisySignal);
            
            expect(noisyQuality).toBeLessThanOrEqual(cleanQuality);
        });
        
        test('should handle edge cases', () => {
            const silentSignal = new Float32Array(fftSize);
            const veryLoudSignal = new Float32Array(fftSize).fill(10);
            
            expect(() => {
                const silentQuality = model.calculatePerceptualQuality(silentSignal);
                const loudQuality = model.calculatePerceptualQuality(veryLoudSignal);
                
                expect(silentQuality).toBeGreaterThanOrEqual(0);
                expect(loudQuality).toBeGreaterThanOrEqual(0);
            }).not.toThrow();
        });
    });
    
    describe('Configuration Management', () => {
        test('should update configuration', () => {
            const newConfig: Partial<PsychoacousticConfig> = {
                maskingThreshold: -15,
                enableTemporalMasking: false
            };
            
            model.updateConfig(newConfig);
            
            const config = model.getConfig();
            expect(config.maskingThreshold).toBe(-15);
            expect(config.enableTemporalMasking).toBe(false);
        });
        
        test('should preserve other config values when updating', () => {
            const originalConfig = model.getConfig();
            
            model.updateConfig({ maskingThreshold: -10 });
            
            const newConfig = model.getConfig();
            expect(newConfig.maskingThreshold).toBe(-10);
            expect(newConfig.sampleRate).toBe(originalConfig.sampleRate);
            expect(newConfig.fftSize).toBe(originalConfig.fftSize);
        });
    });
    
    describe('Robustness Tests', () => {
        test('should handle empty spectrum', () => {
            const emptySpectrum = new Float32Array(0);
            
            expect(() => {
                const result = model.calculateMaskingThresholds(emptySpectrum);
                expect(result.thresholds).toHaveLength(0);
            }).not.toThrow();
        });
        
        test('should handle very large spectrum values', () => {
            const spectrum = new Float32Array(fftSize / 2);
            spectrum.fill(1e6); // Very large values
            
            expect(() => {
                const result = model.calculateMaskingThresholds(spectrum);
                expect(result.thresholds.every(value => !isNaN(value) && isFinite(value))).toBe(true);
            }).not.toThrow();
        });
        
        test('should handle very small spectrum values', () => {
            const spectrum = new Float32Array(fftSize / 2);
            spectrum.fill(1e-10); // Very small values
            
            expect(() => {
                const result = model.calculateMaskingThresholds(spectrum);
                expect(result.thresholds.every(value => !isNaN(value) && isFinite(value))).toBe(true);
            }).not.toThrow();
        });
    });
});

// Helper functions
function generateTestSpectrum(length: number): Float32Array {
    const spectrum = new Float32Array(length);
    
    // Generate a realistic spectrum with multiple peaks
    for (let i = 0; i < length; i++) {
        const frequency = (i / length) * (44100 / 2);
        
        // Add peaks at various frequencies
        let amplitude = 0;
        amplitude += 0.8 * Math.exp(-Math.pow((frequency - 440) / 100, 2)); // Peak at 440 Hz
        amplitude += 0.6 * Math.exp(-Math.pow((frequency - 880) / 150, 2)); // Peak at 880 Hz
        amplitude += 0.4 * Math.exp(-Math.pow((frequency - 1320) / 200, 2)); // Peak at 1320 Hz
        
        // Add some background noise
        amplitude += 0.01 * Math.random();
        
        spectrum[i] = amplitude;
    }
    
    return spectrum;
}

function generateTestSignal(length: number): Float32Array {
    const signal = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        // Generate a complex harmonic signal
        signal[i] = 
            0.6 * Math.sin(2 * Math.PI * 440 * i / 44100) +      // Fundamental
            0.3 * Math.sin(2 * Math.PI * 880 * i / 44100) +      // First harmonic
            0.15 * Math.sin(2 * Math.PI * 1320 * i / 44100);     // Second harmonic
    }
    
    return signal;
}

function generateTestNoise(length: number, amplitude: number = 0.1): Float32Array {
    const noise = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        noise[i] = amplitude * (Math.random() - 0.5);
    }
    
    return noise;
}

function addNoise(signal: Float32Array, noiseLevel: number): Float32Array {
    const noisy = new Float32Array(signal.length);
    
    for (let i = 0; i < signal.length; i++) {
        noisy[i] = signal[i] + noiseLevel * (Math.random() - 0.5);
    }
    
    return noisy;
}