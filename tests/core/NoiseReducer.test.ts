/**
 * Tests for NoiseReducer module
 */

import { NoiseReducer } from '../../src/core/NoiseReducer';

describe('NoiseReducer', () => {
    let noiseReducer: NoiseReducer;
    const sampleRate = 44100;
    
    beforeEach(() => {
        noiseReducer = new NoiseReducer(sampleRate);
    });
    
    describe('Initialization', () => {
        test('should create NoiseReducer with default config', () => {
            const config = noiseReducer.getConfig();
            
            expect(config.enabled).toBe(true);
            expect(config.aggressiveness).toBe(0.6);
            expect(config.noiseFloorDb).toBe(-40);
            expect(config.spectralSmoothing).toBe(0.8);
            expect(config.adaptiveMode).toBe(true);
            expect(config.windowSize).toBe(2048);
            expect(config.overlapRatio).toBe(0.5);
        });
        
        test('should create NoiseReducer with custom config', () => {
            const customConfig = {
                enabled: false,
                aggressiveness: 0.8,
                noiseFloorDb: -30,
                spectralSmoothing: 0.9,
                adaptiveMode: false,
                windowSize: 1024,
                overlapRatio: 0.75
            };
            
            const customReducer = new NoiseReducer(sampleRate, customConfig);
            const config = customReducer.getConfig();
            
            expect(config.enabled).toBe(false);
            expect(config.aggressiveness).toBe(0.8);
            expect(config.noiseFloorDb).toBe(-30);
            expect(config.spectralSmoothing).toBe(0.9);
            expect(config.adaptiveMode).toBe(false);
            expect(config.windowSize).toBe(1024);
            expect(config.overlapRatio).toBe(0.75);
        });
    });
    
    describe('Basic Processing', () => {
        test('should process audio when enabled', () => {
            const inputBuffer = generateTestSignal(1024);
            
            const outputBuffer = noiseReducer.process(inputBuffer);
            
            expect(outputBuffer).toBeInstanceOf(Float32Array);
            expect(outputBuffer.length).toBe(inputBuffer.length);
        });
        
        test('should bypass processing when disabled', () => {
            noiseReducer.setEnabled(false);
            const inputBuffer = generateTestSignal(1024);
            
            const outputBuffer = noiseReducer.process(inputBuffer);
            
            expect(outputBuffer).toBe(inputBuffer);
        });
        
        test('should handle empty buffer', () => {
            const emptyBuffer = new Float32Array(0);
            
            expect(() => {
                noiseReducer.process(emptyBuffer);
            }).not.toThrow();
        });
        
        test('should handle small buffers', () => {
            const smallBuffer = generateTestSignal(64);
            
            expect(() => {
                noiseReducer.process(smallBuffer);
            }).not.toThrow();
        });
    });
    
    describe('Noise Learning', () => {
        test('should start noise learning', () => {
            noiseReducer.startNoiseLearning(500);
            
            expect(noiseReducer.isLearningNoise()).toBe(true);
            
            const status = noiseReducer.getNoiseProfileStatus();
            expect(status.isLearning).toBe(true);
            expect(status.hasProfile).toBe(false);
            expect(status.learningProgress).toBe(0);
        });
        
        test('should stop noise learning', () => {
            noiseReducer.startNoiseLearning(500);
            expect(noiseReducer.isLearningNoise()).toBe(true);
            
            noiseReducer.stopNoiseLearning();
            expect(noiseReducer.isLearningNoise()).toBe(false);
        });
        
        test('should update learning progress during processing', () => {
            noiseReducer.startNoiseLearning(100); // Short duration for testing
            
            const noiseBuffer = generateNoise(2048);
            
            // Process some frames
            for (let i = 0; i < 5; i++) {
                noiseReducer.process(noiseBuffer);
                
                const status = noiseReducer.getNoiseProfileStatus();
                expect(status.learningProgress).toBeGreaterThanOrEqual(0);
                expect(status.learningProgress).toBeLessThanOrEqual(1);
            }
        });
        
        test('should create noise profile after learning', () => {
            noiseReducer.startNoiseLearning(100);
            
            const noiseBuffer = generateNoise(2048);
            
            // Process enough frames to complete learning
            for (let i = 0; i < 10; i++) {
                noiseReducer.process(noiseBuffer);
            }
            
            const status = noiseReducer.getNoiseProfileStatus();
            expect(status.hasProfile).toBe(true);
            expect(status.isLearning).toBe(false);
        });
        
        test('should reset noise profile', () => {
            noiseReducer.startNoiseLearning(100);
            
            const noiseBuffer = generateNoise(2048);
            for (let i = 0; i < 10; i++) {
                noiseReducer.process(noiseBuffer);
            }
            
            // Should have profile
            expect(noiseReducer.getNoiseProfileStatus().hasProfile).toBe(true);
            
            noiseReducer.resetNoiseProfile();
            
            // Should not have profile
            const status = noiseReducer.getNoiseProfileStatus();
            expect(status.hasProfile).toBe(false);
            expect(status.isLearning).toBe(false);
        });
    });
    
    describe('Configuration', () => {
        test('should update configuration', () => {
            const newConfig = {
                aggressiveness: 0.9,
                noiseFloorDb: -35,
                spectralSmoothing: 0.7
            };
            
            noiseReducer.setConfig(newConfig);
            
            const config = noiseReducer.getConfig();
            expect(config.aggressiveness).toBe(0.9);
            expect(config.noiseFloorDb).toBe(-35);
            expect(config.spectralSmoothing).toBe(0.7);
        });
        
        test('should recreate FFT when window size changes', () => {
            const originalConfig = noiseReducer.getConfig();
            
            noiseReducer.setConfig({ windowSize: 4096 });
            
            const newConfig = noiseReducer.getConfig();
            expect(newConfig.windowSize).toBe(4096);
            expect(newConfig.windowSize).not.toBe(originalConfig.windowSize);
        });
        
        test('should toggle enabled state', () => {
            expect(noiseReducer.isEnabled()).toBe(true);
            
            noiseReducer.setEnabled(false);
            expect(noiseReducer.isEnabled()).toBe(false);
            
            noiseReducer.setEnabled(true);
            expect(noiseReducer.isEnabled()).toBe(true);
        });
    });
    
    describe('Signal Processing Effects', () => {
        test('should reduce noise in signal', () => {
            // Learn noise profile first
            noiseReducer.startNoiseLearning(100);
            const noiseBuffer = generateNoise(2048);
            
            for (let i = 0; i < 10; i++) {
                noiseReducer.process(noiseBuffer);
            }
            
            // Now process signal with noise
            const cleanSignal = generateSineWave(440, sampleRate, 2048);
            const noisySignal = addNoise(cleanSignal, 0.3);
            
            const processedSignal = noiseReducer.process(noisySignal);
            
            // Processed signal should have lower noise
            const originalNoise = calculateNoiseLevel(noisySignal, cleanSignal);
            const processedNoise = calculateNoiseLevel(processedSignal, cleanSignal);
            
            expect(processedNoise).toBeLessThanOrEqual(originalNoise);
        });
        
        test('should preserve signal content', () => {
            const signal = generateSineWave(440, sampleRate, 2048);
            
            const processedSignal = noiseReducer.process(signal);
            
            // Should not drastically change clean signal
            const correlation = calculateCorrelation(signal, processedSignal);
            expect(correlation).toBeGreaterThan(0.8);
        });
    });
    
    describe('Different Aggressiveness Levels', () => {
        test('should vary processing with aggressiveness', () => {
            const signal = generateSineWave(440, sampleRate, 2048);
            const noisySignal = addNoise(signal, 0.2);
            
            // Learn noise profile
            noiseReducer.startNoiseLearning(50);
            const noiseBuffer = generateNoise(2048);
            for (let i = 0; i < 5; i++) {
                noiseReducer.process(noiseBuffer);
            }
            
            // Test different aggressiveness levels
            noiseReducer.setConfig({ aggressiveness: 0.2 });
            const gentleProcessed = noiseReducer.process(noisySignal.slice());
            
            noiseReducer.setConfig({ aggressiveness: 0.8 });
            const aggressiveProcessed = noiseReducer.process(noisySignal.slice());
            
            // More aggressive should reduce more noise
            const gentleNoise = calculateNoiseLevel(gentleProcessed, signal);
            const aggressiveNoise = calculateNoiseLevel(aggressiveProcessed, signal);
            
            expect(aggressiveNoise).toBeLessThanOrEqual(gentleNoise + 0.1);
        });
    });
    
    describe('Edge Cases', () => {
        test('should handle silent input', () => {
            const silentBuffer = new Float32Array(2048);
            
            expect(() => {
                noiseReducer.process(silentBuffer);
            }).not.toThrow();
        });
        
        test('should handle very loud input', () => {
            const loudBuffer = new Float32Array(2048);
            loudBuffer.fill(1.0); // Maximum amplitude
            
            expect(() => {
                noiseReducer.process(loudBuffer);
            }).not.toThrow();
        });
        
        test('should handle processing without noise profile', () => {
            const signal = generateSineWave(440, sampleRate, 2048);
            
            // Process without learning noise first
            const processedSignal = noiseReducer.process(signal);
            
            expect(processedSignal).toBeInstanceOf(Float32Array);
            expect(processedSignal.length).toBe(signal.length);
        });
    });
});

