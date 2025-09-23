/**
 * Tests for InstrumentProcessor - Universal Instrument Processing
 */

import { InstrumentProcessor, InstrumentAnalysisResult, InstrumentConfig, InstrumentFamily } from '../../src/audioTypes/InstrumentProcessor';

describe('InstrumentProcessor', () => {
    let processor: InstrumentProcessor;
    const sampleRate = 44100;
    const frameSize = 2048;
    
    beforeEach(() => {
        processor = new InstrumentProcessor({
            sampleRate,
            frameSize,
            family: InstrumentFamily.String
        });
    });
    
    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultProcessor = new InstrumentProcessor();
            expect(defaultProcessor).toBeDefined();
        });
        
        test('should initialize with custom configuration', () => {
            const customProcessor = new InstrumentProcessor({
                sampleRate: 48000,
                frameSize: 4096,
                family: InstrumentFamily.Wind,
                harmonicThreshold: 0.8,
                polyphonicSensitivity: 0.9
            });
            expect(customProcessor).toBeDefined();
        });
        
        test('should set instrument family correctly', () => {
            processor.setFamily(InstrumentFamily.Keyboard);
            // Should not throw and continue working
            expect(processor).toBeDefined();
        });
    });
    
    describe('String Instrument Processing', () => {
        beforeEach(() => {
            processor.setFamily(InstrumentFamily.String);
        });
        
        test('should process string instrument signals', () => {
            const buffer = generateStringSignal(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.fundamentalFrequency).toBeGreaterThan(0);
            expect(result.techniques).toBeDefined();
            expect(result.familySpecific).toBeDefined();
            expect(result.audioType).toBe('string');
        });
        
        test('should detect plucking technique', () => {
            const buffer = generatePluckedString(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.techniques.plucking).toBe(true);
            expect(result.techniques.bowing).toBe(false);
        });
        
        test('should detect bowing technique', () => {
            const buffer = generateBowedString(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.techniques.bowing).toBe(true);
            expect(result.techniques.plucking).toBe(false);
        });
        
        test('should detect string bending', () => {
            const buffer = generateStringBend(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.techniques.bending).toBe(true);
        });
        
        test('should analyze string harmonics', () => {
            const buffer = generateStringHarmonics(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.familySpecific.stringData).toBeDefined();
            expect(result.familySpecific.stringData.harmonicity).toBeGreaterThan(0.5);
        });
    });
    
    describe('Keyboard Instrument Processing', () => {
        beforeEach(() => {
            processor.setFamily(InstrumentFamily.Keyboard);
        });
        
        test('should process keyboard instrument signals', () => {
            const buffer = generateKeyboardSignal(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.fundamentalFrequency).toBeGreaterThan(0);
            expect(result.audioType).toBe('keyboard');
            expect(result.familySpecific.keyboardData).toBeDefined();
        });
        
        test('should detect piano-like attack characteristics', () => {
            const buffer = generatePianoAttack(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.familySpecific.keyboardData.attackTime).toBeLessThan(0.1);
            expect(result.familySpecific.keyboardData.percussiveness).toBeGreaterThan(0.7);
        });
        
        test('should detect sustained keyboard tones', () => {
            const buffer = generateSustainedKeyboard(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.familySpecific.keyboardData.sustainLevel).toBeGreaterThan(0.5);
        });
        
        test('should detect pedaling effects', () => {
            const buffer = generatePedaledKeyboard(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.techniques.pedaling).toBe(true);
        });
    });
    
    describe('Wind Instrument Processing', () => {
        beforeEach(() => {
            processor.setFamily(InstrumentFamily.Wind);
        });
        
        test('should process wind instrument signals', () => {
            const buffer = generateWindSignal(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.fundamentalFrequency).toBeGreaterThan(0);
            expect(result.audioType).toBe('wind');
            expect(result.familySpecific.windData).toBeDefined();
        });
        
        test('should detect breathing characteristics', () => {
            const buffer = generateBreathyWind(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.techniques.breathing).toBe(true);
            expect(result.familySpecific.windData.breathiness).toBeGreaterThan(0.3);
        });
        
        test('should detect tonguing technique', () => {
            const buffer = generateTonguedWind(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.techniques.tonguing).toBe(true);
        });
        
        test('should analyze wind instrument harmonics', () => {
            const buffer = generateWindHarmonics(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.familySpecific.windData.harmonicRatio).toBeGreaterThan(0.4);
        });
    });
    
    describe('Percussion Instrument Processing', () => {
        beforeEach(() => {
            processor.setFamily(InstrumentFamily.Percussion);
        });
        
        test('should process percussion signals', () => {
            const buffer = generatePercussionSignal(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.audioType).toBe('percussion');
            expect(result.familySpecific.percussionData).toBeDefined();
        });
        
        test('should detect striking characteristics', () => {
            const buffer = generatePercussionStrike(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.techniques.striking).toBe(true);
            expect(result.familySpecific.percussionData.transientRatio).toBeGreaterThan(0.7);
        });
        
        test('should analyze percussion decay', () => {
            const buffer = generatePercussionDecay(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.familySpecific.percussionData.decayTime).toBeGreaterThan(0);
            expect(result.familySpecific.percussionData.decayTime).toBeLessThan(2.0);
        });
        
        test('should handle metallic percussion', () => {
            const buffer = generateMetallicPercussion(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.familySpecific.percussionData.metallicContent).toBeGreaterThan(0.5);
        });
    });
    
    describe('Multi-Algorithm Pitch Detection', () => {
        test('should use multiple pitch detection algorithms', () => {
            const buffer = generateComplexTone(220, sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.fundamentalFrequency).toBeCloseTo(220, 0);
            expect(result.pitchConfidence).toBeGreaterThan(0.5);
        });
        
        test('should handle polyphonic content', () => {
            const buffer = generatePolyphonicSignal(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.polyphonicAnalysis).toBeDefined();
            expect(result.polyphonicAnalysis.isPolyphonic).toBe(true);
            expect(result.polyphonicAnalysis.detectedFrequencies.length).toBeGreaterThan(1);
        });
        
        test('should detect chord progressions', () => {
            const buffer = generateChordProgression(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            if (result.polyphonicAnalysis.isPolyphonic) {
                expect(result.polyphonicAnalysis.detectedFrequencies.length).toBeGreaterThanOrEqual(3);
            }
        });
    });
    
    describe('Timbre Analysis', () => {
        test('should analyze timbre characteristics', () => {
            const buffer = generateStringSignal(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.timbre).toBeDefined();
            expect(result.timbre.brightness).toBeGreaterThanOrEqual(0);
            expect(result.timbre.brightness).toBeLessThanOrEqual(1);
            expect(result.timbre.warmth).toBeGreaterThanOrEqual(0);
            expect(result.timbre.warmth).toBeLessThanOrEqual(1);
        });
        
        test('should detect bright vs warm timbres', () => {
            const brightBuffer = generateBrightTimbre(sampleRate, frameSize);
            const warmBuffer = generateWarmTimbre(sampleRate, frameSize);
            
            const brightResult = processor.processInstrument(brightBuffer);
            const warmResult = processor.processInstrument(warmBuffer);
            
            expect(brightResult.timbre.brightness).toBeGreaterThan(warmResult.timbre.brightness);
            expect(warmResult.timbre.warmth).toBeGreaterThan(brightResult.timbre.warmth);
        });
        
        test('should measure roughness', () => {
            const roughBuffer = generateRoughTimbre(sampleRate, frameSize);
            const smoothBuffer = generateSmoothTimbre(sampleRate, frameSize);
            
            const roughResult = processor.processInstrument(roughBuffer);
            const smoothResult = processor.processInstrument(smoothBuffer);
            
            expect(roughResult.timbre.roughness).toBeGreaterThan(smoothResult.timbre.roughness);
        });
    });
    
    describe('Performance Analysis', () => {
        test('should detect vibrato', () => {
            const buffer = generateInstrumentVibrato(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.vibrato).toBeDefined();
            expect(result.vibrato.present).toBe(true);
            expect(result.vibrato.rate).toBeGreaterThan(3);
            expect(result.vibrato.rate).toBeLessThan(8);
        });
        
        test('should detect tremolo', () => {
            const buffer = generateTremolo(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.tremolo).toBeDefined();
            expect(result.tremolo.present).toBe(true);
            expect(result.tremolo.rate).toBeGreaterThan(8);
        });
        
        test('should analyze dynamics', () => {
            const loudBuffer = generateLoudInstrument(sampleRate, frameSize);
            const softBuffer = generateSoftInstrument(sampleRate, frameSize);
            
            const loudResult = processor.processInstrument(loudBuffer);
            const softResult = processor.processInstrument(softBuffer);
            
            expect(loudResult.dynamics.amplitude).toBeGreaterThan(softResult.dynamics.amplitude);
        });
    });
    
    describe('Error Handling', () => {
        test('should handle silent input', () => {
            const buffer = new Float32Array(frameSize);
            const result = processor.processInstrument(buffer);
            
            expect(result.fundamentalFrequency).toBe(0);
            expect(result.pitchConfidence).toBeLessThan(0.5);
        });
        
        test('should handle noisy input', () => {
            const noisyBuffer = generateNoise(frameSize);
            const result = processor.processInstrument(noisyBuffer);
            
            expect(result).toBeDefined();
            expect(result.pitchConfidence).toBeLessThan(0.8);
        });
        
        test('should handle empty buffer', () => {
            const emptyBuffer = new Float32Array(0);
            
            expect(() => {
                processor.processInstrument(emptyBuffer);
            }).not.toThrow();
        });
        
        test('should handle NaN values', () => {
            const nanBuffer = new Float32Array(frameSize);
            nanBuffer.fill(NaN);
            
            const result = processor.processInstrument(nanBuffer);
            expect(result.fundamentalFrequency).toBe(0);
        });
    });
    
    describe('Configuration Updates', () => {
        test('should update configuration correctly', () => {
            const newConfig = {
                harmonicThreshold: 0.9,
                polyphonicSensitivity: 0.8,
                enableVibrato: false
            };
            
            processor.updateConfig(newConfig);
            
            // Should continue working after update
            const buffer = generateStringSignal(sampleRate, frameSize);
            const result = processor.processInstrument(buffer);
            expect(result).toBeDefined();
        });
    });
    
    describe('Performance', () => {
        test('should process instruments efficiently', () => {
            const buffer = generateStringSignal(sampleRate, frameSize);
            
            const startTime = performance.now();
            for (let i = 0; i < 50; i++) {
                processor.processInstrument(buffer);
            }
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            expect(processingTime).toBeLessThan(1000); // Should process 50 frames within 1 second
        });
        
        test('should handle real-time processing constraints', () => {
            const buffer = generateStringSignal(sampleRate, frameSize);
            
            const startTime = performance.now();
            processor.processInstrument(buffer);
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            const frameTime = (frameSize / sampleRate) * 1000; // Frame duration in ms
            
            // Should process faster than real-time
            expect(processingTime).toBeLessThan(frameTime * 2);
        });
    });
});

