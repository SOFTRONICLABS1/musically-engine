/**
 * Enhanced Noise Reduction Module for Audio Processing
 * Implements advanced spectral subtraction, psychoacoustic modeling,
 * adaptive noise filtering, and musical noise suppression
 */

import { FFT } from '../algorithms/FFT';
import { WindowFunctions } from '../utils/WindowFunctions';
import { MathUtils } from '../utils/MathUtils';
import { PsychoacousticModel, MaskingThresholds } from '../utils/PsychoacousticModel';

export interface NoiseReductionConfig {
    enabled: boolean;
    aggressiveness: number;           // 0.0 to 1.0
    noiseFloorDb: number;            // dB threshold
    spectralSmoothing: number;       // smoothing factor
    adaptiveMode: boolean;           // auto-adjust to changing noise
    windowSize: number;              // FFT window size
    overlapRatio: number;            // overlap between windows
    
    // Enhanced features
    enablePsychoacoustic: boolean;   // Enable psychoacoustic masking
    enableMusicalNoiseSuppression: boolean; // Suppress musical artifacts
    enableAdaptiveLearning: boolean; // Real-time noise environment adaptation
    noiseEnvironmentDetection: boolean; // Auto-detect noise environment
    qualityMode: 'fast' | 'balanced' | 'high'; // Processing quality
    
    // Advanced parameters
    maskingThreshold: number;        // dB threshold for masking
    musicalNoiseThreshold: number;   // Threshold for musical noise detection
    adaptationRate: number;          // Learning rate for adaptive mode (0-1)
    environmentSwitchThreshold: number; // Threshold for environment detection
}

export type NoiseEnvironmentType = 'studio' | 'live' | 'outdoor' | 'vehicle' | 'office' | 'unknown';

export interface NoiseAnalysis {
    environmentType: NoiseEnvironmentType;
    noiseLevel: number;              // dB
    spectralCharacteristics: {
        lowFreqEnergy: number;       // Energy below 500Hz
        midFreqEnergy: number;       // Energy 500Hz-4kHz
        highFreqEnergy: number;      // Energy above 4kHz
        spectralSpread: number;      // Frequency distribution spread
        tonalComponents: number[];   // Detected tonal noise frequencies
    };
    confidence: number;              // Environment detection confidence
}

export interface ProcessingStats {
    averageReduction: number;        // Average noise reduction applied (dB)
    qualityScore: number;            // Perceptual quality score (0-1)
    processingLatency: number;       // Processing time (ms)
    memoryUsage: number;             // Estimated memory usage (MB)
    environmentDetectionAccuracy: number; // Environment detection accuracy
}

export class NoiseReducer {
    private config: NoiseReductionConfig;
    private fft: FFT;
    private psychoacousticModel: PsychoacousticModel;
    private noiseProfile: Float32Array | null = null;
    private sampleRate: number;
    private isLearning: boolean = false;
    private learningFrames: number = 0;
    private targetLearningFrames: number;
    private spectralHistory: Float32Array[] = [];
    private maxHistoryFrames: number = 20;
    
    // Enhanced adaptive learning
    private environmentProfiles: Map<NoiseEnvironmentType, Float32Array> = new Map();
    private currentEnvironment: NoiseEnvironmentType = 'unknown';
    private environmentHistory: NoiseAnalysis[] = [];
    private adaptiveLearningBuffer: Float32Array[] = [];
    private qualityHistory: number[] = [];
    private previousSpectrum: Float32Array | null = null;
    private processingStats: ProcessingStats;
    
    // Musical noise suppression
    private spectralFluxHistory: number[] = [];
    private tonalityEstimate: number = 0;
    
    // Buffer pool for performance optimization
    private bufferPool: Map<number, Float32Array[]> = new Map();
    private maxPoolSize = 10; // Maximum buffers per size
    
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
            
            // Enhanced features
            enablePsychoacoustic: true,
            enableMusicalNoiseSuppression: true,
            enableAdaptiveLearning: true,
            noiseEnvironmentDetection: true,
            qualityMode: 'balanced',
            
