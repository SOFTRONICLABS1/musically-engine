/**
 * Target Speaker Extraction System
 * 
 * Complete pipeline for isolating and enhancing a specific speaker's voice
 * from multi-speaker audio environments. Integrates voice profiling,
 * speaker detection, source separation, and enhanced noise reduction.
 * 
 * Key Features:
 * - Real-time target speaker identification
 * - Advanced source separation algorithms
 * - Psychoacoustic noise reduction
 * - Adaptive learning and optimization
 * - Voice training and profiling
 * - Quality assessment and feedback
 */

import { NoiseReducer, NoiseReductionConfig } from './NoiseReducer';
import { VoiceProfiler, VoiceProfile, VoiceMatchResult } from '../utils/VoiceProfiler';
import { SpeakerDetector, SpeakerDetectionConfig, DetectionResult } from '../utils/SpeakerDetector';
import { AudioSourceSeparator, SeparationConfig, SeparationResult, SourceProfile } from '../utils/AudioSourceSeparator';

export interface TargetSpeakerConfig {
    enabled: boolean;
    extractionAggressiveness: number;
    detectionThreshold: number;
    voiceTrainingMode: boolean;
    trainingDuration: number;
    enableAdaptation: boolean;
    enableQualityMonitoring: boolean;
    separationAlgorithm: 'spectral_masking' | 'wiener_filter' | 'ica' | 'adaptive_subtraction';
    enableNoiseReduction: boolean;
    frameSize: number;
    overlapRatio: number;
    maxInterferingSpeakers: number;
    debugMode: boolean;
}

export interface ExtractionResult {
    targetAudio: Float32Array;
    interferingAudio: Float32Array;
    targetConfidence: number;
    separationQuality: number;
    noiseReductionApplied: boolean;
    stats: {
        processingTime: number;
        speakerDetected: boolean;
        voiceActivity: boolean;
        qualityScore: number;
        adaptationApplied: boolean;
    };
    algorithmInfo: {
        detectionAlgorithm: string;
        separationAlgorithm: string;
        noiseReductionAlgorithm: string;
    };
}

export interface TrainingProgress {
    progress: number;
    phase: 'initialization' | 'voice_analysis' | 'profile_creation' | 'validation' | 'completed';
    profileConfidence: number;
    qualityIndicators: {
        signalClarity: number;
        voiceConsistency: number;
        backgroundNoise: number;
        spectralRichness: number;
    };
    estimatedTimeRemaining: number;
    samplesCollected: number;
    targetSamples: number;
}

export interface SystemStats {
    totalProcessingTime: number;
    framesProcessed: number;
    averageQuality: number;
    detectionRate: number;
    trainingStatus: 'not_started' | 'in_progress' | 'completed' | 'needs_retraining';
    performance: {
        realTimeRatio: number;
        memoryUsage: number;
        cpuUsage: number;
    };
}

export class TargetSpeakerExtraction {
    private config: TargetSpeakerConfig;
    private sampleRate: number;
    
    private voiceProfiler: VoiceProfiler;
    private speakerDetector: SpeakerDetector;
    private sourceSeparator: AudioSourceSeparator;
    private noiseReducer: NoiseReducer;
    
    private targetVoiceProfile: VoiceProfile | null = null;
    private isTraining: boolean = false;
    private trainingData: Float32Array[] = [];
    private trainingStartTime: number = 0;
    private systemStats: SystemStats;
    
    private extractionHistory: ExtractionResult[] = [];
    private qualityHistory: number[] = [];
    private processingTimes: number[] = [];
    
    private adaptationParams: Map<string, number> = new Map();
    
    constructor(sampleRate: number = 44100, config: Partial<TargetSpeakerConfig> = {}) {
        this.sampleRate = sampleRate;
        this.config = {
            enabled: true,
            extractionAggressiveness: 0.8,
            detectionThreshold: 0.7,
            voiceTrainingMode: false,
            trainingDuration: 30000,
            enableAdaptation: true,
            enableQualityMonitoring: true,
            separationAlgorithm: 'spectral_masking',
            enableNoiseReduction: true,
            frameSize: 2048,
            overlapRatio: 0.5,
            maxInterferingSpeakers: 3,
            debugMode: false,
            ...config
        };
        
        this.initializeComponents();
        this.initializeSystemStats();
        this.initializeAdaptationParams();
    }
    
