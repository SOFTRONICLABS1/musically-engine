/**
 * Fast Fourier Transform implementation for frequency domain analysis
 * Platform-agnostic implementation optimized for audio processing
 */

export class FFT {
    private size: number;
    private sampleRate: number;
    private cosTable: Float32Array;
    private sinTable: Float32Array;
    private reverseTable: Uint32Array;
    
    constructor(size: number, sampleRate: number = 44100) {
        if (!this.isPowerOfTwo(size)) {
            throw new Error('FFT size must be a power of 2');
        }
        
        this.size = size;
        this.sampleRate = sampleRate;
        
        // Pre-compute tables for optimization
        this.cosTable = new Float32Array(size);
        this.sinTable = new Float32Array(size);
        this.reverseTable = new Uint32Array(size);
        
        this.initializeTables();
    }
    
    /**
     * Initialize lookup tables for FFT computation
     */
    private initializeTables(): void {
        // Bit reversal table
        for (let i = 0; i < this.size; i++) {
            this.reverseTable[i] = this.reverseBits(i, Math.log2(this.size));
        }
        
        // Sine and cosine tables
        for (let i = 0; i < this.size; i++) {
            this.cosTable[i] = Math.cos(-2 * Math.PI * i / this.size);
            this.sinTable[i] = Math.sin(-2 * Math.PI * i / this.size);
        }
    }
    
    /**
     * Reverse bits of a number
     */
    private reverseBits(num: number, bits: number): number {
        let result = 0;
        for (let i = 0; i < bits; i++) {
            result = (result << 1) | (num & 1);
            num >>= 1;
        }
        return result;
    }
    
    /**
     * Perform forward FFT on real-valued input
     * @param input Real-valued input signal
     * @returns Complex FFT result [real, imaginary]
     */
    public forward(input: Float32Array): { real: Float32Array; imag: Float32Array } {
        if (input.length !== this.size) {
            throw new Error(`Input length ${input.length} does not match FFT size ${this.size}`);
        }
        
        const real = new Float32Array(this.size);
        const imag = new Float32Array(this.size);
        
        // Copy input to real array with bit reversal
        for (let i = 0; i < this.size; i++) {
            real[i] = input[this.reverseTable[i]];
        }
        
        // Cooley-Tukey FFT
        let length = 2;
        while (length <= this.size) {
            const halfLength = length >> 1;
            
            for (let i = 0; i < this.size; i += length) {
                for (let j = 0; j < halfLength; j++) {
                    const evenIndex = i + j;
                    const oddIndex = i + j + halfLength;
                    
                    const angle = -2 * Math.PI * j / length;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    
                    const oddReal = real[oddIndex];
                    const oddImag = imag[oddIndex];
                    
                    const tempReal = oddReal * cos - oddImag * sin;
                    const tempImag = oddReal * sin + oddImag * cos;
                    
                    real[oddIndex] = real[evenIndex] - tempReal;
                    imag[oddIndex] = imag[evenIndex] - tempImag;
                    
                    real[evenIndex] = real[evenIndex] + tempReal;
                    imag[evenIndex] = imag[evenIndex] + tempImag;
                }
            }
            length <<= 1;
        }
        
        return { real, imag };
    }
    
    /**
     * Calculate magnitude spectrum from complex FFT result
     * @param real Real component
     * @param imag Imaginary component
     * @returns Magnitude spectrum
     */
    public getMagnitudeSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
        const magnitude = new Float32Array(this.size / 2);
        
        for (let i = 0; i < magnitude.length; i++) {
            magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }
        