// Helper functions for generating test signals

function generateStringSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220; // A3
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Strong harmonics typical of strings
        for (let h = 1; h <= 6; h++) {
            const amplitude = 1 / h; // Decreasing harmonic amplitude
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * h * i / sampleRate);
        }
        
        // Apply exponential decay
        const decay = Math.exp(-i / (sampleRate * 1.5));
        buffer[i] = sample * decay * 0.3;
    }
    return buffer;
}

function generatePluckedString(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Sharp attack typical of plucked strings
        const attack = i < 50 ? 1 : Math.exp(-i / (sampleRate * 0.1));
        
        for (let h = 1; h <= 5; h++) {
            const amplitude = 1 / h;
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * h * i / sampleRate);
        }
        
        buffer[i] = sample * attack * 0.4;
    }
    return buffer;
}

function generateBowedString(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Gradual attack and sustained tone typical of bowed strings
        const attack = Math.min(i / 1000, 1);
        
        for (let h = 1; h <= 8; h++) {
            const amplitude = 1 / Math.sqrt(h);
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * h * i / sampleRate);
        }
        
        // Add slight bow noise
        sample += 0.05 * (Math.random() - 0.5);
        
        buffer[i] = sample * attack * 0.3;
    }
    return buffer;
}

function generateStringBend(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const startFreq = 220;
    const endFreq = 246.94; // Bend up a tone
    
    for (let i = 0; i < length; i++) {
        const progress = i / length;
        const frequency = startFreq + (endFreq - startFreq) * progress;
        
        let sample = 0;
        for (let h = 1; h <= 4; h++) {
            const amplitude = 1 / h;
            sample += amplitude * Math.sin(2 * Math.PI * frequency * h * i / sampleRate);
        }
        
        buffer[i] = sample * 0.3;
    }
    return buffer;
}

