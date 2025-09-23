/**
 * Window functions for signal processing
 * Common window functions used in audio analysis
 */

export type WindowType = 'rectangular' | 'hann' | 'hamming' | 'blackman' | 'blackmanHarris' | 'kaiser' | 'gauss';

/**
 * Window function generator class
 */
export class WindowFunctions {
    /**
     * Create a window function
     * @param type Window type
     * @param size Window size
     * @param parameter Optional parameter for parameterized windows
     * @returns Window function array
     */
    public static create(type: WindowType, size: number, parameter?: number): Float32Array {
        const window = new Float32Array(size);
        
        switch (type) {
            case 'rectangular':
                return this.rectangular(size);
            case 'hann':
                return this.hann(size);
            case 'hamming':
                return this.hamming(size);
            case 'blackman':
                return this.blackman(size);
            case 'blackmanHarris':
                return this.blackmanHarris(size);
            case 'kaiser':
                return this.kaiser(size, parameter || 5);
            case 'gauss':
                return this.gauss(size, parameter || 0.4);
            default:
                throw new Error(`Unknown window type: ${type}`);
        }
    }
    
    /**
     * Rectangular (no) window
     * @param size Window size
     * @returns Rectangular window
     */
    public static rectangular(size: number): Float32Array {
        const window = new Float32Array(size);
        window.fill(1);
        return window;
    }
    
    /**
     * Hann window
     * Good general-purpose window with moderate side-lobe suppression
     * @param size Window size
     * @returns Hann window
     */
    public static hann(size: number): Float32Array {
        const window = new Float32Array(size);
        
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
        }
        