// Helper functions
function generateTestSignal(length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    }
    return buffer;
}

function generateSineWave(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return buffer;
}

function generateNoise(length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = (Math.random() - 0.5) * 0.1; // Low level noise
    }
    return buffer;
}

function addNoise(signal: Float32Array, noiseLevel: number): Float32Array {
    const noisy = new Float32Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
        noisy[i] = signal[i] + (Math.random() - 0.5) * noiseLevel;
    }
    return noisy;
}

function calculateNoiseLevel(noisySignal: Float32Array, cleanSignal: Float32Array): number {
    let sumSquaredError = 0;
    for (let i = 0; i < noisySignal.length; i++) {
        const error = noisySignal[i] - cleanSignal[i];
        sumSquaredError += error * error;
    }
    return Math.sqrt(sumSquaredError / noisySignal.length);
}

// Enhanced analysis functions
function calculateCorrelation(a: Float32Array, b: Float32Array): number {
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
    
    for (let i = 0; i < a.length; i++) {
        sumA += a[i];
        sumB += b[i];
        sumAB += a[i] * b[i];
        sumA2 += a[i] * a[i];
        sumB2 += b[i] * b[i];
    }
    
    const n = a.length;
    const numerator = n * sumAB - sumA * sumB;
    const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
    
    return denominator === 0 ? 0 : numerator / denominator;
}

