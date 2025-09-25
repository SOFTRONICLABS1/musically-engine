/**
 * Tests for FFT algorithm
 */

import { FFT, RealTimeFFT } from '../../src/algorithms/FFT';

describe('FFT Algorithm', () => {
    let fft: FFT;
    const sampleRate = 44100;
    const fftSize = 1024;
    
    beforeEach(() => {
        fft = new FFT(fftSize, sampleRate);
    });
    
    describe('Initialization', () => {
        test('should create FFT with correct size', () => {
            expect(fft.getSize()).toBe(fftSize);
            expect(fft.getSampleRate()).toBe(sampleRate);
        });
        
        test('should reject non-power-of-two sizes', () => {
            expect(() => new FFT(1000, sampleRate)).toThrow('FFT size must be a power of 2');
        });
        
        test('should accept valid power-of-two sizes', () => {
            const validSizes = [256, 512, 1024, 2048, 4096];
            validSizes.forEach(size => {
                expect(() => new FFT(size, sampleRate)).not.toThrow();
            });
        });
    });
    
    describe('Static Utilities', () => {
        test('should detect power of two correctly', () => {
            expect(FFT.nextPowerOfTwo(1000)).toBe(1024);
            expect(FFT.nextPowerOfTwo(1024)).toBe(1024);
            expect(FFT.nextPowerOfTwo(1025)).toBe(2048);
        });
        
        test('should zero-pad correctly', () => {
            const input = new Float32Array([1, 2, 3]);
            const padded = FFT.zeroPad(input, 8);
            
            expect(padded.length).toBe(8);
            expect(Array.from(padded)).toEqual([1, 2, 3, 0, 0, 0, 0, 0]);
        });
        
        test('should truncate when input is larger than target', () => {
            const input = new Float32Array([1, 2, 3, 4, 5]);
            const truncated = FFT.zeroPad(input, 3);
            
            expect(truncated.length).toBe(3);
            expect(Array.from(truncated)).toEqual([1, 2, 3]);
        });
    });
    
    describe('FFT Forward Transform', () => {
        test('should handle DC signal correctly', () => {
            const input = new Float32Array(fftSize);
            input.fill(1); // DC signal
            
            const { real, imag } = fft.forward(input);
            
            expect(real[0]).toBeCloseTo(fftSize, 5);
            expect(imag[0]).toBeCloseTo(0, 5);
            
            // Other bins should be approximately zero
            for (let i = 1; i < 10; i++) {
                expect(Math.abs(real[i])).toBeLessThan(1e-10);
                expect(Math.abs(imag[i])).toBeLessThan(1e-10);
            }
        });
        
        test('should handle sine wave correctly', () => {
            const frequency = 440; // A4
            const input = new Float32Array(fftSize);
            
            // Generate sine wave
            for (let i = 0; i < fftSize; i++) {
                input[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
            }
            
            const { real, imag } = fft.forward(input);
            const magnitude = fft.getMagnitudeSpectrum(real, imag);
            
            // Find peak frequency
            const peakFreq = fft.findPeakFrequency(magnitude);
            
            // Should be close to the input frequency (within FFT bin resolution)
            const frequencyResolution = sampleRate / fftSize; // 43.07 Hz
            expect(Math.abs(peakFreq - frequency)).toBeLessThan(frequencyResolution);
        });
        
        test('should handle complex signals with multiple frequencies', () => {
            const freq1 = 440;  // A4
            const freq2 = 880;  // A5
            const input = new Float32Array(fftSize);
            
            // Generate signal with two frequencies
            for (let i = 0; i < fftSize; i++) {
                input[i] = Math.sin(2 * Math.PI * freq1 * i / sampleRate) +
                          0.5 * Math.sin(2 * Math.PI * freq2 * i / sampleRate);
            }
            
            const { real, imag } = fft.forward(input);
            const magnitude = fft.getMagnitudeSpectrum(real, imag);
            const frequencies = fft.getFrequencyBins();
            
            // Find peaks
            const peaks: Array<{ freq: number; mag: number }> = [];
            for (let i = 1; i < magnitude.length - 1; i++) {
                if (magnitude[i] > magnitude[i-1] && magnitude[i] > magnitude[i+1]) {
                    peaks.push({ freq: frequencies[i], mag: magnitude[i] });
                }
            }
            
            // Sort by magnitude
            peaks.sort((a, b) => b.mag - a.mag);
            
            // Should find both frequencies
            expect(peaks.length).toBeGreaterThanOrEqual(2);
            const frequencyResolution = sampleRate / fftSize;
            expect(Math.abs(peaks[0].freq - freq1)).toBeLessThan(frequencyResolution);
            expect(Math.abs(peaks[1].freq - freq2)).toBeLessThan(frequencyResolution);
        });
        
        test('should reject wrong input size', () => {
            const wrongSizeInput = new Float32Array(512);
            expect(() => fft.forward(wrongSizeInput)).toThrow();
        });
    });
    
    describe('Spectrum Analysis', () => {
        test('should calculate magnitude spectrum correctly', () => {
            const real = new Float32Array([3, 0, 0, 0]);
            const imag = new Float32Array([4, 0, 0, 0]);
            
            const magnitude = fft.getMagnitudeSpectrum(real, imag);
            
            expect(magnitude[0]).toBeCloseTo(5, 5); // sqrt(3^2 + 4^2) = 5
            expect(magnitude[1]).toBeCloseTo(0, 5);
        });
        
        test('should calculate power spectrum correctly', () => {
            const real = new Float32Array([3, 0, 0, 0]);
            const imag = new Float32Array([4, 0, 0, 0]);
            
            const power = fft.getPowerSpectrum(real, imag);
            
            expect(power[0]).toBeCloseTo(25, 5); // 3^2 + 4^2 = 25
            expect(power[1]).toBeCloseTo(0, 5);
        });
        
        test('should generate correct frequency bins', () => {
            const bins = fft.getFrequencyBins();
            
            expect(bins.length).toBe(fftSize / 2);
            expect(bins[0]).toBe(0); // DC
            expect(bins[1]).toBeCloseTo(sampleRate / fftSize, 5);
            expect(bins[bins.length - 1]).toBeCloseTo(sampleRate / 2 - sampleRate / fftSize, 5);
        });
    });
    
    describe('Peak Detection', () => {
        test('should find correct peak frequency', () => {
            const testFreq = 1000;
            const input = new Float32Array(fftSize);
            
            // Generate pure tone
            for (let i = 0; i < fftSize; i++) {
                input[i] = Math.sin(2 * Math.PI * testFreq * i / sampleRate);
            }
            
            const { real, imag } = fft.forward(input);
            const magnitude = fft.getMagnitudeSpectrum(real, imag);
            const peakFreq = fft.findPeakFrequency(magnitude);
            
            const frequencyResolution = sampleRate / fftSize;
            expect(Math.abs(peakFreq - testFreq)).toBeLessThan(frequencyResolution);
        });
        
        test('should handle noise correctly', () => {
            const input = new Float32Array(fftSize);
            
            // Generate random noise
            for (let i = 0; i < fftSize; i++) {
                input[i] = (Math.random() - 0.5) * 0.1;
            }
            
            const { real, imag } = fft.forward(input);
            const magnitude = fft.getMagnitudeSpectrum(real, imag);
            const peakFreq = fft.findPeakFrequency(magnitude);
            
            // Peak should be somewhere reasonable
            expect(peakFreq).toBeGreaterThanOrEqual(0);
            expect(peakFreq).toBeLessThanOrEqual(sampleRate / 2);
        });
    });
});

describe('RealTimeFFT', () => {
    let rtFFT: RealTimeFFT;
    const sampleRate = 44100;
    const fftSize = 1024;
    
    beforeEach(() => {
        rtFFT = new RealTimeFFT(fftSize, sampleRate);
    });
    
    describe('Real-Time Processing', () => {
        test('should process signal with windowing', () => {
            const frequency = 440;
            const input = new Float32Array(fftSize);
            
            // Generate sine wave
            for (let i = 0; i < fftSize; i++) {
                input[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
            }
            
            const { magnitude, frequency: freqBins } = rtFFT.process(input);
            
            expect(magnitude.length).toBe(fftSize / 2);
            expect(freqBins.length).toBe(fftSize / 2);
            
            // Find peak
            let maxIndex = 0;
            for (let i = 1; i < magnitude.length; i++) {
                if (magnitude[i] > magnitude[maxIndex]) {
                    maxIndex = i;
                }
            }
            
            const detectedFreq = freqBins[maxIndex];
            const frequencyResolution = sampleRate / fftSize;
            expect(Math.abs(detectedFreq - frequency)).toBeLessThan(frequencyResolution);
        });
        
        test('should handle custom window function', () => {
            const customWindow = new Float32Array(fftSize);
            customWindow.fill(1); // Rectangular window
            
            rtFFT.setWindowFunction(customWindow);
            
            const input = new Float32Array(fftSize);
            input.fill(1);
            
            expect(() => rtFFT.process(input)).not.toThrow();
        });
        
        test('should reject wrong window size', () => {
            const wrongSizeWindow = new Float32Array(512);
            expect(() => rtFFT.setWindowFunction(wrongSizeWindow)).toThrow();
        });
    });
});

describe('FFT Performance', () => {
    test('should perform within reasonable time limits', () => {
        const fft = new FFT(4096, 44100);
        const input = new Float32Array(4096);
        
        // Generate test signal
        for (let i = 0; i < input.length; i++) {
            input[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
        }
        
        const startTime = performance.now();
        const { real, imag } = fft.forward(input);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        
        // Should complete within 10ms for 4096-point FFT
        expect(processingTime).toBeLessThan(10);
        
        // Verify output is valid
        expect(real.length).toBe(4096);
        expect(imag.length).toBe(4096);
    });
});