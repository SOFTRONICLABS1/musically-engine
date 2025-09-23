/**
 * Tests for YIN pitch detection algorithm
 */

import { YIN, RealTimeYIN } from '../../src/algorithms/YIN';

describe('YIN Algorithm', () => {
    let yin: YIN;
    const sampleRate = 44100;
    const bufferSize = 2048;
    
    beforeEach(() => {
        yin = new YIN(sampleRate, bufferSize);
    });
    
    describe('Initialization', () => {
        test('should create YIN with correct parameters', () => {
            const params = yin.getParameters();
            
            expect(params.sampleRate).toBe(sampleRate);
            expect(params.bufferSize).toBe(bufferSize);
            expect(params.threshold).toBe(0.15);
            expect(params.probabilityThreshold).toBe(0.1);
        });
        
        test('should allow custom parameters', () => {
            const customYin = new YIN(48000, 4096, 0.2, 0.15);
            const params = customYin.getParameters();
            
            expect(params.sampleRate).toBe(48000);
            expect(params.bufferSize).toBe(4096);
            expect(params.threshold).toBe(0.2);
            expect(params.probabilityThreshold).toBe(0.15);
        });
    });
    
    describe('Pitch Detection', () => {
        test('should detect single frequency correctly', () => {
            const frequency = 440; // A4
            const buffer = generateSineWave(frequency, sampleRate, bufferSize);
            
            const result = yin.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 1);
            expect(result.probability).toBeGreaterThan(0.8);
        });
        
        test('should detect different frequencies accurately', () => {
            const testFrequencies = [220, 330, 440, 523, 659]; // Musical notes
            
            testFrequencies.forEach(freq => {
                const buffer = generateSineWave(freq, sampleRate, bufferSize);
                const result = yin.detectPitch(buffer);
                
                expect(result.frequency).toBeCloseTo(freq, 1);
                expect(result.probability).toBeGreaterThan(0.7);
            });
        });
        
        test('should handle low frequencies', () => {
            const frequency = 82; // Low E (guitar)
            const buffer = generateSineWave(frequency, sampleRate, bufferSize);
            
            const result = yin.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 1);
            expect(result.probability).toBeGreaterThan(0.5);
        });
        
        test('should handle high frequencies', () => {
            const frequency = 2000; // High frequency
            const buffer = generateSineWave(frequency, sampleRate, bufferSize);
            
            const result = yin.detectPitch(buffer);
            
            expect(result.frequency).toBeCloseTo(frequency, 1);
            expect(result.probability).toBeGreaterThan(0.6);
        });
        
        test('should return low confidence for noise', () => {
            const buffer = generateNoise(bufferSize);
            
            const result = yin.detectPitch(buffer);
            
            expect(result.probability).toBeLessThan(0.3);
        });
        
        test('should handle silence', () => {
            const buffer = new Float32Array(bufferSize);
            buffer.fill(0);
            
            const result = yin.detectPitch(buffer);
            
            expect(result.frequency).toBe(0);
            expect(result.probability).toBe(0);
        });
    });
    
    describe('Advanced Processing', () => {
        test('should process with filtering', () => {
            const frequency = 440;
            const noisyBuffer = generateSineWave(frequency, sampleRate, bufferSize);
            
            // Add low-frequency noise
            for (let i = 0; i < noisyBuffer.length; i++) {
                noisyBuffer[i] += 0.1 * Math.sin(2 * Math.PI * 20 * i / sampleRate);
            }
            
            const result = yin.processWithFilter(noisyBuffer, true);
            
            expect(result.frequency).toBeCloseTo(frequency, 1);
            expect(result.probability).toBeGreaterThan(0.6);
            expect(result.clarity).toBeGreaterThan(0.3);
        });
        
        test('should calculate clarity metric', () => {
            const frequency = 440;
            const cleanBuffer = generateSineWave(frequency, sampleRate, bufferSize);
            const noisyBuffer = generateSineWave(frequency, sampleRate, bufferSize);
            
            // Add noise to second buffer
            for (let i = 0; i < noisyBuffer.length; i++) {
                noisyBuffer[i] += 0.3 * (Math.random() - 0.5);
            }
            
            const cleanResult = yin.processWithFilter(cleanBuffer);
            const noisyResult = yin.processWithFilter(noisyBuffer);
            
            expect(cleanResult.clarity).toBeGreaterThan(noisyResult.clarity);
        });
    });
    
    describe('Batch Processing', () => {
        test('should process multiple buffers', () => {
            const frequencies = [220, 440, 880];
            const buffers = frequencies.map(freq => 
                generateSineWave(freq, sampleRate, bufferSize)
            );
            
            const results = yin.batchProcess(buffers);
            
            expect(results.length).toBe(3);
            
            results.forEach((result, index) => {
                expect(result.frequency).toBeCloseTo(frequencies[index], 1);
                expect(result.probability).toBeGreaterThan(0.7);
            });
        });
    });
    
    describe('Parameter Adjustment', () => {
        test('should allow threshold adjustment', () => {
            const originalParams = yin.getParameters();
            
            yin.setThreshold(0.25);
            
            const newParams = yin.getParameters();
            expect(newParams.threshold).toBe(0.25);
            expect(newParams.threshold).not.toBe(originalParams.threshold);
        });
        
        test('should clamp threshold to valid range', () => {
            yin.setThreshold(-0.1);
            expect(yin.getParameters().threshold).toBe(0.05);
            
            yin.setThreshold(0.5);
            expect(yin.getParameters().threshold).toBe(0.3);
        });
    });
});

