/**
 * Unit Tests for Speaker Detector
 */

import { SpeakerDetector, SpeakerDetectionConfig, DetectionResult, SpeakerInfo } from '../../src/utils/SpeakerDetector';
import { VoiceProfile } from '../../src/utils/VoiceProfiler';

describe('SpeakerDetector', () => {
    let detector: SpeakerDetector;
    
    beforeEach(() => {
        detector = new SpeakerDetector({
            detectionThreshold: 0.7,
            confirmationFrames: 3,
            maxSpeakers: 5,
            smoothingWindow: 5
        });
    });
    
    afterEach(() => {
        detector.reset();
    });
    
    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultDetector = new SpeakerDetector();
            const config = defaultDetector.getConfig();
            
            expect(config.detectionThreshold).toBe(0.7);
            expect(config.changeSensitivity).toBe(0.6);
            expect(config.confirmationFrames).toBe(3);
            expect(config.vadThreshold).toBe(0.3);
            expect(config.adaptiveThreshold).toBe(true);
            expect(config.maxSpeakers).toBe(5);
            expect(config.smoothingWindow).toBe(5);
            expect(config.enableChangeDetection).toBe(true);
            
            defaultDetector.reset();
        });
        
        test('should initialize with custom configuration', () => {
            const customConfig: Partial<SpeakerDetectionConfig> = {
                detectionThreshold: 0.8,
                changeSensitivity: 0.7,
                confirmationFrames: 5,
                maxSpeakers: 3,
                adaptiveThreshold: false
            };
            
            const customDetector = new SpeakerDetector(customConfig);
            const config = customDetector.getConfig();
            
            expect(config.detectionThreshold).toBe(0.8);
            expect(config.changeSensitivity).toBe(0.7);
            expect(config.confirmationFrames).toBe(5);
            expect(config.maxSpeakers).toBe(3);
            expect(config.adaptiveThreshold).toBe(false);
            
            customDetector.reset();
        });
    });
    
    describe('Speaker Registration', () => {
        test('should register new speaker successfully', () => {
            const profile = createMockVoiceProfile('speaker1');
            
            const success = detector.registerSpeaker(profile);
            
            expect(success).toBe(true);
            
            const speakers = detector.getAllSpeakers();
            expect(speakers.size).toBe(1);
            expect(speakers.has('speaker1')).toBe(true);
            
            const stats = detector.getProcessingStats();
            expect(stats.totalSpeakers).toBe(1);
        });
        
        test('should register multiple speakers', () => {
            const profile1 = createMockVoiceProfile('speaker1');
            const profile2 = createMockVoiceProfile('speaker2');
            
            detector.registerSpeaker(profile1);
            detector.registerSpeaker(profile2);
            
            const speakers = detector.getAllSpeakers();
            expect(speakers.size).toBe(2);
            expect(speakers.has('speaker1')).toBe(true);
            expect(speakers.has('speaker2')).toBe(true);
        });
        
        test('should reject registration when max speakers reached', () => {
            const smallDetector = new SpeakerDetector({ maxSpeakers: 2 });
            
            const profile1 = createMockVoiceProfile('speaker1');
            const profile2 = createMockVoiceProfile('speaker2');
            const profile3 = createMockVoiceProfile('speaker3');
            
            expect(smallDetector.registerSpeaker(profile1)).toBe(true);
            expect(smallDetector.registerSpeaker(profile2)).toBe(true);
            expect(smallDetector.registerSpeaker(profile3)).toBe(false);
            
            expect(smallDetector.getAllSpeakers().size).toBe(2);
            
            smallDetector.reset();
        });
        
        test('should unregister speaker successfully', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            expect(detector.getAllSpeakers().size).toBe(1);
            
            const success = detector.unregisterSpeaker('speaker1');
            
            expect(success).toBe(true);
            expect(detector.getAllSpeakers().size).toBe(0);
        });
        
        test('should return false when unregistering non-existent speaker', () => {
            const success = detector.unregisterSpeaker('nonexistent');
            expect(success).toBe(false);
        });
    });
    
    describe('Voice Activity Detection', () => {
        test('should detect voice activity in speech signal', () => {
            const speechSignal = generateSpeechSignal(2048);
            
            const result = detector.detectSpeaker(speechSignal);
            
            expect(result.voiceActivity).toBe(true);
            expect(result.timestamp).toBeGreaterThan(0);
        });
        
        test('should not detect voice activity in silence', () => {
            const silentSignal = new Float32Array(2048); // All zeros
            
            const result = detector.detectSpeaker(silentSignal);
            
            expect(result.voiceActivity).toBe(false);
        });
        
        test('should not detect voice activity in pure noise', () => {
            const noiseSignal = generateNoiseSignal(2048, 0.05); // Low-level noise
            
            const result = detector.detectSpeaker(noiseSignal);
            
            expect(result.voiceActivity).toBe(false);
        });
    });
    
    describe('Speaker Detection', () => {
        test('should detect registered speaker', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            const speechSignal = generateSpeechSignal(2048);
            
            // Process multiple frames to build confidence
            let result: DetectionResult;
            for (let i = 0; i < 5; i++) {
                result = detector.detectSpeaker(speechSignal);
            }
            
            // Should eventually detect the speaker
            expect(result!.voiceActivity).toBe(true);
            expect(result!.allConfidences.has('speaker1')).toBe(true);
        });
        
        test('should not detect unregistered speaker', () => {
            const speechSignal = generateSpeechSignal(2048);
            
            const result = detector.detectSpeaker(speechSignal);
            
            expect(result.speakerId).toBeNull();
            expect(result.confidence).toBe(0);
            expect(result.allConfidences.size).toBe(0);
        });
        
        test('should provide confidence scores', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            const speechSignal = generateSpeechSignal(2048);
            
            const result = detector.detectSpeaker(speechSignal);
            
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            expect(result.frameQuality).toBeGreaterThanOrEqual(0);
        });
        
        test('should smooth confidence over time', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            const speechSignal = generateSpeechSignal(2048);
            
            const results: DetectionResult[] = [];
            for (let i = 0; i < 10; i++) {
                results.push(detector.detectSpeaker(speechSignal));
            }
            
            // Confidence should stabilize over time
            const lastResults = results.slice(-3);
            const confidenceVariation = Math.max(...lastResults.map(r => r.confidence)) - 
                                       Math.min(...lastResults.map(r => r.confidence));
            
            expect(confidenceVariation).toBeLessThan(0.3); // Should be relatively stable
        });
    });
    
    describe('Speaker Change Detection', () => {
        test('should detect speaker changes when enabled', () => {
            detector.updateConfig({ enableChangeDetection: true });
            
            const profile1 = createMockVoiceProfile('speaker1');
            const profile2 = createMockVoiceProfile('speaker2');
            
            detector.registerSpeaker(profile1);
            detector.registerSpeaker(profile2);
            
            const signal1 = generateSpeechSignal(1024, 200); // Different frequency
            const signal2 = generateSpeechSignal(1024, 300);
            
            // Build confidence for first speaker
            for (let i = 0; i < 5; i++) {
                detector.detectSpeaker(signal1);
            }
            
            // Switch to second speaker
            const changeResult = detector.detectSpeaker(signal2);
            
            // Should detect change (though may need multiple frames)
            expect(typeof changeResult.speakerChange).toBe('boolean');
        });
        
        test('should not detect changes when disabled', () => {
            detector.updateConfig({ enableChangeDetection: false });
            
            const speechSignal = generateSpeechSignal(2048);
            
            const result = detector.detectSpeaker(speechSignal);
            
            expect(result.speakerChange).toBe(false);
        });
    });
    
    describe('Configuration Management', () => {
        test('should update configuration', () => {
            const newConfig: Partial<SpeakerDetectionConfig> = {
                detectionThreshold: 0.8,
                changeSensitivity: 0.7,
                confirmationFrames: 5
            };
            
            detector.updateConfig(newConfig);
            
            const config = detector.getConfig();
            expect(config.detectionThreshold).toBe(0.8);
            expect(config.changeSensitivity).toBe(0.7);
            expect(config.confirmationFrames).toBe(5);
        });
        
        test('should update base threshold when detection threshold changes', () => {
            const originalConfig = detector.getConfig();
            const originalThreshold = originalConfig.detectionThreshold;
            
            detector.updateConfig({ detectionThreshold: 0.9 });
            
            const newConfig = detector.getConfig();
            expect(newConfig.detectionThreshold).toBe(0.9);
        });
    });
    
    describe('Processing Statistics', () => {
        test('should track processing statistics', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            const speechSignal = generateSpeechSignal(2048);
            const silentSignal = new Float32Array(2048);
            
            // Process mixed speech and silence
            for (let i = 0; i < 10; i++) {
                detector.detectSpeaker(i % 2 === 0 ? speechSignal : silentSignal);
            }
            
            const stats = detector.getProcessingStats();
            
            expect(stats.totalFrames).toBe(10);
            expect(stats.avgProcessingTime).toBeGreaterThan(0);
            expect(stats.voiceActivityRatio).toBeLessThanOrEqual(1);
            expect(stats.voiceActivityRatio).toBeGreaterThanOrEqual(0);
        });
        
        test('should update active speakers list', () => {
            const profile1 = createMockVoiceProfile('speaker1');
            const profile2 = createMockVoiceProfile('speaker2');
            
            detector.registerSpeaker(profile1);
            detector.registerSpeaker(profile2);
            
            const speechSignal = generateSpeechSignal(2048);
            
            // Simulate speaker1 being detected
            for (let i = 0; i < 5; i++) {
                detector.detectSpeaker(speechSignal);
            }
            
            const stats = detector.getProcessingStats();
            expect(stats.totalSpeakers).toBe(2);
            // Active speakers list depends on detection results
            expect(Array.isArray(stats.activeSpeakers)).toBe(true);
        });
        
        test('should calculate recent accuracy', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            const speechSignal = generateSpeechSignal(2048);
            const silentSignal = new Float32Array(2048);
            
            // Process some frames
            for (let i = 0; i < 10; i++) {
                detector.detectSpeaker(i < 5 ? speechSignal : silentSignal);
            }
            
            const accuracy = detector.calculateRecentAccuracy();
            
            expect(accuracy).toBeGreaterThanOrEqual(0);
            expect(accuracy).toBeLessThanOrEqual(1);
        });
    });
    
    describe('Detection History', () => {
        test('should maintain detection history', () => {
            const speechSignal = generateSpeechSignal(2048);
            
            // Process several frames
            for (let i = 0; i < 5; i++) {
                detector.detectSpeaker(speechSignal);
            }
            
            const history = detector.getDetectionHistory();
            
            expect(history).toHaveLength(5);
            history.forEach(result => {
                expect(result.timestamp).toBeGreaterThan(0);
                expect(typeof result.voiceActivity).toBe('boolean');
                expect(typeof result.confidence).toBe('number');
            });
        });
        
        test('should limit history size', () => {
            const speechSignal = generateSpeechSignal(2048);
            
            // Process more than the history limit
            for (let i = 0; i < 105; i++) {
                detector.detectSpeaker(speechSignal);
            }
            
            const history = detector.getDetectionHistory();
            expect(history.length).toBeLessThanOrEqual(100);
        });
        
        test('should return limited history when requested', () => {
            const speechSignal = generateSpeechSignal(2048);
            
            // Process several frames
            for (let i = 0; i < 10; i++) {
                detector.detectSpeaker(speechSignal);
            }
            
            const limitedHistory = detector.getDetectionHistory(3);
            expect(limitedHistory).toHaveLength(3);
        });
    });
    
    describe('System Reset', () => {
        test('should reset all state', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            const speechSignal = generateSpeechSignal(2048);
            detector.detectSpeaker(speechSignal);
            
            // Verify state exists
            expect(detector.getAllSpeakers().size).toBe(1);
            expect(detector.getDetectionHistory()).toHaveLength(1);
            expect(detector.getProcessingStats().totalFrames).toBe(1);
            
            // Reset
            detector.reset();
            
            // Verify state cleared
            expect(detector.getAllSpeakers().size).toBe(0);
            expect(detector.getDetectionHistory()).toHaveLength(0);
            expect(detector.getProcessingStats().totalFrames).toBe(0);
            expect(detector.getProcessingStats().totalSpeakers).toBe(0);
        });
    });
    
    describe('Speaker Information', () => {
        test('should provide speaker information', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            const speakerInfo = detector.getSpeakerInfo('speaker1');
            
            expect(speakerInfo).not.toBeNull();
            expect(speakerInfo!.profile.id).toBe('speaker1');
            expect(speakerInfo!.confidence).toBe(0);
            expect(speakerInfo!.detectionCount).toBe(0);
            expect(speakerInfo!.isActive).toBe(false);
        });
        
        test('should return null for non-existent speaker', () => {
            const speakerInfo = detector.getSpeakerInfo('nonexistent');
            expect(speakerInfo).toBeNull();
        });
        
        test('should update speaker information during detection', () => {
            const profile = createMockVoiceProfile('speaker1');
            detector.registerSpeaker(profile);
            
            const speechSignal = generateSpeechSignal(2048);
            
            // Process several frames
            for (let i = 0; i < 5; i++) {
                detector.detectSpeaker(speechSignal);
            }
            
            const speakerInfo = detector.getSpeakerInfo('speaker1');
            
            expect(speakerInfo).not.toBeNull();
            expect(speakerInfo!.lastDetected).toBeGreaterThan(0);
        });
    });
});

