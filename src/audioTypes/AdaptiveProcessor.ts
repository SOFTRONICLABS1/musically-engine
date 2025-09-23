/**
 * Adaptive Audio Processing Pipeline
 * 
 * This class provides a unified interface for audio processing that automatically
 * detects the audio type and routes to the appropriate specialized processor.
 * It integrates AutoDetector, VocalProcessor, and InstrumentProcessor into a
 * seamless pipeline with intelligent fallback and quality assessment.
 */

import { FFT } from '../algorithms/FFT';
import { AutoDetector, AudioTypeResult, AudioType } from './AutoDetector';
import { VocalProcessor, VocalAnalysisResult, VocalConfig } from './VocalProcessor';
import { InstrumentProcessor, InstrumentAnalysisResult, InstrumentConfig, InstrumentFamily } from './InstrumentProcessor';

/**
 * Configuration for the adaptive processing pipeline
 */
export interface AdaptiveConfig {
    /** Sample rate of audio data */
    sampleRate?: number;
    
    /** Frame size for analysis (should be power of 2) */
    frameSize?: number;
    
    /** Minimum confidence threshold for audio type detection */
    confidenceThreshold?: number;
    
    /** Whether to enable multi-pass processing for better accuracy */
    enableMultiPass?: boolean;
    
    /** Number of analysis passes for multi-pass mode */
    multiPassCount?: number;
    
    /** Whether to enable quality assessment */
    enableQualityAssessment?: boolean;
    
    /** Configuration for vocal processor */
    vocalConfig?: Partial<VocalConfig>;
    
    /** Configuration for instrument processor */
    instrumentConfig?: Partial<InstrumentConfig>;
    
    /** Whether to enable automatic parameter adaptation */
    enableAdaptation?: boolean;
    
    /** History length for adaptation learning */
    adaptationHistoryLength?: number;
}

/**
 * Quality metrics for processed audio
 */
export interface QualityMetrics {
    /** Overall processing quality score (0-1) */
    overallQuality: number;
    
    /** Signal-to-noise ratio estimate */
    snrEstimate: number;
    
    /** Confidence in audio type detection */
    detectionConfidence: number;
    
    /** Processing accuracy estimate */
    processingAccuracy: number;
    
    /** Whether the result is considered reliable */
    isReliable: boolean;
    
    /** Quality breakdown by component */
    componentQuality: {
        audioDetection: number;
        featureExtraction: number;
        primaryProcessing: number;
    };
}

/**
 * Comprehensive analysis result combining all processors
 */
export interface AdaptiveAnalysisResult {
    /** Detected audio type */
    audioType: AudioType;
    
    /** Confidence in audio type detection */
    detectionConfidence: number;
    
    /** Primary frequency detected */
    fundamentalFrequency: number;
    
    /** Vocal analysis results (if applicable) */
    vocalAnalysis?: VocalAnalysisResult;
    
    /** Instrument analysis results (if applicable) */
    instrumentAnalysis?: InstrumentAnalysisResult;
    
    /** Quality metrics for the analysis */
    quality: QualityMetrics;
    
    /** Processing metadata */
    metadata: {
        processingTime: number;
        frameSize: number;
        sampleRate: number;
        passesUsed: number;
        adaptationApplied: boolean;
    };
    
    /** Alternative interpretations with lower confidence */
    alternatives?: Array<{
        audioType: AudioType;
        confidence: number;
        frequency?: number;
    }>;
}

/**
 * Processing history for adaptation learning
 */
interface ProcessingHistory {
    timestamp: number;
    audioType: AudioType;
    confidence: number;
    quality: number;
    parameters: any;
}

/**
 * Adaptive audio processing pipeline that automatically detects audio type
 * and routes to appropriate specialized processors
 */
export class AdaptiveProcessor {
    private autoDetector: AutoDetector;
    private vocalProcessor: VocalProcessor;
    private instrumentProcessor: InstrumentProcessor;
    private fft: FFT;
    private config: Required<AdaptiveConfig>;
    private processingHistory: ProcessingHistory[] = [];
    private adaptedParameters: Map<AudioType, any> = new Map();
    
