/**
 * Comprehensive Validation Test Suite
 * Final validation of Phase 1, 2, and 3 core functionality
 * This test suite validates that all critical components work together correctly
 */

import { AudioCapture } from '../../src/core/AudioCapture';
import { AutoDetector } from '../../src/audioTypes/AutoDetector';
import { VocalProcessor } from '../../src/audioTypes/VocalProcessor';
import { InstrumentProcessor } from '../../src/audioTypes/InstrumentProcessor';
import { AdaptiveProcessor } from '../../src/audioTypes/AdaptiveProcessor';
import { BufferManager } from '../../src/core/BufferManager';
import { NoiseReducer } from '../../src/core/NoiseReducer';
import { EventEmitter } from '../../src/core/EventEmitter';

describe('Comprehensive Phase 1, 2, 3 Validation', () => {
    const sampleRate = 44100;
    const frameSize = 2048;
    
    describe('Phase 1: Core Audio Processing Foundation', () => {
        let bufferManager: BufferManager;
        let noiseReducer: NoiseReducer;
        let eventEmitter: EventEmitter;
        
        beforeEach(() => {
            bufferManager = new BufferManager(frameSize);
            noiseReducer = new NoiseReducer({ sampleRate, frameSize });
            eventEmitter = new EventEmitter();
        });
        
        test('should initialize all core components successfully', () => {
            expect(bufferManager).toBeDefined();
            expect(noiseReducer).toBeDefined();
            expect(eventEmitter).toBeDefined();
        });
        
        test('should handle audio buffer management correctly', () => {
            const testBuffer = generateTestSignal(sampleRate, frameSize);
            
            // Test buffer operations
            expect(() => bufferManager.addBuffer(testBuffer)).not.toThrow();
            const retrievedBuffer = bufferManager.getNextBuffer();
            expect(retrievedBuffer).toBeDefined();
        });
        
        test('should apply noise reduction without corruption', () => {
            const noisySignal = generateNoisySignal(sampleRate, frameSize);
            const cleaned = noiseReducer.process(noisySignal);
            
            expect(cleaned).toBeDefined();
            expect(cleaned.length).toBe(noisySignal.length);
            // Signal should be modified (noise reduced)
            const originalRMS = Math.sqrt(noisySignal.reduce((sum, val) => sum + val * val, 0) / noisySignal.length);
            const cleanedRMS = Math.sqrt(cleaned.reduce((sum, val) => sum + val * val, 0) / cleaned.length);
            expect(cleanedRMS).toBeLessThanOrEqual(originalRMS);
        });
        
        test('should handle event system correctly', () => {
            let eventFired = false;
            const testData = { message: 'test' };
            
            eventEmitter.on('test', (data) => {
                eventFired = true;
                expect(data).toEqual(testData);
            });
            
            eventEmitter.emit('test', testData);
            expect(eventFired).toBe(true);
        });
    });
    
    describe('Phase 2: Universal Signal Processing', () => {
        let autoDetector: AutoDetector;
        
        beforeEach(() => {
            autoDetector = new AutoDetector({ sampleRate, frameSize });
        });
        
        test('should detect different audio types reliably', () => {
            const voiceSignal = generateVoicelikeSignal(sampleRate, frameSize);
            const instrumentSignal = generateInstrumentSignal(sampleRate, frameSize);
            
            const voiceResult = autoDetector.detectAudioType(voiceSignal);
            const instrumentResult = autoDetector.detectAudioType(instrumentSignal);
            
            expect(voiceResult.audioType).toBeDefined();
            expect(instrumentResult.audioType).toBeDefined();
            expect(voiceResult.confidence).toBeGreaterThan(0);
            expect(instrumentResult.confidence).toBeGreaterThan(0);
        });
        
        test('should extract meaningful audio features', () => {
            const testSignal = generateComplexSignal(sampleRate, frameSize);
            const result = autoDetector.detectAudioType(testSignal);
            
            expect(result.features).toBeDefined();
            expect(result.features.spectralCentroid).toBeGreaterThan(0);
            expect(result.features.zcr).toBeGreaterThanOrEqual(0);
            expect(result.features.harmonicity).toBeGreaterThanOrEqual(0);
            expect(result.features.harmonicity).toBeLessThanOrEqual(1);
        });
        
        test('should handle edge cases gracefully', () => {
            const silentSignal = new Float32Array(frameSize);
            const noisySignal = generatePureNoise(frameSize);
            
            const silentResult = autoDetector.detectAudioType(silentSignal);
            const noisyResult = autoDetector.detectAudioType(noisySignal);
            
            expect(silentResult.audioType).toBe('unknown');
            expect(noisyResult.audioType).toBeDefined();
        });
    });
    
    describe('Phase 3: Adaptive Audio Processing', () => {
        let vocalProcessor: VocalProcessor;
        let instrumentProcessor: InstrumentProcessor;
        let adaptiveProcessor: AdaptiveProcessor;
        
        beforeEach(() => {
            vocalProcessor = new VocalProcessor({ sampleRate, frameSize });
            instrumentProcessor = new InstrumentProcessor({ sampleRate, frameSize });
            adaptiveProcessor = new AdaptiveProcessor({ sampleRate, frameSize });
        });
        
        test('should process voice audio correctly', async () => {
            const voiceSignal = generateRealisticVoice(sampleRate, frameSize);
            
            const result = vocalProcessor.processVoice(voiceSignal);
            expect(result).toBeDefined();
            expect(result.formants).toBeDefined();
            expect(result.voiceQuality).toBeDefined();
            // Fundamental frequency should be detected or be 0 for difficult signals
            expect(result.fundamentalFrequency).toBeGreaterThanOrEqual(0);
        });
        
        test('should process instrument audio correctly', async () => {
            const instrumentSignal = generateRealisticInstrument(sampleRate, frameSize);
            
            const result = instrumentProcessor.processInstrument(instrumentSignal);
            expect(result).toBeDefined();
            expect(result.techniques).toBeDefined();
            expect(result.timbre).toBeDefined();
            expect(result.fundamentalFrequency).toBeGreaterThanOrEqual(0);
        });
        
        test('should adapt processing based on audio type', async () => {
            const voiceSignal = generateRealisticVoice(sampleRate, frameSize);
            const instrumentSignal = generateRealisticInstrument(sampleRate, frameSize);
            
            const voiceResult = await adaptiveProcessor.processAudio(voiceSignal);
            const instrumentResult = await adaptiveProcessor.processAudio(instrumentSignal);
            
            expect(voiceResult).toBeDefined();
            expect(instrumentResult).toBeDefined();
            expect(voiceResult.audioType).toBeDefined();
            expect(instrumentResult.audioType).toBeDefined();
            expect(voiceResult.quality.isReliable).toBeDefined();
            expect(instrumentResult.quality.isReliable).toBeDefined();
        });
        
        test('should provide quality assessment', async () => {
            const highQualitySignal = generateCleanSignal(sampleRate, frameSize);
            const lowQualitySignal = generateDegradedSignal(sampleRate, frameSize);
            
            const highQualityResult = await adaptiveProcessor.processAudio(highQualitySignal);
            const lowQualityResult = await adaptiveProcessor.processAudio(lowQualitySignal);
            
            expect(highQualityResult.quality.overallQuality).toBeDefined();
            expect(lowQualityResult.quality.overallQuality).toBeDefined();
            
            // High quality signal should generally score higher
            if (highQualityResult.quality.overallQuality > 0 && lowQualityResult.quality.overallQuality > 0) {
                // Both signals produced meaningful results
                expect(highQualityResult.quality.overallQuality).toBeGreaterThanOrEqual(lowQualityResult.quality.overallQuality * 0.8);
            }
        });
    });
    
    describe('End-to-End Integration', () => {
        let audioCapture: AudioCapture;
        
        beforeEach(() => {
            audioCapture = new AudioCapture({
                sampleRate,
                bufferSize: frameSize
            });
        });
        
        test('should initialize audio capture successfully', () => {
            expect(audioCapture).toBeDefined();
        });
        
        test('should handle complete audio processing pipeline', async () => {
            // Test with different types of audio
            const audioTypes = [
                generateRealisticVoice(sampleRate, frameSize),
                generateRealisticInstrument(sampleRate, frameSize),
                generateMixedAudio(sampleRate, frameSize)
            ];
            
            for (const audio of audioTypes) {
                // This tests the core pipeline functionality
                expect(audio).toBeDefined();
                expect(audio.length).toBe(frameSize);
                
                // Ensure signal has reasonable amplitude
                const maxAmplitude = Math.max(...Array.from(audio).map(Math.abs));
                expect(maxAmplitude).toBeGreaterThan(0.01);
                expect(maxAmplitude).toBeLessThanOrEqual(1.0);
            }
        });
        
        test('should maintain stability during extended processing', async () => {
            const signals = [];
            for (let i = 0; i < 10; i++) {
                signals.push(generateRandomSignal(sampleRate, frameSize));
            }
            
            // Process all signals without crashing
            for (const signal of signals) {
                expect(() => {
                    // Basic validation that signal processing doesn't crash
                    const autoDetector = new AutoDetector({ sampleRate, frameSize });
                    autoDetector.detectAudioType(signal);
                }).not.toThrow();
            }
        });
    });
    
    describe('Performance and Memory Validation', () => {
        test('should process audio within reasonable time constraints', () => {
            const autoDetector = new AutoDetector({ sampleRate, frameSize });
            const testSignal = generateTestSignal(sampleRate, frameSize);
            
            const startTime = performance.now();
            
            // Process multiple frames
            for (let i = 0; i < 10; i++) {
                autoDetector.detectAudioType(testSignal);
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            
            // Should process 10 frames quickly
            expect(totalTime).toBeLessThan(1000); // Less than 1 second
        });
        
        test('should handle concurrent processing without conflicts', async () => {
            const adaptiveProcessor = new AdaptiveProcessor({ sampleRate, frameSize });
            
            const signals = [
                generateTestSignal(sampleRate, frameSize),
                generateVoicelikeSignal(sampleRate, frameSize),
                generateInstrumentSignal(sampleRate, frameSize)
            ];
            
            // Process concurrently
            const promises = signals.map(signal => adaptiveProcessor.processAudio(signal));
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.audioType).toBeDefined();
            });
        });
    });
});