    private initializeComponents(): void {
        this.voiceProfiler = new VoiceProfiler(this.sampleRate, this.config.frameSize);
        
        const detectorConfig: Partial<SpeakerDetectionConfig> = {
            detectionThreshold: this.config.detectionThreshold,
            maxSpeakers: this.config.maxInterferingSpeakers + 1,
            enableChangeDetection: true,
            adaptiveThreshold: this.config.enableAdaptation
        };
        this.speakerDetector = new SpeakerDetector(detectorConfig);
        
        const separatorConfig: Partial<SeparationConfig> = {
            algorithm: this.config.separationAlgorithm,
            aggressiveness: this.config.extractionAggressiveness,
            frameSize: this.config.frameSize,
            overlapRatio: this.config.overlapRatio,
            maxSources: this.config.maxInterferingSpeakers + 1,
            enableRealTimeOptimization: this.config.enableAdaptation
        };
        this.sourceSeparator = new AudioSourceSeparator(this.sampleRate, separatorConfig);
        
        const noiseConfig: Partial<NoiseReductionConfig> = {
            enabled: this.config.enableNoiseReduction,
            aggressiveness: 0.7,
            enablePsychoacoustic: true,
            enableMusicalNoiseReduction: true,
            enableAdaptiveLearning: true,
            windowSize: this.config.frameSize
        };
        this.noiseReducer = new NoiseReducer(this.sampleRate, noiseConfig);
    }
    
    public startVoiceTraining(duration?: number): string {
        if (this.isTraining) {
            throw new Error('Voice training already in progress');
        }
        
        this.isTraining = true;
        this.trainingData = [];
        this.trainingStartTime = Date.now();
        this.config.voiceTrainingMode = true;
        
        if (duration) {
            this.config.trainingDuration = duration;
        }
        
        const sessionId = `training_${Date.now()}`;
        
        if (this.config.debugMode) {
            console.log(`Voice training started: ${sessionId}, duration: ${this.config.trainingDuration}ms`);
        }
        
        return sessionId;
    }
    
    public process(audioFrame: Float32Array): ExtractionResult | TrainingProgress {
        const startTime = performance.now();
        
        if (this.isTraining) {
            return this.processTrainingFrame(audioFrame, startTime);
        } else if (this.config.enabled && this.targetVoiceProfile) {
            return this.processExtractionFrame(audioFrame, startTime);
        } else {
            return {
                targetAudio: new Float32Array(audioFrame),
                interferingAudio: new Float32Array(audioFrame.length),
                targetConfidence: 0,
                separationQuality: 0,
                noiseReductionApplied: false,
                stats: {
                    processingTime: performance.now() - startTime,
                    speakerDetected: false,
                    voiceActivity: false,
                    qualityScore: 0,
                    adaptationApplied: false
                },
                algorithmInfo: {
                    detectionAlgorithm: 'none',
                    separationAlgorithm: 'none',
                    noiseReductionAlgorithm: 'none'
                }
            };
        }
    }
    
    private processTrainingFrame(audioFrame: Float32Array, startTime: number): TrainingProgress {
        const currentTime = Date.now();
        const elapsedTime = currentTime - this.trainingStartTime;
        
        if (elapsedTime >= this.config.trainingDuration) {
            return this.finalizeTraining();
        }
        
        const frameQuality = this.assessTrainingFrameQuality(audioFrame);
        
        if (frameQuality > 0.5) {
            this.trainingData.push(new Float32Array(audioFrame));
        }
        
        const progress = Math.min(1.0, elapsedTime / this.config.trainingDuration);
        const targetSamples = Math.floor(this.config.trainingDuration / (this.config.frameSize / this.sampleRate * 1000));
        
        return {
            progress,
            phase: this.getTrainingPhase(progress),
            profileConfidence: Math.min(1.0, this.trainingData.length / (targetSamples * 0.5)),
            qualityIndicators: this.calculateTrainingQuality(audioFrame),
            estimatedTimeRemaining: Math.max(0, this.config.trainingDuration - elapsedTime),
            samplesCollected: this.trainingData.length,
            targetSamples
        };
    }
    