        return magnitude;
    }
    
    /**
     * Calculate power spectrum from complex FFT result
     * @param real Real component
     * @param imag Imaginary component
     * @returns Power spectrum
     */
    public getPowerSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
        const power = new Float32Array(this.size / 2);
        
        for (let i = 0; i < power.length; i++) {
            power[i] = real[i] * real[i] + imag[i] * imag[i];
        }
        
        return power;
    }
    
    /**
     * Get frequency bins for the FFT
     * @returns Array of frequency values for each bin
     */
    public getFrequencyBins(): Float32Array {
        const bins = new Float32Array(this.size / 2);
        const binWidth = this.sampleRate / this.size;
        
        for (let i = 0; i < bins.length; i++) {
            bins[i] = i * binWidth;
        }
        
        return bins;
    }
    
    /**
     * Find peak frequency in magnitude spectrum with parabolic interpolation
     * @param magnitude Magnitude spectrum
     * @returns Peak frequency in Hz with sub-bin accuracy
     */
    public findPeakFrequency(magnitude: Float32Array): number {
        let maxIndex = 0;
        let maxValue = magnitude[0];
        
        for (let i = 1; i < magnitude.length; i++) {
            if (magnitude[i] > maxValue) {
                maxValue = magnitude[i];
                maxIndex = i;
            }
        }
        
        // Apply parabolic interpolation for sub-bin accuracy
        const interpolatedIndex = this.parabolicInterpolation(magnitude, maxIndex);
        
        return interpolatedIndex * this.sampleRate / this.size;
    }
    
    /**
     * Parabolic interpolation for precise peak location
     * Uses three points around the peak to fit a parabola
     * @param spectrum Magnitude spectrum
     * @param peakIndex Index of the peak bin
     * @returns Interpolated peak position with sub-bin accuracy
     */
    private parabolicInterpolation(spectrum: Float32Array, peakIndex: number): number {
        // Handle edge cases
        if (peakIndex === 0 || peakIndex >= spectrum.length - 1) {
            return peakIndex;
        }
        
        // Get the three points around the peak
        const y1 = spectrum[peakIndex - 1];
        const y2 = spectrum[peakIndex];
        const y3 = spectrum[peakIndex + 1];
        
        // Calculate the fractional bin offset using parabolic interpolation
        // Formula: p = 0.5 * (y1 - y3) / (y1 - 2*y2 + y3)
        const denominator = y1 - 2 * y2 + y3;
        
        // Avoid division by zero
        if (Math.abs(denominator) < 1e-10) {
            return peakIndex;
        }
        
        const p = 0.5 * (y1 - y3) / denominator;
        
        // Return the interpolated peak position
        // Constrain to [-0.5, 0.5] to avoid unrealistic corrections
        const constrainedP = Math.max(-0.5, Math.min(0.5, p));
        return peakIndex + constrainedP;
    }
    
    /**
     * Find multiple peaks in magnitude spectrum with interpolation
     * @param magnitude Magnitude spectrum
     * @param numPeaks Number of peaks to find
     * @param minDistance Minimum bin distance between peaks
     * @returns Array of peak frequencies in Hz
     */
    public findMultiplePeaks(magnitude: Float32Array, numPeaks: number = 5, minDistance: number = 4): number[] {
        const peaks: { index: number; value: number; frequency: number }[] = [];
        const threshold = Math.max(...Array.from(magnitude)) * 0.1; // 10% of max
        
        // Find all local maxima
        for (let i = 1; i < magnitude.length - 1; i++) {
            if (magnitude[i] > magnitude[i - 1] && 
                magnitude[i] > magnitude[i + 1] && 
                magnitude[i] > threshold) {
                
                // Check minimum distance from existing peaks
                let tooClose = false;
                for (const peak of peaks) {
                    if (Math.abs(i - peak.index) < minDistance) {
                        tooClose = true;
                        break;
                    }
                }
                
                if (!tooClose) {
                    const interpolatedIndex = this.parabolicInterpolation(magnitude, i);
                    peaks.push({
                        index: i,
                        value: magnitude[i],
                        frequency: interpolatedIndex * this.sampleRate / this.size
                    });
                }
            }
        }
        
        // Sort by magnitude and return top N peaks
        peaks.sort((a, b) => b.value - a.value);
        return peaks.slice(0, numPeaks).map(p => p.frequency);
    }
    
    /**
     * Apply zero padding to input signal
     * @param input Input signal
     * @param targetSize Target size (must be power of 2)
     * @returns Zero-padded signal
     */
    public static zeroPad(input: Float32Array, targetSize: number): Float32Array {
        if (input.length >= targetSize) {
            return input.slice(0, targetSize);
        }
        
        const padded = new Float32Array(targetSize);
        padded.set(input);
        return padded;
    }
    
    /**
     * Find next power of two greater than or equal to n
     * @param n Input number
     * @returns Next power of two
     */
    public static nextPowerOfTwo(n: number): number {
        let power = 1;
        while (power < n) {
            power <<= 1;
        }
        return power;
    }
    
    /**
     * Check if number is power of two
     * @param n Number to check
     * @returns True if power of two
     */
    private isPowerOfTwo(n: number): boolean {
        return n > 0 && (n & (n - 1)) === 0;
    }
    
    /**
     * Get FFT size
     */
    public getSize(): number {
        return this.size;
    }
    
    /**
     * Get sample rate
     */
    public getSampleRate(): number {
        return this.sampleRate;
    }
    
    /**
     * Perform inverse FFT with O(N log N) complexity
     * @param real Real component of frequency domain signal
     * @param imag Imaginary component of frequency domain signal
     * @returns Time-domain signal
     */
    public inverse(real: Float32Array, imag: Float32Array): Float32Array {
        if (real.length !== this.size || imag.length !== this.size) {
            throw new Error(`Input length must match FFT size ${this.size}`);
        }
        
        // Create copies to avoid modifying input
        const realCopy = new Float32Array(real);
        const imagCopy = new Float32Array(imag);
        
        // Conjugate the complex numbers
        for (let i = 0; i < this.size; i++) {
            imagCopy[i] = -imagCopy[i];
        }
        
        // Apply bit reversal
        for (let i = 0; i < this.size; i++) {
            const j = this.reverseTable[i];
            if (i < j) {
                // Swap real parts
                const tempReal = realCopy[i];
                realCopy[i] = realCopy[j];
                realCopy[j] = tempReal;
                
                // Swap imaginary parts
                const tempImag = imagCopy[i];
                imagCopy[i] = imagCopy[j];
                imagCopy[j] = tempImag;
            }
        }
        
        // Cooley-Tukey IFFT (same as FFT but with conjugated input)
        let length = 2;
        while (length <= this.size) {
            const halfLength = length >> 1;
            
            for (let i = 0; i < this.size; i += length) {
                for (let j = 0; j < halfLength; j++) {
                    const evenIndex = i + j;
                    const oddIndex = i + j + halfLength;
                    
                    const angle = -2 * Math.PI * j / length;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    
                    const oddReal = realCopy[oddIndex];
                    const oddImag = imagCopy[oddIndex];
                    
                    const tempReal = oddReal * cos - oddImag * sin;
                    const tempImag = oddReal * sin + oddImag * cos;
                    
                    realCopy[oddIndex] = realCopy[evenIndex] - tempReal;
                    imagCopy[oddIndex] = imagCopy[evenIndex] - tempImag;
                    
                    realCopy[evenIndex] = realCopy[evenIndex] + tempReal;
                    imagCopy[evenIndex] = imagCopy[evenIndex] + tempImag;
                }
            }
            length <<= 1;
        }
        
        // Conjugate again and scale
        const output = new Float32Array(this.size);
        const scale = 1.0 / this.size;
        
        for (let i = 0; i < this.size; i++) {
            // Take real part and scale
            output[i] = realCopy[i] * scale;
        }
        
        return output;
    }
    
    /**
     * Perform forward FFT followed by inverse FFT (for testing)
     * @param input Real-valued input signal
     * @returns Reconstructed signal (should match input)
     */
    public roundTrip(input: Float32Array): Float32Array {
        const { real, imag } = this.forward(input);
        return this.inverse(real, imag);
    }
}

