/**
 * Real-time Speaker Detection and Identification Module
 * 
 * Provides continuous speaker identification using voice profiles and
 * real-time audio analysis. Optimized for low-latency processing in
 * multi-speaker environments with adaptive threshold management.
 * 
 * Key Features:
 * - Real-time speaker identification
 * - Voice activity detection (VAD)
 * - Speaker change detection
 * - Adaptive threshold adjustment
 * - Confidence smoothing and validation
 * - Performance monitoring
 */

import { VoiceProfiler, VoiceProfile, VoiceMatchResult } from './VoiceProfiler';

export interface SpeakerDetectionConfig {
    detectionThreshold: number;
    changeSensitivity: number;
    confirmationFrames: number;
    vadThreshold: number;
    adaptiveThreshold: boolean;
    maxSpeakers: number;
    smoothingWindow: number;
    enableChangeDetection: boolean;
}

export interface DetectionResult {
    speakerId: string | null;
    confidence: number;
    allConfidences: Map<string, number>;
    voiceActivity: boolean;
    speakerChange: boolean;
    frameQuality: number;
    timestamp: number;
    speakerDetected?: boolean;
}

export interface SpeakerInfo {
    profile: VoiceProfile;
    confidence: number;
    lastDetected: number;
    detectionCount: number;
    averageConfidence: number;
    isActive: boolean;
}

export interface ProcessingStats {
    totalSpeakers: number;
    activeSpeakers: string[];
    recentAccuracy: number;
    avgProcessingTime: number;
    totalFrames: number;
    voiceActivityRatio: number;
}

export class SpeakerDetector {
    private config: SpeakerDetectionConfig;
    private voiceProfiler: VoiceProfiler;
    private speakers: Map<string, SpeakerInfo> = new Map();
    private confidenceBuffer: Map<string, number[]> = new Map();
    private detectionHistory: DetectionResult[] = [];
    
    private currentSpeaker: string | null = null;
    private speakerConfirmationCount: number = 0;
    private baseThreshold: number;
    private processingTimes: number[] = [];
    private processingStats: ProcessingStats;
    private frameCount: number = 0;
    private voiceActivityCount: number = 0;
    
    constructor(config: Partial<SpeakerDetectionConfig> = {}) {
        this.config = {
            detectionThreshold: 0.7,
            changeSensitivity: 0.6,
            confirmationFrames: 3,
            vadThreshold: 0.3,
            adaptiveThreshold: true,
            maxSpeakers: 5,
            smoothingWindow: 5,
            enableChangeDetection: true,
            ...config
        };
        
        this.baseThreshold = this.config.detectionThreshold;
        this.voiceProfiler = new VoiceProfiler();
        
        this.processingStats = {
            totalSpeakers: 0,
            activeSpeakers: [],
            recentAccuracy: 0,
            avgProcessingTime: 0,
            totalFrames: 0,
            voiceActivityRatio: 0
        };
    }
    
    public registerSpeaker(profile: VoiceProfile): boolean {
        if (this.speakers.size >= this.config.maxSpeakers) {
            console.warn(`Maximum speakers (${this.config.maxSpeakers}) already registered`);
            return false;
        }
        
        const speakerInfo: SpeakerInfo = {
            profile,
            confidence: 0,
            lastDetected: 0,
            detectionCount: 0,
            averageConfidence: 0,
            isActive: false
        };
        
        this.speakers.set(profile.id, speakerInfo);
        this.confidenceBuffer.set(profile.id, []);
        
        this.processingStats.totalSpeakers = this.speakers.size;
        
        console.log(`Speaker registered: ${profile.id}`);
        return true;
    }
    
    public unregisterSpeaker(speakerId: string): boolean {
        if (!this.speakers.has(speakerId)) {
            return false;
        }
        
        this.speakers.delete(speakerId);
        this.confidenceBuffer.delete(speakerId);
        
        if (this.currentSpeaker === speakerId) {
            this.currentSpeaker = null;
            this.speakerConfirmationCount = 0;
        }
        
        this.processingStats.totalSpeakers = this.speakers.size;
        
        return true;
    }
    
