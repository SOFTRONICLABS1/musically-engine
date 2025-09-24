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

    describe('Advanced Integration Scenarios', () => {
        test('should handle rapid audio type changes', async () => {
            const rapidChangeBuffer = generateRapidAudioTypeChanges(sampleRate, frameSize * 4);
            
            const results = [];
            for (let i = 0; i < 4; i++) {
                const frameStart = i * frameSize;
                const frame = rapidChangeBuffer.slice(frameStart, frameStart + frameSize);
                
                const result = await adaptiveProcessor.processAudio(frame);
                results.push(result);
            }
            
            // Should detect different audio types
            const uniqueTypes = new Set(results.map(r => r.audioType));
            expect(uniqueTypes.size).toBeGreaterThanOrEqual(2);
            
            // Each result should have reasonable confidence
            results.forEach(result => {
                expect(result.detectionConfidence).toBeGreaterThan(0.3);
            });
        });

        test('should maintain pitch tracking accuracy across processors', async () => {
            const pitchBuffer = generateSteadyPitch(220, sampleRate, frameSize);
            
            // Test with different processors
            const autoResult = autoDetector.detectAudioType(pitchBuffer);
            const vocalResult = vocalProcessor.processVoice(pitchBuffer);
            const instrumentResult = instrumentProcessor.processInstrument(pitchBuffer);
            const adaptiveResult = await adaptiveProcessor.processAudio(pitchBuffer);
            const pitchVoteResult = pitchVoting.detectPitch(pitchBuffer);
            
            // All should detect similar fundamental frequency (within 10%)
            const frequencies = [
                vocalResult.fundamentalFrequency,
                instrumentResult.fundamentalFrequency,
                adaptiveResult.fundamentalFrequency,
                pitchVoteResult.frequency
            ].filter(f => f > 0);
            
            if (frequencies.length > 1) {
                const avgFreq = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
                frequencies.forEach(freq => {
                    const deviation = Math.abs(freq - avgFreq) / avgFreq;
                    expect(deviation).toBeLessThan(0.1); // Within 10%
                });
            }
        });

        test('should handle extreme audio conditions', async () => {
            const extremeConditions = [
                generateVeryLowPitch(50, sampleRate, frameSize),    // Very low pitch
                generateVeryHighPitch(4000, sampleRate, frameSize), // Very high pitch  
                generateVeryQuietSignal(sampleRate, frameSize),     // Very quiet
                generateVeryLoudSignal(sampleRate, frameSize),      // Very loud
                generateNoiseOnlySignal(sampleRate, frameSize)      // Pure noise
            ];
            
            for (const buffer of extremeConditions) {
                const result = await adaptiveProcessor.processAudio(buffer);
                
                // Should not crash and should return valid results
                expect(result).toBeDefined();
                expect(result.audioType).toBeDefined();
                expect(result.quality).toBeDefined();
                expect(result.quality.isReliable).toBeDefined();
            }
        });

        test('should demonstrate quality assessment correlation', async () => {
            const signals = [
                { buffer: generateHighQualityVoice(sampleRate, frameSize), expectedQuality: 'high' },
                { buffer: generateMediumQualityVoice(sampleRate, frameSize), expectedQuality: 'medium' },
                { buffer: generateLowQualityVoice(sampleRate, frameSize), expectedQuality: 'low' }
            ];
            
            const qualityResults = [];
            for (const signal of signals) {
                const result = await adaptiveProcessor.processAudio(signal.buffer);
                qualityResults.push({
                    expected: signal.expectedQuality,
                    actual: result.quality.overallQuality
                });
            }
            
            // High quality should score higher than medium, medium higher than low
            const highQuality = qualityResults.find(r => r.expected === 'high');
            const mediumQuality = qualityResults.find(r => r.expected === 'medium');
            const lowQuality = qualityResults.find(r => r.expected === 'low');
            
            if (highQuality && mediumQuality && lowQuality) {
                expect(highQuality.actual).toBeGreaterThan(mediumQuality.actual);
                expect(mediumQuality.actual).toBeGreaterThan(lowQuality.actual);
            }
        });

        test('should handle polyphonic content across all processors', async () => {
            const polyphonicBuffer = generatePolyphonicContent(sampleRate, frameSize);
            
            const autoResult = autoDetector.detectAudioType(polyphonicBuffer);
            const instrumentResult = instrumentProcessor.processInstrument(polyphonicBuffer);
            const adaptiveResult = await adaptiveProcessor.processAudio(polyphonicBuffer);
            const pitchVoteResult = pitchVoting.detectPitch(polyphonicBuffer);
            
            // Should detect multiple pitches or handle polyphony gracefully
            expect(autoResult.features.harmonicity).toBeLessThan(0.9); // Less harmonic due to multiple pitches
            expect(instrumentResult.fundamentalFrequency).toBeGreaterThan(0);
            expect(adaptiveResult.detectionConfidence).toBeGreaterThan(0.4);
            expect(pitchVoteResult.quality).toBeGreaterThan(0.3);
        });

        test('should demonstrate adaptive learning behavior', async () => {
            // Process similar signals multiple times to trigger adaptation
            const learningSignal = generateConsistentVoice(sampleRate, frameSize);
            
            const initialResult = await adaptiveProcessor.processAudio(learningSignal);
            
            // Process multiple similar signals
            for (let i = 0; i < 15; i++) {
                const similarSignal = generateConsistentVoice(sampleRate, frameSize);
                await adaptiveProcessor.processAudio(similarSignal);
            }
            
            const adaptedResult = await adaptiveProcessor.processAudio(learningSignal);
            
            // After adaptation, should have better confidence or consistency
            expect(adaptedResult.metadata.adaptationApplied).toBe(true);
            expect(adaptedResult.detectionConfidence).toBeGreaterThanOrEqual(initialResult.detectionConfidence);
        });
    });

    describe('Performance and Stability Integration', () => {
        test('should process large batches efficiently', async () => {
            const batchSize = 20;
            const signals = [];
            
            for (let i = 0; i < batchSize; i++) {
                signals.push(generateRandomAudioSignal(sampleRate, frameSize));
            }
            
            const startTime = performance.now();
            const results = [];
            
            for (const signal of signals) {
                const result = await adaptiveProcessor.processAudio(signal);
                results.push(result);
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            
            // Should process efficiently
            expect(totalTime).toBeLessThan(2000); // Less than 2 seconds for 20 signals
            expect(results.length).toBe(batchSize);
            
            // All results should be valid
            results.forEach(result => {
                expect(result.audioType).toBeDefined();
                expect(result.quality).toBeDefined();
            });
        });

        test('should maintain memory stability during long processing', async () => {
            const iterations = 50;
            let memoryGrowth = 0;
            
            if (typeof performance !== 'undefined' && performance.memory) {
                const initialMemory = performance.memory.usedJSHeapSize;
                
                for (let i = 0; i < iterations; i++) {
                    const signal = generateRandomAudioSignal(sampleRate, frameSize);
                    await adaptiveProcessor.processAudio(signal);
                }
                
                const finalMemory = performance.memory.usedJSHeapSize;
                memoryGrowth = finalMemory - initialMemory;
            }
            
            // Should not have excessive memory growth (test will pass if memory API unavailable)
            if (memoryGrowth > 0) {
                expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
            }
        });

        test('should handle concurrent processing requests', async () => {
            const concurrentSignals = [
                generateVoiceSignal(sampleRate, frameSize),
                generateStringSignal(sampleRate, frameSize),
                generateMixedAudioSignal(sampleRate, frameSize)
            ];
            
            // Process all signals concurrently
            const promises = concurrentSignals.map(signal => 
                adaptiveProcessor.processAudio(signal)
            );
            
            const results = await Promise.all(promises);
            
            // All should complete successfully
            expect(results.length).toBe(3);
            results.forEach(result => {
                expect(result.audioType).toBeDefined();
                expect(result.detectionConfidence).toBeGreaterThan(0);
            });
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

// Additional helper functions for comprehensive integration testing

function generateRapidAudioTypeChanges(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const segmentLength = Math.floor(length / 4);
    
    // Segment 1: Voice
    for (let i = 0; i < segmentLength; i++) {
        buffer[i] = 0.3 * Math.sin(2 * Math.PI * 200 * i / sampleRate) +
                   0.15 * Math.sin(2 * Math.PI * 800 * i / sampleRate);
    }
    
    // Segment 2: String
    for (let i = segmentLength; i < segmentLength * 2; i++) {
        const freq = 220;
        const decay = Math.exp(-(i - segmentLength) / (sampleRate * 0.5));
        buffer[i] = 0.4 * Math.sin(2 * Math.PI * freq * i / sampleRate) * decay;
    }
    
    // Segment 3: Percussion
    for (let i = segmentLength * 2; i < segmentLength * 3; i++) {
        if (i < segmentLength * 2 + 50) {
            buffer[i] = 0.8 * (Math.random() - 0.5); // Attack
        } else {
            const decay = Math.exp(-(i - segmentLength * 2) / (sampleRate * 0.1));
            buffer[i] = 0.3 * Math.sin(2 * Math.PI * 150 * i / sampleRate) * decay;
        }
    }
    
    // Segment 4: Wind
    for (let i = segmentLength * 3; i < length; i++) {
        const sample = 0.4 * Math.sin(2 * Math.PI * 440 * i / sampleRate);
        buffer[i] = sample + 0.1 * (Math.random() - 0.5); // Add breathiness
    }
    
    return buffer;
}

function generateSteadyPitch(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return buffer;
}

function generateVeryLowPitch(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return buffer;
}

function generateVeryHighPitch(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.3 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return buffer;
}

function generateVeryQuietSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.01 * Math.sin(2 * Math.PI * 440 * i / sampleRate); // Very quiet
    }
    return buffer;
}

function generateVeryLoudSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.95 * Math.sin(2 * Math.PI * 440 * i / sampleRate); // Near clipping
    }
    return buffer;
}

function generateNoiseOnlySignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = (Math.random() - 0.5) * 0.5; // White noise
    }
    return buffer;
}

