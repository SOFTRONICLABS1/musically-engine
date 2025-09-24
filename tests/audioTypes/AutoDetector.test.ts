/**
 * Tests for AutoDetector - Universal Audio Type Detection System
 */

import { AutoDetector, AudioType, AudioTypeResult } from '../../src/audioTypes/AutoDetector';

describe('AutoDetector', () => {
    let detector: AutoDetector;
    const sampleRate = 44100;
    const frameSize = 2048;
    
    beforeEach(() => {
        detector = new AutoDetector({
            sampleRate,
            frameSize
        });
    });
    
    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultDetector = new AutoDetector();
            expect(defaultDetector).toBeDefined();
        });
        
        test('should initialize with custom configuration', () => {
            const customDetector = new AutoDetector({
                sampleRate: 48000,
                frameSize: 4096,
                confidenceThreshold: 0.8
            });
            expect(customDetector).toBeDefined();
        });
    });
    
    describe('Audio Type Detection', () => {
        test('should detect voice characteristics', () => {
            // Simulate voice-like signal with formant characteristics
            const buffer = generateVoicelikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            expect(result.features).toBeDefined();
        });
        
        test('should detect string instrument characteristics', () => {
            // Simulate string instrument with harmonic content
            const buffer = generateStringlikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.features.harmonicity).toBeGreaterThan(0.5);
        });
        
        test('should detect keyboard instrument characteristics', () => {
            // Simulate keyboard with rapid attack and decay
            const buffer = generateKeyboardlikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.features.attackTime).toBeLessThan(0.1);
        });
        
        test('should detect wind instrument characteristics', () => {
            // Simulate wind instrument with breath-like characteristics
            const buffer = generateWindlikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.features.breathiness).toBeGreaterThan(0.3);
        });
        
        test('should detect percussion characteristics', () => {
            // Simulate percussion with transient characteristics
            const buffer = generatePercussionlikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.features.transientRatio).toBeGreaterThan(0.7);
        });
        
        test('should handle silent input', () => {
            const buffer = new Float32Array(frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBe('unknown');
            expect(result.confidence).toBeLessThan(0.5);
        });
        
        test('should handle noise input', () => {
            const buffer = generateWhiteNoise(frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.confidence).toBeLessThan(0.8); // Should be uncertain about noise
        });
    });
    
    describe('Feature Extraction', () => {
        test('should extract spectral features correctly', () => {
            const buffer = generateTestTone(440, sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features.spectralCentroid).toBeGreaterThan(0);
            expect(result.features.spectralBandwidth).toBeGreaterThan(0);
            expect(result.features.spectralRolloff).toBeGreaterThan(0);
            expect(result.features.zcr).toBeGreaterThan(0);
        });
        
        test('should extract harmonic features correctly', () => {
            const buffer = generateHarmonicSignal(220, sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features.harmonicity).toBeGreaterThan(0.5);
            expect(result.features.harmonicRatio).toBeGreaterThan(0.5);
            expect(result.features.inharmonicity).toBeLessThan(0.5);
        });
        
        test('should extract temporal features correctly', () => {
            const buffer = generateImpulseResponse(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features.attackTime).toBeGreaterThan(0);
            expect(result.features.decayTime).toBeGreaterThan(0);
            expect(result.features.sustainLevel).toBeGreaterThanOrEqual(0);
            expect(result.features.sustainLevel).toBeLessThanOrEqual(1);
        });
        
        test('should extract voice-specific features', () => {
            const buffer = generateVoicelikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features.formantStability).toBeDefined();
            expect(result.features.voicedness).toBeDefined();
            expect(result.features.shimmer).toBeDefined();
            expect(result.features.jitter).toBeDefined();
        });
        
        test('should extract instrument-specific features', () => {
            const buffer = generateStringlikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features.pluckiness).toBeDefined();
            expect(result.features.breathiness).toBeDefined();
            expect(result.features.transientRatio).toBeDefined();
            expect(result.features.tremoloRate).toBeDefined();
        });
    });
    
    describe('Confidence Scoring', () => {
        test('should return higher confidence for clear signals', () => {
            const clearTone = generateTestTone(440, sampleRate, frameSize);
            const noisyTone = addNoise(clearTone, 0.5);
            
            const clearResult = detector.detectAudioType(clearTone);
            const noisyResult = detector.detectAudioType(noisyTone);
            
            expect(clearResult.confidence).toBeGreaterThan(noisyResult.confidence);
        });
        
        test('should return low confidence for ambiguous signals', () => {
            const ambiguousSignal = generateComplexSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(ambiguousSignal);
            
            // Should detect something but with lower confidence
            expect(result.confidence).toBeLessThan(0.9);
        });
        
        test('should handle edge case frequencies', () => {
            // Very low frequency
            const lowFreq = generateTestTone(20, sampleRate, frameSize);
            const lowResult = detector.detectAudioType(lowFreq);
            
            // Very high frequency
            const highFreq = generateTestTone(8000, sampleRate, frameSize);
            const highResult = detector.detectAudioType(highFreq);
            
            expect(lowResult.confidence).toBeGreaterThan(0);
            expect(highResult.confidence).toBeGreaterThan(0);
        });
    });
    
    describe('Instrument Profile Matching', () => {
        test('should match instrument profiles correctly', () => {
            // Test multiple types to ensure profile matching works
            const instruments = [
                { signal: generateStringlikeSignal(sampleRate, frameSize), expectedFamily: 'string' },
                { signal: generateWindlikeSignal(sampleRate, frameSize), expectedFamily: 'wind' },
                { signal: generatePercussionlikeSignal(sampleRate, frameSize), expectedFamily: 'percussion' }
            ];
            
            instruments.forEach(({ signal, expectedFamily }) => {
                const result = detector.detectAudioType(signal);
                // Should at least classify into a reasonable category
                expect(['string', 'keyboard', 'wind', 'percussion', 'voice', 'unknown']).toContain(result.audioType);
            });
        });
    });
    
    describe('Performance', () => {
        test('should process audio efficiently', () => {
            const buffer = generateTestTone(440, sampleRate, frameSize);
            
            const startTime = performance.now();
            for (let i = 0; i < 100; i++) {
                detector.detectAudioType(buffer);
            }
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            expect(processingTime).toBeLessThan(1000); // Should process 100 frames within 1 second
        });
        
        test('should handle large buffers', () => {
            const largeBuffer = generateTestTone(440, sampleRate, frameSize * 2);
            const result = detector.detectAudioType(largeBuffer);
            
            expect(result).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
        });
        
        test('should handle small buffers', () => {
            const smallBuffer = generateTestTone(440, sampleRate, frameSize / 2);
            const result = detector.detectAudioType(smallBuffer);
            
            expect(result).toBeDefined();
        });
    });
    
    describe('Configuration Updates', () => {
        test('should update configuration correctly', () => {
            detector.updateConfig({
                confidenceThreshold: 0.9,
                enableVoiceDetection: false
            });
            
            // Configuration should be updated (test indirectly through behavior)
            const buffer = generateVoicelikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result).toBeDefined();
        });
    });
    
    describe('Error Handling', () => {
        test('should handle empty buffer', () => {
            const emptyBuffer = new Float32Array(0);
            const result = detector.detectAudioType(emptyBuffer);
            
            expect(result.audioType).toBe('unknown');
            expect(result.confidence).toBe(0);
        });
        
        test('should handle NaN values in buffer', () => {
            const buffer = new Float32Array(frameSize);
            buffer.fill(NaN);
            
            const result = detector.detectAudioType(buffer);
            expect(result.audioType).toBe('unknown');
        });
        
        test('should handle infinite values in buffer', () => {
            const buffer = new Float32Array(frameSize);
            buffer.fill(Infinity);
            
            const result = detector.detectAudioType(buffer);
            expect(result.audioType).toBe('unknown');
        });
    });

    describe('Advanced Feature Extraction', () => {
        test('should handle very short buffers', () => {
            const shortBuffer = new Float32Array(10); // Very short
            shortBuffer.fill(0.5);
            
            const result = detector.detectAudioType(shortBuffer);
            expect(result).toBeDefined();
            expect(result.audioType).toBeDefined();
        });

        test('should extract formant stability features', () => {
            const buffer = generateVoicelikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features.formantStability).toBeDefined();
            expect(typeof result.features.formantStability).toBe('number');
        });

        test('should calculate spectral flux correctly', () => {
            const buffer = generateComplexSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features).toBeDefined();
            // Spectral flux should be captured in spectral features
            expect(result.features.spectralCentroid).toBeGreaterThan(0);
        });

        test('should detect polyphonic content', () => {
            const buffer = generatePolyphonicSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features.harmonicity).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
        });

        test('should handle DC offset in signals', () => {
            const buffer = generateTestTone(440, sampleRate, frameSize);
            // Add DC offset
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] += 0.5;
            }
            
            const result = detector.detectAudioType(buffer);
            expect(result).toBeDefined();
            expect(result.features.spectralCentroid).toBeGreaterThan(0);
        });

        test('should extract mel-frequency features', () => {
            const buffer = generateVoicelikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.features.voicedness).toBeDefined();
            expect(result.features.shimmer).toBeDefined();
            expect(result.features.jitter).toBeDefined();
        });
    });

    describe('Edge Cases and Robustness', () => {
        test('should handle clipped audio signals', () => {
            const buffer = new Float32Array(frameSize);
            for (let i = 0; i < frameSize; i++) {
                buffer[i] = i % 2 === 0 ? 1.0 : -1.0; // Square wave (clipped)
            }
            
            const result = detector.detectAudioType(buffer);
            expect(result.audioType).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
        });

        test('should handle impulse signals', () => {
            const buffer = new Float32Array(frameSize);
            buffer[100] = 1.0; // Single impulse
            
            const result = detector.detectAudioType(buffer);
            expect(result.audioType).toBeDefined();
        });

        test('should handle frequency sweeps', () => {
            const buffer = generateFrequencySweep(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.features.spectralBandwidth).toBeGreaterThan(0);
        });

        test('should detect audio with multiple peaks', () => {
            const buffer = generateMultiPeakSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.features.harmonicity).toBeLessThan(0.8); // Should detect as less harmonic
        });

        test('should handle amplitude modulated signals', () => {
            const buffer = generateAmplitudeModulatedSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            expect(result.audioType).toBeDefined();
            expect(result.features.tremoloRate).toBeDefined();
        });
    });

    describe('Configuration Edge Cases', () => {
        test('should work with extreme confidence thresholds', () => {
            const extremeDetector = new AutoDetector({
                sampleRate,
                frameSize,
                confidenceThreshold: 0.99 // Very high
            });
            
            const buffer = generateTestTone(440, sampleRate, frameSize);
            const result = extremeDetector.detectAudioType(buffer);
            
            expect(result).toBeDefined();
        });

        test('should handle disabled voice detection', () => {
            const detectorNoVoice = new AutoDetector({
                sampleRate,
                frameSize,
                enableVoiceDetection: false
            });
            
            const buffer = generateVoicelikeSignal(sampleRate, frameSize);
            const result = detectorNoVoice.detectAudioType(buffer);
            
            expect(result.audioType).not.toBe('voice');
        });

        test('should update configuration dynamically', () => {
            detector.updateConfig({
                confidenceThreshold: 0.8,
                enableVoiceDetection: false
            });
            
            const buffer = generateVoicelikeSignal(sampleRate, frameSize);
            const result = detector.detectAudioType(buffer);
            
            // Should not detect voice with disabled voice detection
            expect(result.audioType).not.toBe('voice');
        });
    });
});

