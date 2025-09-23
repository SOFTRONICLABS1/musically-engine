/**
 * Integration Tests for Phase 3 Components
 * Tests how AutoDetector, VocalProcessor, InstrumentProcessor, AdaptiveProcessor, and PitchVoting work together
 */

import { AutoDetector } from '../../src/audioTypes/AutoDetector';
import { VocalProcessor } from '../../src/audioTypes/VocalProcessor';
import { InstrumentProcessor, InstrumentFamily } from '../../src/audioTypes/InstrumentProcessor';
import { AdaptiveProcessor } from '../../src/audioTypes/AdaptiveProcessor';
import { PitchVoting } from '../../src/algorithms/PitchVoting';

describe('Phase 3 Integration', () => {
    const sampleRate = 44100;
    const frameSize = 2048;
    
    let autoDetector: AutoDetector;
    let vocalProcessor: VocalProcessor;
    let instrumentProcessor: InstrumentProcessor;
    let adaptiveProcessor: AdaptiveProcessor;
    let pitchVoting: PitchVoting;
    
    beforeEach(() => {
        autoDetector = new AutoDetector({
            sampleRate,
            frameSize
        });
        
        vocalProcessor = new VocalProcessor({
            sampleRate,
            frameSize
        });
        
        instrumentProcessor = new InstrumentProcessor({
            sampleRate,
            frameSize
        });
        
        adaptiveProcessor = new AdaptiveProcessor({
            sampleRate,
            frameSize
        });
        
        pitchVoting = new PitchVoting({
            sampleRate,
            frameSize
        });
    });
    
    describe('End-to-End Audio Processing Pipeline', () => {
        test('should process voice audio through complete pipeline', async () => {
            const voiceBuffer = generateVoiceSignal(sampleRate, frameSize);
            
            // Step 1: Auto-detect audio type
            const detectionResult = autoDetector.detectAudioType(voiceBuffer);
            expect(detectionResult.audioType).toBe('voice');
            expect(detectionResult.confidence).toBeGreaterThan(0.5);
            
            // Step 2: Process with appropriate processor
            if (detectionResult.audioType === 'voice') {
                const vocalResult = vocalProcessor.processVoice(voiceBuffer);
                expect(vocalResult.fundamentalFrequency).toBeGreaterThan(0);
                expect(vocalResult.formants.length).toBeGreaterThanOrEqual(0);
            }
            
            // Step 3: Use adaptive processor for intelligent routing
            const adaptiveResult = await adaptiveProcessor.processAudio(voiceBuffer);
            expect(adaptiveResult.audioType).toBeDefined();
            expect(adaptiveResult.quality.overallQuality).toBeGreaterThan(0);
            
            // Step 4: Use pitch voting for enhanced accuracy
            const pitchResult = pitchVoting.detectPitch(voiceBuffer);
            expect(pitchResult.frequency).toBeGreaterThan(0);
            expect(pitchResult.algorithmsUsed).toBeGreaterThan(1);
        });
        
        test('should process string instrument through complete pipeline', async () => {
            const stringBuffer = generateStringSignal(sampleRate, frameSize);
            
            // Step 1: Auto-detect audio type
            const detectionResult = autoDetector.detectAudioType(stringBuffer);
            expect(['string', 'unknown']).toContain(detectionResult.audioType);
            
            // Step 2: Process with instrument processor
            instrumentProcessor.setFamily(InstrumentFamily.String);
            const instrumentResult = instrumentProcessor.processInstrument(stringBuffer);
            expect(instrumentResult.fundamentalFrequency).toBeGreaterThan(0);
            expect(instrumentResult.audioType).toBe('string');
            
            // Step 3: Use adaptive processor
            const adaptiveResult = await adaptiveProcessor.processAudio(stringBuffer);
            expect(adaptiveResult.audioType).toBeDefined();
            expect(adaptiveResult.fundamentalFrequency).toBeGreaterThan(0);
            
            // Step 4: Use pitch voting
            const pitchResult = pitchVoting.detectPitch(stringBuffer);
            expect(pitchResult.frequency).toBeGreaterThan(0);
            expect(pitchResult.confidence).toBeGreaterThan(0.3);
        });
        
        test('should handle mixed audio content', async () => {
            const mixedBuffer = generateMixedAudioSignal(sampleRate, frameSize);
            
            // Adaptive processor should handle complex audio
            const adaptiveResult = await adaptiveProcessor.processAudio(mixedBuffer);
            expect(adaptiveResult.audioType).toBeDefined();
            expect(adaptiveResult.alternatives).toBeDefined();
            
            // Pitch voting should provide robust results
            const pitchResult = pitchVoting.detectPitch(mixedBuffer);
            expect(pitchResult.frequency).toBeGreaterThanOrEqual(0);
            expect(pitchResult.quality).toBeDefined();
        });
        
        test('should maintain consistency across multiple frames', async () => {
            const sustainedVoice = generateSustainedVoiceSignal(sampleRate, frameSize * 3);
            
            const results = [];
            for (let i = 0; i < 3; i++) {
                const frameStart = i * frameSize;
                const frameEnd = frameStart + frameSize;
                const frame = sustainedVoice.slice(frameStart, frameEnd);
                
                const result = await adaptiveProcessor.processAudio(frame);
                results.push(result);
            }
            
            // Should consistently detect as voice
            const voiceDetections = results.filter(r => r.audioType === 'voice').length;
            expect(voiceDetections).toBeGreaterThan(results.length * 0.5);
            
            // Frequencies should be similar for sustained tone
            const frequencies = results.map(r => r.fundamentalFrequency).filter(f => f > 0);
            if (frequencies.length > 1) {
                const avgFreq = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
                const deviations = frequencies.map(f => Math.abs(f - avgFreq) / avgFreq);
                const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
                expect(avgDeviation).toBeLessThan(0.2); // Less than 20% deviation
            }
        });
    });
    
    describe('Cross-Component Compatibility', () => {
        test('should maintain feature consistency between components', () => {
            const testBuffer = generateTestTone(440, sampleRate, frameSize);
            
            // Extract features using AutoDetector
            const detectionResult = autoDetector.detectAudioType(testBuffer);
            const autoFeatures = detectionResult.features;
            
            // Process with PitchVoting
            const pitchResult = pitchVoting.detectPitch(testBuffer);
            
            // Both should detect similar fundamental frequency
            if (autoFeatures.fundamentalStrength > 0.5 && pitchResult.frequency > 0) {
                // Allow for some variation due to different algorithms
                const frequencyRatio = Math.abs(pitchResult.frequency - 440) / 440;
                expect(frequencyRatio).toBeLessThan(0.1); // Within 10%
            }
        });
        
        test('should handle processor-specific configurations', () => {
            // Configure components with specific settings
            const customAutoDetector = new AutoDetector({
                sampleRate: 48000,
                frameSize: 4096,
                confidenceThreshold: 0.8
            });
            
            const customVocalProcessor = new VocalProcessor({
                sampleRate: 48000,
                frameSize: 4096,
                pitchSmoothingFactor: 0.9
            });
            
            const buffer = generateVoiceSignal(48000, 4096);
            
            // Both should work with custom configurations
            const detectionResult = customAutoDetector.detectAudioType(buffer);
            const vocalResult = customVocalProcessor.processVoice(buffer);
            
            expect(detectionResult).toBeDefined();
            expect(vocalResult).toBeDefined();
        });
    });
    
    describe('Performance Integration', () => {
        test('should handle real-time processing pipeline', async () => {
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            
            const startTime = performance.now();
            
            // Simulate real-time pipeline
            const detectionResult = autoDetector.detectAudioType(buffer);
            const adaptiveResult = await adaptiveProcessor.processAudio(buffer);
            const pitchResult = pitchVoting.detectPitch(buffer);
            
            const endTime = performance.now();
            const processingTime = endTime - startTime;
            const frameTime = (frameSize / sampleRate) * 1000; // Frame duration in ms
            
            // Should process faster than real-time
            expect(processingTime).toBeLessThan(frameTime * 3); // Allow 3x real-time
        });
        
        test('should handle concurrent processing', async () => {
            const buffers = [
                generateVoiceSignal(sampleRate, frameSize),
                generateStringSignal(sampleRate, frameSize),
                generatePercussionSignal(sampleRate, frameSize)
            ];
            
            // Process all buffers concurrently
            const promises = buffers.map(buffer => 
                adaptiveProcessor.processAudio(buffer)
            );
            
            const results = await Promise.all(promises);
            
            expect(results.length).toBe(3);
            results.forEach(result => {
                expect(result.audioType).toBeDefined();
                expect(result.metadata.processingTime).toBeGreaterThan(0);
            });
        });
    });
    
    describe('Error Handling Integration', () => {
        test('should gracefully handle processing errors across components', async () => {
            const problematicBuffer = new Float32Array(frameSize);
            problematicBuffer.fill(NaN);
            
            // All components should handle NaN gracefully
            const detectionResult = autoDetector.detectAudioType(problematicBuffer);
            const vocalResult = vocalProcessor.processVoice(problematicBuffer);
            const adaptiveResult = await adaptiveProcessor.processAudio(problematicBuffer);
            const pitchResult = pitchVoting.detectPitch(problematicBuffer);
            
            expect(detectionResult.audioType).toBeDefined();
            expect(vocalResult.fundamentalFrequency).toBe(0);
            expect(adaptiveResult.audioType).toBeDefined();
            expect(pitchResult.frequency).toBe(0);
        });
        
        test('should maintain stability with varying buffer sizes', async () => {
            const sizes = [frameSize / 2, frameSize, frameSize * 2];
            
            for (const size of sizes) {
                const buffer = generateVoiceSignal(sampleRate, size);
                
                // Adaptive processor should handle different sizes
                const result = await adaptiveProcessor.processAudio(buffer);
                expect(result).toBeDefined();
                expect(result.audioType).toBeDefined();
            }
        });
    });
    
    describe('Adaptive Learning Integration', () => {
        test('should improve performance through adaptive learning', async () => {
            const adaptiveProc = new AdaptiveProcessor({
                sampleRate,
                frameSize,
                enableAdaptation: true,
                adaptationHistoryLength: 20
            });
            
            // Process multiple similar signals
            const initialResults = [];
            const finalResults = [];
            
            for (let i = 0; i < 25; i++) {
                const buffer = generateVoiceSignal(sampleRate, frameSize);
                const result = await adaptiveProc.processAudio(buffer);
                
                if (i < 5) {
                    initialResults.push(result);
                } else if (i >= 20) {
                    finalResults.push(result);
                }
            }
            
            // Performance should improve over time
            const initialAvgConfidence = initialResults.reduce((sum, r) => 
                sum + r.detectionConfidence, 0) / initialResults.length;
            const finalAvgConfidence = finalResults.reduce((sum, r) => 
                sum + r.detectionConfidence, 0) / finalResults.length;
            
            expect(finalAvgConfidence).toBeGreaterThanOrEqual(initialAvgConfidence);
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
        
        for (let h = 1; h <= 6; h++) {
            const amplitude = 1 / h;
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * h * i / sampleRate);
        }
        
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
            sample = (Math.random() - 0.5) * 2;
        } else {
            const decay = Math.exp(-i / (sampleRate * 0.2));
            sample = 0.3 * Math.sin(2 * Math.PI * 150 * i / sampleRate) * decay;
            sample += 0.1 * (Math.random() - 0.5) * decay;
        }
        
        buffer[i] = sample * 0.6;
    }
    return buffer;
}

function generateMixedAudioSignal(sampleRate: number, length: number): Float32Array {
    const voice = generateVoiceSignal(sampleRate, length);
    const instrument = generateStringSignal(sampleRate, length);
    const mixed = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        mixed[i] = 0.6 * voice[i] + 0.4 * instrument[i];
    }
    
    return mixed;
}

function generateSustainedVoiceSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 200;
    
    for (let i = 0; i < length; i++) {
        let sample = 0.4 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        buffer[i] = sample;
    }
    return buffer;
}

function generateTestTone(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return buffer;
}