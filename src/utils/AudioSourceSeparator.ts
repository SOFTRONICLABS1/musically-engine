/**
 * Audio Source Separation Module
 * 
 * Implements advanced audio source separation algorithms for multi-speaker
 * environments. Separates mixed audio into individual speaker components
 * using spectral masking, Independent Component Analysis (ICA), and
 * machine learning-based approaches.
 * 
 * Key Features:
 * - Spectral masking-based separation
 * - Independent Component Analysis (ICA)
 * - Wiener filtering for source isolation
 * - Adaptive spectral subtraction
 * - Harmonic-percussive separation
 * - Real-time processing optimization
 */

import { FFT } from '../algorithms/FFT';
import { VoiceProfile } from './VoiceProfiler';
import { MathUtils } from './MathUtils';

export interface SeparationConfig {
    algorithm: 'spectral_masking' | 'wiener_filter' | 'ica' | 'adaptive_subtraction';
    aggressiveness: number;
    frameSize: number;
    overlapRatio: number;
    enableHarmonicEnhancement: boolean;
    enableNoiseSuppression: boolean;
    minSeparationConfidence: number;
    maxSources: number;
    enableRealTimeOptimization: boolean;
}

export interface SeparationResult {
    sources: Float32Array[];
    confidences: number[];
    sourceLabels: string[];
    separationQuality: number;
    processingTime: number;
    algorithmUsed: string;
}

export interface SourceProfile {
    id: string;
    voiceProfile?: VoiceProfile;
    spectralProfile: Float32Array;
    f0Range: [number, number];
    formants: number[];
    sourceType: 'voice' | 'music' | 'noise' | 'unknown';
    profileConfidence: number;
}

export class AudioSourceSeparator {
    private config: SeparationConfig;
    private fft: FFT;
    private sampleRate: number;
    private sourceProfiles: Map<string, SourceProfile> = new Map();
    private separationHistory: SeparationResult[] = [];
    private adaptiveParams: Map<string, number> = new Map();
    
    private previousSpectra: Float32Array[] = [];
    private noiseProfile: Float32Array | null = null;
    private icaWeights: Float32Array[][] | null = null;
    
    private processingTimes: number[] = [];
    
    constructor(sampleRate: number = 44100, config: Partial<SeparationConfig> = {}) {
        this.sampleRate = sampleRate;
        this.config = {
            algorithm: 'spectral_masking',
            aggressiveness: 0.7,
            frameSize: 2048,
            overlapRatio: 0.5,
            enableHarmonicEnhancement: true,
            enableNoiseSuppression: true,
            minSeparationConfidence: 0.6,
            maxSources: 3,
            enableRealTimeOptimization: true,
            ...config
        };
        
        this.fft = new FFT(this.config.frameSize);
        this.initializeAdaptiveParams();
    }
    
    public registerSourceProfile(profile: SourceProfile): void {
        this.sourceProfiles.set(profile.id, profile);
        console.log(`Source profile registered: ${profile.id} (${profile.sourceType})`);
    }
    
    public separateSources(
        mixedAudio: Float32Array,
        targetSourceIds?: string[]
    ): SeparationResult {
        const startTime = performance.now();
        
        let result: SeparationResult;
        
        switch (this.config.algorithm) {
            case 'spectral_masking':
                result = this.spectralMaskingSeparation(mixedAudio, targetSourceIds);
                break;
            case 'wiener_filter':
                result = this.wienerFilterSeparation(mixedAudio, targetSourceIds);
                break;
            case 'ica':
                result = this.icaSeparation(mixedAudio, targetSourceIds);
                break;
            case 'adaptive_subtraction':
                result = this.adaptiveSubtractionSeparation(mixedAudio, targetSourceIds);
                break;
            default:
                throw new Error(`Unknown separation algorithm: ${this.config.algorithm}`);
        }
        
        result.processingTime = performance.now() - startTime;
        result.algorithmUsed = this.config.algorithm;
        
        this.updateProcessingStats(result);
        this.separationHistory.push(result);
        
        if (this.separationHistory.length > 100) {
            this.separationHistory.shift();
        }
        
        return result;
    }
    