    private processExtractionFrame(audioFrame: Float32Array, startTime: number): ExtractionResult {
        const detectionResult = this.speakerDetector.detectSpeaker(audioFrame);
        
        let targetAudio = new Float32Array(audioFrame);
        let interferingAudio = new Float32Array(audioFrame.length);
        let separationQuality = 0;
        let noiseReductionApplied = false;
        
        if (detectionResult.speakerDetected && detectionResult.speakerId === this.targetVoiceProfile!.id) {
            const separationResult = this.sourceSeparator.separateSources(
                audioFrame,
                [this.targetVoiceProfile!.id]
            );
            
            if (separationResult.sources.length > 0) {
                targetAudio = separationResult.sources[0];
                separationQuality = separationResult.separationQuality;
                
                for (let i = 0; i < audioFrame.length; i++) {
                    interferingAudio[i] = audioFrame[i] - targetAudio[i];
                }
            }
        }
        
        if (this.config.enableNoiseReduction && separationQuality > 0.3) {
            targetAudio = this.noiseReducer.process(targetAudio);
            noiseReductionApplied = true;
        }
        
        const qualityScore = this.assessExtractionQuality(targetAudio, interferingAudio, detectionResult);
        
        let adaptationApplied = false;
        if (this.config.enableAdaptation && qualityScore < 0.6) {
            this.applyAdaptation(qualityScore, detectionResult);
            adaptationApplied = true;
        }
        
        const processingTime = performance.now() - startTime;
        
        const result: ExtractionResult = {
            targetAudio,
            interferingAudio,
            targetConfidence: detectionResult.confidence,
            separationQuality,
            noiseReductionApplied,
            stats: {
                processingTime,
                speakerDetected: detectionResult.speakerDetected,
                voiceActivity: detectionResult.voiceActivity,
                qualityScore,
                adaptationApplied
            },
            algorithmInfo: {
                detectionAlgorithm: 'voice_profiling',
                separationAlgorithm: this.config.separationAlgorithm,
                noiseReductionAlgorithm: noiseReductionApplied ? 'psychoacoustic' : 'none'
            }
        };
        
        this.updateSystemStats(result);
        
        return result;
    }
    
    private finalizeTraining(): TrainingProgress {
        this.isTraining = false;
        this.config.voiceTrainingMode = false;
        
        if (this.trainingData.length === 0) {
            throw new Error('No training data collected');
        }
        
        try {
            this.targetVoiceProfile = this.voiceProfiler.createVoiceProfile(
                this.trainingData,
                'target_speaker'
            );
            
            this.speakerDetector.registerSpeaker(this.targetVoiceProfile);
            
            const sourceProfile: SourceProfile = {
                id: this.targetVoiceProfile.id,
                voiceProfile: this.targetVoiceProfile,
                spectralProfile: this.targetVoiceProfile.spectralEnvelope,
                f0Range: this.targetVoiceProfile.fundamentalFrequencyRange,
                formants: [this.targetVoiceProfile.formants.f1, this.targetVoiceProfile.formants.f2, 
                          this.targetVoiceProfile.formants.f3, this.targetVoiceProfile.formants.f4],
                sourceType: 'voice',
                profileConfidence: this.targetVoiceProfile.confidence
            };
            
            this.sourceSeparator.registerSourceProfile(sourceProfile);
            
            this.systemStats.trainingStatus = 'completed';
            
            if (this.config.debugMode) {
                console.log(`Voice training completed. Profile confidence: ${this.targetVoiceProfile.confidence}`);
            }
            
            return {
                progress: 1.0,
                phase: 'completed',
                profileConfidence: this.targetVoiceProfile.confidence,
                qualityIndicators: {
                    signalClarity: 0.8,
                    voiceConsistency: 0.9,
                    backgroundNoise: 0.1,
                    spectralRichness: 0.8
                },
                estimatedTimeRemaining: 0,
                samplesCollected: this.trainingData.length,
                targetSamples: this.trainingData.length
            };
            
        } catch (error) {
            this.systemStats.trainingStatus = 'needs_retraining';
            throw new Error(`Training failed: ${(error as Error).message}`);
        }
    }
    
