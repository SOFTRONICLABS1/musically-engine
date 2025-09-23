/**
 * Noise reduction module for audio processing
 * Implements spectral subtraction and adaptive noise filtering
 */

import { FFT } from '../algorithms/FFT';
import { WindowFunctions } from '../utils/WindowFunctions';
import { MathUtils } from '../utils/MathUtils';

export interface NoiseReductionConfig {
    enabled: boolean;
    aggressiveness: number;      // 0.0 to 1.0
    noiseFloorDb: number;        // dB threshold
    spectralSmoothing: number;   // smoothing factor
    adaptiveMode: boolean;       // auto-adjust to changing noise
    windowSize: number;          // FFT window size
    overlapRatio: number;        // overlap between windows
}

export class NoiseReducer {
    private config: NoiseReductionConfig;
    private fft: FFT;
    private noiseProfile: Float32Array | null = null;
    private sampleRate: number;
    private isLearning: boolean = false;
    private learningFrames: number = 0;
    private targetLearningFrames: number;
    private spectralHistory: Float32Array[] = [];
    private maxHistoryFrames: number = 10;
    
    constructor(sampleRate: number = 44100, config?: Partial<NoiseReductionConfig>) {
        this.sampleRate = sampleRate;
        this.config = {
            enabled: true,
            aggressiveness: 0.6,
            noiseFloorDb: -40,
            spectralSmoothing: 0.8,
            adaptiveMode: true,
            windowSize: 2048,
            overlapRatio: 0.5,
            ...config
        };
        
        this.fft = new FFT(this.config.windowSize, sampleRate);
        this.targetLearningFrames = Math.ceil(sampleRate / (this.config.windowSize * (1 - this.config.overlapRatio)));
    }
    
    /**
     * Process audio buffer with noise reduction
     * @param buffer Input audio buffer
     * @returns Processed audio buffer
     */
    public process(buffer: Float32Array): Float32Array {
        if (!this.config.enabled) {
            return buffer;
        }
        
        // Process using overlap-add method
        return this.processOverlapAdd(buffer);
    }
    
    /**
     * Process using overlap-add method for better quality
     * @param buffer Input buffer
     * @returns Processed buffer
     */
    private processOverlapAdd(buffer: Float32Array): Float32Array {
        const windowSize = this.config.windowSize;
        const hopSize = Math.floor(windowSize * (1 - this.config.overlapRatio));
        const numFrames = Math.ceil((buffer.length - windowSize) / hopSize) + 1;
        const outputLength = buffer.length;
        const output = new Float32Array(outputLength);
        
        // Window function for overlap-add
        const window = WindowFunctions.create('hann', windowSize);
        
        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * hopSize;
            const end = Math.min(start + windowSize, buffer.length);
            
            if (end - start < windowSize) {
                // Zero-pad last frame if necessary
                const frameBuffer = new Float32Array(windowSize);
                frameBuffer.set(buffer.slice(start, end));
                const processedFrame = this.processFrame(frameBuffer, window);
                
                // Add to output with proper bounds checking
                for (let i = 0; i < end - start; i++) {
                    if (start + i < outputLength) {
                        output[start + i] += processedFrame[i];
                    }
                }
            } else {
                const frameBuffer = buffer.slice(start, end);
                const processedFrame = this.processFrame(frameBuffer, window);
                
                // Add to output
                for (let i = 0; i < windowSize && start + i < outputLength; i++) {
                    output[start + i] += processedFrame[i];
                }
            }
        }
        