        return window;
    }
    
    /**
     * Hamming window
     * Similar to Hann but with different coefficients
     * @param size Window size
     * @returns Hamming window
     */
    public static hamming(size: number): Float32Array {
        const window = new Float32Array(size);
        
        for (let i = 0; i < size; i++) {
            window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
        }
        
        return window;
    }
    
    /**
     * Blackman window
     * Better side-lobe suppression than Hann/Hamming
     * @param size Window size
     * @returns Blackman window
     */
    public static blackman(size: number): Float32Array {
        const window = new Float32Array(size);
        
        const a0 = 0.42;
        const a1 = 0.5;
        const a2 = 0.08;
        
        for (let i = 0; i < size; i++) {
            window[i] = a0 - a1 * Math.cos(2 * Math.PI * i / (size - 1)) +
                       a2 * Math.cos(4 * Math.PI * i / (size - 1));
        }
        
        return window;
    }
    
    /**
     * Blackman-Harris window
     * Excellent side-lobe suppression for spectral analysis
     * @param size Window size
     * @returns Blackman-Harris window
     */
    public static blackmanHarris(size: number): Float32Array {
        const window = new Float32Array(size);
        
        const a0 = 0.35875;
        const a1 = 0.48829;
        const a2 = 0.14128;
        const a3 = 0.01168;
        
        for (let i = 0; i < size; i++) {
            const n = 2 * Math.PI * i / (size - 1);
            window[i] = a0 - a1 * Math.cos(n) + a2 * Math.cos(2 * n) - a3 * Math.cos(3 * n);
        }
        
        return window;
    }
    
    /**
     * Kaiser window
     * Parameterizable window with adjustable trade-off between main lobe width and side lobe level
     * @param size Window size
     * @param beta Shape parameter (higher = narrower main lobe, lower side lobes)
     * @returns Kaiser window
     */
    public static kaiser(size: number, beta: number = 5): Float32Array {
        const window = new Float32Array(size);
        const alpha = (size - 1) / 2;
        const I0_beta = this.besselI0(beta);
        
        for (let i = 0; i < size; i++) {
            const x = (i - alpha) / alpha;
            const arg = beta * Math.sqrt(1 - x * x);
            window[i] = this.besselI0(arg) / I0_beta;
        }
        
        return window;
    }
    
    /**
     * Gaussian window
     * @param size Window size
     * @param sigma Standard deviation (smaller = narrower window)
     * @returns Gaussian window
     */
    public static gauss(size: number, sigma: number = 0.4): Float32Array {
        const window = new Float32Array(size);
        const N = size - 1;
        
        for (let i = 0; i < size; i++) {
            const n = i - N / 2;
            const exponent = -0.5 * Math.pow(n / (sigma * N / 2), 2);
            window[i] = Math.exp(exponent);
        }
        
        return window;
    }
    
    /**
     * Apply window function to signal
     * @param signal Input signal
     * @param window Window function
     * @returns Windowed signal
     */
    public static apply(signal: Float32Array, window: Float32Array): Float32Array {
        if (signal.length !== window.length) {
            throw new Error('Signal and window must have the same length');
        }
        
        const windowed = new Float32Array(signal.length);
        
        for (let i = 0; i < signal.length; i++) {
            windowed[i] = signal[i] * window[i];
        }
        
        return windowed;
    }
    
    /**
     * Apply window function in-place
     * @param signal Signal to window (modified in-place)
     * @param window Window function
     */
    public static applyInPlace(signal: Float32Array, window: Float32Array): void {
        if (signal.length !== window.length) {
            throw new Error('Signal and window must have the same length');
        }
        
        for (let i = 0; i < signal.length; i++) {
            signal[i] *= window[i];
        }
    }
    
    /**
     * Calculate window normalization factor
     * @param window Window function
     * @returns Normalization factor
     */
    public static getNormalizationFactor(window: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < window.length; i++) {
            sum += window[i];
        }
        return sum / window.length;
    }
    
    /**
     * Calculate coherent gain (amplitude scaling factor)
     * @param window Window function
     * @returns Coherent gain
     */
    public static getCoherentGain(window: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < window.length; i++) {
            sum += window[i];
        }
        return sum / window.length;
    }
    
    /**
     * Calculate noise equivalent bandwidth
     * @param window Window function
     * @returns Noise equivalent bandwidth
     */
    public static getNoiseEquivalentBandwidth(window: Float32Array): number {
        let sumSquared = 0;
        let sum = 0;
        
        for (let i = 0; i < window.length; i++) {
            sum += window[i];
            sumSquared += window[i] * window[i];
        }
        
        return window.length * sumSquared / (sum * sum);
    }
    
    /**
     * Create overlapped windows for STFT
     * @param signal Input signal
     * @param windowSize Window size
     * @param overlap Overlap ratio (0-1)
     * @param windowType Window type
     * @returns Array of windowed segments
     */
    public static createOverlappedWindows(
        signal: Float32Array,
        windowSize: number,
        overlap: number,
        windowType: WindowType = 'hann'
    ): Float32Array[] {
        const window = this.create(windowType, windowSize);
        const hopSize = Math.floor(windowSize * (1 - overlap));
        const windows: Float32Array[] = [];
        
        for (let start = 0; start <= signal.length - windowSize; start += hopSize) {
            const segment = signal.slice(start, start + windowSize);
            const windowed = this.apply(segment, window);
            windows.push(windowed);
        }
        
        return windows;
    }
    
    /**
     * Modified Bessel function of the first kind, order 0
     * Used for Kaiser window calculation
     * @param x Input value
     * @returns I0(x)
     */
    private static besselI0(x: number): number {
        let sum = 1;
        let term = 1;
        let k = 1;
        
        while (term > 1e-12) {
            term = Math.pow(x / 2, 2 * k) / Math.pow(this.factorial(k), 2);
            sum += term;
            k++;
        }
        
        return sum;
    }
    
    /**
     * Calculate factorial
     * @param n Input number
     * @returns n!
     */
    private static factorial(n: number): number {
        if (n <= 1) return 1;
        return n * this.factorial(n - 1);
    }
    
    /**
     * Get recommended window for specific applications
     * @param application Application type
     * @returns Recommended window type and parameters
     */
    public static getRecommendedWindow(application: 'pitch' | 'spectral' | 'transient' | 'general'): {
        type: WindowType;
        parameter?: number;
        reason: string;
    } {
        switch (application) {
            case 'pitch':
                return {
                    type: 'hann',
                    reason: 'Good balance of frequency resolution and leakage reduction for pitch detection'
                };
            case 'spectral':
                return {
                    type: 'blackmanHarris',
                    reason: 'Excellent side-lobe suppression for precise spectral analysis'
                };
            case 'transient':
                return {
                    type: 'rectangular',
                    reason: 'Preserves temporal characteristics for transient analysis'
                };
            case 'general':
                return {
                    type: 'hann',
                    reason: 'General-purpose window with good overall characteristics'
                };
            default:
                return {
                    type: 'hann',
                    reason: 'Default general-purpose window'
                };
        }
    }
}

export default WindowFunctions;