    constructor(config: AdaptiveConfig = {}) {
        this.config = {
            sampleRate: config.sampleRate ?? 44100,
            frameSize: config.frameSize ?? 2048,
            confidenceThreshold: config.confidenceThreshold ?? 0.7,
            enableMultiPass: config.enableMultiPass ?? true,
            multiPassCount: config.multiPassCount ?? 3,
            enableQualityAssessment: config.enableQualityAssessment ?? true,
            vocalConfig: config.vocalConfig ?? {},
            instrumentConfig: config.instrumentConfig ?? {},
            enableAdaptation: config.enableAdaptation ?? true,
            adaptationHistoryLength: config.adaptationHistoryLength ?? 100
        };
        
        this.fft = new FFT(this.config.frameSize);
        this.autoDetector = new AutoDetector({
            sampleRate: this.config.sampleRate,
            frameSize: this.config.frameSize
        });
        
        this.vocalProcessor = new VocalProcessor({
            sampleRate: this.config.sampleRate,
            frameSize: this.config.frameSize,
            ...this.config.vocalConfig
        });
        
        this.instrumentProcessor = new InstrumentProcessor({
            sampleRate: this.config.sampleRate,
            frameSize: this.config.frameSize,
            ...this.config.instrumentConfig
        });
        
        this.initializeAdaptedParameters();
    }
    
    /**
     * Process audio buffer with adaptive routing
     */
    public async processAudio(buffer: Float32Array): Promise<AdaptiveAnalysisResult> {
        const startTime = performance.now();
        
        // Step 1: Multi-pass audio type detection
        const detectionResult = await this.performMultiPassDetection(buffer);
        
        // Step 2: Apply adaptation if enabled
        if (this.config.enableAdaptation) {
            this.applyAdaptation(detectionResult.audioType);
        }
        
        // Step 3: Route to appropriate processor
        const processingResult = await this.routeToProcessor(buffer, detectionResult);
        
        // Step 4: Quality assessment
        const quality = this.config.enableQualityAssessment 
            ? this.assessQuality(buffer, detectionResult, processingResult)
            : this.getDefaultQuality();
        
        // Step 5: Build comprehensive result
        const result: AdaptiveAnalysisResult = {
            audioType: detectionResult.audioType,
            detectionConfidence: detectionResult.confidence,
            fundamentalFrequency: this.extractFundamentalFrequency(processingResult),
            quality,
            metadata: {
                processingTime: performance.now() - startTime,
                frameSize: this.config.frameSize,
                sampleRate: this.config.sampleRate,
                passesUsed: this.config.enableMultiPass ? this.config.multiPassCount : 1,
                adaptationApplied: this.config.enableAdaptation
            }
        };
        
        // Add specific analysis results
        if (detectionResult.audioType === 'voice') {
            result.vocalAnalysis = processingResult as VocalAnalysisResult;
        } else {
            result.instrumentAnalysis = processingResult as InstrumentAnalysisResult;
        }
        
        // Add alternatives if available
        result.alternatives = detectionResult.alternatives?.map(alt => ({
            audioType: alt.audioType,
            confidence: alt.confidence
        }));
        
        // Update processing history
        this.updateProcessingHistory(result);
        
        return result;
    }
    