        return output;
    }
    
    /**
     * Process a single frame
     * @param frame Audio frame
     * @param window Window function
     * @returns Processed frame
     */
    private processFrame(frame: Float32Array, window: Float32Array): Float32Array {
        // Apply window
        const windowed = WindowFunctions.apply(frame, window);
        
        // Transform to frequency domain
        const { real, imag } = this.fft.forward(windowed);
        const magnitude = this.fft.getMagnitudeSpectrum(real, imag);
        const phase = this.calculatePhase(real, imag);
        
        // Update noise profile if in learning mode
        if (this.isLearning) {
            this.updateNoiseProfile(magnitude);
        }
        
        // Apply spectral subtraction
        const processedMagnitude = this.spectralSubtraction(magnitude);
        
        // Reconstruct signal
        const processedFrame = this.reconstructSignal(processedMagnitude, phase, window);
        
        return processedFrame;
    }
    
    /**
     * Start learning noise profile
     * @param durationMs Duration in milliseconds to learn noise
     */
    public startNoiseLearning(durationMs: number = 1000): void {
        this.isLearning = true;
        this.learningFrames = 0;
        this.targetLearningFrames = Math.ceil(durationMs * this.sampleRate / 1000 / 
                                            (this.config.windowSize * (1 - this.config.overlapRatio)));
        this.noiseProfile = null;
        this.spectralHistory = [];
    }
    
    /**
     * Stop learning noise profile
     */
    public stopNoiseLearning(): void {
        this.isLearning = false;
        this.finalizeNoiseProfile();
    }
    
    /**
     * Check if currently learning noise profile
     */
    public isLearningNoise(): boolean {
        return this.isLearning;
    }
    
    /**
     * Update noise profile during learning phase
     * @param magnitude Current magnitude spectrum
     */
    private updateNoiseProfile(magnitude: Float32Array): void {
        if (!this.isLearning) return;
        
        // Store spectrum for averaging
        this.spectralHistory.push(new Float32Array(magnitude));
        
        // Limit history size
        if (this.spectralHistory.length > this.maxHistoryFrames) {
            this.spectralHistory.shift();
        }
        
        this.learningFrames++;
        
        // Auto-stop learning when target reached
        if (this.learningFrames >= this.targetLearningFrames) {
            this.stopNoiseLearning();
        }
    }
    
    /**
     * Finalize noise profile by averaging collected spectra
     */
    private finalizeNoiseProfile(): void {
        if (this.spectralHistory.length === 0) return;
        
        const spectrumLength = this.spectralHistory[0].length;
        this.noiseProfile = new Float32Array(spectrumLength);
        
        // Average all collected spectra
        for (let bin = 0; bin < spectrumLength; bin++) {
            let sum = 0;
            for (const spectrum of this.spectralHistory) {
                sum += spectrum[bin];
            }
            this.noiseProfile[bin] = sum / this.spectralHistory.length;
        }
        
        // Apply smoothing to noise profile
        this.noiseProfile = MathUtils.exponentialSmoothing(this.noiseProfile, 0.8);
    }
    
    /**
     * Apply spectral subtraction
     * @param magnitude Current magnitude spectrum
     * @returns Processed magnitude spectrum
     */
    private spectralSubtraction(magnitude: Float32Array): Float32Array {
        if (!this.noiseProfile) {
            return magnitude; // No noise profile available
        }
        
        const processed = new Float32Array(magnitude.length);
        const alpha = this.config.aggressiveness;
        const beta = 0.01; // Over-subtraction factor
        
        for (let i = 0; i < magnitude.length; i++) {
            // Spectral subtraction formula
            const noiseEstimate = this.noiseProfile[i] * alpha;
            let subtracted = magnitude[i] - noiseEstimate;
            
            // Apply spectral floor (prevent over-subtraction)
            const floor = beta * magnitude[i];
            processed[i] = Math.max(subtracted, floor);
        }
        
        // Apply spectral smoothing
        if (this.config.spectralSmoothing > 0) {
            return MathUtils.exponentialSmoothing(processed, this.config.spectralSmoothing);
        }
        
        return processed;
    }
    
    /**
     * Calculate phase from complex FFT result
     * @param real Real component
     * @param imag Imaginary component
     * @returns Phase array
     */
    private calculatePhase(real: Float32Array, imag: Float32Array): Float32Array {
        const phase = new Float32Array(real.length);
        
        for (let i = 0; i < real.length; i++) {
            phase[i] = Math.atan2(imag[i], real[i]);
        }
        
        return phase;
    }
    
    /**
     * Reconstruct signal from magnitude and phase
     * @param magnitude Processed magnitude spectrum
     * @param phase Phase spectrum
     * @param window Window function
     * @returns Reconstructed time-domain signal
     */
    private reconstructSignal(magnitude: Float32Array, phase: Float32Array, window: Float32Array): Float32Array {
        // Reconstruct complex spectrum
        const real = new Float32Array(magnitude.length);
        const imag = new Float32Array(magnitude.length);
        
        for (let i = 0; i < magnitude.length; i++) {
            real[i] = magnitude[i] * Math.cos(phase[i]);
            imag[i] = magnitude[i] * Math.sin(phase[i]);
        }
        
        // Create full spectrum (conjugate for IFFT)
        const fullReal = new Float32Array(this.config.windowSize);
        const fullImag = new Float32Array(this.config.windowSize);
        
        // Copy positive frequencies
        for (let i = 0; i < magnitude.length && i < this.config.windowSize / 2; i++) {
            fullReal[i] = real[i];
            fullImag[i] = imag[i];
        }
        
        // Mirror for negative frequencies (conjugate symmetry)
        for (let i = 1; i < magnitude.length && i < this.config.windowSize / 2; i++) {
            const mirrorIndex = this.config.windowSize - i;
            fullReal[mirrorIndex] = real[i];
            fullImag[mirrorIndex] = -imag[i];
        }
        
        // Inverse FFT (simplified - assumes FFT class has inverse method)
        const timeSignal = this.inverseFFT(fullReal, fullImag);
        
        // Apply window for overlap-add
        WindowFunctions.applyInPlace(timeSignal, window);
        
        return timeSignal;
    }
    
    /**
     * Simplified inverse FFT (placeholder - would use proper IFFT implementation)
     * @param real Real component
     * @param imag Imaginary component
     * @returns Time-domain signal
     */
    private inverseFFT(real: Float32Array, imag: Float32Array): Float32Array {
        // This is a simplified placeholder
        // In a real implementation, you would use a proper IFFT algorithm
        const result = new Float32Array(real.length);
        
        for (let n = 0; n < result.length; n++) {
            let sumReal = 0;
            let sumImag = 0;
            
            for (let k = 0; k < real.length; k++) {
                const angle = 2 * Math.PI * k * n / real.length;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                
                sumReal += real[k] * cos - imag[k] * sin;
                sumImag += real[k] * sin + imag[k] * cos;
            }
            
            result[n] = sumReal / real.length;
        }
        
        return result;
    }
    
    /**
     * Set noise reduction configuration
     * @param config New configuration
     */
    public setConfig(config: Partial<NoiseReductionConfig>): void {
        this.config = { ...this.config, ...config };
        
        // Recreate FFT if window size changed
        if (config.windowSize && config.windowSize !== this.fft.getSize()) {
            this.fft = new FFT(config.windowSize, this.sampleRate);
        }
    }
    
    /**
     * Get current configuration
     */
    public getConfig(): NoiseReductionConfig {
        return { ...this.config };
    }
    
    /**
     * Reset noise profile
     */
    public resetNoiseProfile(): void {
        this.noiseProfile = null;
        this.spectralHistory = [];
        this.isLearning = false;
        this.learningFrames = 0;
    }
    
    /**
     * Enable/disable noise reduction
     * @param enabled Enable state
     */
    public setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }
    
    /**
     * Check if noise reduction is enabled
     */
    public isEnabled(): boolean {
        return this.config.enabled;
    }
    
    /**
     * Get noise profile status
     */
    public getNoiseProfileStatus(): {
        hasProfile: boolean;
        isLearning: boolean;
        learningProgress: number;
    } {
        return {
            hasProfile: this.noiseProfile !== null,
            isLearning: this.isLearning,
            learningProgress: this.targetLearningFrames > 0 ? 
                           this.learningFrames / this.targetLearningFrames : 0
        };
    }
}

export default NoiseReducer;