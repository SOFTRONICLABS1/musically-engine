/**
 * Multi-Algorithm Pitch Detection Voting System
 * 
 * This system combines multiple pitch detection algorithms and uses intelligent
 * voting mechanisms to achieve more accurate and robust pitch detection than
 * any single algorithm alone. It includes confidence weighting, outlier detection,
 * and dynamic algorithm selection based on signal characteristics.
 */

import { YIN } from './YIN';
import { Autocorrelation } from './Autocorrelation';
import { HPS } from './HPS';
import { FFT } from './FFT';

/**
 * Configuration for pitch voting system
 */
export interface PitchVotingConfig {
    /** Sample rate of audio data */
    sampleRate?: number;
    
    /** Frame size for analysis */
    frameSize?: number;
    
    /** Minimum frequency to detect (Hz) */
    minFrequency?: number;
    
    /** Maximum frequency to detect (Hz) */
    maxFrequency?: number;
    
    /** Threshold for considering a detection valid */
    confidenceThreshold?: number;
    
    /** Maximum allowed deviation between algorithms (semitones) */
    maxDeviationSemitones?: number;
    
    /** Whether to enable adaptive algorithm weighting */
    enableAdaptiveWeighting?: boolean;
    
    /** Whether to enable outlier rejection */
    enableOutlierRejection?: boolean;
    
    /** Number of recent results to consider for adaptation */
    adaptationHistorySize?: number;
    
    /** Minimum number of algorithms that must agree */
    minimumAgreement?: number;
}

/**
 * Result from a single pitch detection algorithm
 */
export interface AlgorithmResult {
    /** Detected frequency in Hz */
    frequency: number;
    
    /** Confidence score (0-1) */
    confidence: number;
    
    /** Algorithm that produced this result */
    algorithm: string;
    
    /** Additional metadata from the algorithm */
    metadata?: any;
    
    /** Processing time in milliseconds */
    processingTime?: number;
}

/**
 * Aggregated pitch detection result with voting information
 */
export interface VotingResult {
    /** Final detected frequency */
    frequency: number;
    
    /** Overall confidence in the result */
    confidence: number;
    
    /** Number of algorithms that participated */
    algorithmsUsed: number;
    
    /** Number of algorithms that agreed on the result */
    agreementCount: number;
    
    /** Results from individual algorithms */
    algorithmResults: AlgorithmResult[];
    
    /** Whether outliers were detected and removed */
    outliersRemoved: boolean;
    
    /** Voting method used for final decision */
    votingMethod: 'weighted' | 'majority' | 'consensus' | 'best';
    
    /** Quality assessment of the result */
    quality: {
        consistency: number;
        reliability: number;
        accuracy: number;
    };
    
    /** Processing metadata */
    metadata: {
        totalProcessingTime: number;
        adaptationApplied: boolean;
        algorithmWeights: Map<string, number>;
    };
}

/**
 * Historical performance data for algorithm adaptation
 */
interface AlgorithmPerformance {
    successRate: number;
    averageConfidence: number;
    averageDeviation: number;
    recentResults: Array<{
        confidence: number;
        deviation: number;
        timestamp: number;
    }>;
}

/**
 * Multi-algorithm pitch detection with intelligent voting
 */
export class PitchVoting {
    private yin: YIN;
    private autocorrelation: Autocorrelation;
    private hps: HPS;
    private fft: FFT;
    private config: Required<PitchVotingConfig>;
    
    // Algorithm performance tracking
    private algorithmPerformance: Map<string, AlgorithmPerformance> = new Map();
    private adaptiveWeights: Map<string, number> = new Map();
    private processingHistory: VotingResult[] = [];
    
    constructor(config: PitchVotingConfig = {}) {
        this.config = {
            sampleRate: config.sampleRate ?? 44100,
            frameSize: config.frameSize ?? 2048,
            minFrequency: config.minFrequency ?? 50,
            maxFrequency: config.maxFrequency ?? 2000,
            confidenceThreshold: config.confidenceThreshold ?? 0.5,
            maxDeviationSemitones: config.maxDeviationSemitones ?? 0.5,
            enableAdaptiveWeighting: config.enableAdaptiveWeighting ?? true,
            enableOutlierRejection: config.enableOutlierRejection ?? true,
            adaptationHistorySize: config.adaptationHistorySize ?? 50,
            minimumAgreement: config.minimumAgreement ?? 2
        };
        
        // Initialize algorithms
        this.fft = new FFT(this.config.frameSize, this.config.sampleRate);
        this.yin = new YIN(
            this.config.sampleRate,
            this.config.frameSize,
            0.15,
            0.1
        );
        
        this.autocorrelation = new Autocorrelation(
            this.config.sampleRate,
            this.config.frameSize
        );
        
        this.hps = new HPS(
            this.config.frameSize,
            this.config.sampleRate,
            5,
            this.config.minFrequency,
            this.config.maxFrequency
        );
        
        this.initializePerformanceTracking();
    }
    