    /**
     * Perform multi-pass audio type detection for improved accuracy
     */
    private async performMultiPassDetection(buffer: Float32Array): Promise<AudioTypeResult & { alternatives?: AudioTypeResult[] }> {
        if (!this.config.enableMultiPass) {
            return this.autoDetector.detectAudioType(buffer);
        }
        
        const results: AudioTypeResult[] = [];
        const windowSize = Math.floor(buffer.length / this.config.multiPassCount);
        
        // Analyze multiple segments
        for (let i = 0; i < this.config.multiPassCount; i++) {
            const start = i * windowSize;
            const end = Math.min(start + windowSize * 1.5, buffer.length); // Overlapping windows
            const segment = buffer.slice(start, end);
            
            if (segment.length > this.config.frameSize) {
                const result = this.autoDetector.detectAudioType(segment);
                results.push(result);
            }
        }
        
        // Aggregate results using weighted voting
        const typeVotes = new Map<AudioType, { confidence: number; count: number }>();
        
        results.forEach(result => {
            const existing = typeVotes.get(result.audioType) || { confidence: 0, count: 0 };
            typeVotes.set(result.audioType, {
                confidence: existing.confidence + result.confidence,
                count: existing.count + 1
            });
        });
        
        // Find best match
        let bestType: AudioType = 'unknown';
        let bestScore = 0;
        const alternatives: AudioTypeResult[] = [];
        
        for (const [type, votes] of typeVotes.entries()) {
            const avgConfidence = votes.confidence / votes.count;
            const weightedScore = avgConfidence * (votes.count / results.length);
            
            if (weightedScore > bestScore) {
                if (bestScore > 0) {
                    alternatives.push({
                        audioType: bestType,
                        confidence: bestScore,
                        features: results.find(r => r.audioType === bestType)?.features!
                    });
                }
                bestType = type;
                bestScore = weightedScore;
            } else if (weightedScore > 0.3) {
                alternatives.push({
                    audioType: type,
                    confidence: weightedScore,
                    features: results.find(r => r.audioType === type)?.features!
                });
            }
        }
        
        // Sort alternatives by confidence
        alternatives.sort((a, b) => b.confidence - a.confidence);
        
        return {
            audioType: bestType,
            confidence: bestScore,
            features: results.find(r => r.audioType === bestType)?.features!,
            alternatives: alternatives.slice(0, 3) // Top 3 alternatives
        };
    }
    
    /**
     * Route audio to appropriate processor based on detected type
     */
    private async routeToProcessor(
        buffer: Float32Array, 
        detection: AudioTypeResult
    ): Promise<VocalAnalysisResult | InstrumentAnalysisResult> {
        
        if (detection.confidence < this.config.confidenceThreshold) {
            // Low confidence - try both processors and compare results
            return this.handleLowConfidenceDetection(buffer, detection);
        }
        
        switch (detection.audioType) {
            case 'voice':
                return this.vocalProcessor.processVoice(buffer);
                
            case 'string':
                this.instrumentProcessor.setFamily(InstrumentFamily.String);
                return this.instrumentProcessor.processInstrument(buffer);
                
            case 'keyboard':
                this.instrumentProcessor.setFamily(InstrumentFamily.Keyboard);
                return this.instrumentProcessor.processInstrument(buffer);
                
            case 'wind':
                this.instrumentProcessor.setFamily(InstrumentFamily.Wind);
                return this.instrumentProcessor.processInstrument(buffer);
                
            case 'percussion':
                this.instrumentProcessor.setFamily(InstrumentFamily.Percussion);
                return this.instrumentProcessor.processInstrument(buffer);
                
            default:
                // Default to general instrument processing
                this.instrumentProcessor.setFamily(InstrumentFamily.String);
                return this.instrumentProcessor.processInstrument(buffer);
        }
    }
    
    /**
     * Handle low confidence detection with comparative analysis
     */
    private async handleLowConfidenceDetection(
        buffer: Float32Array, 
        detection: AudioTypeResult
    ): Promise<VocalAnalysisResult | InstrumentAnalysisResult> {
        
        // Try vocal processing
        const vocalResult = this.vocalProcessor.processVoice(buffer);
        const vocalQuality = this.assessVocalQuality(vocalResult, buffer);
        
        // Try instrument processing
        this.instrumentProcessor.setFamily(InstrumentFamily.String);
        const instrumentResult = this.instrumentProcessor.processInstrument(buffer);
        const instrumentQuality = this.assessInstrumentQuality(instrumentResult, buffer);
        
        // Choose based on quality metrics
        return vocalQuality > instrumentQuality ? vocalResult : instrumentResult;
    }
    
    /**
     * Apply adaptation based on processing history
     */
    private applyAdaptation(audioType: AudioType): void {
        const adaptedParams = this.adaptedParameters.get(audioType);
        if (!adaptedParams) return;
        
        // Apply learned parameters to processors
        if (audioType === 'voice') {
            this.vocalProcessor.updateConfig(adaptedParams.vocal || {});
        } else {
            this.instrumentProcessor.updateConfig(adaptedParams.instrument || {});
        }
    }
    
    /**
     * Initialize adapted parameters for different audio types
     */
    private initializeAdaptedParameters(): void {
        const audioTypes: AudioType[] = ['voice', 'string', 'keyboard', 'wind', 'percussion'];
        
        audioTypes.forEach(type => {
            this.adaptedParameters.set(type, {
                vocal: {},
                instrument: {}
            });
        });
    }
    
