/**
 * Tests for Autocorrelation pitch detection algorithm
 */

import { Autocorrelation, EnhancedAutocorrelation } from '../../src/algorithms/Autocorrelation';

describe('Autocorrelation Algorithm', () => {
    let autocorr: Autocorrelation;
    const sampleRate = 44100;
    const minFreq = 50;
    const maxFreq = 4000;
    
    beforeEach(() => {
        autocorr = new Autocorrelation(sampleRate, minFreq, maxFreq);
    });
    
    describe('Initialization', () => {
        test('should create Autocorrelation with correct parameters', () => {
            const config = autocorr.getConfig();
            
            expect(config.sampleRate).toBe(sampleRate);
            expect(config.minFrequency).toBe(minFreq);
            expect(config.maxFrequency).toBe(maxFreq);
        });
        
        test('should use default parameters', () => {
            const defaultAutocorr = new Autocorrelation();
            const config = defaultAutocorr.getConfig();
            
            expect(config.sampleRate).toBe(44100);
            expect(config.minFrequency).toBe(50);
            expect(config.maxFrequency).toBe(4000);
        });
    });
    
    describe('Pitch Detection', () => {
        test('should detect single frequency correctly', () => {
            const frequency = 440; // A4
            const buffer = generateSineWave(frequency, sampleRate, 2048);
            
            const result = autocorr.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 0);
            expect(result.confidence).toBeGreaterThan(0.5);
        });
        
        test('should detect different frequencies accurately', () => {
            const testFrequencies = [220, 330, 440, 523, 659]; // Musical notes
            
            testFrequencies.forEach(freq => {
                const buffer = generateSineWave(freq, sampleRate, 2048);
                const result = autocorr.detectPitch(buffer);
                
                expect(result.frequency).toBeCloseTo(freq, 0);
                expect(result.confidence).toBeGreaterThan(0.4);
            });
        });
        
        test('should handle low frequencies', () => {
            const frequency = 82; // Low E (guitar)
            const buffer = generateSineWave(frequency, sampleRate, 4096); // Longer buffer for low freq
            
            const result = autocorr.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 0);
            expect(result.confidence).toBeGreaterThan(0.3);
        });
        
        test('should handle high frequencies', () => {
            const frequency = 2000; // High frequency
            const buffer = generateSineWave(frequency, sampleRate, 2048);
            
            const result = autocorr.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 1);
            expect(result.confidence).toBeGreaterThan(0.3);
        });
        
        test('should return low confidence for noise', () => {
            const buffer = generateNoise(2048);
            
            const result = autocorr.detectPitch(buffer);
            
            expect(result.confidence).toBeLessThan(0.5);
        });
        
        test('should handle silence', () => {
            const buffer = new Float32Array(2048);
            buffer.fill(0);
            
            const result = autocorr.detectPitch(buffer);
            
            expect(result.frequency).toBe(0);
            expect(result.confidence).toBe(0);
        });
        
        test('should handle very short buffers', () => {
            const buffer = generateSineWave(440, sampleRate, 64);
            
            const result = autocorr.detectPitch(buffer);
            
            // Should not crash and return some result
            expect(typeof result.frequency).toBe('number');
            expect(typeof result.confidence).toBe('number');
        });
    });
    
    describe('Window Functions', () => {
        test('should apply Hann window', () => {
            const frequency = 440;
            const buffer = generateSineWave(frequency, sampleRate, 2048);
            
            const windowed = autocorr.applyWindow(buffer, 'hann');
            
            expect(windowed.length).toBe(buffer.length);
            
            // Window should taper to near zero at edges
            expect(Math.abs(windowed[0])).toBeLessThan(0.1);
            expect(Math.abs(windowed[windowed.length - 1])).toBeLessThan(0.1);
            
            // Should have maximum near center
            const centerIndex = Math.floor(windowed.length / 2);
            const centerValue = Math.abs(windowed[centerIndex]);
            expect(centerValue).toBeGreaterThan(Math.abs(windowed[0]));
        });
        
        test('should apply Hamming window', () => {
            const buffer = generateSineWave(440, sampleRate, 1024);
            
            const windowed = autocorr.applyWindow(buffer, 'hamming');
            
            expect(windowed.length).toBe(buffer.length);
            
            // Hamming window should not go to zero at edges
            expect(Math.abs(windowed[0])).toBeGreaterThan(0.05);
            expect(Math.abs(windowed[windowed.length - 1])).toBeGreaterThan(0.05);
        });
        
        test('should apply Blackman window', () => {
            const buffer = generateSineWave(440, sampleRate, 1024);
            
            const windowed = autocorr.applyWindow(buffer, 'blackman');
            
            expect(windowed.length).toBe(buffer.length);
            
            // Blackman window should have very small values at edges
            expect(Math.abs(windowed[0])).toBeLessThan(0.01);
            expect(Math.abs(windowed[windowed.length - 1])).toBeLessThan(0.01);
        });
    });
    
    describe('Batch Processing', () => {
        test('should process multiple buffers', () => {
            const frequencies = [220, 440, 880];
            const buffers = frequencies.map(freq => 
                generateSineWave(freq, sampleRate, 2048)
            );
            
            const results = autocorr.batchProcess(buffers);
            
            expect(results.length).toBe(3);
            
            results.forEach((result, index) => {
                expect(result.frequency).toBeCloseTo(frequencies[index], 0);
                expect(result.confidence).toBeGreaterThan(0.3);
            });
        });
        
        test('should handle empty batch', () => {
            const results = autocorr.batchProcess([]);
            
            expect(results).toEqual([]);
        });
        
        test('should handle mixed quality signals', () => {
            const cleanBuffer = generateSineWave(440, sampleRate, 2048);
            const noisyBuffer = generateNoise(2048);
            const silentBuffer = new Float32Array(2048);
            
            const results = autocorr.batchProcess([cleanBuffer, noisyBuffer, silentBuffer]);
            
            expect(results.length).toBe(3);
            expect(results[0].confidence).toBeGreaterThan(results[1].confidence);
            expect(results[2].frequency).toBe(0);
        });
    });
});

