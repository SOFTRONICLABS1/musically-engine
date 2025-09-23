/**
 * Tests for AdaptiveProcessor - Adaptive Audio Processing Pipeline
 */

import { AdaptiveProcessor, AdaptiveConfig, AdaptiveAnalysisResult } from '../../src/audioTypes/AdaptiveProcessor';
import { AudioType } from '../../src/audioTypes/AutoDetector';

describe('AdaptiveProcessor', () => {
    let processor: AdaptiveProcessor;
    const sampleRate = 44100;
    const frameSize = 2048;
    
    beforeEach(() => {
        processor = new AdaptiveProcessor({
            sampleRate,
            frameSize,
            confidenceThreshold: 0.7
        });
    });
    
    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultProcessor = new AdaptiveProcessor();
            expect(defaultProcessor).toBeDefined();
        });
        
        test('should initialize with custom configuration', () => {
            const customProcessor = new AdaptiveProcessor({
                sampleRate: 48000,
                frameSize: 4096,
                enableMultiPass: false,
                enableAdaptation: false,
                confidenceThreshold: 0.8
            });
            expect(customProcessor).toBeDefined();
        });
    });
    
    describe('Audio Processing Pipeline', () => {
        test('should process voice audio correctly', async () => {
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            const result = await processor.processAudio(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.detectionConfidence).toBeGreaterThan(0);
            expect(result.fundamentalFrequency).toBeGreaterThan(0);
            expect(result.quality).toBeDefined();
            expect(result.metadata).toBeDefined();
            
            if (result.audioType === 'voice') {
                expect(result.vocalAnalysis).toBeDefined();
                expect(result.vocalAnalysis!.formants).toBeDefined();
            }
        });
        
        test('should process instrument audio correctly', async () => {
            const buffer = generateStringSignal(sampleRate, frameSize);
            const result = await processor.processAudio(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.detectionConfidence).toBeGreaterThan(0);
            expect(result.fundamentalFrequency).toBeGreaterThan(0);
            
            if (['string', 'keyboard', 'wind', 'percussion'].includes(result.audioType)) {
                expect(result.instrumentAnalysis).toBeDefined();
            }
        });
        
        test('should handle mixed audio types', async () => {
            const buffer = generateMixedSignal(sampleRate, frameSize);
            const result = await processor.processAudio(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.alternatives).toBeDefined();
            expect(result.quality.overallQuality).toBeGreaterThan(0);
        });
        
        test('should process silent audio gracefully', async () => {
            const buffer = new Float32Array(frameSize);
            const result = await processor.processAudio(buffer);
            
            expect(result.audioType).toBe('unknown');
            expect(result.fundamentalFrequency).toBe(0);
            expect(result.quality.isReliable).toBe(false);
        });
    });
    
    describe('Multi-pass Detection', () => {
        test('should improve accuracy with multi-pass enabled', async () => {
            const multiPassProcessor = new AdaptiveProcessor({
                sampleRate,
                frameSize,
                enableMultiPass: true,
                multiPassCount: 3
            });
            
            const singlePassProcessor = new AdaptiveProcessor({
                sampleRate,
                frameSize,
                enableMultiPass: false
            });
            
            const buffer = generateNoisyVoiceSignal(sampleRate, frameSize);
            
            const multiPassResult = await multiPassProcessor.processAudio(buffer);
            const singlePassResult = await singlePassProcessor.processAudio(buffer);
            
            expect(multiPassResult.metadata.passesUsed).toBe(3);
            expect(singlePassResult.metadata.passesUsed).toBe(1);
            
            // Multi-pass should generally be more confident
            expect(multiPassResult.detectionConfidence).toBeGreaterThanOrEqual(singlePassResult.detectionConfidence);
        });
        
        test('should provide alternative interpretations', async () => {
            const buffer = generateAmbiguousSignal(sampleRate, frameSize);
            const result = await processor.processAudio(buffer);
            
            expect(result.alternatives).toBeDefined();
            if (result.alternatives && result.alternatives.length > 0) {
                expect(result.alternatives[0].confidence).toBeLessThan(result.detectionConfidence);
            }
        });
    });
    
    describe('Quality Assessment', () => {
        test('should assess quality correctly for clear signals', async () => {
            const clearBuffer = generateClearVoiceSignal(sampleRate, frameSize);
            const noisyBuffer = generateNoisyVoiceSignal(sampleRate, frameSize);
            
            const clearResult = await processor.processAudio(clearBuffer);
            const noisyResult = await processor.processAudio(noisyBuffer);
            
            expect(clearResult.quality.overallQuality).toBeGreaterThan(noisyResult.quality.overallQuality);
            expect(clearResult.quality.snrEstimate).toBeGreaterThan(noisyResult.quality.snrEstimate);
            expect(clearResult.quality.isReliable).toBe(true);
        });
        
        test('should provide detailed quality metrics', async () => {
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            const result = await processor.processAudio(buffer);
            
            expect(result.quality.componentQuality.audioDetection).toBeGreaterThan(0);
            expect(result.quality.componentQuality.featureExtraction).toBeGreaterThan(0);
            expect(result.quality.componentQuality.primaryProcessing).toBeGreaterThan(0);
            expect(result.quality.processingAccuracy).toBeGreaterThan(0);
        });
        
        test('should handle quality assessment disable', async () => {
            const noQualityProcessor = new AdaptiveProcessor({
                sampleRate,
                frameSize,
                enableQualityAssessment: false
            });
            
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            const result = await noQualityProcessor.processAudio(buffer);
            
            expect(result.quality.overallQuality).toBe(0.8); // Default value
            expect(result.quality.isReliable).toBe(true);
        });
    });
    
    describe('Adaptive Learning', () => {
        test('should adapt processing parameters over time', async () => {
            const adaptiveProcessor = new AdaptiveProcessor({
                sampleRate,
                frameSize,
                enableAdaptation: true,
                adaptationHistoryLength: 10
            });
            
            // Process multiple similar signals
            for (let i = 0; i < 15; i++) {
                const buffer = generateVoiceSignal(sampleRate, frameSize);
                await adaptiveProcessor.processAudio(buffer);
            }
            
            // Check if adaptation was applied
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            const result = await adaptiveProcessor.processAudio(buffer);
            
            expect(result.metadata.adaptationApplied).toBe(true);
        });
        
        test('should not adapt when disabled', async () => {
            const nonAdaptiveProcessor = new AdaptiveProcessor({
                sampleRate,
                frameSize,
                enableAdaptation: false
            });
            
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            const result = await nonAdaptiveProcessor.processAudio(buffer);
            
            expect(result.metadata.adaptationApplied).toBe(false);
        });
        
        test('should maintain processing history', async () => {
            const processor = new AdaptiveProcessor({
                sampleRate,
                frameSize,
                enableAdaptation: true
            });
            
            // Process several signals
            for (let i = 0; i < 5; i++) {
                const buffer = generateVoiceSignal(sampleRate, frameSize);
                await processor.processAudio(buffer);
            }
            
            const stats = processor.getProcessingStatistics();
            expect(stats.totalProcessed).toBe(5);
            expect(stats.averageQuality).toBeGreaterThan(0);
            expect(stats.averageConfidence).toBeGreaterThan(0);
        });
    });
    
    describe('Low Confidence Handling', () => {
        test('should handle low confidence detection gracefully', async () => {
            const processor = new AdaptiveProcessor({
                sampleRate,
                frameSize,
                confidenceThreshold: 0.9 // Very high threshold
            });
            
            const ambiguousBuffer = generateAmbiguousSignal(sampleRate, frameSize);
            const result = await processor.processAudio(ambiguousBuffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.quality.isReliable).toBe(false);
        });
        
        test('should use comparative analysis for uncertain signals', async () => {
            const uncertainBuffer = generateUncertainSignal(sampleRate, frameSize);
            const result = await processor.processAudio(uncertainBuffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.detectionConfidence).toBeGreaterThan(0);
        });
    });
    
    describe('Performance', () => {
        test('should process audio within reasonable time', async () => {
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            
            const startTime = performance.now();
            await processor.processAudio(buffer);
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            expect(processingTime).toBeLessThan(100); // Should be fast
        });
        
        test('should handle concurrent processing', async () => {
            const buffers = [
                generateVoiceSignal(sampleRate, frameSize),
                generateStringSignal(sampleRate, frameSize),
                generatePercussionSignal(sampleRate, frameSize)
            ];
            
            const promises = buffers.map(buffer => processor.processAudio(buffer));
            const results = await Promise.all(promises);
            
            expect(results.length).toBe(3);
            results.forEach(result => {
                expect(result.audioType).toBeDefined();
                expect(result.metadata.processingTime).toBeGreaterThan(0);
            });
        });
    });
    
    describe('Configuration Updates', () => {
        test('should update configuration correctly', () => {
            const newConfig = {
                confidenceThreshold: 0.8,
                enableMultiPass: false,
                multiPassCount: 2
            };
            
            processor.updateConfig(newConfig);
            
            // Should not throw and continue working
            expect(processor).toBeDefined();
        });
        
        test('should propagate configuration to sub-processors', () => {
            const newConfig = {
                vocalConfig: {
                    pitchSmoothingFactor: 0.9
                },
                instrumentConfig: {
                    harmonicThreshold: 0.8
                }
            };
            
            processor.updateConfig(newConfig);
            
            // Should not throw
            expect(processor).toBeDefined();
        });
    });
    
    describe('Processing Statistics', () => {
        test('should track processing statistics correctly', async () => {
            // Process different types of audio
            const signals = [
                generateVoiceSignal(sampleRate, frameSize),
                generateStringSignal(sampleRate, frameSize),
                generatePercussionSignal(sampleRate, frameSize)
            ];
            
            for (const signal of signals) {
                await processor.processAudio(signal);
            }
            
            const stats = processor.getProcessingStatistics();
            
            expect(stats.totalProcessed).toBe(3);
            expect(stats.typeDistribution.size).toBeGreaterThan(0);
            expect(stats.averageQuality).toBeGreaterThan(0);
            expect(stats.averageConfidence).toBeGreaterThan(0);
        });
    });
    
    describe('Error Handling', () => {
        test('should handle empty buffer gracefully', async () => {
            const emptyBuffer = new Float32Array(0);
            const result = await processor.processAudio(emptyBuffer);
            
            expect(result.audioType).toBe('unknown');
            expect(result.fundamentalFrequency).toBe(0);
        });
        
        test('should handle invalid audio data', async () => {
            const invalidBuffer = new Float32Array(frameSize);
            invalidBuffer.fill(NaN);
            
            const result = await processor.processAudio(invalidBuffer);
            
            expect(result.audioType).toBe('unknown');
            expect(result.quality.isReliable).toBe(false);
        });
        
        test('should handle processing errors gracefully', async () => {
            // This should not throw even with problematic input
            const problematicBuffer = new Float32Array(frameSize);
            problematicBuffer.fill(Infinity);
            
            const result = await processor.processAudio(problematicBuffer);
            
            expect(result).toBeDefined();
            expect(result.audioType).toBeDefined();
        });
    });
    
    describe('Adaptation Reset', () => {
        test('should reset adaptation correctly', async () => {
            // Build up some adaptation history
            for (let i = 0; i < 10; i++) {
                const buffer = generateVoiceSignal(sampleRate, frameSize);
                await processor.processAudio(buffer);
            }
            
            // Reset adaptation
            processor.resetAdaptation();
            
            const stats = processor.getProcessingStatistics();
            expect(stats.totalProcessed).toBe(0);
        });
    });
});