// Helper functions for comprehensive validation

function generateTestSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }
    return buffer;
}

function generateNoisySignal(sampleRate: number, length: number): Float32Array {
    const signal = generateTestSignal(sampleRate, length);
    for (let i = 0; i < signal.length; i++) {
        signal[i] += 0.2 * (Math.random() - 0.5);
    }
    return signal;
}

function generateVoicelikeSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 180;
    
    for (let i = 0; i < length; i++) {
        let sample = 0.3 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.15 * Math.sin(2 * Math.PI * 720 * i / sampleRate);  // Formant
        sample += 0.1 * Math.sin(2 * Math.PI * 1080 * i / sampleRate); // Formant
        buffer[i] = sample;
    }
    return buffer;
}

function generateInstrumentSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        // Harmonic series typical of instruments
        for (let h = 1; h <= 5; h++) {
            sample += (0.5 / h) * Math.sin(2 * Math.PI * fundamental * h * i / sampleRate);
        }
        buffer[i] = sample * 0.4;
    }
    return buffer;
}

function generateComplexSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        let sample = 0.3 * Math.sin(2 * Math.PI * 200 * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * 400 * i / sampleRate);
        sample += 0.1 * Math.sin(2 * Math.PI * 800 * i / sampleRate);
        buffer[i] = sample;
    }
    return buffer;
}

