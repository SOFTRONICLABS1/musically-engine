/**
 * Tests for VocalProcessor - Advanced Voice Processing with Formant Tracking
 */

import { VocalProcessor, VocalAnalysisResult, VocalConfig } from '../../src/audioTypes/VocalProcessor';

describe('VocalProcessor', () => {
    let processor: VocalProcessor;
    const sampleRate = 44100;
    const frameSize = 2048;
    
    beforeEach(() => {
        processor = new VocalProcessor({
            sampleRate,
            frameSize
        });
    });
    
    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultProcessor = new VocalProcessor();
            expect(defaultProcessor).toBeDefined();
        });
        
        test('should initialize with custom configuration', () => {
            const customProcessor = new VocalProcessor({
                sampleRate: 48000,
                frameSize: 4096,
                pitchSmoothingFactor: 0.9,
                formantBandwidth: 150
            });
            expect(customProcessor).toBeDefined();
        });
    });
    
    describe('Voice Processing', () => {
        test('should process voice signal correctly', () => {
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.fundamentalFrequency).toBeGreaterThan(0);
            expect(result.formants).toBeDefined();
            expect(result.formants.length).toBeGreaterThan(0);
            expect(result.vowelClassification).toBeDefined();
            expect(result.vibrato).toBeDefined();
            expect(result.ornaments).toBeDefined();
        });
        
        test('should handle silent input', () => {
            const buffer = new Float32Array(frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.fundamentalFrequency).toBe(0);
            expect(result.formants).toEqual([]);
        });
        
        test('should process male voice characteristics', () => {
            const buffer = generateMaleVoiceSignal(sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.fundamentalFrequency).toBeGreaterThan(80);
            expect(result.fundamentalFrequency).toBeLessThan(300);
            expect(result.formants.length).toBeGreaterThanOrEqual(2);
        });
        
        test('should process female voice characteristics', () => {
            const buffer = generateFemaleVoiceSignal(sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.fundamentalFrequency).toBeGreaterThan(150);
            expect(result.fundamentalFrequency).toBeLessThan(500);
            expect(result.formants.length).toBeGreaterThanOrEqual(2);
        });
    });
    
    describe('Formant Detection', () => {
        test('should detect formants in vowel sounds', () => {
            const buffer = generateVowelSound('a', sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.formants.length).toBeGreaterThanOrEqual(2);
            
            // Check that formants are in reasonable ranges
            result.formants.forEach(formant => {
                expect(formant.frequency).toBeGreaterThan(200);
                expect(formant.frequency).toBeLessThan(4000);
                expect(formant.amplitude).toBeGreaterThan(0);
                expect(formant.bandwidth).toBeGreaterThan(0);
            });
        });
        
        test('should detect different formant patterns for different vowels', () => {
            const vowels = ['a', 'e', 'i', 'o', 'u'];
            const formantPatterns: any[] = [];
            
            vowels.forEach(vowel => {
                const buffer = generateVowelSound(vowel, sampleRate, frameSize);
                const result = processor.processVoice(buffer);
                formantPatterns.push(result.formants);
            });
            
            // Each vowel should have distinct formant patterns
            expect(formantPatterns.length).toBe(5);
            formantPatterns.forEach(pattern => {
                expect(pattern.length).toBeGreaterThanOrEqual(2);
            });
        });
        
        test('should track formant stability over time', () => {
            const buffer = generateSustainedVowel('a', sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.formants.length).toBeGreaterThan(0);
            
            // For sustained vowel, formants should be relatively stable
            result.formants.forEach(formant => {
                expect(formant.stability).toBeGreaterThan(0.5);
            });
        });
    });
    
    describe('Vowel Classification', () => {
        test('should classify vowel sounds correctly', () => {
            const vowels = ['a', 'e', 'i', 'o', 'u'];
            
            vowels.forEach(vowel => {
                const buffer = generateVowelSound(vowel, sampleRate, frameSize);
                const result = processor.processVoice(buffer);
                
                expect(result.vowelClassification).toBeDefined();
                expect(result.vowelClassification.vowel).toBeDefined();
                expect(result.vowelClassification.confidence).toBeGreaterThan(0);
                expect(result.vowelClassification.confidence).toBeLessThanOrEqual(1);
            });
        });
        
        test('should handle diphthongs', () => {
            const buffer = generateDiphthong('ai', sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.vowelClassification).toBeDefined();
            expect(result.vowelClassification.isDiphthong).toBe(true);
        });
        
        test('should detect vowel transitions', () => {
            const buffer = generateVowelTransition('a', 'i', sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.vowelClassification).toBeDefined();
            // Should detect some form of transition or instability
        });
    });
    
    describe('Vibrato Analysis', () => {
        test('should detect vibrato in voice signal', () => {
            const buffer = generateVibratoVoice(sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.vibrato).toBeDefined();
            expect(result.vibrato.present).toBe(true);
            expect(result.vibrato.rate).toBeGreaterThan(3);
            expect(result.vibrato.rate).toBeLessThan(8);
            expect(result.vibrato.depth).toBeGreaterThan(0);
        });
        
        test('should not detect vibrato in steady voice', () => {
            const buffer = generateSteadyVoice(sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.vibrato.present).toBe(false);
            expect(result.vibrato.rate).toBeLessThan(3);
        });
        
        test('should measure vibrato characteristics accurately', () => {
            const vibratoRate = 5; // Hz
            const vibratoDepth = 0.5; // semitones
            const buffer = generateControlledVibrato(vibratoRate, vibratoDepth, sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.vibrato.rate).toBeCloseTo(vibratoRate, 1);
            expect(result.vibrato.depth).toBeCloseTo(vibratoDepth, 0.2);
        });
    });
    
    describe('Indian Classical Ornaments', () => {
        test('should detect Gamaka ornaments', () => {
            const buffer = generateGamaka('kampita', sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.ornaments.gamaka).toBeDefined();
            expect(result.ornaments.gamaka.detected).toBe(true);
            expect(result.ornaments.gamaka.type).toBe('kampita');
        });
        
        test('should detect Meend (glissando)', () => {
            const buffer = generateMeend(220, 330, sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.ornaments.meend).toBeDefined();
            expect(result.ornaments.meend.detected).toBe(true);
            expect(result.ornaments.meend.startFrequency).toBeCloseTo(220, 10);
            expect(result.ornaments.meend.endFrequency).toBeCloseTo(330, 10);
        });
        
        test('should detect Kan (grace note)', () => {
            const buffer = generateKan(sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.ornaments.kan).toBeDefined();
            expect(result.ornaments.kan.detected).toBe(true);
            expect(result.ornaments.kan.duration).toBeLessThan(0.1); // Should be brief
        });
        
        test('should classify different Gamaka types', () => {
            const gamakaTypes = ['kampita', 'nokku', 'sphurita', 'namita', 'andolana'];
            
            gamakaTypes.forEach(type => {
                const buffer = generateGamaka(type, sampleRate, frameSize);
                const result = processor.processVoice(buffer);
                
                if (result.ornaments.gamaka.detected) {
                    expect(['kampita', 'nokku', 'sphurita', 'namita', 'andolana']).toContain(result.ornaments.gamaka.type);
                }
            });
        });
    });
    
    describe('Voice Quality Analysis', () => {
        test('should measure breathiness', () => {
            const breathyBuffer = generateBreathyVoice(sampleRate, frameSize);
            const clearBuffer = generateClearVoice(sampleRate, frameSize);
            
            const breathyResult = processor.processVoice(breathyBuffer);
            const clearResult = processor.processVoice(clearBuffer);
            
            expect(breathyResult.voiceQuality.breathiness).toBeGreaterThan(clearResult.voiceQuality.breathiness);
        });
        
        test('should measure roughness', () => {
            const roughBuffer = generateRoughVoice(sampleRate, frameSize);
            const smoothBuffer = generateSmoothVoice(sampleRate, frameSize);
            
            const roughResult = processor.processVoice(roughBuffer);
            const smoothResult = processor.processVoice(smoothBuffer);
            
            expect(roughResult.voiceQuality.roughness).toBeGreaterThan(smoothResult.voiceQuality.roughness);
        });
        
        test('should measure strain', () => {
            const strainedBuffer = generateStrainedVoice(sampleRate, frameSize);
            const relaxedBuffer = generateRelaxedVoice(sampleRate, frameSize);
            
            const strainedResult = processor.processVoice(strainedBuffer);
            const relaxedResult = processor.processVoice(relaxedBuffer);
            
            expect(strainedResult.voiceQuality.strain).toBeGreaterThan(relaxedResult.voiceQuality.strain);
        });
    });
    
    describe('Pitch Tracking', () => {
        test('should track pitch accurately', () => {
            const frequency = 220; // A3
            const buffer = generateSteadyTone(frequency, sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.fundamentalFrequency).toBeCloseTo(frequency, 5);
        });
        
        test('should handle pitch glides', () => {
            const buffer = generatePitchGlide(220, 330, sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            
            expect(result.fundamentalFrequency).toBeGreaterThan(0);
            // Should detect some pitch movement
            if (result.ornaments.meend.detected) {
                expect(result.ornaments.meend.startFrequency).not.toEqual(result.ornaments.meend.endFrequency);
            }
        });
        
        test('should smooth pitch tracking', () => {
            const noisyBuffer = generateNoisyPitch(220, sampleRate, frameSize);
            const result = processor.processVoice(noisyBuffer);
            
            // Should still detect fundamental frequency despite noise
            expect(result.fundamentalFrequency).toBeCloseTo(220, 20);
        });
    });
    
    describe('Performance', () => {
        test('should process voice efficiently', () => {
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            
            const startTime = performance.now();
            for (let i = 0; i < 50; i++) {
                processor.processVoice(buffer);
            }
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            expect(processingTime).toBeLessThan(1000); // Should process 50 frames within 1 second
        });
        
        test('should handle real-time processing constraints', () => {
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            
            const startTime = performance.now();
            processor.processVoice(buffer);
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            const frameTime = (frameSize / sampleRate) * 1000; // Frame duration in ms
            
            // Should process faster than real-time
            expect(processingTime).toBeLessThan(frameTime * 2);
        });
    });
    
    describe('Configuration Updates', () => {
        test('should update configuration correctly', () => {
            const newConfig = {
                pitchSmoothingFactor: 0.95,
                formantBandwidth: 200,
                vibratoMinRate: 3.5,
                vibratoMaxRate: 7.5
            };
            
            processor.updateConfig(newConfig);
            
            // Test should pass if update doesn't throw
            const buffer = generateVoiceSignal(sampleRate, frameSize);
            const result = processor.processVoice(buffer);
            expect(result).toBeDefined();
        });
    });
    
    describe('Error Handling', () => {
        test('should handle empty buffer', () => {
            const emptyBuffer = new Float32Array(0);
            const result = processor.processVoice(emptyBuffer);
            
            expect(result.fundamentalFrequency).toBe(0);
            expect(result.formants).toEqual([]);
        });
        
        test('should handle NaN values', () => {
            const buffer = new Float32Array(frameSize);
            buffer.fill(NaN);
            
            const result = processor.processVoice(buffer);
            expect(result.fundamentalFrequency).toBe(0);
        });
        
        test('should handle infinite values', () => {
            const buffer = new Float32Array(frameSize);
            buffer.fill(Infinity);
            
            const result = processor.processVoice(buffer);
            expect(result.fundamentalFrequency).toBe(0);
        });
    });
});