describe('RealTimeYIN', () => {
    let rtYin: RealTimeYIN;
    const sampleRate = 44100;
    const bufferSize = 2048;
    
    beforeEach(() => {
        rtYin = new RealTimeYIN(sampleRate, bufferSize);
    });
    
    describe('Real-time Processing', () => {
        test('should provide temporal smoothing', () => {
            const frequency = 440;
            const buffer1 = generateSineWave(frequency, sampleRate, bufferSize);
            const buffer2 = generateSineWave(frequency + 10, sampleRate, bufferSize); // Slight variation
            
            const result1 = rtYin.processRealTime(buffer1);
            const result2 = rtYin.processRealTime(buffer2);
            
            expect(result1.frequency).toBeCloseTo(frequency, 1);
            expect(result2.frequency).toBeCloseTo(frequency + 10, 1);
            
            // Smoothed frequency should be between the two
            expect(result2.smoothedFrequency).toBeGreaterThan(frequency);
            expect(result2.smoothedFrequency).toBeLessThan(frequency + 10);
        });
        
        test('should reject outliers', () => {
            const frequency = 440;
            const buffer1 = generateSineWave(frequency, sampleRate, bufferSize);
            const buffer2 = generateSineWave(frequency * 1.5, sampleRate, bufferSize); // Large jump
            
            const result1 = rtYin.processRealTime(buffer1);
            const result2 = rtYin.processRealTime(buffer2);
            
            // Smoothed frequency should reject the outlier
            expect(result2.smoothedFrequency).toBeCloseTo(frequency * 1.5, 1);
        });
        
        test('should handle reset correctly', () => {
            const frequency = 440;
            const buffer = generateSineWave(frequency, sampleRate, bufferSize);
            
            const result1 = rtYin.processRealTime(buffer);
            rtYin.reset();
            const result2 = rtYin.processRealTime(buffer);
            
            // After reset, should not use previous data for smoothing
            expect(result2.smoothedFrequency).toBeCloseTo(result2.frequency, 1);
        });
    });
    
    describe('Smoothing Configuration', () => {
        test('should allow smoothing factor adjustment', () => {
            rtYin.setSmoothingFactor(0.5);
            
            const frequency = 440;
            const buffer1 = generateSineWave(frequency, sampleRate, bufferSize);
            const buffer2 = generateSineWave(frequency + 20, sampleRate, bufferSize);
            
            rtYin.processRealTime(buffer1);
            const result = rtYin.processRealTime(buffer2);
            
            // With lower smoothing factor, should respond faster
            const expectedSmoothed = 0.5 * frequency + 0.5 * (frequency + 20);
            expect(result.smoothedFrequency).toBeCloseTo(expectedSmoothed, 1);
        });
        
        test('should clamp smoothing factor', () => {
            rtYin.setSmoothingFactor(-0.1);
            rtYin.setSmoothingFactor(1.5);
            
            // Should not throw and should work normally
            const buffer = generateSineWave(440, sampleRate, bufferSize);
            expect(() => rtYin.processRealTime(buffer)).not.toThrow();
        });
    });
});

describe('YIN Performance', () => {
    test('should perform within reasonable time limits', () => {
        const yin = new YIN(44100, 4096);
        const buffer = generateSineWave(440, 44100, 4096);
        
        const startTime = performance.now();
        const result = yin.detectPitch(buffer);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        
        // Should complete within 50ms for 4096-sample buffer
        expect(processingTime).toBeLessThan(50);
        
        // Verify result is valid
        expect(result.frequency).toBeGreaterThan(0);
        expect(result.probability).toBeGreaterThan(0);
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