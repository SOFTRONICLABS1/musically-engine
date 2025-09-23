/**
 * YIN algorithm for pitch detection
 * Particularly effective for vocal and monophonic instrument pitch detection
 * Based on "YIN, a fundamental frequency estimator for speech and music"
 * by de Cheveigné and Kawahara (2002)
 */

export class YIN {
    private sampleRate: number;
    private threshold: number;
    private bufferSize: number;
    private probabilityThreshold: number;
    
    constructor(
        sampleRate: number = 44100,
        bufferSize: number = 2048,
        threshold: number = 0.15,
        probabilityThreshold: number = 0.1
    ) {
        this.sampleRate = sampleRate;
        this.bufferSize = bufferSize;
        this.threshold = threshold;
        this.probabilityThreshold = probabilityThreshold;
    }
    
    /**
     * Detect pitch using YIN algorithm
     * @param buffer Audio buffer
     * @returns Detected pitch and probability
     */
    public detectPitch(buffer: Float32Array): { frequency: number; probability: number } {
        const yinBuffer = new Float32Array(this.bufferSize / 2);
        
        // Step 1: Calculate difference function
        this.difference(buffer, yinBuffer);
        
        // Step 2: Calculate cumulative mean normalized difference
        this.cumulativeMeanNormalizedDifference(yinBuffer);
        
        // Step 3: Find absolute threshold
        const tau = this.absoluteThreshold(yinBuffer);
        
        if (tau === -1) {
            return { frequency: 0, probability: 0 };
        }
        
        // Step 4: Parabolic interpolation
        const betterTau = this.parabolicInterpolation(yinBuffer, tau);
        
        // Step 5: Calculate frequency
        const frequency = this.sampleRate / betterTau;
        
        // Step 6: Calculate probability
        const probability = this.calculateProbability(yinBuffer, tau);
        
        return { frequency, probability };
    }
    
    /**
     * Step 1: Difference function
     * d_t(τ) = Σ(x[j] - x[j+τ])²
     */
    private difference(buffer: Float32Array, yinBuffer: Float32Array): void {
        let tau: number;
        let delta: number;
        
        for (tau = 0; tau < yinBuffer.length; tau++) {
            yinBuffer[tau] = 0;
        }
        
        for (tau = 1; tau < yinBuffer.length; tau++) {
            for (let i = 0; i < yinBuffer.length; i++) {
                delta = buffer[i] - buffer[i + tau];
                yinBuffer[tau] += delta * delta;
            }
        }
    }
    