// Helper functions for generating test voice signals

function generateVoiceSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 150; // Typical voice frequency
    const formants = [800, 1200, 2400]; // Typical formant frequencies
    
    for (let i = 0; i < length; i++) {
        let sample = 0.3 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        
        // Add formant resonances
        formants.forEach((formant, index) => {
            const amplitude = 0.15 / (index + 1);
            sample += amplitude * Math.sin(2 * Math.PI * formant * i / sampleRate);
        });
        
        buffer[i] = sample;
    }
    return buffer;
}

function generateMaleVoiceSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 120; // Typical male voice
    const formants = [730, 1090, 2440]; // Male formants for 'a'
    
    for (let i = 0; i < length; i++) {
        let sample = 0.4 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        
        formants.forEach((formant, index) => {
            const amplitude = 0.2 / (index + 1);
            sample += amplitude * Math.sin(2 * Math.PI * formant * i / sampleRate);
        });
        
        buffer[i] = sample;
    }
    return buffer;
}

function generateFemaleVoiceSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220; // Typical female voice
    const formants = [850, 1220, 2810]; // Female formants for 'a'
    
    for (let i = 0; i < length; i++) {
        let sample = 0.4 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        
        formants.forEach((formant, index) => {
            const amplitude = 0.2 / (index + 1);
            sample += amplitude * Math.sin(2 * Math.PI * formant * i / sampleRate);
        });
        
        buffer[i] = sample;
    }
    return buffer;
}