/**
 * Optimized FFT for real-time processing
 */
export class RealTimeFFT extends FFT {
    private windowFunction: Float32Array;
    
    constructor(size: number, sampleRate: number = 44100) {
        super(size, sampleRate);
        
        // Apply Hann window by default for real-time processing
        this.windowFunction = this.createHannWindow();
    }
    
    /**
     * Create Hann window function
     */
    private createHannWindow(): Float32Array {
        const window = new Float32Array(this.getSize());
        
        for (let i = 0; i < this.getSize(); i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (this.getSize() - 1)));
        }
        
        return window;
    }
    
    /**
     * Process input with windowing
     * @param input Input signal
     * @returns FFT result with windowing applied
     */
    public process(input: Float32Array): { magnitude: Float32Array; frequency: Float32Array } {
        // Apply window function
        const windowed = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
            windowed[i] = input[i] * this.windowFunction[i];
        }
        
        // Perform FFT
        const { real, imag } = this.forward(windowed);
        
        // Calculate magnitude spectrum
        const magnitude = this.getMagnitudeSpectrum(real, imag);
        const frequency = this.getFrequencyBins();
        
        return { magnitude, frequency };
    }
    
    /**
     * Set custom window function
     * @param windowFunction Window function array
     */
    public setWindowFunction(windowFunction: Float32Array): void {
        if (windowFunction.length !== this.getSize()) {
            throw new Error('Window function size must match FFT size');
        }
        this.windowFunction = windowFunction;
    }
}

export default FFT;