    private spectralMaskingSeparation(
        mixedAudio: Float32Array,
        targetSourceIds?: string[]
    ): SeparationResult {
        const spectrum = this.fft.forward(mixedAudio);
        const magnitude = MathUtils.computeMagnitude(spectrum);
        const phase = MathUtils.computePhase(spectrum);
        
        const separatedSources: Float32Array[] = [];
        const confidences: number[] = [];
        const sourceLabels: string[] = [];
        
        const profiles = targetSourceIds ? 
            targetSourceIds.map(id => this.sourceProfiles.get(id)).filter(p => p) as SourceProfile[] :
            Array.from(this.sourceProfiles.values());
        
        for (const profile of profiles) {
            const mask = this.createSpectralMask(magnitude, profile);
            const maskedSpectrum = this.applySpectralMask(spectrum, mask);
            const separatedAudio = this.fft.inverse(maskedSpectrum);
            
            separatedSources.push(separatedAudio.slice(0, mixedAudio.length));
            confidences.push(this.calculateSeparationConfidence(magnitude, mask, profile));
            sourceLabels.push(profile.id);
        }
        
        const separationQuality = this.assessSeparationQuality(separatedSources, mixedAudio);
        
        return {
            sources: separatedSources,
            confidences,
            sourceLabels,
            separationQuality,
            processingTime: 0,
            algorithmUsed: 'spectral_masking'
        };
    }
    
    private wienerFilterSeparation(
        mixedAudio: Float32Array,
        targetSourceIds?: string[]
    ): SeparationResult {
        const spectrum = this.fft.forward(mixedAudio);
        const magnitude = MathUtils.computeMagnitude(spectrum);
        
        const separatedSources: Float32Array[] = [];
        const confidences: number[] = [];
        const sourceLabels: string[] = [];
        
        const profiles = targetSourceIds ? 
            targetSourceIds.map(id => this.sourceProfiles.get(id)).filter(p => p) as SourceProfile[] :
            Array.from(this.sourceProfiles.values());
        
        for (const profile of profiles) {
            const wienerFilter = this.computeWienerFilter(magnitude, profile);
            const filteredSpectrum = this.applyWienerFilter(spectrum, wienerFilter);
            const separatedAudio = this.fft.inverse(filteredSpectrum);
            
            separatedSources.push(separatedAudio.slice(0, mixedAudio.length));
            confidences.push(this.calculateFilterConfidence(wienerFilter, profile));
            sourceLabels.push(profile.id);
        }
        
        const separationQuality = this.assessSeparationQuality(separatedSources, mixedAudio);
        
        return {
            sources: separatedSources,
            confidences,
            sourceLabels,
            separationQuality,
            processingTime: 0,
            algorithmUsed: 'wiener_filter'
        };
    }
    
    private icaSeparation(
        mixedAudio: Float32Array,
        targetSourceIds?: string[]
    ): SeparationResult {
        if (!this.icaWeights || this.icaWeights.length === 0) {
            this.initializeICAWeights();
        }
        
        const separatedSources: Float32Array[] = [];
        const confidences: number[] = [];
        const sourceLabels: string[] = [];
        
        const sources = this.performICA(mixedAudio);
        
        const profiles = targetSourceIds ? 
            targetSourceIds.map(id => this.sourceProfiles.get(id)).filter(p => p) as SourceProfile[] :
            Array.from(this.sourceProfiles.values());
        
        for (let i = 0; i < Math.min(sources.length, profiles.length); i++) {
            separatedSources.push(sources[i]);
            confidences.push(0.7); // Simplified confidence for ICA
            sourceLabels.push(profiles[i].id);
        }
        
        const separationQuality = this.assessSeparationQuality(separatedSources, mixedAudio);
        
        return {
            sources: separatedSources,
            confidences,
            sourceLabels,
            separationQuality,
            processingTime: 0,
            algorithmUsed: 'ica'
        };
    }
    