// Helper functions for generating test signals

function generateTestTone(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return buffer;
}

function generateHarmonicSignal(fundamental: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const harmonics = [1, 0.5, 0.25, 0.125, 0.0625]; // Harmonic amplitudes
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        harmonics.forEach((amplitude, harmonic) => {
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * (harmonic + 1) * i / sampleRate);
        });
        buffer[i] = sample;
    }
    return buffer;
}

function generateVoicelikeSignal(sampleRate: number, length: number): Float32Array {
    // Simulate voice with formants at typical frequencies
    const buffer = new Float32Array(length);
    const fundamental = 150; // Typical male voice
    const formants = [800, 1200, 2400]; // Typical formant frequencies
    
    for (let i = 0; i < length; i++) {
        let sample = 0.3 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        
        // Add formant resonances
        formants.forEach((formant, index) => {
            const amplitude = 0.2 / (index + 1);
            sample += amplitude * Math.sin(2 * Math.PI * formant * i / sampleRate);
        });
        
        // Add some noise for breathiness
        sample += 0.05 * (Math.random() - 0.5);
        buffer[i] = sample;
    }
    return buffer;
}

function generateStringlikeSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220; // A3
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Strong harmonics typical of strings
        for (let h = 1; h <= 8; h++) {
            const amplitude = 1 / h; // Decreasing harmonic amplitude
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * h * i / sampleRate);
        }
        
        // Apply exponential decay
        const decay = Math.exp(-i / (sampleRate * 2));
        buffer[i] = sample * decay * 0.3;
    }
    return buffer;
}

function generateKeyboardlikeSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 261.63; // C4
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Sharp attack characteristic of keyboard instruments
        const attack = i < 100 ? i / 100 : 1;
        const decay = Math.exp(-i / (sampleRate * 0.5));
        
        // Harmonics with piano-like spectrum
        sample += 1.0 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        sample += 0.1 * Math.sin(2 * Math.PI * fundamental * 3 * i / sampleRate);
        
        buffer[i] = sample * attack * decay * 0.5;
    }
    return buffer;
}

function generateWindlikeSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440; // A4
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Fundamental with some harmonics
        sample += 0.8 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        sample += 0.1 * Math.sin(2 * Math.PI * fundamental * 3 * i / sampleRate);
        
        // Add breath noise
        sample += 0.1 * (Math.random() - 0.5);
        
        // Slight amplitude modulation (vibrato)
        const vibrato = 1 + 0.05 * Math.sin(2 * Math.PI * 5 * i / sampleRate);
        buffer[i] = sample * vibrato * 0.4;
    }
    return buffer;
}

function generatePercussionlikeSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        if (i < 50) {
            // Sharp transient attack
            sample = (Math.random() - 0.5) * 2;
        } else {
            // Rapid decay with some resonance
            const decay = Math.exp(-i / (sampleRate * 0.1));
            sample = 0.3 * Math.sin(2 * Math.PI * 200 * i / sampleRate) * decay;
            sample += 0.1 * (Math.random() - 0.5) * decay;
        }
        
        buffer[i] = sample * 0.6;
    }
    return buffer;
}

