/**
 * Autocorrelation algorithm for pitch detection
 * Efficient implementation for monophonic pitch detection
 */

export class Autocorrelation {
    private sampleRate: number;
    private minFrequency: number;
    private maxFrequency: number;
    
    constructor(sampleRate: number = 44100, minFrequency: number = 50, maxFrequency: number = 4000) {
        this.sampleRate = sampleRate;
        this.minFrequency = minFrequency;
        this.maxFrequency = maxFrequency;
    }
    
    /**
     * Detect pitch using autocorrelation method
     * @param buffer Audio buffer
     * @returns Detected frequency and confidence
     */
    public detectPitch(buffer: Float32Array): { frequency: number; confidence: number } {
        // Calculate lag range based on frequency limits
        const minLag = Math.floor(this.sampleRate / this.maxFrequency);
        const maxLag = Math.ceil(this.sampleRate / this.minFrequency);
        
        // Ensure we don't exceed buffer length and have valid range
        const effectiveMaxLag = Math.min(maxLag, Math.floor(buffer.length / 2));
        const effectiveMinLag = Math.max(1, minLag); // Ensure minLag is at least 1
        
        if (effectiveMinLag >= effectiveMaxLag) {
            return { frequency: 0, confidence: 0 };
        }
        
        // Compute autocorrelation
        const autocorrelation = this.computeAutocorrelation(buffer, effectiveMinLag, effectiveMaxLag);
        
        // Find peak in autocorrelation
        const { lag, correlation } = this.findPeak(autocorrelation, effectiveMinLag);
        
        if (lag === 0) {
            return { frequency: 0, confidence: 0 };
        }
        
        // Refine peak using parabolic interpolation
        const refinedLag = this.parabolicInterpolation(autocorrelation, lag - effectiveMinLag, effectiveMinLag);
        
        // Calculate frequency from lag
        const frequency = this.sampleRate / refinedLag;
        
        // Calculate confidence based on correlation strength
        const confidence = this.calculateConfidence(correlation, autocorrelation);
        
        return { frequency, confidence };
    }
    
    /**
     * Compute autocorrelation function
     * @param buffer Input buffer
     * @param minLag Minimum lag
     * @param maxLag Maximum lag
     * @returns Autocorrelation values
     */
    private computeAutocorrelation(buffer: Float32Array, minLag: number, maxLag: number): Float32Array {
        const size = maxLag - minLag + 1;
        const result = new Float32Array(size);
        
        // Normalize input to reduce numerical errors
        const normalized = this.normalize(buffer);
        
        for (let lag = minLag; lag <= maxLag; lag++) {
            let sum = 0;
            const effectiveLength = buffer.length - lag;
            
            for (let i = 0; i < effectiveLength; i++) {
                sum += normalized[i] * normalized[i + lag];
            }
            
            result[lag - minLag] = sum / effectiveLength;
        }
        
        return result;
    }
    
    /**
     * Find peak in autocorrelation function
     * @param autocorr Autocorrelation values
     * @param minLag Minimum lag offset
     * @returns Peak lag and correlation value
     */
    private findPeak(autocorr: Float32Array, minLag: number): { lag: number; correlation: number } {
        let maxCorr = autocorr[0];
        let maxLag = 0;
        
        // Find first peak after zero lag
        for (let i = 1; i < autocorr.length - 1; i++) {
            // Check if this is a local maximum
            if (autocorr[i] > autocorr[i - 1] && autocorr[i] > autocorr[i + 1]) {
                if (autocorr[i] > maxCorr) {
                    maxCorr = autocorr[i];
                    maxLag = i;
                }
            }
        }
        
        return { lag: maxLag + minLag, correlation: maxCorr };
    }
    
    /**
     * Refine peak position using parabolic interpolation
     * @param autocorr Autocorrelation values
     * @param peakIndex Peak index in autocorr array
     * @param minLag Minimum lag offset
     * @returns Refined lag value
     */
    private parabolicInterpolation(autocorr: Float32Array, peakIndex: number, minLag: number): number {
        if (peakIndex === 0 || peakIndex === autocorr.length - 1) {
            return peakIndex + minLag;
        }
        
        const y1 = autocorr[peakIndex - 1];
        const y2 = autocorr[peakIndex];
        const y3 = autocorr[peakIndex + 1];
        
        const x0 = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
        
        return peakIndex + x0 + minLag;
    }
    