    private assessTrainingFrameQuality(audioFrame: Float32Array): number {
        let energy = 0;
        for (let i = 0; i < audioFrame.length; i++) {
            energy += audioFrame[i] * audioFrame[i];
        }
        energy = energy / audioFrame.length;
        
        let zcr = 0;
        for (let i = 1; i < audioFrame.length; i++) {
            if ((audioFrame[i] >= 0) !== (audioFrame[i-1] >= 0)) {
                zcr++;
            }
        }
        zcr = zcr / (audioFrame.length - 1);
        
        const energyScore = Math.min(1, energy * 10000);
        const zcrScore = Math.max(0, 1 - zcr * 5);
        
        return (energyScore * 0.7 + zcrScore * 0.3);
    }
    
    private getTrainingPhase(progress: number): TrainingProgress['phase'] {
        if (progress < 0.1) return 'initialization';
        if (progress < 0.7) return 'voice_analysis';
        if (progress < 0.9) return 'profile_creation';
        if (progress < 1.0) return 'validation';
        return 'completed';
    }
    
    private calculateTrainingQuality(audioFrame: Float32Array): TrainingProgress['qualityIndicators'] {
        const frameQuality = this.assessTrainingFrameQuality(audioFrame);
        
        return {
            signalClarity: frameQuality,
            voiceConsistency: Math.min(1, this.trainingData.length / 100),
            backgroundNoise: Math.max(0, 1 - frameQuality),
            spectralRichness: 0.8
        };
    }
    
    private assessExtractionQuality(
        targetAudio: Float32Array,
        interferingAudio: Float32Array,
        detectionResult: DetectionResult
    ): number {
        const detectionConfidence = detectionResult.confidence;
        const separationRatio = this.calculateSeparationRatio(targetAudio, interferingAudio);
        const signalQuality = this.calculateSignalQuality(targetAudio);
        
        return (detectionConfidence * 0.4 + separationRatio * 0.3 + signalQuality * 0.3);
    }
    
    private calculateSeparationRatio(targetAudio: Float32Array, interferingAudio: Float32Array): number {
        let targetEnergy = 0;
        let interferingEnergy = 0;
        
        for (let i = 0; i < targetAudio.length; i++) {
            targetEnergy += targetAudio[i] * targetAudio[i];
            interferingEnergy += interferingAudio[i] * interferingAudio[i];
        }
        
        const totalEnergy = targetEnergy + interferingEnergy;
        if (totalEnergy === 0) return 0;
        
        return targetEnergy / totalEnergy;
    }
    
    private calculateSignalQuality(audio: Float32Array): number {
        let energy = 0;
        for (let i = 0; i < audio.length; i++) {
            energy += audio[i] * audio[i];
        }
        energy = energy / audio.length;
        
        return Math.min(1, energy * 5000);
    }
    
    private applyAdaptation(qualityScore: number, detectionResult: DetectionResult): void {
        if (detectionResult.confidence < 0.5 && qualityScore < 0.4) {
            const currentThreshold = this.speakerDetector.getConfig().detectionThreshold;
            const newThreshold = Math.max(0.3, currentThreshold - 0.05);
            this.speakerDetector.updateConfig({ detectionThreshold: newThreshold });
        }
        
        if (qualityScore < 0.5) {
            const currentAgg = this.sourceSeparator.getConfig().aggressiveness;
            const newAgg = Math.min(0.95, currentAgg + 0.05);
            this.sourceSeparator.updateConfig({ aggressiveness: newAgg });
        }
        
        if (qualityScore < 0.6) {
            const currentAgg = this.noiseReducer.getConfig().aggressiveness;
            const newAgg = Math.min(0.9, currentAgg + 0.05);
            this.noiseReducer.setConfig({ aggressiveness: newAgg });
        }
    }
    
    private initializeSystemStats(): void {
        this.systemStats = {
            totalProcessingTime: 0,
            framesProcessed: 0,
            averageQuality: 0,
            detectionRate: 0,
            trainingStatus: 'not_started',
            performance: {
                realTimeRatio: 0,
                memoryUsage: 0,
                cpuUsage: 0
            }
        };
    }
    
    private initializeAdaptationParams(): void {
        this.adaptationParams.set('detection_threshold_min', 0.3);
        this.adaptationParams.set('detection_threshold_max', 0.9);
        this.adaptationParams.set('separation_aggressiveness_min', 0.3);
        this.adaptationParams.set('separation_aggressiveness_max', 0.95);
        this.adaptationParams.set('quality_adaptation_rate', 0.1);
    }
    