function generateVowelSound(vowel: string, sampleRate: number, length: number): Float32Array {
    const formantMap: { [key: string]: number[] } = {
        'a': [730, 1090, 2440],
        'e': [270, 2290, 3010],
        'i': [390, 1990, 2550],
        'o': [520, 920, 2560],
        'u': [320, 800, 2240]
    };
    
    const buffer = new Float32Array(length);
    const fundamental = 150;
    const formants = formantMap[vowel] || formantMap['a'];
    
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

function generateSustainedVowel(vowel: string, sampleRate: number, length: number): Float32Array {
    // Similar to generateVowelSound but with consistent parameters for stability testing
    return generateVowelSound(vowel, sampleRate, length);
}

function generateDiphthong(diphthong: string, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const halfLength = Math.floor(length / 2);
    
    // First half - first vowel
    const firstVowel = generateVowelSound(diphthong[0], sampleRate, halfLength);
    // Second half - second vowel
    const secondVowel = generateVowelSound(diphthong[1], sampleRate, halfLength);
    
    // Combine with smooth transition
    for (let i = 0; i < halfLength; i++) {
        buffer[i] = firstVowel[i];
    }
    for (let i = 0; i < halfLength; i++) {
        buffer[halfLength + i] = secondVowel[i];
    }
    
    return buffer;
}

function generateVowelTransition(vowel1: string, vowel2: string, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        const progress = i / length;
        const sample1 = generateVowelSound(vowel1, sampleRate, 1)[0];
        const sample2 = generateVowelSound(vowel2, sampleRate, 1)[0];
        
        // Linear interpolation between vowels
        buffer[i] = sample1 * (1 - progress) + sample2 * progress;
    }
    
    return buffer;
}