function generateStringHarmonics(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 220;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Very strong harmonics
        for (let h = 1; h <= 10; h++) {
            const amplitude = 1 / h;
            sample += amplitude * Math.sin(2 * Math.PI * fundamental * h * i / sampleRate);
        }
        
        buffer[i] = sample * 0.2;
    }
    return buffer;
}

function generateKeyboardSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 261.63; // C4
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Sharp attack characteristic of keyboard instruments
        const attack = i < 100 ? i / 100 : 1;
        const decay = Math.exp(-i / (sampleRate * 0.8));
        
        // Harmonics with piano-like spectrum
        sample += 1.0 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.4 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * fundamental * 3 * i / sampleRate);
        sample += 0.1 * Math.sin(2 * Math.PI * fundamental * 4 * i / sampleRate);
        
        buffer[i] = sample * attack * decay * 0.3;
    }
    return buffer;
}

function generatePianoAttack(sampleRate: number, length: number): Float32Array {
    const buffer = generateKeyboardSignal(sampleRate, length);
    
    // Enhance the attack characteristics
    for (let i = 0; i < Math.min(200, length); i++) {
        buffer[i] *= 2; // Emphasize attack
    }
    
    return buffer;
}

function generateSustainedKeyboard(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 261.63;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Sustained tone with slow decay
        const attack = i < 200 ? i / 200 : 1;
        const decay = Math.exp(-i / (sampleRate * 3)); // Slower decay
        
        sample += 0.8 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        
        buffer[i] = sample * attack * decay * 0.4;
    }
    return buffer;
}

