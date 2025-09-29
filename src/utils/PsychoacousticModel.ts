/**
 * Psychoacoustic Model for Perceptual Audio Processing
 * 
 * Implements auditory masking models based on human hearing perception
 * for advanced noise reduction and audio quality assessment.
 * 
 * Key Features:
 * - Bark scale frequency mapping
 * - Critical band analysis
 * - Simultaneous and temporal masking
 * - Perceptual audio quality metrics
 * - Frequency-dependent noise thresholds
 */

export interface PsychoacousticConfig {
    /** Sample rate for analysis */
    sampleRate: number;
    
    /** FFT size for frequency analysis */
    fftSize: number;
    
    /** Enable temporal masking analysis */
    enableTemporalMasking: boolean;
    
    /** Enable simultaneous masking analysis */
    enableSimultaneousMasking: boolean;
    
    /** Masking threshold adjustment (dB) */
    maskingThreshold: number;
}

export interface MaskingThresholds {
    /** Frequency bins in Hz */
    frequencies: Float32Array;
    
    /** Masking threshold per frequency bin (dB) */
    thresholds: Float32Array;
    
    /** Critical band indices */
    criticalBands: Uint16Array;
    
    /** Bark scale values */
    barkScale: Float32Array;
}

export class PsychoacousticModel {
    private config: Required<PsychoacousticConfig>;
    private barkBandLimits: Float32Array;
    private criticalBandTable: Float32Array[];
    private maskingTable: Float32Array;
    
    constructor(config: PsychoacousticConfig) {
        this.config = {
            enableTemporalMasking: true,
            enableSimultaneousMasking: true,
            maskingThreshold: -20,
            ...config
        };
        
        this.initializeBarkScale();
        this.initializeCriticalBands();
        this.initializeMaskingTable();
    }
    
    /**
     * Calculate masking thresholds for given spectrum
     * @param magnitude Magnitude spectrum
     * @param previousSpectrum Previous frame for temporal masking
     * @returns Masking thresholds
     */
    public calculateMaskingThresholds(
        magnitude: Float32Array, 
        previousSpectrum?: Float32Array
    ): MaskingThresholds {
        const frequencies = this.getFrequencyBins();
        const barkScale = this.frequenciesToBark(frequencies);
        const criticalBands = this.assignCriticalBands(frequencies);
        
        // Calculate simultaneous masking
        let thresholds = this.config.enableSimultaneousMasking
            ? this.calculateSimultaneousMasking(magnitude, barkScale)
            : new Float32Array(magnitude.length).fill(this.config.maskingThreshold);
        
        // Apply temporal masking if previous spectrum available
        if (this.config.enableTemporalMasking && previousSpectrum) {
            const temporalThresholds = this.calculateTemporalMasking(
                magnitude, 
                previousSpectrum, 
                barkScale
            );
            
            // Combine simultaneous and temporal masking (take minimum)
            for (let i = 0; i < thresholds.length; i++) {
                thresholds[i] = Math.min(thresholds[i], temporalThresholds[i]);
            }
        }
        
        return {
            frequencies,
            thresholds,
            criticalBands,
            barkScale
        };
    }
    
    /**
     * Apply psychoacoustic masking to noise reduction
     * @param signal Current signal magnitude spectrum
     * @param noise Noise magnitude spectrum
     * @param maskingThresholds Pre-calculated masking thresholds
     * @returns Perceptually optimized noise reduction factors (0-1)
     */
    public applyPerceptualMasking(
        signal: Float32Array,
        noise: Float32Array,
        maskingThresholds: MaskingThresholds
    ): Float32Array {
        const reductionFactors = new Float32Array(signal.length);
        
        for (let i = 0; i < signal.length; i++) {
            // Convert to dB
            const signalDb = this.magnitudeToDb(signal[i]);
            const noiseDb = this.magnitudeToDb(noise[i]);
            const thresholdDb = maskingThresholds.thresholds[i];
            
            // Calculate signal-to-mask ratio (SMR)
            const smr = signalDb - thresholdDb;
            
            if (smr > 0) {
                // Signal is above masking threshold - preserve it
                // Reduce noise based on how much it's below the signal
                const snr = signalDb - noiseDb;
                reductionFactors[i] = Math.min(1.0, Math.max(0.1, snr / 20));
            } else {
                // Signal is below masking threshold - can apply aggressive reduction
                reductionFactors[i] = 0.05; // Aggressive noise reduction
            }
        }
        
        // Smooth reduction factors across critical bands
        return this.smoothAcrossCriticalBands(reductionFactors, maskingThresholds.criticalBands);
    }
    