    private updateSystemStats(result: ExtractionResult): void {
        this.systemStats.totalProcessingTime += result.stats.processingTime;
        this.systemStats.framesProcessed++;
        
        this.qualityHistory.push(result.stats.qualityScore);
        if (this.qualityHistory.length > 100) {
            this.qualityHistory.shift();
        }
        
        this.systemStats.averageQuality = 
            this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
        
        this.processingTimes.push(result.stats.processingTime);
        if (this.processingTimes.length > 50) {
            this.processingTimes.shift();
        }
        
        const avgProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
        const frameTimeMs = (this.config.frameSize / this.sampleRate) * 1000;
        this.systemStats.performance.realTimeRatio = avgProcessingTime / frameTimeMs;
        
        const recentResults = this.extractionHistory.slice(-50);
        const detections = recentResults.filter(r => r.stats.speakerDetected).length;
        this.systemStats.detectionRate = recentResults.length > 0 ? detections / recentResults.length : 0;
        
        this.extractionHistory.push(result);
        if (this.extractionHistory.length > 100) {
            this.extractionHistory.shift();
        }
    }
    
    public getTargetVoiceProfile(): VoiceProfile | null {
        return this.targetVoiceProfile;
    }
    
    public setTargetVoiceProfile(profile: VoiceProfile): void {
        this.targetVoiceProfile = profile;
        
        this.speakerDetector.registerSpeaker(profile);
        
        const sourceProfile: SourceProfile = {
            id: profile.id,
            voiceProfile: profile,
            spectralProfile: profile.spectralEnvelope,
            f0Range: profile.fundamentalFrequencyRange,
            formants: [profile.formants.f1, profile.formants.f2, profile.formants.f3, profile.formants.f4],
            sourceType: 'voice',
            profileConfidence: profile.confidence
        };
        
        this.sourceSeparator.registerSourceProfile(sourceProfile);
        
        this.systemStats.trainingStatus = 'completed';
    }
    
    public getSystemStats(): SystemStats {
        return { ...this.systemStats };
    }
    
    public getExtractionHistory(count: number = 20): ExtractionResult[] {
        return this.extractionHistory.slice(-count);
    }
    
    public updateConfig(newConfig: Partial<TargetSpeakerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        if (newConfig.detectionThreshold !== undefined) {
            this.speakerDetector.updateConfig({ detectionThreshold: newConfig.detectionThreshold });
        }
        
        if (newConfig.separationAlgorithm !== undefined || newConfig.extractionAggressiveness !== undefined) {
            this.sourceSeparator.updateConfig({
                algorithm: newConfig.separationAlgorithm,
                aggressiveness: newConfig.extractionAggressiveness
            });
        }
        
        if (newConfig.enableNoiseReduction !== undefined) {
            this.noiseReducer.setConfig({ enabled: newConfig.enableNoiseReduction });
        }
    }
    
    public getConfig(): TargetSpeakerConfig {
        return { ...this.config };
    }
    
    public reset(): void {
        if (this.isTraining) {
            this.isTraining = false;
            this.config.voiceTrainingMode = false;
        }
        
        this.targetVoiceProfile = null;
        
        this.speakerDetector.reset();
        this.sourceSeparator.reset();
        this.noiseReducer.resetNoiseProfile();
        
        this.extractionHistory = [];
        this.qualityHistory = [];
        this.processingTimes = [];
        this.trainingData = [];
        
        this.initializeSystemStats();
        
        if (this.config.debugMode) {
            console.log('Target Speaker Extraction system reset');
        }
    }
    
    public isReady(): boolean {
        return this.config.enabled && 
               this.targetVoiceProfile !== null && 
               !this.isTraining;
    }
    
    public getTrainingStatus(): {
        isTraining: boolean;
        hasProfile: boolean;
        profileConfidence: number;
        trainingProgress: number;
    } {
        return {
            isTraining: this.isTraining,
            hasProfile: this.targetVoiceProfile !== null,
            profileConfidence: this.targetVoiceProfile?.confidence || 0,
            trainingProgress: this.isTraining ? 
                Math.min(1, (Date.now() - this.trainingStartTime) / this.config.trainingDuration) : 
                (this.targetVoiceProfile ? 1 : 0)
        };
    }
}

export default TargetSpeakerExtraction;