function generatePedaledKeyboard(sampleRate: number, length: number): Float32Array {
    const buffer = generateKeyboardSignal(sampleRate, length);
    
    // Add resonance and extended decay typical of pedaled piano
    for (let i = 0; i < length; i++) {
        const resonance = 0.1 * Math.sin(2 * Math.PI * 65.4 * i / sampleRate); // Low resonance
        buffer[i] += resonance;
    }
    
    return buffer;
}

function generateWindSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440; // A4
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Fundamental with some harmonics
        sample += 0.8 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        sample += 0.1 * Math.sin(2 * Math.PI * fundamental * 3 * i / sampleRate);
        
        // Add breath noise
        sample += 0.08 * (Math.random() - 0.5);
        
        // Slight amplitude modulation (vibrato)
        const vibrato = 1 + 0.05 * Math.sin(2 * Math.PI * 5 * i / sampleRate);
        buffer[i] = sample * vibrato * 0.4;
    }
    return buffer;
}

function generateBreathyWind(sampleRate: number, length: number): Float32Array {
    const buffer = generateWindSignal(sampleRate, length);
    
    // Add more breath noise
    for (let i = 0; i < length; i++) {
        buffer[i] += 0.2 * (Math.random() - 0.5);
    }
    
    return buffer;
}

function generateTonguedWind(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Sharp attacks at regular intervals (tonguing)
        const tongueRate = 8; // 8 Hz tonguing
        const tonguePhase = (i / sampleRate) * tongueRate * 2 * Math.PI;
        const tongueEnvelope = Math.max(0, Math.sin(tonguePhase));
        
        sample += 0.7 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample *= tongueEnvelope;
        
        buffer[i] = sample * 0.4;
    }
    return buffer;
}

function generateWindHarmonics(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Strong harmonics typical of brass instruments
        sample += 0.8 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.6 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        sample += 0.4 * Math.sin(2 * Math.PI * fundamental * 3 * i / sampleRate);
        sample += 0.2 * Math.sin(2 * Math.PI * fundamental * 4 * i / sampleRate);
        
        buffer[i] = sample * 0.3;
    }
    return buffer;
}

function generatePercussionSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        if (i < 100) {
            // Sharp transient attack
            sample = (Math.random() - 0.5) * 2;
        } else {
            // Decay with some resonance
            const decay = Math.exp(-i / (sampleRate * 0.3));
            sample = 0.4 * Math.sin(2 * Math.PI * 150 * i / sampleRate) * decay;
            sample += 0.1 * (Math.random() - 0.5) * decay;
        }
        
        buffer[i] = sample * 0.6;
    }
    return buffer;
}

function generatePercussionStrike(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        if (i < 50) {
            // Very sharp strike
            sample = (Math.random() - 0.5) * 3;
        } else {
            // Rapid decay
            const decay = Math.exp(-i / (sampleRate * 0.1));
            sample = 0.2 * Math.sin(2 * Math.PI * 200 * i / sampleRate) * decay;
        }
        
        buffer[i] = sample * 0.7;
    }
    return buffer;
}

function generatePercussionDecay(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        // Medium decay percussion
        const decay = Math.exp(-i / (sampleRate * 0.8));
        let sample = 0.5 * Math.sin(2 * Math.PI * 180 * i / sampleRate) * decay;
        sample += 0.2 * Math.sin(2 * Math.PI * 360 * i / sampleRate) * decay;
        
        buffer[i] = sample * 0.5;
    }
    return buffer;
}