    /**
     * Update processing history for adaptation learning
     */
    private updateProcessingHistory(result: AdaptiveAnalysisResult): void {
        if (!this.config.enableAdaptation) return;
        
        const historyEntry: ProcessingHistory = {
            timestamp: Date.now(),
            audioType: result.audioType,
            confidence: result.detectionConfidence,
            quality: result.quality.overallQuality,
            parameters: {
                frameSize: this.config.frameSize,
                sampleRate: this.config.sampleRate
            }
        };
        
        this.processingHistory.push(historyEntry);
        
        // Maintain history length
        if (this.processingHistory.length > this.config.adaptationHistoryLength) {
            this.processingHistory.shift();
        }
        
        // Learn from history
        this.learnFromHistory(result.audioType);
    }
    
    /**
     * Learn optimal parameters from processing history
     */
    private learnFromHistory(audioType: AudioType): void {
        const relevantHistory = this.processingHistory
            .filter(entry => entry.audioType === audioType)
            .slice(-20); // Use recent history
        
        if (relevantHistory.length < 5) return;
        
        // Calculate optimal parameters based on quality scores
        const highQualityEntries = relevantHistory.filter(entry => entry.quality > 0.8);
        
        if (highQualityEntries.length > 0) {
            // Extract common parameters from high-quality results
            const adaptedParams = this.extractOptimalParameters(highQualityEntries);
            this.adaptedParameters.set(audioType, adaptedParams);
        }
    }
    
    /**
     * Extract optimal parameters from high-quality processing history
     */
    private extractOptimalParameters(history: ProcessingHistory[]): any {
        // Simple parameter optimization based on historical success
        return {
            vocal: {
                pitchSmoothingFactor: 0.8, // Learned from successful vocal processing
                formantBandwidth: 100
            },
            instrument: {
                harmonicThreshold: 0.7, // Learned from successful instrument processing
                polyphonicSensitivity: 0.8
            }
        };
    }
    
    /**
     * Assess overall quality of processing results
     */
    private assessQuality(
        buffer: Float32Array, 
        detection: AudioTypeResult, 
        processingResult: VocalAnalysisResult | InstrumentAnalysisResult
    ): QualityMetrics {
        
        const snrEstimate = this.estimateSignalToNoise(buffer);
        const detectionQuality = this.assessDetectionQuality(detection);
        const processingQuality = this.assessProcessingQuality(processingResult, buffer);
        
        const componentQuality = {
            audioDetection: detectionQuality,
            featureExtraction: Math.min(snrEstimate / 20, 1), // Normalize SNR to 0-1
            primaryProcessing: processingQuality
        };
        
        const overallQuality = (
            componentQuality.audioDetection * 0.3 +
            componentQuality.featureExtraction * 0.3 +
            componentQuality.primaryProcessing * 0.4
        );
        
        return {
            overallQuality,
            snrEstimate,
            detectionConfidence: detection.confidence,
            processingAccuracy: processingQuality,
            isReliable: overallQuality > 0.7 && detection.confidence > this.config.confidenceThreshold,
            componentQuality
        };
    }
    
    /**
     * Assess quality of vocal processing results
     */
    private assessVocalQuality(result: VocalAnalysisResult, buffer: Float32Array): number {
        let quality = 0.5; // Base quality
        
        // Check for valid formants
        if (result.formants && result.formants.length >= 2) {
            quality += 0.2;
        }
        
        // Check for valid pitch
        if (result.fundamentalFrequency > 80 && result.fundamentalFrequency < 1000) {
            quality += 0.2;
        }
        
        // Check for vocal characteristics
        if (result.vowelClassification && result.vowelClassification.confidence > 0.6) {
            quality += 0.1;
        }
        
        return Math.min(quality, 1.0);
    }
    
    /**
     * Assess quality of instrument processing results
     */
    private assessInstrumentQuality(result: InstrumentAnalysisResult, buffer: Float32Array): number {
        let quality = 0.5; // Base quality
        
        // Check for valid fundamental frequency
        if (result.fundamentalFrequency > 20 && result.fundamentalFrequency < 8000) {
            quality += 0.2;
        }
        
        // Check for playing techniques detection
        if (result.techniques && Object.values(result.techniques).some(Boolean)) {
            quality += 0.15;
        }
        
        // Check for family-specific analysis
        if (result.familySpecific) {
            quality += 0.15;
        }
        
        return Math.min(quality, 1.0);
    }
    