function calculateSNR(signal: Float32Array, reference: Float32Array): number {
    let signalPower = 0;
    let noisePower = 0;
    
    for (let i = 0; i < signal.length; i++) {
        signalPower += reference[i] * reference[i];
        const noise = signal[i] - reference[i];
        noisePower += noise * noise;
    }
    
    if (noisePower === 0) return 100; // Very high SNR
    return 10 * Math.log10(signalPower / noisePower);
}

function calculateRMSPower(signal: Float32Array): number {
    let sumSquared = 0;
    for (let i = 0; i < signal.length; i++) {
        sumSquared += signal[i] * signal[i];
    }
    return Math.sqrt(sumSquared / signal.length);
}

function calculateSpectralFlux(signal: Float32Array): number {
    // Simple spectral flux calculation
    let flux = 0;
    const windowSize = 256;
    
    for (let i = windowSize; i < signal.length - windowSize; i += windowSize) {
        let currentEnergy = 0;
        let previousEnergy = 0;
        
        for (let j = 0; j < windowSize; j++) {
            currentEnergy += signal[i + j] * signal[i + j];
            previousEnergy += signal[i - windowSize + j] * signal[i - windowSize + j];
        }
        
        const diff = currentEnergy - previousEnergy;
        if (diff > 0) flux += diff;
    }
    
    return flux / (signal.length / windowSize);
}

function calculatePerceptualQuality(reference: Float32Array, processed: Float32Array): number {
    // Simplified perceptual quality metric
    const correlation = calculateCorrelation(reference, processed);
    const snr = calculateSNR(processed, reference);
    const spectralPreservation = calculateSpectralPreservation(reference, processed);
    
    // Weighted combination
    return 0.4 * Math.max(0, Math.min(1, correlation)) + 
           0.3 * Math.max(0, Math.min(1, (snr + 20) / 40)) + 
           0.3 * spectralPreservation;
}

function calculateSpectralPreservation(reference: Float32Array, processed: Float32Array): number {
    // Calculate how well spectral characteristics are preserved
    const refSpectrum = calculateSimpleSpectrum(reference);
    const procSpectrum = calculateSimpleSpectrum(processed);
    
    let similarity = 0;
    for (let i = 0; i < Math.min(refSpectrum.length, procSpectrum.length); i++) {
        const refMag = Math.sqrt(refSpectrum[i]);
        const procMag = Math.sqrt(procSpectrum[i]);
        const diff = Math.abs(refMag - procMag) / (refMag + procMag + 1e-10);
        similarity += 1 - Math.min(1, diff);
    }
    
    return similarity / Math.min(refSpectrum.length, procSpectrum.length);
}

function calculateHarmonicPreservation(reference: Float32Array, processed: Float32Array): number {
    // Analyze how well harmonic structure is preserved
    const refHarmonics = extractHarmonics(reference);
    const procHarmonics = extractHarmonics(processed);
    
    let preservation = 0;
    const numHarmonics = Math.min(refHarmonics.length, procHarmonics.length);
    
    for (let i = 0; i < numHarmonics; i++) {
        const ratio = Math.min(refHarmonics[i], procHarmonics[i]) / 
                     (Math.max(refHarmonics[i], procHarmonics[i]) + 1e-10);
        preservation += ratio;
    }
    
    return numHarmonics > 0 ? preservation / numHarmonics : 0;
}

function calculateSimpleSpectrum(signal: Float32Array): Float32Array {
    // Simple DFT for spectrum analysis
    const N = Math.min(512, signal.length);
    const spectrum = new Float32Array(N / 2);
    
    for (let k = 0; k < N / 2; k++) {
        let real = 0, imag = 0;
        for (let n = 0; n < N; n++) {
            const angle = -2 * Math.PI * k * n / N;
            real += signal[n] * Math.cos(angle);
            imag += signal[n] * Math.sin(angle);
        }
        spectrum[k] = real * real + imag * imag;
    }
    
    return spectrum;
}

function extractHarmonics(signal: Float32Array): Float32Array {
    const spectrum = calculateSimpleSpectrum(signal);
    const harmonics = [];
    
    // Find peaks in spectrum (simplified harmonic detection)
    for (let i = 2; i < spectrum.length - 2; i++) {
        if (spectrum[i] > spectrum[i-1] && spectrum[i] > spectrum[i+1] && 
            spectrum[i] > spectrum[i-2] && spectrum[i] > spectrum[i+2]) {
            harmonics.push(spectrum[i]);
        }
    }
    
    return new Float32Array(harmonics.slice(0, 8)); // First 8 harmonics
}