    /**
     * Detect pitch using multiple algorithms with voting
     */
    public detectPitch(buffer: Float32Array): VotingResult {
        const startTime = performance.now();
        
        // Step 1: Run all algorithms
        const algorithmResults = this.runAllAlgorithms(buffer);
        
        // Step 2: Filter valid results
        const validResults = this.filterValidResults(algorithmResults);
        
        // Step 3: Remove outliers if enabled
        const filteredResults = this.config.enableOutlierRejection 
            ? this.removeOutliers(validResults)
            : validResults;
        
        // Step 4: Apply voting mechanism
        const votingResult = this.applyVoting(filteredResults);
        
        // Step 5: Assess quality
        const quality = this.assessQuality(filteredResults, votingResult);
        
        // Step 6: Update adaptation
        if (this.config.enableAdaptiveWeighting) {
            this.updateAdaptation(filteredResults, votingResult);
        }
        
        const totalProcessingTime = performance.now() - startTime;
        
        const result: VotingResult = {
            frequency: votingResult.frequency,
            confidence: votingResult.confidence,
            algorithmsUsed: algorithmResults.length,
            agreementCount: this.countAgreement(filteredResults, votingResult.frequency),
            algorithmResults: algorithmResults,
            outliersRemoved: validResults.length !== filteredResults.length,
            votingMethod: votingResult.method,
            quality,
            metadata: {
                totalProcessingTime,
                adaptationApplied: this.config.enableAdaptiveWeighting,
                algorithmWeights: new Map(this.adaptiveWeights)
            }
        };
        
        // Update processing history
        this.updateProcessingHistory(result);
        
        return result;
    }
    
    /**
     * Run all available pitch detection algorithms
     */
    private runAllAlgorithms(buffer: Float32Array): AlgorithmResult[] {
        const results: AlgorithmResult[] = [];
        
        // YIN Algorithm
        try {
            const startTime = performance.now();
            const yinResult = this.yin.detectPitch(buffer);
            const processingTime = performance.now() - startTime;
            
            if (yinResult.frequency > 0) {
                results.push({
                    frequency: yinResult.frequency,
                    confidence: yinResult.probability || 0,
                    algorithm: 'YIN',
                    metadata: { probability: yinResult.probability },
                    processingTime
                });
            }
        } catch (error) {
            console.warn('YIN algorithm failed:', error);
        }
        
        // Autocorrelation Algorithm
        try {
            const startTime = performance.now();
            const acResult = this.autocorrelation.detectPitch(buffer);
            const processingTime = performance.now() - startTime;
            
            if (acResult.frequency > 0) {
                results.push({
                    frequency: acResult.frequency,
                    confidence: acResult.confidence,
                    algorithm: 'Autocorrelation',
                    metadata: { peak: acResult.peak },
                    processingTime
                });
            }
        } catch (error) {
            console.warn('Autocorrelation algorithm failed:', error);
        }
        
        // HPS Algorithm
        try {
            const startTime = performance.now();
            const hpsResult = this.hps.detectPitch(buffer);
            const processingTime = performance.now() - startTime;
            
            if (hpsResult.frequency > 0) {
                results.push({
                    frequency: hpsResult.frequency,
                    confidence: hpsResult.strength || 0,
                    algorithm: 'HPS',
                    metadata: { 
                        strength: hpsResult.strength,
                        harmonicAmplitudes: hpsResult.harmonicAmplitudes,
                        harmonicity: hpsResult.harmonicity || 0,
                        spectralCentroid: hpsResult.spectralCentroid || 0
                    },
                    processingTime
                });
            }
        } catch (error) {
            console.warn('HPS algorithm failed:', error);
        }
        
        // Additional spectral-based algorithm
        try {
            const spectralResult = this.spectralPeakDetection(buffer);
            if (spectralResult) {
                results.push(spectralResult);
            }
        } catch (error) {
            console.warn('Spectral peak detection failed:', error);
        }
        
        return results;
    }
    
