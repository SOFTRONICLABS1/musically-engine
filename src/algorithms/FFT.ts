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
     * Find peak frequency in magnitude spectrum
     * @param magnitude Magnitude spectrum
     * @returns Peak frequency in Hz
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
        
        return maxIndex * this.sampleRate / this.size;
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