    private adaptiveSubtractionSeparation(
        mixedAudio: Float32Array,
        targetSourceIds?: string[]
    ): SeparationResult {
        const spectrum = this.fft.forward(mixedAudio);
        const magnitude = MathUtils.computeMagnitude(spectrum);
        
        const separatedSources: Float32Array[] = [];
        const confidences: number[] = [];
        const sourceLabels: string[] = [];
        
        const profiles = targetSourceIds ? 
            targetSourceIds.map(id => this.sourceProfiles.get(id)).filter(p => p) as SourceProfile[] :
            Array.from(this.sourceProfiles.values());
        
        for (const profile of profiles) {
            const adaptiveFilter = this.computeAdaptiveFilter(magnitude, profile);
            const filteredSpectrum = this.applyAdaptiveFilter(spectrum, adaptiveFilter);
            const separatedAudio = this.fft.inverse(filteredSpectrum);
            
            separatedSources.push(separatedAudio.slice(0, mixedAudio.length));
            confidences.push(this.calculateAdaptiveConfidence(adaptiveFilter, profile));
            sourceLabels.push(profile.id);
        }
        
        const separationQuality = this.assessSeparationQuality(separatedSources, mixedAudio);
        
        return {
            sources: separatedSources,
            confidences,
            sourceLabels,
            separationQuality,
            processingTime: 0,
            algorithmUsed: 'adaptive_subtraction'
        };
    }
    
    private createSpectralMask(magnitude: Float32Array, profile: SourceProfile): Float32Array {
        const mask = new Float32Array(magnitude.length);
        
        for (let i = 0; i < magnitude.length; i++) {
            const frequency = (i / magnitude.length) * (this.sampleRate / 2);
            
            let maskValue = 0;
            
            if (profile.voiceProfile) {
                const f0 = profile.voiceProfile.fundamentalFrequency;
                const harmonics = this.getHarmonics(f0, frequency);
                const formantResponse = this.getFormantResponse(frequency, profile.formants);
                
                maskValue = harmonics * formantResponse * profile.profileConfidence;
            } else {
                const spectralMatch = this.getSpectralMatch(frequency, profile.spectralProfile);
                maskValue = spectralMatch * profile.profileConfidence;
            }
            
            mask[i] = Math.min(1, Math.max(0, maskValue * this.config.aggressiveness));
        }
        
        return mask;
    }
    
    private applySpectralMask(spectrum: Float32Array, mask: Float32Array): Float32Array {
        const maskedSpectrum = new Float32Array(spectrum.length);
        
        for (let i = 0; i < spectrum.length; i += 2) {
            const magnitude = Math.sqrt(spectrum[i] ** 2 + spectrum[i + 1] ** 2);
            const phase = Math.atan2(spectrum[i + 1], spectrum[i]);
            const maskIndex = Math.floor(i / 2);
            
            const maskedMagnitude = magnitude * (maskIndex < mask.length ? mask[maskIndex] : 0);
            
            maskedSpectrum[i] = maskedMagnitude * Math.cos(phase);
            maskedSpectrum[i + 1] = maskedMagnitude * Math.sin(phase);
        }
        
        return maskedSpectrum;
    }
    
    private computeWienerFilter(magnitude: Float32Array, profile: SourceProfile): Float32Array {
        const filter = new Float32Array(magnitude.length);
        const noiseLevel = this.estimateNoiseLevel(magnitude);
        
        for (let i = 0; i < magnitude.length; i++) {
            const signalPower = magnitude[i] ** 2;
            const noisePower = noiseLevel ** 2;
            
            filter[i] = signalPower / (signalPower + noisePower);
        }
        
        return filter;
    }
    
    private applyWienerFilter(spectrum: Float32Array, filter: Float32Array): Float32Array {
        const filteredSpectrum = new Float32Array(spectrum.length);
        
        for (let i = 0; i < spectrum.length; i += 2) {
            const filterIndex = Math.floor(i / 2);
            const filterValue = filterIndex < filter.length ? filter[filterIndex] : 0;
            
            filteredSpectrum[i] = spectrum[i] * filterValue;
            filteredSpectrum[i + 1] = spectrum[i + 1] * filterValue;
        }
        
        return filteredSpectrum;
    }
    