    /**
     * Step 2: Cumulative mean normalized difference function
     * d'_t(τ) = d_t(τ) / [(1/τ) * Σ d_t(j)]
     */
    private cumulativeMeanNormalizedDifference(yinBuffer: Float32Array): void {
        let runningSum = 0;
        yinBuffer[0] = 1;
        
        for (let tau = 1; tau < yinBuffer.length; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] = yinBuffer[tau] / (runningSum / tau);
        }
    }
    
    /**
     * Step 3: Absolute threshold
     * Find first minimum below threshold
     */
    private absoluteThreshold(yinBuffer: Float32Array): number {
        let tau: number;
        
        // Start from tau = 2 to avoid high frequency errors
        for (tau = 2; tau < yinBuffer.length; tau++) {
            if (yinBuffer[tau] < this.threshold) {
                while (tau + 1 < yinBuffer.length && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                return tau;
            }
        }
        
        // If no value below threshold, find global minimum
        let minTau = 2;
        let minVal = yinBuffer[2];
        
        for (tau = 3; tau < yinBuffer.length; tau++) {
            if (yinBuffer[tau] < minVal) {
                minVal = yinBuffer[tau];
                minTau = tau;
            }
        }
        
        if (minVal < this.probabilityThreshold) {
            return minTau;
        }
        
        return -1;
    }
    
    /**
     * Step 4: Parabolic interpolation
     * Refine tau estimate using parabolic interpolation
     */
    private parabolicInterpolation(yinBuffer: Float32Array, tau: number): number {
        if (tau === 0 || tau === yinBuffer.length - 1) {
            return tau;
        }
        
        const x0 = tau - 1;
        const x2 = tau + 1;
        
        const y0 = yinBuffer[x0];
        const y1 = yinBuffer[tau];
        const y2 = yinBuffer[x2];
        
        const a = (y2 - 2 * y1 + y0) / 2;
        const b = (y2 - y0) / 2;
        
        if (a === 0) {
            return tau;
        }
        
        const xVertex = tau - b / (2 * a);
        
        return xVertex;
    }
    
    /**
     * Calculate probability/confidence of pitch detection
     */
    private calculateProbability(yinBuffer: Float32Array, tau: number): number {
        return 1 - yinBuffer[tau];
    }
    
    /**
     * Process buffer with pre-filtering
     * @param buffer Input audio buffer
     * @param filterLowFreq Filter out low frequencies
     * @returns Pitch detection result
     */
    public processWithFilter(buffer: Float32Array, filterLowFreq: boolean = true): 
        { frequency: number; probability: number; clarity: number } {
        
        let processedBuffer = buffer;
        
        if (filterLowFreq) {
            processedBuffer = this.highPassFilter(buffer);
        }
        
        const result = this.detectPitch(processedBuffer);
        
        // Calculate clarity metric
        const clarity = this.calculateClarity(processedBuffer);
        
        return {
            frequency: result.frequency,
            probability: result.probability,
            clarity
        };
    }
    
    /**
     * Simple high-pass filter to remove DC and low frequency noise
     */
    private highPassFilter(buffer: Float32Array): Float32Array {
        const filtered = new Float32Array(buffer.length);
        const alpha = 0.95;
        
        filtered[0] = buffer[0];
        
        for (let i = 1; i < buffer.length; i++) {
            filtered[i] = alpha * filtered[i - 1] + alpha * (buffer[i] - buffer[i - 1]);
        }
        
        return filtered;
    }
    
    /**
     * Calculate clarity/periodicity of the signal
     */
    private calculateClarity(buffer: Float32Array): number {
        const yinBuffer = new Float32Array(this.bufferSize / 2);
        this.difference(buffer, yinBuffer);
        this.cumulativeMeanNormalizedDifference(yinBuffer);
        
        // Find minimum value as clarity indicator
        let minVal = 1;
        for (let i = 2; i < yinBuffer.length; i++) {
            if (yinBuffer[i] < minVal) {
                minVal = yinBuffer[i];
            }
        }
        
        return 1 - minVal;
    }
    
    /**
     * Batch process multiple windows
     * @param buffers Array of audio buffers
     * @returns Array of pitch detection results
     */
    public batchProcess(buffers: Float32Array[]): Array<{ frequency: number; probability: number }> {
        return buffers.map(buffer => this.detectPitch(buffer));
    }
    
    /**
     * Get algorithm parameters
     */
    public getParameters(): { 
        sampleRate: number; 
        bufferSize: number; 
        threshold: number; 
        probabilityThreshold: number 
    } {
        return {
            sampleRate: this.sampleRate,
            bufferSize: this.bufferSize,
            threshold: this.threshold,
            probabilityThreshold: this.probabilityThreshold
        };
    }
    
    /**
     * Update threshold
     * @param threshold New threshold value (0.05 - 0.3 recommended)
     */
    public setThreshold(threshold: number): void {
        this.threshold = Math.max(0.05, Math.min(0.3, threshold));
    }
}

/**
 * Optimized YIN for real-time processing
 */
export class RealTimeYIN extends YIN {
    private previousBuffer: Float32Array | null;
    private smoothingFactor: number;
    
    constructor(
        sampleRate: number = 44100,
        bufferSize: number = 2048,
        threshold: number = 0.15
    ) {
        super(sampleRate, bufferSize, threshold);
        this.previousBuffer = null;
        this.smoothingFactor = 0.9;
    }
    
    /**
     * Process with temporal smoothing for real-time stability
     * @param buffer Current audio buffer
     * @returns Smoothed pitch detection result
     */
    public processRealTime(buffer: Float32Array): {
        frequency: number;
        probability: number;
        smoothedFrequency: number;
    } {
        const result = this.detectPitch(buffer);
        
        let smoothedFrequency = result.frequency;
        
        if (this.previousBuffer !== null && result.frequency > 0) {
            const prevResult = this.detectPitch(this.previousBuffer);
            
            if (prevResult.frequency > 0) {
                // Apply exponential smoothing
                smoothedFrequency = this.smoothingFactor * prevResult.frequency + 
                                   (1 - this.smoothingFactor) * result.frequency;
                
                // Reject outliers
                const deviation = Math.abs(result.frequency - prevResult.frequency) / prevResult.frequency;
                if (deviation > 0.1) {
                    smoothedFrequency = result.frequency;
                }
            }
        }
        
        // Store current buffer for next iteration
        this.previousBuffer = new Float32Array(buffer);
        
        return {
            frequency: result.frequency,
            probability: result.probability,
            smoothedFrequency
        };
    }
    
    /**
     * Reset temporal smoothing
     */
    public reset(): void {
        this.previousBuffer = null;
    }
    
    /**
     * Set smoothing factor
     * @param factor Smoothing factor (0-1, higher = more smoothing)
     */
    public setSmoothingFactor(factor: number): void {
        this.smoothingFactor = Math.max(0, Math.min(1, factor));
    }
}

export default YIN;