    public detectSpeaker(audioFrame: Float32Array): DetectionResult {
        const startTime = performance.now();
        
        const voiceActivity = this.detectVoiceActivity(audioFrame);
        
        let detectedSpeaker: string | null = null;
        let maxConfidence = 0;
        let frameQuality = 0;
        const allConfidences = new Map<string, number>();
        
        if (voiceActivity) {
            for (const [speakerId, speakerInfo] of this.speakers) {
                const matchResult = this.voiceProfiler.matchVoice(
                    audioFrame,
                    speakerInfo.profile,
                    this.getCurrentThreshold()
                );
                
                const smoothedConfidence = this.smoothConfidence(speakerId, matchResult.confidence);
                allConfidences.set(speakerId, smoothedConfidence);
                
                if (smoothedConfidence > maxConfidence && matchResult.isMatch) {
                    maxConfidence = smoothedConfidence;
                    detectedSpeaker = speakerId;
                    frameQuality = matchResult.similarity;
                }
            }
        }
        
        const speakerChange = this.detectSpeakerChange(detectedSpeaker, maxConfidence);
        
        this.updateSpeakerConfirmation(detectedSpeaker, maxConfidence);
        
        this.updateSpeakerStats(detectedSpeaker, maxConfidence, allConfidences);
        
        if (this.config.adaptiveThreshold) {
            this.adjustThreshold(maxConfidence, frameQuality);
        }
        
        const result: DetectionResult = {
            speakerId: this.currentSpeaker,
            confidence: this.currentSpeaker ? allConfidences.get(this.currentSpeaker) || 0 : 0,
            allConfidences,
            voiceActivity,
            speakerChange,
            frameQuality,
            timestamp: Date.now(),
            speakerDetected: this.currentSpeaker !== null
        };
        
        this.updateProcessingStats(performance.now() - startTime, voiceActivity);
        
        this.detectionHistory.push(result);
        if (this.detectionHistory.length > 100) {
            this.detectionHistory.shift();
        }
        
        return result;
    }
    
    private detectVoiceActivity(audioFrame: Float32Array): boolean {
        let energy = 0;
        let zcr = 0;
        
        for (let i = 0; i < audioFrame.length; i++) {
            energy += audioFrame[i] * audioFrame[i];
            if (i > 0 && (audioFrame[i] >= 0) !== (audioFrame[i-1] >= 0)) {
                zcr++;
            }
        }
        
        energy = energy / audioFrame.length;
        zcr = zcr / (audioFrame.length - 1);
        
        const energyThreshold = this.config.vadThreshold * this.config.vadThreshold;
        const zcrThreshold = 0.3;
        
        return energy > energyThreshold && zcr < zcrThreshold;
    }
    
    private smoothConfidence(speakerId: string, newConfidence: number): number {
        const buffer = this.confidenceBuffer.get(speakerId) || [];
        
        buffer.push(newConfidence);
        if (buffer.length > this.config.smoothingWindow) {
            buffer.shift();
        }
        
        this.confidenceBuffer.set(speakerId, buffer);
        
        return buffer.reduce((sum, conf) => sum + conf, 0) / buffer.length;
    }
    
    private detectSpeakerChange(detectedSpeaker: string | null, confidence: number): boolean {
        if (!this.config.enableChangeDetection) {
            return false;
        }
        
        const threshold = this.config.changeSensitivity;
        
        if (detectedSpeaker !== this.currentSpeaker) {
            if (detectedSpeaker && confidence > threshold) {
                return true;
            }
            if (!detectedSpeaker && this.currentSpeaker) {
                return true;
            }
        }
        
        return false;
    }
    
    private updateSpeakerConfirmation(detectedSpeaker: string | null, confidence: number): void {
        if (detectedSpeaker === this.currentSpeaker) {
            this.speakerConfirmationCount = Math.min(
                this.speakerConfirmationCount + 1,
                this.config.confirmationFrames
            );
        } else if (detectedSpeaker && confidence > this.getCurrentThreshold()) {
            if (this.speakerConfirmationCount > 0) {
                this.speakerConfirmationCount--;
            } else {
                this.speakerConfirmationCount = 1;
                if (this.speakerConfirmationCount >= this.config.confirmationFrames) {
                    this.currentSpeaker = detectedSpeaker;
                }
            }
        } else {
            this.speakerConfirmationCount = Math.max(0, this.speakerConfirmationCount - 1);
            if (this.speakerConfirmationCount === 0) {
                this.currentSpeaker = null;
            }
        }
    }
    