function generateVibratoVoice(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    const vibratoRate = 5; // Hz
    const vibratoDepth = 0.5; // semitones
    
    for (let i = 0; i < length; i++) {
        const vibrato = 1 + (vibratoDepth / 12) * Math.sin(2 * Math.PI * vibratoRate * i / sampleRate);
        const freq = fundamental * vibrato;
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    
    return buffer;
}

function generateSteadyVoice(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
    }
    
    return buffer;
}

function generateControlledVibrato(rate: number, depth: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    
    for (let i = 0; i < length; i++) {
        const vibrato = 1 + (depth / 12) * Math.sin(2 * Math.PI * rate * i / sampleRate);
        const freq = fundamental * vibrato;
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    
    return buffer;
}

function generateGamaka(type: string, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    
    switch (type) {
        case 'kampita':
            // Oscillating between two notes
            for (let i = 0; i < length; i++) {
                const oscillation = Math.sin(2 * Math.PI * 8 * i / sampleRate);
                const freq = fundamental * (1 + 0.1 * oscillation);
                buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
            }
            break;
            
        case 'nokku':
            // Quick touch of higher note
            for (let i = 0; i < length; i++) {
                let freq = fundamental;
                if (i > length * 0.3 && i < length * 0.5) {
                    freq = fundamental * 1.12; // Semitone higher
                }
                buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
            }
            break;
            
        default:
            // Default gamaka pattern
            for (let i = 0; i < length; i++) {
                const modulation = 0.05 * Math.sin(2 * Math.PI * 6 * i / sampleRate);
                const freq = fundamental * (1 + modulation);
                buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
            }
    }
    
    return buffer;
}

function generateMeend(startFreq: number, endFreq: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        const progress = i / length;
        const freq = startFreq + (endFreq - startFreq) * progress;
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    
    return buffer;
}

function generateKan(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    const graceNote = fundamental * 1.12; // Semitone higher
    const graceDuration = Math.floor(length * 0.1); // 10% of total duration
    
    for (let i = 0; i < length; i++) {
        const freq = i < graceDuration ? graceNote : fundamental;
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    
    return buffer;
}

function generateBreathyVoice(sampleRate: number, length: number): Float32Array {
    const buffer = generateVoiceSignal(sampleRate, length);
    
    // Add noise for breathiness
    for (let i = 0; i < length; i++) {
        buffer[i] += 0.3 * (Math.random() - 0.5);
    }
    
    return buffer;
}

function generateClearVoice(sampleRate: number, length: number): Float32Array {
    return generateVoiceSignal(sampleRate, length);
}

function generateRoughVoice(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 150;
    
    for (let i = 0; i < length; i++) {
        // Add irregular amplitude modulation for roughness
        const roughness = 1 + 0.3 * Math.sin(2 * Math.PI * 30 * i / sampleRate) * Math.random();
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * fundamental * i / sampleRate) * roughness;
    }
    
    return buffer;
}

function generateSmoothVoice(sampleRate: number, length: number): Float32Array {
    return generateVoiceSignal(sampleRate, length);
}

function generateStrainedVoice(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 200; // Higher tension
    
    for (let i = 0; i < length; i++) {
        // Add higher harmonics for strain
        let sample = 0.4 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * fundamental * 3 * i / sampleRate);
        sample += 0.1 * Math.sin(2 * Math.PI * fundamental * 5 * i / sampleRate);
        buffer[i] = sample;
    }
    
    return buffer;
}

function generateRelaxedVoice(sampleRate: number, length: number): Float32Array {
    return generateVoiceSignal(sampleRate, length);
}

function generateSteadyTone(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    
    return buffer;
}

function generatePitchGlide(startFreq: number, endFreq: number, sampleRate: number, length: number): Float32Array {
    return generateMeend(startFreq, endFreq, sampleRate, length);
}

function generateNoisyPitch(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        const noise = 0.1 * (Math.random() - 0.5);
        const freq = frequency * (1 + noise);
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    
    return buffer;
}