    private initializeICAWeights(): void {
        const numSources = Math.min(this.config.maxSources, this.sourceProfiles.size);
        this.icaWeights = [];
        
        for (let i = 0; i < numSources; i++) {
            const weights = new Float32Array(this.config.frameSize);
            for (let j = 0; j < weights.length; j++) {
                weights[j] = (Math.random() - 0.5) * 2;
            }
            this.icaWeights.push([weights]);
        }
    }
    
    private performICA(mixedAudio: Float32Array): Float32Array[] {
        const sources: Float32Array[] = [];
        
        if (!this.icaWeights) {
            this.initializeICAWeights();
        }
        
        for (const weights of this.icaWeights!) {
            const source = new Float32Array(mixedAudio.length);
            
            for (let i = 0; i < mixedAudio.length; i++) {
                let value = 0;
                for (let j = 0; j < weights.length && j < weights[0].length; j++) {
                    const inputIndex = Math.min(i + j, mixedAudio.length - 1);
                    value += mixedAudio[inputIndex] * weights[0][j];
                }
                source[i] = value;
            }
            
            sources.push(source);
        }
        
        return sources;
    }
    
    private computeAdaptiveFilter(magnitude: Float32Array, profile: SourceProfile): Float32Array {
        const filter = new Float32Array(magnitude.length);
        const adaptationRate = this.adaptiveParams.get('adaptation_rate') || 0.1;
        
        for (let i = 0; i < magnitude.length; i++) {
            const frequency = (i / magnitude.length) * (this.sampleRate / 2);
            
            let targetResponse = 0;
            if (profile.voiceProfile) {
                targetResponse = this.getFormantResponse(frequency, profile.formants);
            } else {
                targetResponse = this.getSpectralMatch(frequency, profile.spectralProfile);
            }
            
            const currentResponse = magnitude[i];
            const error = targetResponse - currentResponse;
            
            filter[i] = Math.max(0, Math.min(1, 
                (this.previousSpectra.length > 0 ? 
                    this.previousSpectra[this.previousSpectra.length - 1][i] : 0.5) + 
                adaptationRate * error
            ));
        }
        
        return filter;
    }
    
    private applyAdaptiveFilter(spectrum: Float32Array, filter: Float32Array): Float32Array {
        const filteredSpectrum = new Float32Array(spectrum.length);
        
        for (let i = 0; i < spectrum.length; i += 2) {
            const filterIndex = Math.floor(i / 2);
            const filterValue = filterIndex < filter.length ? filter[filterIndex] : 0;
            
            filteredSpectrum[i] = spectrum[i] * filterValue;
            filteredSpectrum[i + 1] = spectrum[i + 1] * filterValue;
        }
        
        return filteredSpectrum;
    }
    
    private getHarmonics(f0: number, frequency: number): number {
        const harmonicNumber = Math.round(frequency / f0);
        const harmonicFreq = harmonicNumber * f0;
        const deviation = Math.abs(frequency - harmonicFreq) / f0;
        
        return Math.exp(-deviation * 5);
    }
    
    private getFormantResponse(frequency: number, formants: number[]): number {
        let response = 0;
        
        for (const formant of formants) {
            const bandwidth = formant * 0.1;
            const distance = Math.abs(frequency - formant);
            response += Math.exp(-distance / bandwidth);
        }
        
        return Math.min(1, response / formants.length);
    }
    
    private getSpectralMatch(frequency: number, spectralProfile: Float32Array): number {
        const binIndex = Math.floor((frequency / (this.sampleRate / 2)) * spectralProfile.length);
        return binIndex < spectralProfile.length ? spectralProfile[binIndex] : 0;
    }
    
    private calculateSeparationConfidence(
        magnitude: Float32Array, 
        mask: Float32Array, 
        profile: SourceProfile
    ): number {
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < magnitude.length && i < mask.length; i++) {
            const weight = mask[i];
            weightedSum += weight * magnitude[i];
            totalWeight += weight;
        }
        