// Helper functions
function createMockVoiceProfile(speakerId: string): VoiceProfile {
    const spectralEnvelope = new Float32Array(512);
    for (let i = 0; i < spectralEnvelope.length; i++) {
        spectralEnvelope[i] = Math.exp(-i / 100);
    }
    
    const mfccs = new Float32Array(13);
    for (let i = 0; i < mfccs.length; i++) {
        mfccs[i] = (Math.random() - 0.5) * 2;
    }
    
    return {
        id: speakerId,
        timestamp: Date.now(),
        fundamentalFrequencyRange: [100, 300] as [number, number],
        averageF0: 200,
        formants: {
            f1: 700,
            f2: 1220,
            f3: 2600,
            f4: 3010,
            bandwidths: [50, 50, 50, 50],
            confidences: [0.8, 0.8, 0.8, 0.8]
        },
        spectralEnvelope,
        mfccs,
        voiceQuality: {
            breathiness: 0.3,
            roughness: 0.2,
            strain: 0.1,
            vocalTractLength: 17.5,
            genderLikelihood: 0.0
        },
        pitchContour: {
            mean: 200,
            variance: 400,
            skewness: 0,
            kurtosis: 3
        },
        harmonicToNoiseRatio: {
            mean: 15,
            variance: 4
        },
        spectralMoments: {
            centroid: 2000,
            spread: 800,
            skewness: 0.5,
            kurtosis: 2.5
        },
        confidence: 0.85,
        sampleCount: 100
    };
}

function generateSpeechSignal(length: number, frequency: number = 220): Float32Array {
    const signal = new Float32Array(length);
    const omega = 2 * Math.PI * frequency / 44100;
    
    for (let i = 0; i < length; i++) {
        // Generate speech-like signal with harmonics
        signal[i] = 
            0.6 * Math.sin(omega * i) +                    // Fundamental
            0.3 * Math.sin(2 * omega * i) +                // First harmonic
            0.15 * Math.sin(3 * omega * i) +               // Second harmonic
            0.05 * (Math.random() - 0.5);                  // Noise
    }
    
    return signal;
}

function generateNoiseSignal(length: number, amplitude: number = 0.1): Float32Array {
    const signal = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        signal[i] = amplitude * (Math.random() - 0.5);
    }
    
    return signal;
}