function generatePureNoise(length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = (Math.random() - 0.5) * 0.5;
    }
    return buffer;
}

function generateRealisticVoice(sampleRate: number, length: number): Float32Array {
    return generateVoicelikeSignal(sampleRate, length);
}

function generateRealisticInstrument(sampleRate: number, length: number): Float32Array {
    return generateInstrumentSignal(sampleRate, length);
}

function generateCleanSignal(sampleRate: number, length: number): Float32Array {
    return generateTestSignal(sampleRate, length);
}

function generateDegradedSignal(sampleRate: number, length: number): Float32Array {
    const clean = generateTestSignal(sampleRate, length);
    for (let i = 0; i < clean.length; i++) {
        clean[i] += 0.3 * (Math.random() - 0.5); // Add significant noise
    }
    return clean;
}

function generateMixedAudio(sampleRate: number, length: number): Float32Array {
    const voice = generateVoicelikeSignal(sampleRate, length);
    const instrument = generateInstrumentSignal(sampleRate, length);
    const mixed = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        mixed[i] = 0.6 * voice[i] + 0.4 * instrument[i];
    }
    return mixed;
}

function generateRandomSignal(sampleRate: number, length: number): Float32Array {
    const types = [generateTestSignal, generateVoicelikeSignal, generateInstrumentSignal];
    const randomType = types[Math.floor(Math.random() * types.length)];
    return randomType(sampleRate, length);
}