describe('EnhancedAutocorrelation', () => {
    let enhancedAutocorr: EnhancedAutocorrelation;
    const sampleRate = 44100;
    
    beforeEach(() => {
        enhancedAutocorr = new EnhancedAutocorrelation(sampleRate);
    });
    
    describe('Enhanced Processing', () => {
        test('should process with pre-processing enabled by default', () => {
            const frequency = 440;
            const buffer = generateSineWave(frequency, sampleRate, 2048);
            
            // Add DC offset
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] += 0.1;
            }
            
            const result = enhancedAutocorr.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 0);
            expect(result.confidence).toBeGreaterThan(0.5);
        });
        
        test('should handle pre-processing toggle', () => {
            const frequency = 440;
            const buffer = generateSineWave(frequency, sampleRate, 2048);
            
            // Add DC offset
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] += 0.2;
            }
            
            enhancedAutocorr.setPreProcessing(false);
            const resultWithoutPreprocessing = enhancedAutocorr.detectPitch(buffer);
            
            enhancedAutocorr.setPreProcessing(true);
            const resultWithPreprocessing = enhancedAutocorr.detectPitch(buffer);
            
            // With preprocessing should generally perform better
            expect(resultWithPreprocessing.confidence).toBeGreaterThanOrEqual(
                resultWithoutPreprocessing.confidence - 0.1
            );
        });
        
        test('should remove DC offset effectively', () => {
            const frequency = 440;
            const buffer = generateSineWave(frequency, sampleRate, 2048);
            
            // Add significant DC offset
            const dcOffset = 0.5;
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] += dcOffset;
            }
            
            const result = enhancedAutocorr.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 0);
            expect(result.confidence).toBeGreaterThan(0.4);
        });
    });
});

describe('Autocorrelation Performance', () => {
    test('should perform within reasonable time limits', () => {
        const autocorr = new Autocorrelation(44100, 50, 4000);
        const buffer = generateSineWave(440, 44100, 4096);
        
        const startTime = performance.now();
        const result = autocorr.detectPitch(buffer);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        
        // Should complete within 20ms for 4096-sample buffer
        expect(processingTime).toBeLessThan(20);
        
        // Verify result is valid
        expect(result.frequency).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0);
    });
    
    test('should handle large batch processing efficiently', () => {
        const autocorr = new Autocorrelation();
        const buffers = [];
        
        // Create 100 test buffers
        for (let i = 0; i < 100; i++) {
            const freq = 200 + i * 10; // 200Hz to 1190Hz
            buffers.push(generateSineWave(freq, 44100, 1024));
        }
        
        const startTime = performance.now();
        const results = autocorr.batchProcess(buffers);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        
        // Should process 100 buffers within 1 second
        expect(processingTime).toBeLessThan(1000);
        expect(results.length).toBe(100);
        
        // Verify first few results
        for (let i = 0; i < 5; i++) {
            const expectedFreq = 200 + i * 10;
            expect(results[i].frequency).toBeCloseTo(expectedFreq, 0);
        }
    });
});

describe('Edge Cases', () => {
    test('should handle frequency at boundaries', () => {
        const autocorr = new Autocorrelation(44100, 80, 2000);
        
        // Test frequency at lower boundary
        const lowBuffer = generateSineWave(80, 44100, 4096);
        const lowResult = autocorr.detectPitch(lowBuffer);
        expect(lowResult.frequency).toBeCloseTo(80, 0);
        
        // Test frequency at upper boundary
        const highBuffer = generateSineWave(2000, 44100, 2048);
        const highResult = autocorr.detectPitch(highBuffer);
        expect(highResult.frequency).toBeCloseTo(2000, 1);
    });
    
    test('should handle frequencies outside range', () => {
        const autocorr = new Autocorrelation(44100, 200, 1000);
        
        // Test frequency below range
        const lowBuffer = generateSineWave(100, 44100, 2048);
        const lowResult = autocorr.detectPitch(lowBuffer);
        expect(lowResult.confidence).toBeLessThan(0.3);
        
        // Test frequency above range
        const highBuffer = generateSineWave(2000, 44100, 2048);
        const highResult = autocorr.detectPitch(highBuffer);
        expect(highResult.confidence).toBeLessThan(0.3);
    });
    
    test('should handle buffer length edge cases', () => {
        const autocorr = new Autocorrelation();
        
        // Very small buffer
        const tinyBuffer = new Float32Array(10);
        tinyBuffer.fill(0.5);
        const tinyResult = autocorr.detectPitch(tinyBuffer);
        expect(typeof tinyResult.frequency).toBe('number');
        
        // Large buffer
        const largeBuffer = generateSineWave(440, 44100, 16384);
        const largeResult = autocorr.detectPitch(largeBuffer);
        expect(largeResult.frequency).toBeCloseTo(440, 0);
    });
});

// Helper functions
function generateSineWave(frequency: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
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