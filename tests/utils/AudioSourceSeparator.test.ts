/**
 * Unit Tests for Audio Source Separator
 */

import { AudioSourceSeparator, SeparationConfig, SourceProfile } from '../../src/utils/AudioSourceSeparator';

describe('AudioSourceSeparator', () => {
    let separator: AudioSourceSeparator;
    const sampleRate = 44100;
    const frameSize = 2048;
    
    beforeEach(() => {
        separator = new AudioSourceSeparator(sampleRate, {
            algorithm: 'spectral_masking',
            frameSize,
            aggressiveness: 0.7
        });
    });
    
    afterEach(() => {
        separator.reset();
    });
    
    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultSeparator = new AudioSourceSeparator();
            const config = defaultSeparator.getConfig();
            
            expect(config.algorithm).toBe('spectral_masking');
            expect(config.aggressiveness).toBe(0.7);
            expect(config.frameSize).toBe(2048);
            expect(config.enableHarmonicEnhancement).toBe(true);
            expect(config.enableNoiseSuppression).toBe(true);
        });
        
        test('should initialize with custom configuration', () => {
            const customConfig: Partial<SeparationConfig> = {
                algorithm: 'wiener_filter',
                aggressiveness: 0.9,
                frameSize: 1024,
                enableHarmonicEnhancement: false,
                maxSources: 5
            };
            
            const customSeparator = new AudioSourceSeparator(sampleRate, customConfig);
            const config = customSeparator.getConfig();
            
            expect(config.algorithm).toBe('wiener_filter');
            expect(config.aggressiveness).toBe(0.9);
            expect(config.frameSize).toBe(1024);
            expect(config.enableHarmonicEnhancement).toBe(false);
            expect(config.maxSources).toBe(5);
            
            customSeparator.reset();
        });
    });
    
    describe('Source Profile Management', () => {
        test('should register source profile', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            
            separator.registerSourceProfile(profile);
            
            const profiles = separator.getSourceProfiles();
            expect(profiles).toHaveLength(1);
            expect(profiles[0].id).toBe('speaker1');
            expect(profiles[0].sourceType).toBe('voice');
        });
        
        test('should register multiple source profiles', () => {
            const profile1 = createMockSourceProfile('speaker1', 'voice');
            const profile2 = createMockSourceProfile('instrument1', 'music');
            
            separator.registerSourceProfile(profile1);
            separator.registerSourceProfile(profile2);
            
            const profiles = separator.getSourceProfiles();
            expect(profiles).toHaveLength(2);
            expect(profiles.find(p => p.id === 'speaker1')).toBeDefined();
            expect(profiles.find(p => p.id === 'instrument1')).toBeDefined();
        });
        
        test('should remove source profile', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            expect(separator.getSourceProfiles()).toHaveLength(1);
            
            const removed = separator.removeSourceProfile('speaker1');
            expect(removed).toBe(true);
            expect(separator.getSourceProfiles()).toHaveLength(0);
        });
        
        test('should return false when removing non-existent profile', () => {
            const removed = separator.removeSourceProfile('nonexistent');
            expect(removed).toBe(false);
        });
    });
    
    describe('Audio Separation', () => {
        test('should separate audio using spectral masking', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            separator.updateConfig({ algorithm: 'spectral_masking' });
            const result = separator.separateSources(mixedAudio, ['speaker1']);
            
            expect(result.sources).toHaveLength(1);
            expect(result.sources[0]).toHaveLength(frameSize);
            expect(result.confidences).toHaveLength(1);
            expect(result.sourceLabels).toEqual(['speaker1']);
            expect(result.algorithmUsed).toBe('spectral_masking');
            expect(result.processingTime).toBeGreaterThan(0);
        });
        
        test('should separate audio using Wiener filter', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            separator.updateConfig({ algorithm: 'wiener_filter' });
            const result = separator.separateSources(mixedAudio, ['speaker1']);
            
            expect(result.sources).toHaveLength(1);
            expect(result.algorithmUsed).toBe('wiener_filter');
            expect(result.separationQuality).toBeGreaterThanOrEqual(0);
        });
        
        test('should separate audio using ICA', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            separator.updateConfig({ algorithm: 'ica' });
            const result = separator.separateSources(mixedAudio, ['speaker1']);
            
            expect(result.sources).toHaveLength(1);
            expect(result.algorithmUsed).toBe('ica');
        });
        
        test('should separate audio using adaptive subtraction', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            separator.updateConfig({ algorithm: 'adaptive_subtraction' });
            const result = separator.separateSources(mixedAudio, ['speaker1']);
            
            expect(result.sources).toHaveLength(1);
            expect(result.algorithmUsed).toBe('adaptive_subtraction');
        });
        
        test('should separate multiple sources', () => {
            const profile1 = createMockSourceProfile('speaker1', 'voice');
            const profile2 = createMockSourceProfile('speaker2', 'voice');
            
            separator.registerSourceProfile(profile1);
            separator.registerSourceProfile(profile2);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            const result = separator.separateSources(mixedAudio, ['speaker1', 'speaker2']);
            
            expect(result.sources).toHaveLength(2);
            expect(result.confidences).toHaveLength(2);
            expect(result.sourceLabels).toEqual(['speaker1', 'speaker2']);
        });
        
        test('should separate all registered sources when no targets specified', () => {
            const profile1 = createMockSourceProfile('speaker1', 'voice');
            const profile2 = createMockSourceProfile('instrument1', 'music');
            
            separator.registerSourceProfile(profile1);
            separator.registerSourceProfile(profile2);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            const result = separator.separateSources(mixedAudio);
            
            expect(result.sources).toHaveLength(2);
            expect(result.sourceLabels).toContain('speaker1');
            expect(result.sourceLabels).toContain('instrument1');
        });
        
        test('should throw error for unknown algorithm', () => {
            const mixedAudio = generateMixedAudio(frameSize);
            
            // @ts-ignore - Testing invalid algorithm
            separator.updateConfig({ algorithm: 'invalid_algorithm' });
            
            expect(() => {
                separator.separateSources(mixedAudio);
            }).toThrow('Unknown separation algorithm');
        });
    });
    
    describe('Configuration Management', () => {
        test('should update configuration', () => {
            const newConfig: Partial<SeparationConfig> = {
                algorithm: 'wiener_filter',
                aggressiveness: 0.9,
                enableHarmonicEnhancement: false,
                maxSources: 5
            };
            
            separator.updateConfig(newConfig);
            
            const config = separator.getConfig();
            expect(config.algorithm).toBe('wiener_filter');
            expect(config.aggressiveness).toBe(0.9);
            expect(config.enableHarmonicEnhancement).toBe(false);
            expect(config.maxSources).toBe(5);
        });
        
        test('should update FFT when frame size changes', () => {
            const originalConfig = separator.getConfig();
            expect(originalConfig.frameSize).toBe(frameSize);
            
            separator.updateConfig({ frameSize: 1024 });
            
            const newConfig = separator.getConfig();
            expect(newConfig.frameSize).toBe(1024);
        });
    });
    
    describe('Performance Monitoring', () => {
        test('should track separation history', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            // Process multiple separations
            for (let i = 0; i < 3; i++) {
                separator.separateSources(mixedAudio, ['speaker1']);
            }
            
            const history = separator.getSeparationHistory();
            expect(history).toHaveLength(3);
            
            history.forEach(result => {
                expect(result.processingTime).toBeGreaterThan(0);
                expect(result.sources).toHaveLength(1);
            });
        });
        
        test('should provide performance statistics', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            // Process some separations
            for (let i = 0; i < 5; i++) {
                separator.separateSources(mixedAudio, ['speaker1']);
            }
            
            const stats = separator.getPerformanceStats();
            expect(stats.averageProcessingTime).toBeGreaterThan(0);
            expect(stats.realTimeRatio).toBeGreaterThan(0);
            expect(stats.separationQuality).toBeGreaterThanOrEqual(0);
        });
        
        test('should limit history size', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            const mixedAudio = generateMixedAudio(frameSize);
            
            // Process more than the history limit (100)
            for (let i = 0; i < 105; i++) {
                separator.separateSources(mixedAudio, ['speaker1']);
            }
            
            const history = separator.getSeparationHistory();
            expect(history.length).toBeLessThanOrEqual(100);
        });
    });
    
    describe('System Reset', () => {
        test('should reset all state', () => {
            const profile = createMockSourceProfile('speaker1', 'voice');
            separator.registerSourceProfile(profile);
            
            const mixedAudio = generateMixedAudio(frameSize);
            separator.separateSources(mixedAudio, ['speaker1']);
            
            // Verify state exists
            expect(separator.getSourceProfiles()).toHaveLength(1);
            expect(separator.getSeparationHistory()).toHaveLength(1);
            
            // Reset
            separator.reset();
            
            // Verify state cleared
            expect(separator.getSourceProfiles()).toHaveLength(0);
            expect(separator.getSeparationHistory()).toHaveLength(0);
            expect(separator.getPerformanceStats().averageProcessingTime).toBe(0);
        });
    });
});

// Helper functions
function createMockSourceProfile(id: string, sourceType: 'voice' | 'music' | 'noise' | 'unknown'): SourceProfile {
    const spectralProfile = new Float32Array(1024);
    for (let i = 0; i < spectralProfile.length; i++) {
        spectralProfile[i] = Math.exp(-i / 100); // Decaying spectral profile
    }
    
    return {
        id,
        spectralProfile,
        f0Range: [100, 400] as [number, number],
        formants: [700, 1220, 2600, 3010],
        sourceType,
        profileConfidence: 0.8
    };
}

function generateMixedAudio(length: number): Float32Array {
    const signal = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        // Create a mixed signal with multiple frequency components
        signal[i] = 
            0.4 * Math.sin(2 * Math.PI * 440 * i / 44100) +      // 440 Hz component
            0.3 * Math.sin(2 * Math.PI * 880 * i / 44100) +      // 880 Hz component
            0.2 * Math.sin(2 * Math.PI * 1320 * i / 44100) +     // 1320 Hz component
            0.1 * (Math.random() - 0.5);                         // Noise
    }
    
    return signal;
}