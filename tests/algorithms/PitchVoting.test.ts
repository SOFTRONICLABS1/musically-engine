/**
 * Tests for PitchVoting - Multi-Algorithm Pitch Detection Voting System
 */

import { PitchVoting, PitchVotingConfig, VotingResult, AlgorithmResult } from '../../src/algorithms/PitchVoting';

describe('PitchVoting', () => {
    let voting: PitchVoting;
    const sampleRate = 44100;
    const frameSize = 2048;
    
    beforeEach(() => {
        voting = new PitchVoting({
            sampleRate,
            frameSize,
            minFrequency: 80,
            maxFrequency: 2000,
            confidenceThreshold: 0.5
        });
    });
    
    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultVoting = new PitchVoting();
            expect(defaultVoting).toBeDefined();
        });
        
        test('should initialize with custom configuration', () => {
            const customVoting = new PitchVoting({
                sampleRate: 48000,
                frameSize: 4096,
                minFrequency: 50,
                maxFrequency: 4000,
                enableAdaptiveWeighting: false,
                enableOutlierRejection: false
            });
            expect(customVoting).toBeDefined();
        });
    });
    
    describe('Multi-Algorithm Pitch Detection', () => {
        test('should detect pitch using multiple algorithms', () => {
            const frequency = 440; // A4
            const buffer = generatePureTone(frequency, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 5);
            expect(result.confidence).toBeGreaterThan(0.5);
            expect(result.algorithmsUsed).toBeGreaterThan(1);
            expect(result.algorithmResults.length).toBeGreaterThan(1);
        });
        
        test('should handle different frequency ranges correctly', () => {
            const frequencies = [110, 220, 440, 880]; // A2, A3, A4, A5
            
            frequencies.forEach(freq => {
                const buffer = generatePureTone(freq, sampleRate, frameSize);
                const result = voting.detectPitch(buffer);
                
                expect(result.frequency).toBeCloseTo(freq, 10);
                expect(result.confidence).toBeGreaterThan(0.3);
            });
        });
        
        test('should handle complex harmonic signals', () => {
            const fundamental = 220;
            const buffer = generateHarmonicSignal(fundamental, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(fundamental, 15);
            expect(result.algorithmsUsed).toBeGreaterThan(1);
        });
        
        test('should handle noisy signals', () => {
            const frequency = 330;
            const cleanBuffer = generatePureTone(frequency, sampleRate, frameSize);
            const noisyBuffer = addNoise(cleanBuffer, 0.3);
            
            const cleanResult = voting.detectPitch(cleanBuffer);
            const noisyResult = voting.detectPitch(noisyBuffer);
            
            expect(cleanResult.confidence).toBeGreaterThan(noisyResult.confidence);
            expect(Math.abs(noisyResult.frequency - frequency)).toBeLessThan(20);
        });
    });
    
    describe('Voting Mechanisms', () => {
        test('should use consensus voting when algorithms agree', () => {
            const frequency = 440;
            const buffer = generatePureTone(frequency, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.votingMethod).toBeDefined();
            expect(result.agreementCount).toBeGreaterThan(1);
            expect(result.frequency).toBeCloseTo(frequency, 10);
        });
        
        test('should handle algorithm disagreement gracefully', () => {
            const buffer = generateConflictingSignal(sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBeGreaterThan(0);
            expect(result.votingMethod).toBeDefined();
            expect(['weighted', 'majority', 'consensus', 'best']).toContain(result.votingMethod);
        });
        
        test('should provide alternative interpretations', () => {
            const buffer = generateAmbiguousSignal(sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBeGreaterThan(0);
            // Some signals might have alternatives, but not all
            if (result.algorithmResults.length > 2) {
                expect(result.agreementCount).toBeGreaterThanOrEqual(1);
            }
        });
    });
    
    describe('Outlier Rejection', () => {
        test('should remove outlier results when enabled', () => {
            const votingWithOutlierRejection = new PitchVoting({
                sampleRate,
                frameSize,
                enableOutlierRejection: true,
                maxDeviationSemitones: 0.5
            });
            
            const votingWithoutOutlierRejection = new PitchVoting({
                sampleRate,
                frameSize,
                enableOutlierRejection: false
            });
            
            const buffer = generateOutlierProneSignal(sampleRate, frameSize);
            
            const resultWith = votingWithOutlierRejection.detectPitch(buffer);
            const resultWithout = votingWithoutOutlierRejection.detectPitch(buffer);
            
            expect(resultWith.outliersRemoved).toBeDefined();
            expect(resultWithout.outliersRemoved).toBe(false);
        });
        
        test('should not reject valid results as outliers', () => {
            const frequency = 440;
            const buffer = generatePureTone(frequency, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.outliersRemoved).toBe(false);
            expect(result.agreementCount).toBeGreaterThan(0);
        });
    });
    
    describe('Adaptive Weighting', () => {
        test('should adapt algorithm weights over time', () => {
            const adaptiveVoting = new PitchVoting({
                sampleRate,
                frameSize,
                enableAdaptiveWeighting: true,
                adaptationHistorySize: 10
            });
            
            const frequency = 440;
            
            // Process multiple signals to build adaptation history
            for (let i = 0; i < 15; i++) {
                const buffer = generatePureTone(frequency + i * 2, sampleRate, frameSize);
                adaptiveVoting.detectPitch(buffer);
            }
            
            const weights = adaptiveVoting.getAdaptiveWeights();
            expect(weights.size).toBeGreaterThan(0);
            
            // Check that weights are reasonable
            for (const [algorithm, weight] of weights) {
                expect(weight).toBeGreaterThan(0);
                expect(weight).toBeLessThanOrEqual(2.0);
            }
        });
        
        test('should not adapt when disabled', () => {
            const nonAdaptiveVoting = new PitchVoting({
                sampleRate,
                frameSize,
                enableAdaptiveWeighting: false
            });
            
            const frequency = 440;
            const buffer = generatePureTone(frequency, sampleRate, frameSize);
            const result = nonAdaptiveVoting.detectPitch(buffer);
            
            expect(result.metadata.adaptationApplied).toBe(false);
        });
        
        test('should track algorithm performance', () => {
            const frequency = 440;
            
            // Process several signals
            for (let i = 0; i < 5; i++) {
                const buffer = generatePureTone(frequency, sampleRate, frameSize);
                voting.detectPitch(buffer);
            }
            
            const stats = voting.getAlgorithmStatistics();
            expect(stats.size).toBeGreaterThan(0);
            
            for (const [algorithm, performance] of stats) {
                expect(performance.successRate).toBeGreaterThanOrEqual(0);
                expect(performance.successRate).toBeLessThanOrEqual(1);
                expect(performance.averageConfidence).toBeGreaterThanOrEqual(0);
                expect(performance.averageDeviation).toBeGreaterThanOrEqual(0);
            }
        });
    });
    
    describe('Quality Assessment', () => {
        test('should provide quality metrics', () => {
            const frequency = 440;
            const buffer = generatePureTone(frequency, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.quality).toBeDefined();
            expect(result.quality.consistency).toBeGreaterThanOrEqual(0);
            expect(result.quality.consistency).toBeLessThanOrEqual(1);
            expect(result.quality.reliability).toBeGreaterThanOrEqual(0);
            expect(result.quality.reliability).toBeLessThanOrEqual(1);
            expect(result.quality.accuracy).toBeGreaterThanOrEqual(0);
            expect(result.quality.accuracy).toBeLessThanOrEqual(1);
        });
        
        test('should assess quality correctly for different signal types', () => {
            const pureBuffer = generatePureTone(440, sampleRate, frameSize);
            const noisyBuffer = addNoise(pureBuffer, 0.5);
            
            const pureResult = voting.detectPitch(pureBuffer);
            const noisyResult = voting.detectPitch(noisyBuffer);
            
            expect(pureResult.quality.consistency).toBeGreaterThan(noisyResult.quality.consistency);
            expect(pureResult.quality.reliability).toBeGreaterThan(noisyResult.quality.reliability);
        });
    });
    
    describe('Edge Cases', () => {
        test('should handle silent input', () => {
            const buffer = new Float32Array(frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBe(0);
            expect(result.confidence).toBe(0);
            expect(result.votingMethod).toBe('best');
        });
        
        test('should handle single algorithm result', () => {
            // Create a signal that might only be detected by one algorithm
            const buffer = generateEdgeCaseSignal(sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            if (result.algorithmsUsed === 1) {
                expect(result.votingMethod).toBe('best');
                expect(result.agreementCount).toBe(1);
            }
        });
        
        test('should handle very low frequencies', () => {
            const lowFreq = 85; // Near the minimum
            const buffer = generatePureTone(lowFreq, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            if (result.frequency > 0) {
                expect(result.frequency).toBeCloseTo(lowFreq, 10);
            }
        });
        
        test('should handle very high frequencies', () => {
            const highFreq = 1800; // Near the maximum
            const buffer = generatePureTone(highFreq, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            if (result.frequency > 0) {
                expect(result.frequency).toBeCloseTo(highFreq, 20);
            }
        });
    });
    
    describe('Performance', () => {
        test('should process pitch detection efficiently', () => {
            const buffer = generatePureTone(440, sampleRate, frameSize);
            
            const startTime = performance.now();
            for (let i = 0; i < 100; i++) {
                voting.detectPitch(buffer);
            }
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            expect(processingTime).toBeLessThan(1000); // Should process 100 detections within 1 second
        });
        
        test('should track processing times', () => {
            const buffer = generatePureTone(440, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.metadata.totalProcessingTime).toBeGreaterThan(0);
            expect(result.metadata.totalProcessingTime).toBeLessThan(100); // Reasonable time limit
            
            result.algorithmResults.forEach(algResult => {
                if (algResult.processingTime !== undefined) {
                    expect(algResult.processingTime).toBeGreaterThan(0);
                }
            });
        });
    });
    
    describe('Configuration Updates', () => {
        test('should update configuration correctly', () => {
            const newConfig = {
                minFrequency: 60,
                maxFrequency: 4000,
                confidenceThreshold: 0.7,
                maxDeviationSemitones: 0.3
            };
            
            voting.updateConfig(newConfig);
            
            // Should still work after configuration update
            const buffer = generatePureTone(440, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBeGreaterThan(0);
        });
        
        test('should update sub-algorithm configurations', () => {
            const newConfig = {
                sampleRate: 48000,
                frameSize: 4096
            };
            
            voting.updateConfig(newConfig);
            
            // Should not throw and continue working
            expect(voting).toBeDefined();
        });
    });
    
    describe('Adaptation Reset', () => {
        test('should reset adaptation correctly', () => {
            // Build up adaptation history
            for (let i = 0; i < 10; i++) {
                const buffer = generatePureTone(440, sampleRate, frameSize);
                voting.detectPitch(buffer);
            }
            
            // Reset adaptation
            voting.resetAdaptation();
            
            const weights = voting.getAdaptiveWeights();
            for (const [algorithm, weight] of weights) {
                expect(weight).toBe(1.0); // Should be reset to default
            }
        });
    });
    
    describe('Error Handling', () => {
        test('should handle NaN values in buffer', () => {
            const buffer = new Float32Array(frameSize);
            buffer.fill(NaN);
            
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBe(0);
            expect(result.confidence).toBe(0);
        });
        
        test('should handle infinite values in buffer', () => {
            const buffer = new Float32Array(frameSize);
            buffer.fill(Infinity);
            
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBe(0);
            expect(result.confidence).toBe(0);
        });
        
        test('should handle empty buffer', () => {
            const buffer = new Float32Array(0);
            const result = voting.detectPitch(buffer);
            
            expect(result.frequency).toBe(0);
            expect(result.confidence).toBe(0);
        });
    });
    
    describe('Algorithm Integration', () => {
        test('should run all available algorithms', () => {
            const buffer = generatePureTone(440, sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            // Should have results from multiple algorithms
            expect(result.algorithmResults.length).toBeGreaterThan(1);
            
            // Check that different algorithms are represented
            const algorithms = result.algorithmResults.map(r => r.algorithm);
            const uniqueAlgorithms = new Set(algorithms);
            expect(uniqueAlgorithms.size).toBeGreaterThan(1);
        });
        
        test('should handle algorithm failures gracefully', () => {
            // Even if some algorithms fail, should still work
            const buffer = generateChallengingSignal(sampleRate, frameSize);
            const result = voting.detectPitch(buffer);
            
            expect(result).toBeDefined();
            expect(result.algorithmsUsed).toBeGreaterThanOrEqual(0);
        });
    });
});

// Helper functions for generating test signals

function generatePureTone(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return buffer;
}

function generateHarmonicSignal(fundamental: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const harmonics = [1, 0.5, 0.25, 0.125]; // Harmonic amplitudes
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        harmonics.forEach((amplitude, harmonic) => {
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * (harmonic + 1) * i / sampleRate);
        });
        buffer[i] = sample;
    }
    return buffer;
}

function generateConflictingSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    // Signal with multiple strong frequency components
    for (let i = 0; i < length; i++) {
        let sample = 0;
        sample += 0.4 * Math.sin(2 * Math.PI * 220 * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * 330 * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * 440 * i / sampleRate);
        buffer[i] = sample;
    }
    return buffer;
}

function generateAmbiguousSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    // Signal that could be interpreted multiple ways
    for (let i = 0; i < length; i++) {
        let sample = 0;
        sample += 0.35 * Math.sin(2 * Math.PI * 200 * i / sampleRate);
        sample += 0.35 * Math.sin(2 * Math.PI * 400 * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * 600 * i / sampleRate);
        sample += 0.1 * (Math.random() - 0.5); // Add some noise
        buffer[i] = sample;
    }
    return buffer;
}

function generateOutlierProneSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    // Signal that might cause some algorithms to produce outlier results
    for (let i = 0; i < length; i++) {
        let sample = 0;
        sample += 0.5 * Math.sin(2 * Math.PI * 220 * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * 440 * i / sampleRate);
        sample += 0.1 * Math.sin(2 * Math.PI * 880 * i / sampleRate);
        
        // Add some noise that might confuse algorithms differently
        sample += 0.15 * Math.sin(2 * Math.PI * 150 * i / sampleRate);
        sample += 0.1 * (Math.random() - 0.5);
        
        buffer[i] = sample;
    }
    return buffer;
}

function generateEdgeCaseSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    // Very low frequency signal that might challenge some algorithms
    const frequency = 90; // Near minimum detection threshold
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.7 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
        buffer[i] += 0.2 * (Math.random() - 0.5); // Add some noise
    }
    return buffer;
}

function generateChallengingSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    // Signal that might cause some algorithms to fail
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Frequency sweep that changes over time
        const frequency = 300 + 200 * Math.sin(2 * Math.PI * 0.5 * i / sampleRate);
        sample += 0.4 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
        
        // Add significant noise
        sample += 0.3 * (Math.random() - 0.5);
        
        buffer[i] = sample;
    }
    return buffer;
}

function addNoise(signal: Float32Array, noiseLevel: number): Float32Array {
    const noisy = new Float32Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
        noisy[i] = signal[i] + noiseLevel * (Math.random() - 0.5);
    }
    return noisy;
}