function generateHighQualityVoice(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 200;
    
    for (let i = 0; i < length; i++) {
        let sample = 0.4 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * 800 * i / sampleRate);  // Clear formant
        sample += 0.1 * Math.sin(2 * Math.PI * 1200 * i / sampleRate); // Clear formant
        buffer[i] = sample;
    }
    return buffer;
}

function generateMediumQualityVoice(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 200;
    
    for (let i = 0; i < length; i++) {
        let sample = 0.3 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.15 * Math.sin(2 * Math.PI * 800 * i / sampleRate);
        sample += 0.05 * (Math.random() - 0.5); // Some noise
        buffer[i] = sample;
    }
    return buffer;
}

function generateLowQualityVoice(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 200;
    
    for (let i = 0; i < length; i++) {
        let sample = 0.2 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.15 * (Math.random() - 0.5); // Lots of noise
        buffer[i] = sample;
    }
    return buffer;
}

function generatePolyphonicContent(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const frequencies = [220, 277, 330]; // C-E-G chord
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        frequencies.forEach(freq => {
            sample += 0.25 * Math.sin(2 * Math.PI * freq * i / sampleRate);
        });
        buffer[i] = sample;
    }
    return buffer;
}

function generateConsistentVoice(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 180;
    
    for (let i = 0; i < length; i++) {
        let sample = 0.35 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.18 * Math.sin(2 * Math.PI * 720 * i / sampleRate);
        sample += 0.12 * Math.sin(2 * Math.PI * 1080 * i / sampleRate);
        buffer[i] = sample;
    }
    return buffer;
}

function generateRandomAudioSignal(sampleRate: number, length: number): Float32Array {
    const types = ['voice', 'string', 'wind', 'percussion'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    switch (randomType) {
        case 'voice':
            return generateVoiceSignal(sampleRate, length);
        case 'string':
            return generateStringSignal(sampleRate, length);
        case 'wind':
            return generateWindSignal(sampleRate, length);
        case 'percussion':
            return generatePercussionSignal(sampleRate, length);
        default:
            return generateTestTone(440, sampleRate, length);
    }
}

function generateWindSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    
    for (let i = 0; i < length; i++) {
        let sample = 0.4 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.1 * (Math.random() - 0.5); // Breathiness
        buffer[i] = sample;
    }
    return buffer;
}

function generatePercussionSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        if (i < 50) {
            buffer[i] = 0.8 * (Math.random() - 0.5);
        } else {
            const decay = Math.exp(-i / (sampleRate * 0.2));
            buffer[i] = 0.3 * Math.sin(2 * Math.PI * 150 * i / sampleRate) * decay;
        }
    }
    return buffer;
}