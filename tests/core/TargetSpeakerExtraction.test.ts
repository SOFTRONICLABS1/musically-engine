/**
 * Test Suite for Target Speaker Extraction System
 */

import { TargetSpeakerExtraction, TargetSpeakerConfig, ExtractionResult, TrainingProgress } from '../../src/core/TargetSpeakerExtraction';
import { VoiceProfile } from '../../src/utils/VoiceProfiler';

describe('Target Speaker Extraction System', () => {
    let tse: TargetSpeakerExtraction;
    const sampleRate = 44100;
    const frameSize = 2048; // Match default FFT size
    
    beforeEach(() => {
        tse = new TargetSpeakerExtraction(sampleRate, {
            frameSize,
            debugMode: false,
            trainingDuration: 1000 // 1 second for quick tests
        });
    });
    
    afterEach(() => {
        tse.reset();
    });
    
    describe('System Initialization', () => {
        test('should initialize with default configuration', () => {
            const config = tse.getConfig();
            
            expect(config.enabled).toBe(true);
            expect(config.extractionAggressiveness).toBe(0.8);
            expect(config.detectionThreshold).toBe(0.7);
            expect(config.separationAlgorithm).toBe('spectral_masking');
            expect(config.enableNoiseReduction).toBe(true);
            expect(config.frameSize).toBe(frameSize);
        });
        
        test('should initialize with custom configuration', () => {
            const customConfig: Partial<TargetSpeakerConfig> = {
                extractionAggressiveness: 0.9,
                detectionThreshold: 0.8,
                separationAlgorithm: 'wiener_filter',
                enableNoiseReduction: false,
                debugMode: true
            };
            
            const customTSE = new TargetSpeakerExtraction(sampleRate, customConfig);
            const config = customTSE.getConfig();
            
            expect(config.extractionAggressiveness).toBe(0.9);
            expect(config.detectionThreshold).toBe(0.8);
            expect(config.separationAlgorithm).toBe('wiener_filter');
            expect(config.enableNoiseReduction).toBe(false);
            expect(config.debugMode).toBe(true);
            
            customTSE.reset();
        });
        
        test('should report not ready initially', () => {
            expect(tse.isReady()).toBe(false);
            
            const trainingStatus = tse.getTrainingStatus();
            expect(trainingStatus.isTraining).toBe(false);
            expect(trainingStatus.hasProfile).toBe(false);
            expect(trainingStatus.profileConfidence).toBe(0);
        });
    });
    
    describe('Voice Training', () => {
        test('should start voice training session', () => {
            const sessionId = tse.startVoiceTraining(500);
            
            expect(sessionId).toMatch(/^training_\d+$/);
            
            const trainingStatus = tse.getTrainingStatus();
            expect(trainingStatus.isTraining).toBe(true);
            expect(trainingStatus.hasProfile).toBe(false);
        });
        
        test('should process training frames and show progress', () => {
            tse.startVoiceTraining(500);
            
            const voiceSignal = generateVoiceSignal(440, frameSize);
            
            let progress: TrainingProgress | null = null;
            for (let i = 0; i < 3; i++) {
                const result = tse.process(voiceSignal);
                if ('progress' in result) {
                    progress = result;
                }
            }
            
            expect(progress).not.toBeNull();
            expect(progress!.progress).toBeGreaterThan(0);
            expect(progress!.samplesCollected).toBeGreaterThan(0);
        });
        
        test('should throw error if training already in progress', () => {
            tse.startVoiceTraining(500);
            
            expect(() => {
                tse.startVoiceTraining(500);
            }).toThrow('Voice training already in progress');
        });
    });
    
    describe('Voice Profile Management', () => {
        test('should set target voice profile manually', () => {
            const mockProfile = createMockVoiceProfile('test_speaker');
            
            tse.setTargetVoiceProfile(mockProfile);
            
            const retrievedProfile = tse.getTargetVoiceProfile();
            expect(retrievedProfile).toEqual(mockProfile);
            expect(tse.isReady()).toBe(true);
            
            const trainingStatus = tse.getTrainingStatus();
            expect(trainingStatus.hasProfile).toBe(true);
            expect(trainingStatus.profileConfidence).toBe(mockProfile.confidence);
        });
        
        test('should return null when no target profile is set', () => {
            const profile = tse.getTargetVoiceProfile();
            expect(profile).toBeNull();
        });
    });
    
    describe('Audio Processing', () => {
        test('should process audio without target profile', () => {
            const audioFrame = generateVoiceSignal(440, frameSize);
            
            const result = tse.process(audioFrame) as ExtractionResult;
            
            expect(result.targetAudio).toEqual(audioFrame);
            expect(result.targetConfidence).toBe(0);
            expect(result.separationQuality).toBe(0);
            expect(result.noiseReductionApplied).toBe(false);
            expect(result.stats.speakerDetected).toBe(false);
        });
        
        test('should handle disabled system gracefully', () => {
            tse.updateConfig({ enabled: false });
            const audioFrame = generateVoiceSignal(440, frameSize);
            
            const result = tse.process(audioFrame) as ExtractionResult;
            
            expect(result.targetAudio).toEqual(audioFrame);
            expect(result.stats.speakerDetected).toBe(false);
        });
    });
    
    describe('Configuration Management', () => {
        test('should update configuration', () => {
            const newConfig: Partial<TargetSpeakerConfig> = {
                extractionAggressiveness: 0.9,
                detectionThreshold: 0.8,
                separationAlgorithm: 'wiener_filter'
            };
            
            tse.updateConfig(newConfig);
            
            const config = tse.getConfig();
            expect(config.extractionAggressiveness).toBe(0.9);
            expect(config.detectionThreshold).toBe(0.8);
            expect(config.separationAlgorithm).toBe('wiener_filter');
        });
    });
    
    describe('System Statistics', () => {
        test('should provide system statistics', () => {
            const stats = tse.getSystemStats();
            
            expect(stats.totalProcessingTime).toBe(0);
            expect(stats.framesProcessed).toBe(0);
            expect(stats.averageQuality).toBe(0);
            expect(stats.detectionRate).toBe(0);
            expect(stats.trainingStatus).toBe('not_started');
        });
        
        test('should update statistics during processing', () => {
            const audioFrame = generateVoiceSignal(440, frameSize);
            
            // Process several frames without target profile
            for (let i = 0; i < 3; i++) {
                tse.process(audioFrame);
            }
            
            const stats = tse.getSystemStats();
            expect(stats.totalProcessingTime).toBe(0); // No processing when disabled
            expect(stats.framesProcessed).toBe(0);
            expect(stats.trainingStatus).toBe('not_started');
        });
    });
    
    describe('System Reset', () => {
        test('should reset system state', () => {
            const mockProfile = createMockVoiceProfile('test_speaker');
            tse.setTargetVoiceProfile(mockProfile);
            
            // Verify system has state
            expect(tse.getTargetVoiceProfile()).not.toBeNull();
            expect(tse.isReady()).toBe(true);
            
            // Reset
            tse.reset();
            
            // Verify reset
            expect(tse.getTargetVoiceProfile()).toBeNull();
            expect(tse.isReady()).toBe(false);
            expect(tse.getSystemStats().framesProcessed).toBe(0);
            expect(tse.getSystemStats().trainingStatus).toBe('not_started');
        });
    });
});

// Helper functions
function generateVoiceSignal(frequency: number, length: number): Float32Array {
    const signal = new Float32Array(length);
    const omega = 2 * Math.PI * frequency / 44100;
    
    for (let i = 0; i < length; i++) {
        // Create a harmonic signal with some complexity
        signal[i] = 
            0.6 * Math.sin(omega * i) +           // Fundamental
            0.3 * Math.sin(2 * omega * i) +       // First harmonic
            0.1 * Math.sin(3 * omega * i) +       // Second harmonic
            0.05 * (Math.random() - 0.5);         // Small amount of noise
    }
    
    return signal;
}

function createMockVoiceProfile(speakerId: string): VoiceProfile {
    const spectralEnvelope = new Float32Array(512);
    for (let i = 0; i < spectralEnvelope.length; i++) {
        spectralEnvelope[i] = Math.exp(-i / 100); // Decaying spectral envelope
    }
    
    const mfccs = new Float32Array(13);
    for (let i = 0; i < mfccs.length; i++) {
        mfccs[i] = (Math.random() - 0.5) * 2; // Random MFCC values
    }
    
    return {
        id: speakerId,
        timestamp: Date.now(),
        fundamentalFrequencyRange: [100, 300],
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