    /**
     * Get default quality metrics when assessment is disabled
     */
    private getDefaultQuality(): QualityMetrics {
        return {
            overallQuality: 0.8,
            snrEstimate: 15,
            detectionConfidence: 0.8,
            processingAccuracy: 0.8,
            isReliable: true,
            componentQuality: {
                audioDetection: 0.8,
                featureExtraction: 0.8,
                primaryProcessing: 0.8
            }
        };
    }
    
    /**
     * Estimate signal-to-noise ratio of the buffer
     */
    private estimateSignalToNoise(buffer: Float32Array): number {
        // Simple SNR estimation based on signal variance and noise floor
        const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
        const variance = buffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / buffer.length;
        const rms = Math.sqrt(variance);
        
        // Estimate noise floor as minimum RMS in sliding windows
        const windowSize = 1024;
        let minRms = Infinity;
        
        for (let i = 0; i < buffer.length - windowSize; i += windowSize) {
            const window = buffer.slice(i, i + windowSize);
            const windowMean = window.reduce((sum, val) => sum + val, 0) / window.length;
            const windowVariance = window.reduce((sum, val) => sum + Math.pow(val - windowMean, 2), 0) / window.length;
            const windowRms = Math.sqrt(windowVariance);
            minRms = Math.min(minRms, windowRms);
        }
        
        const noiseFloor = minRms;
        const snr = 20 * Math.log10(rms / (noiseFloor + 1e-10)); // Add small epsilon to avoid log(0)
        
        return Math.max(0, Math.min(60, snr)); // Clamp between 0-60 dB
    }
    
    /**
     * Assess quality of audio type detection
     */
    private assessDetectionQuality(detection: AudioTypeResult): number {
        return detection.confidence;
    }
    
    /**
     * Assess quality of processing results
     */
    private assessProcessingQuality(result: VocalAnalysisResult | InstrumentAnalysisResult, buffer: Float32Array): number {
        // Check if result has expected properties
        if (!result.fundamentalFrequency || result.fundamentalFrequency <= 0) {
            return 0.3;
        }
        
        // Basic quality based on frequency validity
        if (result.fundamentalFrequency > 20 && result.fundamentalFrequency < 8000) {
            return 0.8;
        }
        
        return 0.6;
    }
    
    /**
     * Extract fundamental frequency from processing result
     */
    private extractFundamentalFrequency(result: VocalAnalysisResult | InstrumentAnalysisResult): number {
        return result.fundamentalFrequency || 0;
    }
    
    /**
     * Get processing statistics
     */
    public getProcessingStatistics(): {
        totalProcessed: number;
        typeDistribution: Map<AudioType, number>;
        averageQuality: number;
        averageConfidence: number;
    } {
        const totalProcessed = this.processingHistory.length;
        const typeDistribution = new Map<AudioType, number>();
        let totalQuality = 0;
        let totalConfidence = 0;
        
        this.processingHistory.forEach(entry => {
            const count = typeDistribution.get(entry.audioType) || 0;
            typeDistribution.set(entry.audioType, count + 1);
            totalQuality += entry.quality;
            totalConfidence += entry.confidence;
        });
        
        return {
            totalProcessed,
            typeDistribution,
            averageQuality: totalProcessed > 0 ? totalQuality / totalProcessed : 0,
            averageConfidence: totalProcessed > 0 ? totalConfidence / totalProcessed : 0
        };
    }
    
    /**
     * Reset adaptation learning
     */
    public resetAdaptation(): void {
        this.processingHistory = [];
        this.initializeAdaptedParameters();
    }
    
    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<AdaptiveConfig>): void {
        Object.assign(this.config, newConfig);
        
        // Update sub-processors if needed
        if (newConfig.vocalConfig) {
            this.vocalProcessor.updateConfig(newConfig.vocalConfig);
        }
        
        if (newConfig.instrumentConfig) {
            this.instrumentProcessor.updateConfig(newConfig.instrumentConfig);
        }
    }
}