            // Advanced parameters
            maskingThreshold: -20,
            musicalNoiseThreshold: 0.3,
            adaptationRate: 0.1,
            environmentSwitchThreshold: 0.7,
            ...config
        };
        
        this.fft = new FFT(this.config.windowSize, sampleRate);
        this.psychoacousticModel = new PsychoacousticModel({
            sampleRate,
            fftSize: this.config.windowSize,
            enableTemporalMasking: true,
            enableSimultaneousMasking: true,
            maskingThreshold: this.config.maskingThreshold
        });
        
        this.targetLearningFrames = Math.ceil(sampleRate / (this.config.windowSize * (1 - this.config.overlapRatio)));
        
        // Initialize processing stats
        this.processingStats = {
            averageReduction: 0,
            qualityScore: 0,
            processingLatency: 0,
            memoryUsage: 0,
            environmentDetectionAccuracy: 0
        };
        
        this.initializeEnvironmentProfiles();
    }
    
    /**
     * Get a buffer from the pool or create a new one
     * @param size Buffer size needed
     * @returns Pooled or new Float32Array
     */
    private getPooledBuffer(size: number): Float32Array {
        if (!this.bufferPool.has(size)) {
            this.bufferPool.set(size, []);
        }
        
        const pool = this.bufferPool.get(size)!;
        if (pool.length > 0) {
            const buffer = pool.pop()!;
            buffer.fill(0); // Clear the buffer
            return buffer;
        }
        
        return new Float32Array(size);
    }
    
    /**
     * Return a buffer to the pool for reuse
     * @param buffer Buffer to return to pool
     */
    private returnBufferToPool(buffer: Float32Array): void {
        const size = buffer.length;
        if (!this.bufferPool.has(size)) {
            this.bufferPool.set(size, []);
        }
        
        const pool = this.bufferPool.get(size)!;
        if (pool.length < this.maxPoolSize) {
            pool.push(buffer);
        }
        // If pool is full, let buffer be garbage collected
    }
    
    /**
     * Clear the buffer pool to free memory
     */
    private clearBufferPool(): void {
        this.bufferPool.clear();
    }
    
    /**
     * Enhanced process audio buffer with advanced noise reduction
     * @param buffer Input audio buffer
     * @returns Processed audio buffer with enhanced quality
     */
    public process(buffer: Float32Array): Float32Array {
        if (!this.config.enabled) {
            return buffer;
        }
        
        const startTime = performance.now();
        
        // Process using enhanced overlap-add method
        const processedBuffer = this.processEnhancedOverlapAdd(buffer);
        
        // Update processing stats
        this.processingStats.processingLatency = performance.now() - startTime;
        this.updateProcessingStats();
        
        return processedBuffer;
    }
    
    /**
     * Enhanced overlap-add processing with psychoacoustic modeling
     * @param buffer Input buffer
     * @returns Enhanced processed buffer
     */
    private processEnhancedOverlapAdd(buffer: Float32Array): Float32Array {
        const windowSize = this.config.windowSize;
        const hopSize = Math.floor(windowSize * (1 - this.config.overlapRatio));
        const numFrames = Math.ceil((buffer.length - windowSize) / hopSize) + 1;
        const outputLength = buffer.length;
        const output = this.getPooledBuffer(outputLength);
        
        // Window function for overlap-add
        const window = WindowFunctions.create('hann', windowSize);
        
        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * hopSize;
            const end = Math.min(start + windowSize, buffer.length);
            
            if (end - start < windowSize) {
                // Zero-pad last frame if necessary
                const frameBuffer = this.getPooledBuffer(windowSize);
                frameBuffer.set(buffer.slice(start, end));
                const processedFrame = this.processEnhancedFrame(frameBuffer, window);
                
                // Add to output with proper bounds checking
                for (let i = 0; i < end - start; i++) {
                    if (start + i < outputLength) {
                        output[start + i] += processedFrame[i];
                    }
                }
            } else {
                const frameBuffer = buffer.slice(start, end);
                const processedFrame = this.processEnhancedFrame(frameBuffer, window);
                
                // Add to output
                for (let i = 0; i < windowSize && start + i < outputLength; i++) {
                    output[start + i] += processedFrame[i];
                }
            }
        }
        
        return output;
    }
    
    /**
     * Process a single frame with enhanced algorithms
     * @param frame Audio frame
     * @param window Window function
     * @returns Enhanced processed frame
     */
    private processEnhancedFrame(frame: Float32Array, window: Float32Array): Float32Array {
        // Apply window
        const windowed = WindowFunctions.apply(frame, window);
        
        // Transform to frequency domain
        const { real, imag } = this.fft.forward(windowed);
        const magnitude = this.fft.getMagnitudeSpectrum(real, imag);
        const phase = this.calculatePhase(real, imag);
        
        // Adaptive environment detection and learning
        if (this.config.noiseEnvironmentDetection) {
            const noiseAnalysis = this.analyzeNoiseEnvironment(magnitude);
            this.updateEnvironmentAdaptation(noiseAnalysis);
        }
        
        // Update noise profile if in learning mode
        if (this.isLearning) {
            this.updateNoiseProfile(magnitude);
        }
        
        // Apply enhanced spectral processing
        let processedMagnitude = magnitude;
        
        // 1. Psychoacoustic masking-aware processing
        if (this.config.enablePsychoacoustic && this.noiseProfile) {
            processedMagnitude = this.applyPsychoacousticProcessing(processedMagnitude);
        }
        
        // 2. Standard spectral subtraction with improvements
        processedMagnitude = this.enhancedSpectralSubtraction(processedMagnitude);
        
        // 3. Musical noise suppression
        if (this.config.enableMusicalNoiseSuppression) {
            processedMagnitude = this.suppressMusicalNoise(processedMagnitude, magnitude);
        }
        
        // 4. Adaptive parameter optimization
        if (this.config.enableAdaptiveLearning) {
            processedMagnitude = this.applyAdaptiveOptimization(processedMagnitude, magnitude);
        }
        
        // Store for next frame (temporal masking)
        this.previousSpectrum = magnitude;
        
        // Reconstruct signal
        const processedFrame = this.reconstructSignal(processedMagnitude, phase, window);
        
        return processedFrame;
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
     * Optimized inverse FFT using enhanced FFT implementation
     * @param real Real component
     * @param imag Imaginary component
     * @returns Time-domain signal
     */
    private inverseFFT(real: Float32Array, imag: Float32Array): Float32Array {
        // Use optimized O(N log N) IFFT from enhanced FFT class
        return this.fft.inverse(real, imag);
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
    
    // ============================================================================
    // ENHANCED METHODS - New functionality for production-grade noise reduction
    // ============================================================================
    
    /**
     * Initialize environment-specific noise profiles
     */
    private initializeEnvironmentProfiles(): void {
        // Initialize with typical noise profiles for different environments
        const environments: NoiseEnvironmentType[] = ['studio', 'live', 'outdoor', 'vehicle', 'office'];
        
        environments.forEach(env => {
            const profile = this.createDefaultEnvironmentProfile(env);
            this.environmentProfiles.set(env, profile);
        });
    }
    
    /**
     * Create default noise profile for environment type
     */
    private createDefaultEnvironmentProfile(envType: NoiseEnvironmentType): Float32Array {
        const profileSize = this.config.windowSize / 2;
        const profile = new Float32Array(profileSize);
        const binWidth = this.sampleRate / this.config.windowSize;
        
        // Create characteristic noise profiles based on environment
        for (let i = 0; i < profileSize; i++) {
            const frequency = i * binWidth;
            
            switch (envType) {
                case 'studio':
                    // Low, uniform noise floor
                    profile[i] = 0.001 * (1 + 0.1 * Math.random());
                    break;
                    
                case 'live':
                    // Higher noise with mid-frequency emphasis
                    profile[i] = 0.01 * (1 + 0.5 * Math.exp(-Math.pow((frequency - 1000) / 500, 2)));
                    break;
                    
                case 'outdoor':
                    // Wind noise (low-frequency emphasis) + ambient
                    profile[i] = 0.02 * Math.exp(-frequency / 200) + 0.005;
                    break;
                    
                case 'vehicle':
                    // Engine noise (low-frequency) + road noise
                    profile[i] = 0.05 * Math.exp(-frequency / 100) + 0.01 * (frequency / 1000);
                    break;
                    
                case 'office':
                    // Air conditioning, electronics - mid-range emphasis
                    profile[i] = 0.005 * (1 + 0.3 * Math.exp(-Math.pow((frequency - 200) / 100, 2)));
                    break;
                    
                default:
                    profile[i] = 0.01;
            }
        }
        
        return profile;
    }
    
    /**
     * Analyze noise environment characteristics
     */
    private analyzeNoiseEnvironment(spectrum: Float32Array): NoiseAnalysis {
        const binWidth = this.sampleRate / this.config.windowSize;
        
        // Calculate energy distribution
        let lowFreqEnergy = 0, midFreqEnergy = 0, highFreqEnergy = 0;
        let totalEnergy = 0;
        const tonalComponents: number[] = [];
        
        for (let i = 0; i < spectrum.length; i++) {
            const frequency = i * binWidth;
            const energy = spectrum[i] * spectrum[i];
            totalEnergy += energy;
            
            if (frequency < 500) {
                lowFreqEnergy += energy;
            } else if (frequency < 4000) {
                midFreqEnergy += energy;
            } else {
                highFreqEnergy += energy;
            }
            
            // Detect tonal components (peaks)
            if (i > 2 && i < spectrum.length - 2) {
                if (spectrum[i] > spectrum[i-1] && spectrum[i] > spectrum[i+1] &&
                    spectrum[i] > spectrum[i-2] && spectrum[i] > spectrum[i+2] &&
                    spectrum[i] > 0.01) {
                    tonalComponents.push(frequency);
                }
            }
        }
        
        // Normalize energies
        if (totalEnergy > 0) {
            lowFreqEnergy /= totalEnergy;
            midFreqEnergy /= totalEnergy;
            highFreqEnergy /= totalEnergy;
        }
        
        // Calculate spectral spread
        let spectralCentroid = 0, spectralSpread = 0;
        for (let i = 0; i < spectrum.length; i++) {
            spectralCentroid += (i * binWidth) * spectrum[i];
        }
        spectralCentroid /= spectrum.reduce((sum, val) => sum + val, 0);
        
        for (let i = 0; i < spectrum.length; i++) {
            spectralSpread += Math.pow((i * binWidth) - spectralCentroid, 2) * spectrum[i];
        }
        spectralSpread = Math.sqrt(spectralSpread / spectrum.reduce((sum, val) => sum + val, 0));
        
        // Classify environment
        const environmentType = this.classifyEnvironment(
            lowFreqEnergy, midFreqEnergy, highFreqEnergy, spectralSpread, tonalComponents.length
        );
        
        // Calculate noise level
        const noiseLevel = 10 * Math.log10(totalEnergy / spectrum.length + 1e-10);
        
        return {
            environmentType,
            noiseLevel,
            spectralCharacteristics: {
                lowFreqEnergy,
                midFreqEnergy,
                highFreqEnergy,
                spectralSpread,
                tonalComponents
            },
            confidence: this.calculateEnvironmentConfidence(environmentType, spectrum)
        };
    }
    
    /**
     * Classify environment based on spectral characteristics
     */
    private classifyEnvironment(
        lowFreq: number, 
        midFreq: number, 
        highFreq: number, 
        spread: number, 
        tonalCount: number
    ): NoiseEnvironmentType {
        // Simple heuristic classification
        if (lowFreq > 0.6 && tonalCount < 3) {
            return 'vehicle'; // High low-frequency energy, few tones
        } else if (lowFreq > 0.4 && spread > 1000) {
            return 'outdoor'; // Wind noise characteristics
        } else if (midFreq > 0.5 && tonalCount > 5) {
            return 'live'; // Mid-frequency emphasis with many tones
        } else if (lowFreq < 0.3 && midFreq < 0.4 && highFreq < 0.3) {
            return 'studio'; // Low overall noise
        } else if (tonalCount >= 3 && tonalCount <= 6) {
            return 'office'; // Moderate tonal content
        }
        
        return 'unknown';
    }
    
    /**
     * Calculate confidence in environment classification
     */
    private calculateEnvironmentConfidence(envType: NoiseEnvironmentType, spectrum: Float32Array): number {
        if (envType === 'unknown') return 0.1;
        
        const referenceProfile = this.environmentProfiles.get(envType);
        if (!referenceProfile) return 0.5;
        
        // Calculate correlation with reference profile
        let correlation = 0;
        let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
        
        const minLen = Math.min(spectrum.length, referenceProfile.length);
        for (let i = 0; i < minLen; i++) {
            const a = spectrum[i];
            const b = referenceProfile[i];
            
            sumA += a;
            sumB += b;
            sumAB += a * b;
            sumA2 += a * a;
            sumB2 += b * b;
        }
        
        const denominator = Math.sqrt((minLen * sumA2 - sumA * sumA) * (minLen * sumB2 - sumB * sumB));
        if (denominator > 0) {
            correlation = (minLen * sumAB - sumA * sumB) / denominator;
        }
        
        return Math.max(0.1, Math.min(1.0, (correlation + 1) / 2)); // Normalize to 0-1
    }
    
    /**
     * Update environment adaptation based on analysis
     */
    private updateEnvironmentAdaptation(analysis: NoiseAnalysis): void {
        this.environmentHistory.push(analysis);
        
        // Maintain history size
        if (this.environmentHistory.length > 50) {
            this.environmentHistory.shift();
        }
        
        // Check for environment switch
        if (analysis.confidence > this.config.environmentSwitchThreshold) {
            if (analysis.environmentType !== this.currentEnvironment) {
                this.switchEnvironment(analysis.environmentType);
            }
        }
        
        // Update current environment profile if in adaptive learning mode
        if (this.config.enableAdaptiveLearning) {
            this.adaptEnvironmentProfile(analysis);
        }
    }
    
    /**
     * Switch to different environment profile
     */
    private switchEnvironment(newEnvironment: NoiseEnvironmentType): void {
        this.currentEnvironment = newEnvironment;
        
        // Load environment-specific noise profile
        const envProfile = this.environmentProfiles.get(newEnvironment);
        if (envProfile) {
            this.noiseProfile = new Float32Array(envProfile);
        }
        
        // Adjust parameters for environment
        this.adjustParametersForEnvironment(newEnvironment);
    }
    
    /**
     * Adjust processing parameters for specific environment
     */
    private adjustParametersForEnvironment(envType: NoiseEnvironmentType): void {
        switch (envType) {
            case 'studio':
                this.config.aggressiveness = 0.8; // Can be more aggressive in clean environment
                this.config.spectralSmoothing = 0.9;
                break;
                
            case 'live':
                this.config.aggressiveness = 0.5; // Conservative to preserve music
                this.config.spectralSmoothing = 0.7;
                break;
                
            case 'outdoor':
                this.config.aggressiveness = 0.7; // Moderate for wind noise
                this.config.spectralSmoothing = 0.8;
                break;
                
            case 'vehicle':
                this.config.aggressiveness = 0.6; // Balance for engine noise
                this.config.spectralSmoothing = 0.75;
                break;
                
            case 'office':
                this.config.aggressiveness = 0.65;
                this.config.spectralSmoothing = 0.8;
                break;
        }
    }
    
    /**
     * Adapt environment profile based on recent analysis
     */
    private adaptEnvironmentProfile(analysis: NoiseAnalysis): void {
        if (!this.noiseProfile) return;
        
        // Simple exponential moving average adaptation
        const adaptRate = this.config.adaptationRate * analysis.confidence;
        
        // This is a simplified adaptation - in practice, you'd want more sophisticated methods
        for (let i = 0; i < this.noiseProfile.length; i++) {
            if (i < analysis.spectralCharacteristics.tonalComponents.length) {
                const tonal = analysis.spectralCharacteristics.tonalComponents[i];
                const binIndex = Math.round(tonal / (this.sampleRate / this.config.windowSize));
                if (binIndex < this.noiseProfile.length) {
                    this.noiseProfile[binIndex] = (1 - adaptRate) * this.noiseProfile[binIndex] + 
                                                adaptRate * tonal;
                }
            }
        }
    }
    
    /**
     * Apply psychoacoustic processing
     */
    private applyPsychoacousticProcessing(magnitude: Float32Array): Float32Array {
        if (!this.noiseProfile) return magnitude;
        
        // Calculate masking thresholds
        const maskingThresholds = this.psychoacousticModel.calculateMaskingThresholds(
            magnitude, this.previousSpectrum || undefined
        );
        
        // Apply perceptual masking to determine noise reduction factors
        const reductionFactors = this.psychoacousticModel.applyPerceptualMasking(
            magnitude, this.noiseProfile, maskingThresholds
        );
        
        // Apply reduction factors
        const processed = new Float32Array(magnitude.length);
        for (let i = 0; i < magnitude.length; i++) {
            processed[i] = magnitude[i] * reductionFactors[i];
        }
        
        return processed;
    }
    
    /**
     * Enhanced spectral subtraction with better artifacts suppression
     */
    private enhancedSpectralSubtraction(magnitude: Float32Array): Float32Array {
        if (!this.noiseProfile) {
            return magnitude; // No noise profile available
        }
        
        const processed = new Float32Array(magnitude.length);
        const alpha = this.config.aggressiveness;
        const beta = 0.01; // Over-subtraction factor
        const gamma = 0.005; // Residual noise factor
        
        for (let i = 0; i < magnitude.length; i++) {
            // Enhanced spectral subtraction with residual noise modeling
            const noiseEstimate = this.noiseProfile[i] * alpha;
            let subtracted = magnitude[i] - noiseEstimate;
            
            // Multi-band spectral floor to prevent over-subtraction
            const adaptiveFloor = Math.max(
                beta * magnitude[i],
                gamma * this.noiseProfile[i],
                0.01 * magnitude[i]
            );
            
            processed[i] = Math.max(subtracted, adaptiveFloor);
        }
        
        // Apply enhanced spectral smoothing
        return this.enhancedSpectralSmoothing(processed);
    }
    
    /**
     * Enhanced spectral smoothing with frequency-dependent parameters
     */
    private enhancedSpectralSmoothing(spectrum: Float32Array): Float32Array {
        if (this.config.spectralSmoothing <= 0) return spectrum;
        
        const smoothed = new Float32Array(spectrum);
        const binWidth = this.sampleRate / this.config.windowSize;
        
        // Frequency-dependent smoothing
        for (let i = 1; i < spectrum.length - 1; i++) {
            const frequency = i * binWidth;
            
            // More smoothing at high frequencies where artifacts are more noticeable
            let smoothingFactor = this.config.spectralSmoothing;
            if (frequency > 4000) {
                smoothingFactor = Math.min(0.95, smoothingFactor + 0.1);
            }
            
            smoothed[i] = (1 - smoothingFactor) * spectrum[i] + 
                         smoothingFactor * (spectrum[i-1] + spectrum[i+1]) / 2;
        }
        
        return smoothed;
    }
    
    /**
     * Suppress musical noise artifacts
     */
    private suppressMusicalNoise(processed: Float32Array, original: Float32Array): Float32Array {
        // Calculate spectral flux (measure of spectral change)
        let spectralFlux = 0;
        if (this.previousSpectrum) {
            for (let i = 0; i < processed.length; i++) {
                const diff = processed[i] - (this.previousSpectrum[i] || 0);
                spectralFlux += Math.max(0, diff); // Only positive changes
            }
            spectralFlux /= processed.length;
        }
        
        this.spectralFluxHistory.push(spectralFlux);
        if (this.spectralFluxHistory.length > 10) {
            this.spectralFluxHistory.shift();
        }
        
        // Detect musical noise based on spectral flux patterns
        const avgFlux = this.spectralFluxHistory.reduce((sum, val) => sum + val, 0) / this.spectralFluxHistory.length;
        const fluxVariance = this.spectralFluxHistory.reduce((sum, val) => sum + Math.pow(val - avgFlux, 2), 0) / this.spectralFluxHistory.length;
        
        if (fluxVariance > this.config.musicalNoiseThreshold) {
            // Apply musical noise suppression
            const suppressed = new Float32Array(processed.length);
            
            for (let i = 0; i < processed.length; i++) {
                // Blend with original based on local spectral stability
                const localVariation = Math.abs(processed[i] - original[i]) / (original[i] + 1e-10);
                const suppressionFactor = Math.min(1.0, localVariation / this.config.musicalNoiseThreshold);
                
                suppressed[i] = (1 - suppressionFactor) * processed[i] + suppressionFactor * original[i] * 0.5;
            }
            
            return suppressed;
        }
        
        return processed;
    }
    
    /**
     * Apply adaptive parameter optimization
     */
    private applyAdaptiveOptimization(processed: Float32Array, original: Float32Array): Float32Array {
        // Calculate quality metrics
        if (this.previousSpectrum) {
            const maskingThresholds = this.psychoacousticModel.calculateMaskingThresholds(original);
            const quality = this.psychoacousticModel.calculatePerceptualQuality(
                original, processed, maskingThresholds
            );
            
            this.qualityHistory.push(quality);
            if (this.qualityHistory.length > 20) {
                this.qualityHistory.shift();
            }
            
            // Adjust parameters based on quality trend
            const recentQuality = this.qualityHistory.slice(-5).reduce((sum, val) => sum + val, 0) / 5;
            const overallQuality = this.qualityHistory.reduce((sum, val) => sum + val, 0) / this.qualityHistory.length;
            
            if (recentQuality < overallQuality - 0.1) {
                // Quality is decreasing, reduce aggressiveness
                this.config.aggressiveness = Math.max(0.2, this.config.aggressiveness - 0.05);
            } else if (recentQuality > overallQuality + 0.1) {
                // Quality is improving, can be more aggressive
                this.config.aggressiveness = Math.min(0.9, this.config.aggressiveness + 0.02);
            }
        }
        
        return processed;
    }
    
    /**
     * Update processing statistics
     */
    private updateProcessingStats(): void {
        // Update quality score
        if (this.qualityHistory.length > 0) {
            this.processingStats.qualityScore = this.qualityHistory[this.qualityHistory.length - 1];
        }
        
        // Update environment detection accuracy
        if (this.environmentHistory.length > 0) {
            this.processingStats.environmentDetectionAccuracy = 
                this.environmentHistory.reduce((sum, analysis) => sum + analysis.confidence, 0) / 
                this.environmentHistory.length;
        }
        
        // Estimate memory usage (simplified)
        const bufferMemory = (this.spectralHistory.length * this.config.windowSize * 4) / (1024 * 1024); // MB
        const profileMemory = (this.environmentProfiles.size * this.config.windowSize * 4) / (1024 * 1024); // MB
        this.processingStats.memoryUsage = bufferMemory + profileMemory;
        
        // Calculate average reduction (simplified)
        if (this.qualityHistory.length > 0) {
            this.processingStats.averageReduction = (1 - this.processingStats.qualityScore) * 20; // Approximate dB
        }
    }
    
    /**
     * Get current processing statistics
     */
    public getProcessingStats(): ProcessingStats {
        return { ...this.processingStats };
    }
    
    /**
     * Get current noise environment analysis
     */
    public getCurrentEnvironment(): NoiseEnvironmentType {
        return this.currentEnvironment;
    }
    
    /**
     * Get environment history for analysis
     */
    public getEnvironmentHistory(): NoiseAnalysis[] {
        return [...this.environmentHistory];
    }
}

export default NoiseReducer;