    /**
     * Calculate confidence score for detected pitch
     * @param peakCorr Peak correlation value
     * @param autocorr Full autocorrelation array
     * @returns Confidence score (0-1)
     */
    private calculateConfidence(peakCorr: number, autocorr: Float32Array): number {
        if (peakCorr <= 0) {
            return 0;
        }
        
        // Calculate mean correlation
        let sum = 0;
        for (let i = 0; i < autocorr.length; i++) {
            sum += Math.abs(autocorr[i]);
        }
        const mean = sum / autocorr.length;
        
        // Confidence based on peak prominence
        const prominence = peakCorr / (mean + 0.001);
        
        // Normalize to 0-1 range
        return Math.min(1, prominence / 3);
    }
    
    /**
     * Normalize audio buffer
     * @param buffer Input buffer
     * @returns Normalized buffer
     */
    private normalize(buffer: Float32Array): Float32Array {
        const normalized = new Float32Array(buffer.length);
        
        // Find max absolute value
        let maxVal = 0;
        for (let i = 0; i < buffer.length; i++) {
            maxVal = Math.max(maxVal, Math.abs(buffer[i]));
        }
        
        if (maxVal === 0) {
            return normalized;
        }
        
        // Normalize
        const scale = 1 / maxVal;
        for (let i = 0; i < buffer.length; i++) {
            normalized[i] = buffer[i] * scale;
        }
        
        return normalized;
    }
    
    /**
     * Apply window function to reduce edge effects
     * @param buffer Input buffer
     * @param windowType Type of window function
     * @returns Windowed buffer
     */
    public applyWindow(buffer: Float32Array, windowType: 'hann' | 'hamming' | 'blackman' = 'hann'): Float32Array {
        const windowed = new Float32Array(buffer.length);
        const N = buffer.length;
        
        for (let i = 0; i < N; i++) {
            let window = 1;
            
            switch (windowType) {
                case 'hann':
                    window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
                    break;
                case 'hamming':
                    window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
                    break;
                case 'blackman':
                    window = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)) + 
                            0.08 * Math.cos(4 * Math.PI * i / (N - 1));
                    break;
            }
            
            windowed[i] = buffer[i] * window;
        }
        
        return windowed;
    }
    
    /**
     * Batch process multiple buffers
     * @param buffers Array of audio buffers
     * @returns Array of pitch detection results
     */
    public batchProcess(buffers: Float32Array[]): Array<{ frequency: number; confidence: number }> {
        return buffers.map(buffer => this.detectPitch(buffer));
    }
    
    /**
     * Get configuration
     */
    public getConfig(): { sampleRate: number; minFrequency: number; maxFrequency: number } {
        return {
            sampleRate: this.sampleRate,
            minFrequency: this.minFrequency,
            maxFrequency: this.maxFrequency
        };
    }
}

/**
 * Enhanced autocorrelation with pre-processing
 */
export class EnhancedAutocorrelation extends Autocorrelation {
    private preProcess: boolean;
    
    constructor(sampleRate: number = 44100, minFrequency: number = 50, maxFrequency: number = 4000) {
        super(sampleRate, minFrequency, maxFrequency);
        this.preProcess = true;
    }
    
    /**
     * Detect pitch with pre-processing
     * @param buffer Audio buffer
     * @returns Detected frequency and confidence
     */
    public detectPitch(buffer: Float32Array): { frequency: number; confidence: number } {
        let processedBuffer = buffer;
        
        if (this.preProcess) {
            // Apply high-pass filter to remove DC offset
            processedBuffer = this.removeDCOffset(buffer);
            
            // Apply window to reduce edge effects
            processedBuffer = this.applyWindow(processedBuffer, 'hann');
        }
        
        return super.detectPitch(processedBuffer);
    }
    
    /**
     * Remove DC offset from signal
     * @param buffer Input buffer
     * @returns Buffer with DC offset removed
     */
    private removeDCOffset(buffer: Float32Array): Float32Array {
        const result = new Float32Array(buffer.length);
        
        // Calculate mean
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
        }
        const mean = sum / buffer.length;
        
        // Subtract mean
        for (let i = 0; i < buffer.length; i++) {
            result[i] = buffer[i] - mean;
        }
        
        return result;
    }
    
    /**
     * Enable or disable pre-processing
     * @param enable Enable pre-processing
     */
    public setPreProcessing(enable: boolean): void {
        this.preProcess = enable;
    }
}

export default Autocorrelation;