    /**
     * Spectral peak-based pitch detection as additional algorithm
     */
    private spectralPeakDetection(buffer: Float32Array): AlgorithmResult | null {
        const startTime = performance.now();
        
        // Apply window and compute FFT
        const windowed = this.applyWindow(buffer);
        const spectrum = this.fft.forward(windowed);
        
        // Calculate magnitude spectrum
        const magnitude = new Float32Array(spectrum.length / 2);
        for (let i = 0; i < magnitude.length; i++) {
            const real = spectrum[2 * i];
            const imag = spectrum[2 * i + 1];
            magnitude[i] = Math.sqrt(real * real + imag * imag);
        }
        
        // Find spectral peak
        const freqResolution = this.config.sampleRate / this.config.frameSize;
        const minBin = Math.floor(this.config.minFrequency / freqResolution);
        const maxBin = Math.floor(this.config.maxFrequency / freqResolution);
        
        let peakBin = minBin;
        let peakMagnitude = magnitude[minBin];
        
        for (let i = minBin; i <= maxBin; i++) {
            if (magnitude[i] > peakMagnitude) {
                peakMagnitude = magnitude[i];
                peakBin = i;
            }
        }
        
        const frequency = peakBin * freqResolution;
        
        // Calculate confidence based on peak prominence
        const avgMagnitude = magnitude.slice(minBin, maxBin + 1)
            .reduce((sum, val) => sum + val, 0) / (maxBin - minBin + 1);
        
        const confidence = Math.min(peakMagnitude / (avgMagnitude + 1e-10), 1.0);
        
        const processingTime = performance.now() - startTime;
        
        if (confidence > 0.3) {
            return {
                frequency,
                confidence,
                algorithm: 'SpectralPeak',
                metadata: { 
                    peakMagnitude, 
                    avgMagnitude,
                    peakBin 
                },
                processingTime
            };
        }
        
        return null;
    }
    