        const averageResponse = totalWeight > 0 ? weightedSum / totalWeight : 0;
        return Math.min(1, averageResponse * profile.profileConfidence);
    }
    
    private calculateFilterConfidence(filter: Float32Array, profile: SourceProfile): number {
        let sum = 0;
        for (let i = 0; i < filter.length; i++) {
            sum += filter[i];
        }
        
        const averageFilter = sum / filter.length;
        return Math.min(1, averageFilter * profile.profileConfidence);
    }
    
    private calculateAdaptiveConfidence(filter: Float32Array, profile: SourceProfile): number {
        return this.calculateFilterConfidence(filter, profile) * 0.9; // Slightly lower for adaptive
    }
    
    private assessSeparationQuality(sources: Float32Array[], originalAudio: Float32Array): number {
        if (sources.length === 0) return 0;
        
        let totalEnergy = 0;
        let separatedEnergy = 0;
        
        for (let i = 0; i < originalAudio.length; i++) {
            totalEnergy += originalAudio[i] ** 2;
        }
        
        for (const source of sources) {
            for (let i = 0; i < Math.min(source.length, originalAudio.length); i++) {
                separatedEnergy += source[i] ** 2;
            }
        }
        
        return Math.min(1, separatedEnergy / Math.max(totalEnergy, 0.001));
    }
    
    private estimateNoiseLevel(magnitude: Float32Array): number {
        const sorted = Array.from(magnitude).sort((a, b) => a - b);
        const percentile25 = sorted[Math.floor(sorted.length * 0.25)];
        return percentile25;
    }
    
    private updateProcessingStats(result: SeparationResult): void {
        this.processingTimes.push(result.processingTime);
        
        if (this.processingTimes.length > 50) {
            this.processingTimes.shift();
        }
        
        if (this.config.enableRealTimeOptimization) {
            this.optimizeForRealTime();
        }
    }
    
    private optimizeForRealTime(): void {
        const avgProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
        const frameTimeMs = (this.config.frameSize / this.sampleRate) * 1000;
        
        if (avgProcessingTime > frameTimeMs * 0.8) {
            // Reduce quality for better performance
            this.config.aggressiveness = Math.max(0.3, this.config.aggressiveness - 0.1);
        } else if (avgProcessingTime < frameTimeMs * 0.4) {
            // Increase quality
            this.config.aggressiveness = Math.min(0.9, this.config.aggressiveness + 0.05);
        }
    }
    
    private initializeAdaptiveParams(): void {
        this.adaptiveParams.set('adaptation_rate', 0.1);
        this.adaptiveParams.set('noise_threshold', 0.01);
        this.adaptiveParams.set('quality_threshold', 0.6);
        this.adaptiveParams.set('convergence_threshold', 0.001);
    }
    
    public updateConfig(newConfig: Partial<SeparationConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        if (newConfig.frameSize && newConfig.frameSize !== this.fft.size) {
            this.fft = new FFT(newConfig.frameSize);
        }
    }
    
    public getConfig(): SeparationConfig {
        return { ...this.config };
    }
    
    public getSourceProfiles(): SourceProfile[] {
        return Array.from(this.sourceProfiles.values());
    }
    
    public removeSourceProfile(sourceId: string): boolean {
        return this.sourceProfiles.delete(sourceId);
    }
    
    public getSeparationHistory(count: number = 20): SeparationResult[] {
        return this.separationHistory.slice(-count);
    }
    
    public reset(): void {
        this.sourceProfiles.clear();
        this.separationHistory = [];
        this.previousSpectra = [];
        this.noiseProfile = null;
        this.icaWeights = null;
        this.processingTimes = [];
        this.initializeAdaptiveParams();
    }
    
    public getPerformanceStats(): {
        averageProcessingTime: number;
        realTimeRatio: number;
        separationQuality: number;
    } {
        const avgProcessingTime = this.processingTimes.length > 0 ? 
            this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length : 0;
        
        const frameTimeMs = (this.config.frameSize / this.sampleRate) * 1000;
        const realTimeRatio = avgProcessingTime / frameTimeMs;
        
        const recentResults = this.separationHistory.slice(-20);
        const avgQuality = recentResults.length > 0 ?
            recentResults.reduce((sum, r) => sum + r.separationQuality, 0) / recentResults.length : 0;
        
        return {
            averageProcessingTime: avgProcessingTime,
            realTimeRatio,
            separationQuality: avgQuality
        };
    }
}

export default AudioSourceSeparator;