    /**
     * Calculate perceptual audio quality metric
     * @param original Original spectrum
     * @param processed Processed spectrum
     * @param maskingThresholds Masking thresholds
     * @returns Quality score (0-1, higher is better)
     */
    public calculatePerceptualQuality(
        original: Float32Array,
        processed: Float32Array,
        maskingThresholds: MaskingThresholds
    ): number {
        let qualitySum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < original.length; i++) {
            // Calculate difference in dB
            const originalDb = this.magnitudeToDb(original[i]);
            const processedDb = this.magnitudeToDb(processed[i]);
            const difference = Math.abs(originalDb - processedDb);
            
            // Weight by critical band importance and masking threshold
            const criticalBandWeight = this.getCriticalBandWeight(maskingThresholds.criticalBands[i]);
            const maskingWeight = Math.max(0.1, (maskingThresholds.thresholds[i] + 60) / 60);
            const weight = criticalBandWeight * maskingWeight;
            
            // Quality decreases with difference, but masked differences matter less
            const maskingAdjustedDiff = difference * maskingWeight;
            const quality = Math.exp(-maskingAdjustedDiff / 10); // Exponential decay
            
            qualitySum += quality * weight;
            weightSum += weight;
        }
        
        return weightSum > 0 ? qualitySum / weightSum : 0;
    }
    
    /**
     * Initialize Bark scale frequency mapping
     */
    private initializeBarkScale(): void {
        // Bark scale critical band boundaries (Hz)
        this.barkBandLimits = new Float32Array([
            0, 100, 200, 300, 400, 510, 630, 770, 920, 1080, 
            1270, 1480, 1720, 2000, 2320, 2700, 3150, 3700, 4400,
            5300, 6400, 7700, 9500, 12000, 15500, 22050
        ]);
    }
    
    /**
     * Initialize critical band analysis
     */
    private initializeCriticalBands(): void {
        this.criticalBandTable = [];
        
        for (let band = 0; band < this.barkBandLimits.length - 1; band++) {
            const lowerFreq = this.barkBandLimits[band];
            const upperFreq = this.barkBandLimits[band + 1];
            const centerFreq = Math.sqrt(lowerFreq * upperFreq);
            
            // Calculate spreading function for this band
            const spreadingFunction = this.calculateSpreadingFunction(centerFreq);
            this.criticalBandTable.push(spreadingFunction);
        }
    }
    
    /**
     * Initialize masking lookup table
     */
    private initializeMaskingTable(): void {
        const tableSize = 1000;
        this.maskingTable = new Float32Array(tableSize);
        
        for (let i = 0; i < tableSize; i++) {
            const ratio = i / (tableSize - 1); // 0 to 1
            const dbRatio = ratio * 120 - 60; // -60 to +60 dB
            
            // Masking function based on psychoacoustic models
            this.maskingTable[i] = this.calculateMaskingFunction(dbRatio);
        }
    }
    
    /**
     * Convert frequency to Bark scale
     * @param frequencies Frequency array in Hz
     * @returns Bark scale values
     */
    private frequenciesToBark(frequencies: Float32Array): Float32Array {
        const bark = new Float32Array(frequencies.length);
        
        for (let i = 0; i < frequencies.length; i++) {
            const freq = frequencies[i];
            // Traunmüller's Bark scale formula
            bark[i] = 26.81 * freq / (1960 + freq) - 0.53;
            
            // Correction for high and low frequencies
            if (bark[i] < 2) {
                bark[i] += 0.15 * (2 - bark[i]);
            }
            if (bark[i] > 20.1) {
                bark[i] += 0.22 * (bark[i] - 20.1);
            }
        }
        
        return bark;
    }
    
    /**
     * Assign critical band indices to frequency bins
     */
    private assignCriticalBands(frequencies: Float32Array): Uint16Array {
        const bands = new Uint16Array(frequencies.length);
        
        for (let i = 0; i < frequencies.length; i++) {
            const freq = frequencies[i];
            
            // Find which critical band this frequency belongs to
            for (let band = 0; band < this.barkBandLimits.length - 1; band++) {
                if (freq >= this.barkBandLimits[band] && freq < this.barkBandLimits[band + 1]) {
                    bands[i] = band;
                    break;
                }
            }
        }
        
        return bands;
    }
    
    /**
     * Calculate simultaneous masking thresholds
     */
    private calculateSimultaneousMasking(
        magnitude: Float32Array, 
        barkScale: Float32Array
    ): Float32Array {
        const thresholds = new Float32Array(magnitude.length);
        
        for (let i = 0; i < magnitude.length; i++) {
            let maskingSum = 0;
            const targetBark = barkScale[i];
            
            // Calculate masking contribution from all frequency bins
            for (let j = 0; j < magnitude.length; j++) {
                const maskerBark = barkScale[j];
                const barkDistance = Math.abs(targetBark - maskerBark);
                
                // Spreading function - masking decreases with bark distance
                const spreadingFactor = this.getSpreadingFactor(barkDistance);
                const maskerLevel = this.magnitudeToDb(magnitude[j]);
                
                maskingSum += Math.pow(10, (maskerLevel * spreadingFactor) / 10);
            }
            
            thresholds[i] = 10 * Math.log10(maskingSum + 1e-10);
        }
        
        return thresholds;
    }
    
    /**
     * Calculate temporal masking thresholds
     */
    private calculateTemporalMasking(
        current: Float32Array,
        previous: Float32Array,
        barkScale: Float32Array
    ): Float32Array {
        const thresholds = new Float32Array(current.length);
        
        for (let i = 0; i < current.length; i++) {
            const currentDb = this.magnitudeToDb(current[i]);
            const previousDb = this.magnitudeToDb(previous[i]);
            
            // Temporal masking - stronger masker affects following sound
            const temporalDecay = -7; // dB/frame (approximate)
            const maskedThreshold = previousDb + temporalDecay;
            
            // Take the stronger masking effect
            thresholds[i] = Math.max(maskedThreshold, this.config.maskingThreshold);
        }
        
        return thresholds;
    }
    
    /**
     * Get frequency bins for current FFT size
     */
    private getFrequencyBins(): Float32Array {
        const frequencies = new Float32Array(this.config.fftSize / 2);
        const binWidth = this.config.sampleRate / this.config.fftSize;
        
        for (let i = 0; i < frequencies.length; i++) {
            frequencies[i] = i * binWidth;
        }
        
        return frequencies;
    }
    
    /**
     * Calculate spreading function for critical band
     */
    private calculateSpreadingFunction(centerFreq: number): Float32Array {
        const spreadingFunction = new Float32Array(100); // Arbitrary size
        
        for (let i = 0; i < spreadingFunction.length; i++) {
            const barkDistance = (i - 50) / 10; // -5 to +5 Bark
            
            // Zwicker's spreading function
            if (barkDistance >= 0) {
                spreadingFunction[i] = -25 - 75 * Math.pow(1 + 1.4 * barkDistance, -0.69);
            } else {
                spreadingFunction[i] = -7 * Math.abs(barkDistance);
            }
        }
        
        return spreadingFunction;
    }
    
    /**
     * Calculate masking function value
     */
    private calculateMaskingFunction(dbRatio: number): number {
        // Simplified masking function
        if (dbRatio > 0) {
            return Math.exp(-dbRatio / 10); // Exponential decay above threshold
        } else {
            return Math.exp(dbRatio / 5); // Different slope below threshold
        }
    }
    
    /**
     * Get spreading factor for bark distance
     */
    private getSpreadingFactor(barkDistance: number): number {
        if (barkDistance < 1) {
            return 1.0 - 0.8 * barkDistance;
        } else if (barkDistance < 2.5) {
            return 0.2 - 0.1 * (barkDistance - 1);
        } else {
            return Math.max(0.05, 0.05 * Math.exp(-(barkDistance - 2.5)));
        }
    }
    
    /**
     * Get critical band weight for perceptual importance
     */
    private getCriticalBandWeight(bandIndex: number): number {
        // Weight based on hearing sensitivity curve
        const weights = [
            0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0,
            1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
            0.1, 0.1, 0.1, 0.1, 0.1
        ];
        
        return bandIndex < weights.length ? weights[bandIndex] : 0.1;
    }
    
    /**
     * Smooth reduction factors across critical bands
     */
    private smoothAcrossCriticalBands(
        factors: Float32Array, 
        bands: Uint16Array
    ): Float32Array {
        const smoothed = new Float32Array(factors);
        const bandAverages = new Map<number, number>();
        const bandCounts = new Map<number, number>();
        
        // Calculate average per band
        for (let i = 0; i < factors.length; i++) {
            const band = bands[i];
            bandAverages.set(band, (bandAverages.get(band) || 0) + factors[i]);
            bandCounts.set(band, (bandCounts.get(band) || 0) + 1);
        }
        
        // Apply smoothing
        for (let i = 0; i < factors.length; i++) {
            const band = bands[i];
            const bandAverage = (bandAverages.get(band) || 0) / (bandCounts.get(band) || 1);
            smoothed[i] = 0.7 * factors[i] + 0.3 * bandAverage;
        }
        
        return smoothed;
    }
    
    /**
     * Convert magnitude to dB
     */
    private magnitudeToDb(magnitude: number): number {
        return 20 * Math.log10(Math.max(magnitude, 1e-10));
    }
    
    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<PsychoacousticConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Reinitialize if sample rate or FFT size changed
        if (newConfig.sampleRate || newConfig.fftSize) {
            this.initializeBarkScale();
            this.initializeCriticalBands();
        }
    }
    
    /**
     * Get current configuration
     */
    public getConfig(): Required<PsychoacousticConfig> {
        return { ...this.config };
    }
}

export default PsychoacousticModel;