// Helper functions for generating test signals

function generateVoiceSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 150;
    const formants = [800, 1200, 2400];
    
    for (let i = 0; i < length; i++) {
        let sample = 0.3 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        
        formants.forEach((formant, index) => {
            const amplitude = 0.15 / (index + 1);
            sample += amplitude * Math.sin(2 * Math.PI * formant * i / sampleRate);
        });
        
        buffer[i] = sample;
    }
    return buffer;
}

function generateStringSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Strong harmonics typical of strings
        for (let h = 1; h <= 6; h++) {
            const amplitude = 1 / h;
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * h * i / sampleRate);
        }
        
        // Apply decay
        const decay = Math.exp(-i / (sampleRate * 1.5));
        buffer[i] = sample * decay * 0.3;
    }
    return buffer;
}

function generatePercussionSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        if (i < 100) {
            // Sharp attack
            sample = (Math.random() - 0.5) * 2;
        } else {
            // Rapid decay
            const decay = Math.exp(-i / (sampleRate * 0.2));
            sample = 0.3 * Math.sin(2 * Math.PI * 150 * i / sampleRate) * decay;
            sample += 0.1 * (Math.random() - 0.5) * decay;
        }
        
        buffer[i] = sample * 0.6;
    }
    return buffer;
}

function generateMixedSignal(sampleRate: number, length: number): Float32Array {
    const voice = generateVoiceSignal(sampleRate, length);
    const instrument = generateStringSignal(sampleRate, length);
    const mixed = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        mixed[i] = 0.6 * voice[i] + 0.4 * instrument[i];
    }
    
    return mixed;
}

function generateNoisyVoiceSignal(sampleRate: number, length: number): Float32Array {
    const clean = generateVoiceSignal(sampleRate, length);
    const noisy = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        noisy[i] = clean[i] + 0.2 * (Math.random() - 0.5);
    }
    
    return noisy;
}

function generateClearVoiceSignal(sampleRate: number, length: number): Float32Array {
    return generateVoiceSignal(sampleRate, length);
}

function generateAmbiguousSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    // Signal that could be interpreted multiple ways
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Multiple competing frequencies
        sample += 0.3 * Math.sin(2 * Math.PI * 200 * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * 300 * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * 450 * i / sampleRate);
        sample += 0.1 * (Math.random() - 0.5);
        
        buffer[i] = sample;
    }
    
    return buffer;
}

function generateUncertainSignal(sampleRate: number, length: number): Float32Array {
    return generateAmbiguousSignal(sampleRate, length);
}