    private updateSpeakerStats(
        detectedSpeaker: string | null,
        confidence: number,
        allConfidences: Map<string, number>
    ): void {
        const currentTime = Date.now();
        
        for (const [speakerId, speakerInfo] of this.speakers) {
            const speakerConfidence = allConfidences.get(speakerId) || 0;
            
            if (speakerId === detectedSpeaker && confidence > this.getCurrentThreshold()) {
                speakerInfo.confidence = speakerConfidence;
                speakerInfo.lastDetected = currentTime;
                speakerInfo.detectionCount++;
                speakerInfo.isActive = true;
                
                speakerInfo.averageConfidence = 
                    (speakerInfo.averageConfidence * (speakerInfo.detectionCount - 1) + speakerConfidence) / 
                    speakerInfo.detectionCount;
            } else {
                speakerInfo.isActive = currentTime - speakerInfo.lastDetected < 1000;
            }
        }
        
        this.processingStats.activeSpeakers = Array.from(this.speakers.entries())
            .filter(([, info]) => info.isActive)
            .map(([speakerId]) => speakerId);
    }
    
    private getCurrentThreshold(): number {
        return this.config.detectionThreshold;
    }
    
    private adjustThreshold(confidence: number, quality: number): void {
        const targetConfidence = 0.8;
        const adjustment = 0.02;
        
        if (confidence < targetConfidence && quality > 0.7) {
            this.config.detectionThreshold = Math.max(0.3, this.config.detectionThreshold - adjustment);
        } else if (confidence > targetConfidence + 0.1) {
            this.config.detectionThreshold = Math.min(0.9, this.config.detectionThreshold + adjustment);
        }
    }
    
    private updateProcessingStats(processingTime: number, voiceActivity: boolean): void {
        this.frameCount++;
        if (voiceActivity) {
            this.voiceActivityCount++;
        }
        
        this.processingTimes.push(processingTime);
        if (this.processingTimes.length > 50) {
            this.processingTimes.shift();
        }
        
        this.processingStats.avgProcessingTime = 
            this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
        
        this.processingStats.totalFrames = this.frameCount;
        this.processingStats.voiceActivityRatio = this.voiceActivityCount / this.frameCount;
    }
    
    public getSpeakerInfo(speakerId: string): SpeakerInfo | null {
        return this.speakers.get(speakerId) || null;
    }
    
    public getAllSpeakers(): Map<string, SpeakerInfo> {
        return new Map(this.speakers);
    }
    
    public getProcessingStats(): ProcessingStats {
        return { ...this.processingStats };
    }
    
    public getDetectionHistory(count: number = 20): DetectionResult[] {
        return this.detectionHistory.slice(-count);
    }
    
    public reset(): void {
        this.speakers.clear();
        this.confidenceBuffer.clear();
        this.detectionHistory = [];
        this.currentSpeaker = null;
        this.speakerConfirmationCount = 0;
        this.frameCount = 0;
        this.voiceActivityCount = 0;
        this.processingTimes = [];
        this.config.detectionThreshold = this.baseThreshold;
        
        this.processingStats = {
            totalSpeakers: 0,
            activeSpeakers: [],
            recentAccuracy: 0,
            avgProcessingTime: 0,
            totalFrames: 0,
            voiceActivityRatio: 0
        };
    }
    
    public updateConfig(newConfig: Partial<SpeakerDetectionConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        if (newConfig.detectionThreshold !== undefined) {
            this.baseThreshold = newConfig.detectionThreshold;
        }
    }
    
    public getConfig(): SpeakerDetectionConfig {
        return { ...this.config };
    }
    
    public calculateRecentAccuracy(): number {
        const recentDetections = this.detectionHistory.slice(-100);
        
        if (recentDetections.length === 0) {
            return 0;
        }
        
        let accuracySum = 0;
        
        for (const detection of recentDetections) {
            if (detection.voiceActivity && detection.speakerId) {
                accuracySum += detection.confidence;
            } else if (!detection.voiceActivity) {
                accuracySum += 1;
            }
        }
        
        const accuracy = accuracySum / recentDetections.length;
        this.processingStats.recentAccuracy = accuracy;
        
        return accuracy;
    }
}

export default SpeakerDetector;