function generateMetallicPercussion(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Multiple inharmonic frequencies typical of metallic percussion
        const fundamentals = [220, 275, 330, 440];
        fundamentals.forEach(freq => {
            const decay = Math.exp(-i / (sampleRate * 1.2));
            sample += 0.25 * Math.sin(2 * Math.PI * freq * i / sampleRate) * decay;
        });
        
        buffer[i] = sample * 0.6;
    }
    return buffer;
}

function generateComplexTone(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Fundamental plus harmonics
        for (let h = 1; h <= 5; h++) {
            const amplitude = 1 / h;
            sample += amplitude * Math.sin(2 * Math.PI * frequency * h * i / sampleRate);
        }
        
        buffer[i] = sample * 0.3;
    }
    return buffer;
}

function generatePolyphonicSignal(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const frequencies = [220, 277.18, 329.63]; // A major chord
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        frequencies.forEach(freq => {
            sample += 0.3 * Math.sin(2 * Math.PI * freq * i / sampleRate);
        });
        
        buffer[i] = sample;
    }
    return buffer;
}

function generateChordProgression(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const chords = [
        [220, 277.18, 329.63], // A major
        [246.94, 311.13, 369.99], // B major
        [261.63, 329.63, 392.00]  // C major
    ];
    
    const chordLength = Math.floor(length / chords.length);
    
    for (let c = 0; c < chords.length; c++) {
        const start = c * chordLength;
        const end = Math.min(start + chordLength, length);
        
        for (let i = start; i < end; i++) {
            let sample = 0;
            
            chords[c].forEach(freq => {
                sample += 0.25 * Math.sin(2 * Math.PI * freq * i / sampleRate);
            });
            
            buffer[i] = sample;
        }
    }
    
    return buffer;
}

function generateBrightTimbre(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Emphasize higher harmonics for brightness
        sample += 0.5 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.4 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        sample += 0.3 * Math.sin(2 * Math.PI * fundamental * 3 * i / sampleRate);
        sample += 0.25 * Math.sin(2 * Math.PI * fundamental * 4 * i / sampleRate);
        
        buffer[i] = sample * 0.3;
    }
    return buffer;
}

function generateWarmTimbre(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Emphasize lower harmonics for warmth
        sample += 0.8 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        sample += 0.4 * Math.sin(2 * Math.PI * fundamental * 2 * i / sampleRate);
        sample += 0.1 * Math.sin(2 * Math.PI * fundamental * 3 * i / sampleRate);
        
        buffer[i] = sample * 0.4;
    }
    return buffer;
}

function generateRoughTimbre(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        // Add irregularities for roughness
        const noise = 0.2 * (Math.random() - 0.5);
        const modulation = 1 + 0.1 * Math.sin(2 * Math.PI * 30 * i / sampleRate);
        
        sample += 0.6 * Math.sin(2 * Math.PI * fundamental * i / sampleRate) * modulation;
        sample += noise;
        
        buffer[i] = sample * 0.4;
    }
    return buffer;
}

function generateSmoothTimbre(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    
    for (let i = 0; i < length; i++) {
        // Pure sine wave for smoothness
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
    }
    return buffer;
}

function generateInstrumentVibrato(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    const vibratoRate = 5; // Hz
    const vibratoDepth = 0.5; // semitones
    
    for (let i = 0; i < length; i++) {
        const vibrato = 1 + (vibratoDepth / 12) * Math.sin(2 * Math.PI * vibratoRate * i / sampleRate);
        const freq = fundamental * vibrato;
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    
    return buffer;
}

function generateTremolo(sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const fundamental = 440;
    const tremoloRate = 10; // Hz
    const tremoloDepth = 0.5;
    
    for (let i = 0; i < length; i++) {
        const tremolo = 1 + tremoloDepth * Math.sin(2 * Math.PI * tremoloRate * i / sampleRate);
        const sample = 0.5 * Math.sin(2 * Math.PI * fundamental * i / sampleRate);
        buffer[i] = sample * tremolo;
    }
    
    return buffer;
}

function generateLoudInstrument(sampleRate: number, length: number): Float32Array {
    const buffer = generateStringSignal(sampleRate, length);
    
    // Amplify for loud dynamics
    for (let i = 0; i < length; i++) {
        buffer[i] *= 2.0;
    }
    
    return buffer;
}

function generateSoftInstrument(sampleRate: number, length: number): Float32Array {
    const buffer = generateStringSignal(sampleRate, length);
    
    // Reduce amplitude for soft dynamics
    for (let i = 0; i < length; i++) {
        buffer[i] *= 0.3;
    }
    
    return buffer;
}

function generateNoise(length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = (Math.random() - 0.5) * 2;
    }
    return buffer;
}