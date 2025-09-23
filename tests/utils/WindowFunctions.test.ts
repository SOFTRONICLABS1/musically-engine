/**
 * Tests for WindowFunctions utility
 */

import { WindowFunctions } from '../../src/utils/WindowFunctions';

describe('WindowFunctions', () => {
    describe('Window Creation', () => {
        test('should create rectangular window', () => {
            const size = 16;
            const window = WindowFunctions.rectangular(size);
            
            expect(window.length).toBe(size);
            
            // All values should be 1
            for (let i = 0; i < size; i++) {
                expect(window[i]).toBe(1);
            }
        });
        
        test('should create Hann window', () => {
            const size = 16;
            const window = WindowFunctions.hann(size);
            
            expect(window.length).toBe(size);
            
            // Should start and end near 0
            expect(window[0]).toBeCloseTo(0, 5);
            expect(window[size - 1]).toBeCloseTo(0, 5);
            
            // Should peak in the middle
            const mid = Math.floor(size / 2);
            expect(window[mid]).toBeCloseTo(1, 1);
            
            // Should be symmetric
            for (let i = 0; i < size / 2; i++) {
                expect(window[i]).toBeCloseTo(window[size - 1 - i], 5);
            }
        });
        
        test('should create Hamming window', () => {
            const size = 16;
            const window = WindowFunctions.hamming(size);
            
            expect(window.length).toBe(size);
            
            // Should start and end at approximately 0.08
            expect(window[0]).toBeCloseTo(0.08, 2);
            expect(window[size - 1]).toBeCloseTo(0.08, 2);
            
            // Should peak in the middle
            const mid = Math.floor(size / 2);
            expect(window[mid]).toBeCloseTo(1, 1);
            
            // Should be symmetric
            for (let i = 0; i < size / 2; i++) {
                expect(window[i]).toBeCloseTo(window[size - 1 - i], 5);
            }
        });
        
        test('should create Blackman window', () => {
            const size = 16;
            const window = WindowFunctions.blackman(size);
            
            expect(window.length).toBe(size);
            
            // Should start and end near 0
            expect(window[0]).toBeCloseTo(0, 3);
            expect(window[size - 1]).toBeCloseTo(0, 3);
            
            // Should be symmetric
            for (let i = 0; i < size / 2; i++) {
                expect(window[i]).toBeCloseTo(window[size - 1 - i], 5);
            }
            
            // All values should be between 0 and 1
            for (let i = 0; i < size; i++) {
                expect(window[i]).toBeGreaterThanOrEqual(0);
                expect(window[i]).toBeLessThanOrEqual(1);
            }
        });
        
        test('should create Blackman-Harris window', () => {
            const size = 16;
            const window = WindowFunctions.blackmanHarris(size);
            
            expect(window.length).toBe(size);
            
            // Should start and end near 0
            expect(window[0]).toBeCloseTo(0, 5);
            expect(window[size - 1]).toBeCloseTo(0, 5);
            
            // Should be symmetric
            for (let i = 0; i < size / 2; i++) {
                expect(window[i]).toBeCloseTo(window[size - 1 - i], 5);
            }
        });
        
        test('should create Kaiser window', () => {
            const size = 16;
            const beta = 5;
            const window = WindowFunctions.kaiser(size, beta);
            
            expect(window.length).toBe(size);
            
            // Should be symmetric
            for (let i = 0; i < size / 2; i++) {
                expect(window[i]).toBeCloseTo(window[size - 1 - i], 5);
            }
            
            // All values should be between 0 and 1
            for (let i = 0; i < size; i++) {
                expect(window[i]).toBeGreaterThanOrEqual(0);
                expect(window[i]).toBeLessThanOrEqual(1);
            }
            
            // Should peak in the middle
            const mid = Math.floor(size / 2);
            expect(window[mid]).toBeCloseTo(1, 2);
        });
        
        test('should create Gaussian window', () => {
            const size = 16;
            const sigma = 0.4;
            const window = WindowFunctions.gauss(size, sigma);
            
            expect(window.length).toBe(size);
            
            // Should be symmetric
            for (let i = 0; i < size / 2; i++) {
                expect(window[i]).toBeCloseTo(window[size - 1 - i], 5);
            }
            
            // All values should be between 0 and 1
            for (let i = 0; i < size; i++) {
                expect(window[i]).toBeGreaterThanOrEqual(0);
                expect(window[i]).toBeLessThanOrEqual(1);
            }
            
            // Should peak in the middle
            const mid = Math.floor(size / 2);
            expect(window[mid]).toBeCloseTo(1, 2);
        });
    });
    
    describe('Generic Window Creation', () => {
        test('should create window using generic create method', () => {
            const size = 16;
            
            const hann = WindowFunctions.create('hann', size);
            const hamming = WindowFunctions.create('hamming', size);
            const blackman = WindowFunctions.create('blackman', size);
            
            expect(hann.length).toBe(size);
            expect(hamming.length).toBe(size);
            expect(blackman.length).toBe(size);
            
            // Should match specific implementations
            const directHann = WindowFunctions.hann(size);
            for (let i = 0; i < size; i++) {
                expect(hann[i]).toBeCloseTo(directHann[i], 10);
            }
        });
        
        test('should create parameterized windows', () => {
            const size = 16;
            
            const kaiser = WindowFunctions.create('kaiser', size, 7);
            const gauss = WindowFunctions.create('gauss', size, 0.3);
            
            expect(kaiser.length).toBe(size);
            expect(gauss.length).toBe(size);
            
            // Should use provided parameters
            const directKaiser = WindowFunctions.kaiser(size, 7);
            const directGauss = WindowFunctions.gauss(size, 0.3);
            
            for (let i = 0; i < size; i++) {
                expect(kaiser[i]).toBeCloseTo(directKaiser[i], 10);
                expect(gauss[i]).toBeCloseTo(directGauss[i], 10);
            }
        });
        
        test('should handle unknown window type', () => {
            expect(() => {
                WindowFunctions.create('unknown' as any, 16);
            }).toThrow('Unknown window type: unknown');
        });
    });
    
    describe('Window Application', () => {
        test('should apply window to signal', () => {
            const signal = new Float32Array([1, 2, 3, 4]);
            const window = new Float32Array([0.5, 1, 1, 0.5]);
            
            const windowed = WindowFunctions.apply(signal, window);
            
            expect(windowed.length).toBe(4);
            expect(windowed[0]).toBeCloseTo(0.5, 5);
            expect(windowed[1]).toBeCloseTo(2, 5);
            expect(windowed[2]).toBeCloseTo(3, 5);
            expect(windowed[3]).toBeCloseTo(2, 5);
        });
        
        test('should apply window in-place', () => {
            const signal = new Float32Array([1, 2, 3, 4]);
            const window = new Float32Array([0.5, 1, 1, 0.5]);
            const original = new Float32Array(signal);
            
            WindowFunctions.applyInPlace(signal, window);
            
            expect(signal[0]).toBeCloseTo(original[0] * window[0], 5);
            expect(signal[1]).toBeCloseTo(original[1] * window[1], 5);
            expect(signal[2]).toBeCloseTo(original[2] * window[2], 5);
            expect(signal[3]).toBeCloseTo(original[3] * window[3], 5);
        });
        
        test('should handle mismatched lengths', () => {
            const signal = new Float32Array([1, 2, 3]);
            const window = new Float32Array([0.5, 1]);
            
            expect(() => {
                WindowFunctions.apply(signal, window);
            }).toThrow('Signal and window must have the same length');
            
            expect(() => {
                WindowFunctions.applyInPlace(signal, window);
            }).toThrow('Signal and window must have the same length');
        });
    });
    
    describe('Window Properties', () => {
        test('should calculate normalization factor', () => {
            const hann = WindowFunctions.hann(16);
            const rectangular = WindowFunctions.rectangular(16);
            
            const hannNorm = WindowFunctions.getNormalizationFactor(hann);
            const rectNorm = WindowFunctions.getNormalizationFactor(rectangular);
            
            expect(hannNorm).toBeCloseTo(0.5, 2);
            expect(rectNorm).toBe(1);
        });
        
        test('should calculate coherent gain', () => {
            const hann = WindowFunctions.hann(16);
            const rectangular = WindowFunctions.rectangular(16);
            
            const hannGain = WindowFunctions.getCoherentGain(hann);
            const rectGain = WindowFunctions.getCoherentGain(rectangular);
            
            expect(hannGain).toBeCloseTo(0.5, 2);
            expect(rectGain).toBe(1);
        });
        
        test('should calculate noise equivalent bandwidth', () => {
            const hann = WindowFunctions.hann(16);
            const rectangular = WindowFunctions.rectangular(16);
            
            const hannNEBW = WindowFunctions.getNoiseEquivalentBandwidth(hann);
            const rectNEBW = WindowFunctions.getNoiseEquivalentBandwidth(rectangular);
            
            expect(hannNEBW).toBeGreaterThan(1);
            expect(rectNEBW).toBe(1);
            
            // Hann window should have higher NEBW than rectangular
            expect(hannNEBW).toBeGreaterThan(rectNEBW);
        });
    });
    
    describe('Overlapped Windows', () => {
        test('should create overlapped windows', () => {
            const signal = new Float32Array(100);
            signal.fill(1);
            
            const windowSize = 32;
            const overlap = 0.5;
            
            const windows = WindowFunctions.createOverlappedWindows(
                signal, windowSize, overlap, 'hann'
            );
            
            expect(windows.length).toBeGreaterThan(1);
            
            // Each window should have the correct size
            windows.forEach(window => {
                expect(window.length).toBe(windowSize);
            });
            
            // Should have proper overlap
            const hopSize = windowSize * (1 - overlap);
            const expectedWindows = Math.floor((signal.length - windowSize) / hopSize) + 1;
            expect(windows.length).toBe(expectedWindows);
        });
        
        test('should handle different overlap ratios', () => {
            const signal = new Float32Array(100);
            signal.fill(1);
            
            const windowSize = 20;
            
            const windows50 = WindowFunctions.createOverlappedWindows(
                signal, windowSize, 0.5
            );
            const windows75 = WindowFunctions.createOverlappedWindows(
                signal, windowSize, 0.75
            );
            
            // Higher overlap should produce more windows
            expect(windows75.length).toBeGreaterThan(windows50.length);
        });
        
        test('should handle edge cases', () => {
            const signal = new Float32Array(10);
            const windowSize = 20; // Larger than signal
            
            const windows = WindowFunctions.createOverlappedWindows(
                signal, windowSize, 0.5
            );
            
            // Should handle gracefully
            expect(windows.length).toBeGreaterThanOrEqual(0);
        });
    });
    
    describe('Window Recommendations', () => {
        test('should provide recommendations for different applications', () => {
            const pitchRec = WindowFunctions.getRecommendedWindow('pitch');
            const spectralRec = WindowFunctions.getRecommendedWindow('spectral');
            const transientRec = WindowFunctions.getRecommendedWindow('transient');
            const generalRec = WindowFunctions.getRecommendedWindow('general');
            
            expect(pitchRec.type).toBe('hann');
            expect(spectralRec.type).toBe('blackmanHarris');
            expect(transientRec.type).toBe('rectangular');
            expect(generalRec.type).toBe('hann');
            
            expect(pitchRec.reason).toContain('pitch');
            expect(spectralRec.reason).toContain('spectral');
            expect(transientRec.reason).toContain('transient');
            expect(generalRec.reason).toContain('general');
        });
        
        test('should handle unknown application', () => {
            const unknownRec = WindowFunctions.getRecommendedWindow('unknown' as any);
            
            expect(unknownRec.type).toBe('hann');
            expect(unknownRec.reason).toContain('Default');
        });
    });
    
    describe('Window Properties Validation', () => {
        test('should validate window symmetry', () => {
            const windows = ['hann', 'hamming', 'blackman', 'blackmanHarris'] as const;
            
            windows.forEach(windowType => {
                const window = WindowFunctions.create(windowType, 32);
                
                // Check symmetry
                for (let i = 0; i < window.length / 2; i++) {
                    expect(window[i]).toBeCloseTo(window[window.length - 1 - i], 5);
                }
            });
        });
        
        test('should validate window range', () => {
            const windows = ['hann', 'hamming', 'blackman'] as const;
            
            windows.forEach(windowType => {
                const window = WindowFunctions.create(windowType, 32);
                
                // All values should be between 0 and 1
                for (let i = 0; i < window.length; i++) {
                    expect(window[i]).toBeGreaterThanOrEqual(0);
                    expect(window[i]).toBeLessThanOrEqual(1);
                }
            });
        });
        
        test('should validate Kaiser window with different beta values', () => {
            const betas = [0, 2, 5, 10];
            
            betas.forEach(beta => {
                const window = WindowFunctions.kaiser(32, beta);
                
                // Should be symmetric
                for (let i = 0; i < window.length / 2; i++) {
                    expect(window[i]).toBeCloseTo(window[window.length - 1 - i], 5);
                }
                
                // Should peak at center
                const mid = Math.floor(window.length / 2);
                expect(window[mid]).toBeCloseTo(1, 2);
            });
        });
        
        test('should validate Gaussian window with different sigma values', () => {
            const sigmas = [0.2, 0.4, 0.6];
            
            sigmas.forEach(sigma => {
                const window = WindowFunctions.gauss(32, sigma);
                
                // Should be symmetric
                for (let i = 0; i < window.length / 2; i++) {
                    expect(window[i]).toBeCloseTo(window[window.length - 1 - i], 5);
                }
                
                // Should peak at center
                const mid = Math.floor(window.length / 2);
                expect(window[mid]).toBeCloseTo(1, 2);
            });
        });
    });
    
    describe('Performance', () => {
        test('should create windows efficiently', () => {
            const size = 4096;
            
            const startTime = performance.now();
            
            for (let i = 0; i < 100; i++) {
                WindowFunctions.hann(size);
                WindowFunctions.hamming(size);
                WindowFunctions.blackman(size);
            }
            
            const endTime = performance.now();
            const processingTime = endTime - startTime;
            
            // Should create 300 windows within 100ms
            expect(processingTime).toBeLessThan(100);
        });
        
        test('should apply windows efficiently', () => {
            const size = 4096;
            const signal = new Float32Array(size);
            signal.fill(1);
            const window = WindowFunctions.hann(size);
            
            const startTime = performance.now();
            
            for (let i = 0; i < 1000; i++) {
                WindowFunctions.apply(signal, window);
            }
            
            const endTime = performance.now();
            const processingTime = endTime - startTime;
            
            // Should apply 1000 windows within 50ms
            expect(processingTime).toBeLessThan(50);
        });
    });
});