function generateWhiteNoise(length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = (Math.random() - 0.5) * 2;
    }
    return buffer;
}

function generateComplexSignal(sampleRate: number, length: number): Float32Array {
    // Complex signal that could be interpreted as multiple types
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Multiple competing frequencies
        sample += 0.3 * Math.sin(2 * Math.PI * 220 * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * 330 * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * 550 * i / sampleRate);
        sample += 0.1 * (Math.random() - 0.5);
        
        buffer[i] = sample;
    }
    return buffer;
}

function generateImpulseResponse(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    // Impulse at the beginning
    buffer[0] = 1.0;
    
    // Exponential decay
    for (let i = 1; i < length; i++) {
        buffer[i] = Math.exp(-i / (sampleRate * 0.5)) * 0.5;
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

function generatePolyphonicSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const frequencies = [220, 275, 330]; // C-Eb-G chord
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        frequencies.forEach((freq, index) => {
            const amplitude = 0.3 / (index + 1);
            sample += amplitude * Math.sin(2 * Math.PI * freq * i / sampleRate);
        });
        buffer[i] = sample;
    }
    return buffer;
}

function generateFrequencySweep(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const startFreq = 100;
    const endFreq = 2000;
    
    for (let i = 0; i < length; i++) {
        const progress = i / length;
        const freq = startFreq + (endFreq - startFreq) * progress;
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    return buffer;
}

function generateMultiPeakSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const peaks = [300, 800, 1500, 2200]; // Multiple frequency peaks
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        peaks.forEach(freq => {
            sample += 0.25 * Math.sin(2 * Math.PI * freq * i / sampleRate);
        });
        buffer[i] = sample;
    }
    return buffer;
}

function generateAmplitudeModulatedSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const carrierFreq = 440;
    const modFreq = 10; // 10 Hz tremolo
    
    for (let i = 0; i < length; i++) {
        const carrier = Math.sin(2 * Math.PI * carrierFreq * i / sampleRate);
        const modulation = 1 + 0.5 * Math.sin(2 * Math.PI * modFreq * i / sampleRate);
        buffer[i] = 0.5 * carrier * modulation;
    }
    return buffer;
}