    /**
     * Apply window function to buffer
     */
    private applyWindow(buffer: Float32Array): Float32Array {
        const windowed = new Float32Array(buffer.length);
        
        // Hann window
        for (let i = 0; i < buffer.length; i++) {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (buffer.length - 1)));
            windowed[i] = buffer[i] * window;
        }
        
        return windowed;
    }
    
    /**
     * Filter results based on validity criteria
     */
    private filterValidResults(results: AlgorithmResult[]): AlgorithmResult[] {
        return results.filter(result => {
            return result.frequency >= this.config.minFrequency &&
                   result.frequency <= this.config.maxFrequency &&
                   result.confidence >= this.config.confidenceThreshold;
        });
    }
    
    /**
     * Remove outlier results that deviate significantly from others
     */
    private removeOutliers(results: AlgorithmResult[]): AlgorithmResult[] {
        if (results.length < 3) return results;
        
        // Calculate median frequency
        const frequencies = results.map(r => r.frequency).sort((a, b) => a - b);
        const medianFreq = frequencies[Math.floor(frequencies.length / 2)];
        
        // Remove results that deviate too much from median
        return results.filter(result => {
            const semitoneDeviation = Math.abs(
                12 * Math.log2(result.frequency / medianFreq)
            );
            return semitoneDeviation <= this.config.maxDeviationSemitones;
        });
    }
    
    /**
     * Apply voting mechanism to determine final result
     */
    private applyVoting(results: AlgorithmResult[]): { 
        frequency: number; 
        confidence: number; 
        method: 'weighted' | 'majority' | 'consensus' | 'best' 
    } {
        if (results.length === 0) {
            return { frequency: 0, confidence: 0, method: 'best' };
        }
        
        if (results.length === 1) {
            return { 
                frequency: results[0].frequency, 
                confidence: results[0].confidence,
                method: 'best'
            };
        }
        
        // Check for consensus (all algorithms agree within tolerance)
        if (this.hasConsensus(results)) {
            const avgFreq = this.calculateWeightedAverage(results);
            const avgConf = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
            return { frequency: avgFreq, confidence: avgConf, method: 'consensus' };
        }
        
        // Apply weighted voting
        if (this.config.enableAdaptiveWeighting && this.adaptiveWeights.size > 0) {
            const weightedResult = this.weightedVoting(results);
            return { ...weightedResult, method: 'weighted' };
        }
        
        // Fall back to majority voting
        if (results.length >= this.config.minimumAgreement) {
            const majorityResult = this.majorityVoting(results);
            return { ...majorityResult, method: 'majority' };
        }
        
        // Use best single result
        const bestResult = results.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
        );
        
        return { 
            frequency: bestResult.frequency, 
            confidence: bestResult.confidence,
            method: 'best'
        };
    }
    
    /**
     * Check if algorithms have reached consensus
     */
    private hasConsensus(results: AlgorithmResult[]): boolean {
        if (results.length < 2) return true;
        
        const frequencies = results.map(r => r.frequency);
        const avgFreq = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
        
        return frequencies.every(freq => {
            const semitoneDeviation = Math.abs(12 * Math.log2(freq / avgFreq));
            return semitoneDeviation <= this.config.maxDeviationSemitones / 2;
        });
    }
    
    /**
     * Calculate weighted average frequency
     */
    private calculateWeightedAverage(results: AlgorithmResult[]): number {
        let weightedSum = 0;
        let totalWeight = 0;
        
        results.forEach(result => {
            const weight = this.adaptiveWeights.get(result.algorithm) || result.confidence;
            weightedSum += result.frequency * weight;
            totalWeight += weight;
        });
        
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    
    /**
     * Weighted voting based on algorithm performance
     */
    private weightedVoting(results: AlgorithmResult[]): { frequency: number; confidence: number } {
        let weightedFreqSum = 0;
        let weightedConfSum = 0;
        let totalWeight = 0;
        
        results.forEach(result => {
            const algorithmWeight = this.adaptiveWeights.get(result.algorithm) || 1.0;
            const weight = algorithmWeight * result.confidence;
            
            weightedFreqSum += result.frequency * weight;
            weightedConfSum += result.confidence * weight;
            totalWeight += weight;
        });
        
        return {
            frequency: totalWeight > 0 ? weightedFreqSum / totalWeight : 0,
            confidence: totalWeight > 0 ? weightedConfSum / totalWeight : 0
        };
    }
    
    /**
     * Majority voting with frequency clustering
     */
    private majorityVoting(results: AlgorithmResult[]): { frequency: number; confidence: number } {
        // Group results by frequency similarity
        const clusters: AlgorithmResult[][] = [];
        
        results.forEach(result => {
            let addedToCluster = false;
            
            for (const cluster of clusters) {
                const clusterAvg = cluster.reduce((sum, r) => sum + r.frequency, 0) / cluster.length;
                const semitoneDeviation = Math.abs(12 * Math.log2(result.frequency / clusterAvg));
                
                if (semitoneDeviation <= this.config.maxDeviationSemitones) {
                    cluster.push(result);
                    addedToCluster = true;
                    break;
                }
            }
            
            if (!addedToCluster) {
                clusters.push([result]);
            }
        });
        
        // Find largest cluster
        const largestCluster = clusters.reduce((largest, current) => 
            current.length > largest.length ? current : largest
        );
        
        // Calculate average of largest cluster
        const avgFreq = largestCluster.reduce((sum, r) => sum + r.frequency, 0) / largestCluster.length;
        const avgConf = largestCluster.reduce((sum, r) => sum + r.confidence, 0) / largestCluster.length;
        
        return { frequency: avgFreq, confidence: avgConf };
    }
    
    /**
     * Count how many algorithms agree with the final result
     */
    private countAgreement(results: AlgorithmResult[], finalFrequency: number): number {
        return results.filter(result => {
            const semitoneDeviation = Math.abs(12 * Math.log2(result.frequency / finalFrequency));
            return semitoneDeviation <= this.config.maxDeviationSemitones;
        }).length;
    }
    
    /**
     * Assess quality of the voting result
     */
    private assessQuality(results: AlgorithmResult[], votingResult: any): {
        consistency: number;
        reliability: number;
        accuracy: number;
    } {
        if (results.length === 0) {
            return { consistency: 0, reliability: 0, accuracy: 0 };
        }
        
        // Consistency: How well algorithms agree
        const frequencies = results.map(r => r.frequency);
        const avgFreq = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
        const deviations = frequencies.map(f => Math.abs(12 * Math.log2(f / avgFreq)));
        const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
        const consistency = Math.max(0, 1 - avgDeviation / this.config.maxDeviationSemitones);
        
        // Reliability: Based on confidence scores and agreement
        const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
        const agreementRatio = votingResult.agreementCount / results.length;
        const reliability = (avgConfidence + agreementRatio) / 2;
        
        // Accuracy: Historical performance (simplified)
        const accuracy = this.getHistoricalAccuracy();
        
        return {
            consistency: Math.min(1, Math.max(0, consistency)),
            reliability: Math.min(1, Math.max(0, reliability)),
            accuracy: Math.min(1, Math.max(0, accuracy))
        };
    }
    
    /**
     * Get historical accuracy estimate
     */
    private getHistoricalAccuracy(): number {
        if (this.processingHistory.length < 5) return 0.7; // Default
        
        const recentResults = this.processingHistory.slice(-20);
        const avgQuality = recentResults.reduce((sum, r) => 
            sum + (r.quality.consistency + r.quality.reliability) / 2, 0
        ) / recentResults.length;
        
        return avgQuality;
    }
    
    /**
     * Update adaptive algorithm weights based on performance
     */
    private updateAdaptation(results: AlgorithmResult[], votingResult: any): void {
        const correctFreq = votingResult.frequency;
        
        results.forEach(result => {
            const performance = this.algorithmPerformance.get(result.algorithm);
            if (!performance) return;
            
            // Calculate deviation from consensus
            const semitoneDeviation = Math.abs(12 * Math.log2(result.frequency / correctFreq));
            const isAccurate = semitoneDeviation <= this.config.maxDeviationSemitones;
            
            // Update performance metrics
            performance.recentResults.push({
                confidence: result.confidence,
                deviation: semitoneDeviation,
                timestamp: Date.now()
            });
            
            // Maintain history size
            if (performance.recentResults.length > this.config.adaptationHistorySize) {
                performance.recentResults.shift();
            }
            
            // Recalculate performance metrics
            const recentResults = performance.recentResults;
            performance.successRate = recentResults.filter(r => 
                r.deviation <= this.config.maxDeviationSemitones
            ).length / recentResults.length;
            
            performance.averageConfidence = recentResults.reduce((sum, r) => 
                sum + r.confidence, 0
            ) / recentResults.length;
            
            performance.averageDeviation = recentResults.reduce((sum, r) => 
                sum + r.deviation, 0
            ) / recentResults.length;
            
            // Update adaptive weight
            const weight = (performance.successRate * 0.5) + 
                          (performance.averageConfidence * 0.3) + 
                          ((1 - performance.averageDeviation / this.config.maxDeviationSemitones) * 0.2);
            
            this.adaptiveWeights.set(result.algorithm, Math.max(0.1, Math.min(2.0, weight)));
        });
    }
    
    /**
     * Initialize performance tracking for all algorithms
     */
    private initializePerformanceTracking(): void {
        const algorithms = ['YIN', 'Autocorrelation', 'HPS', 'SpectralPeak'];
        
        algorithms.forEach(algorithm => {
            this.algorithmPerformance.set(algorithm, {
                successRate: 0.8,
                averageConfidence: 0.7,
                averageDeviation: 0.2,
                recentResults: []
            });
            
            this.adaptiveWeights.set(algorithm, 1.0);
        });
    }
    
    /**
     * Update processing history
     */
    private updateProcessingHistory(result: VotingResult): void {
        this.processingHistory.push(result);
        
        // Maintain history size
        if (this.processingHistory.length > this.config.adaptationHistorySize) {
            this.processingHistory.shift();
        }
    }
    
    /**
     * Get algorithm performance statistics
     */
    public getAlgorithmStatistics(): Map<string, AlgorithmPerformance> {
        return new Map(this.algorithmPerformance);
    }
    
    /**
     * Get current adaptive weights
     */
    public getAdaptiveWeights(): Map<string, number> {
        return new Map(this.adaptiveWeights);
    }
    
    /**
     * Reset adaptation learning
     */
    public resetAdaptation(): void {
        this.initializePerformanceTracking();
        this.processingHistory = [];
    }
    
    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<PitchVotingConfig>): void {
        Object.assign(this.config, newConfig);
        
        // Update sub-algorithms if needed
        if (newConfig.sampleRate || newConfig.frameSize) {
            this.yin.updateConfig({
                sampleRate: this.config.sampleRate,
                frameSize: this.config.frameSize
            });
            
            this.autocorrelation.updateConfig({
                sampleRate: this.config.sampleRate,
                frameSize: this.config.frameSize
            });
            
            this.hps.updateConfig({
                sampleRate: this.config.sampleRate,
                frameSize: this.config.frameSize
            });
        }
    }
}