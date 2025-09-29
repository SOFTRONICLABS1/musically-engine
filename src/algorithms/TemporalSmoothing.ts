/**
 * Temporal Smoothing for Real-Time Pitch Detection
 * 
 * Provides advanced temporal smoothing, outlier rejection, and stability
 * analysis for real-time pitch detection applications. Reduces jitter and
 * improves accuracy in continuous pitch tracking scenarios.
 */

export interface SmoothingConfig {
    /** Size of the smoothing window (frames) */
    windowSize?: number;
    
    /** Smoothing factor for exponential moving average (0-1) */
    smoothingFactor?: number;
    
    /** Maximum allowed jump in semitones between frames */
    maxJumpSemitones?: number;
    
    /** Minimum confidence to accept a detection */
    minConfidence?: number;
    
    /** Enable median filtering for outlier rejection */
    enableMedianFilter?: boolean;
    
    /** Enable hysteresis for note change detection */
    enableHysteresis?: boolean;
    
    /** Hysteresis threshold in cents */
    hysteresisThresholdCents?: number;
    
    /** Enable adaptive smoothing based on signal stability */
    enableAdaptiveSmoothing?: boolean;
}

export interface SmoothedResult {
    /** Raw detected frequency */
    rawFrequency: number;
    
    /** Smoothed frequency after filtering */
    smoothedFrequency: number;
    
    /** Current note (with hysteresis) */
    currentNote: string;
    
    /** Confidence in the detection */
    confidence: number;
    
    /** Stability measure (0-1) */
    stability: number;
    
    /** Whether the result was rejected as outlier */
    isOutlier: boolean;
    
    /** Trend direction: 'rising' | 'falling' | 'stable' */
    trend: 'rising' | 'falling' | 'stable';
}

export class TemporalSmoothing {
    private config: Required<SmoothingConfig>;
    private historyBuffer: number[] = [];
    private confidenceBuffer: number[] = [];
    private smoothedHistory: number[] = [];
    private currentNote: string = '';
    private noteStartTime: number = 0;
    private lastValidFrequency: number = 0;
    private adaptiveSmoothingFactor: number;
    
    constructor(config: SmoothingConfig = {}) {
        this.config = {
            windowSize: config.windowSize ?? 10,
            smoothingFactor: config.smoothingFactor ?? 0.85,
            maxJumpSemitones: config.maxJumpSemitones ?? 2,
            minConfidence: config.minConfidence ?? 0.5,
            enableMedianFilter: config.enableMedianFilter ?? true,
            enableHysteresis: config.enableHysteresis ?? true,
            hysteresisThresholdCents: config.hysteresisThresholdCents ?? 30,
            enableAdaptiveSmoothing: config.enableAdaptiveSmoothing ?? true
        };
        
        this.adaptiveSmoothingFactor = this.config.smoothingFactor;
    }
    
    /**
     * Process a new frequency detection with temporal smoothing
     */
    public process(frequency: number, confidence: number): SmoothedResult {
        // Step 1: Outlier detection
        const isOutlier = this.detectOutlier(frequency, confidence);
        
        if (isOutlier) {
            // Use last valid frequency if outlier detected
            frequency = this.lastValidFrequency || frequency;
        } else {
            this.lastValidFrequency = frequency;
        }
        
        // Step 2: Update history buffers
        this.updateHistoryBuffers(frequency, confidence);
        
        // Step 3: Apply temporal smoothing
        let smoothedFrequency = frequency;
        
        if (this.config.enableMedianFilter && this.historyBuffer.length >= 3) {
            smoothedFrequency = this.medianFilter(this.historyBuffer);
        }
        
        smoothedFrequency = this.exponentialSmoothing(smoothedFrequency);
        
        // Step 4: Calculate stability
        const stability = this.calculateStability();
        
        // Step 5: Update adaptive smoothing
        if (this.config.enableAdaptiveSmoothing) {
            this.updateAdaptiveSmoothing(stability);
        }
        
        // Step 6: Apply hysteresis for note detection
        const currentNote = this.config.enableHysteresis
            ? this.applyHysteresis(smoothedFrequency)
            : this.frequencyToNote(smoothedFrequency);
        
        // Step 7: Detect trend
        const trend = this.detectTrend();
        
        // Update smoothed history
        this.smoothedHistory.push(smoothedFrequency);
        if (this.smoothedHistory.length > this.config.windowSize) {
            this.smoothedHistory.shift();
        }
        
        return {
            rawFrequency: frequency,
            smoothedFrequency,
            currentNote,
            confidence: this.getSmoothedConfidence(),
            stability,
            isOutlier,
            trend
        };
    }
    
    /**
     * Detect if a frequency is an outlier
     */
    private detectOutlier(frequency: number, confidence: number): boolean {
        // Low confidence rejection
        if (confidence < this.config.minConfidence) {
            return true;
        }
        
        // Check for sudden jumps
        if (this.historyBuffer.length > 0) {
            const lastFreq = this.historyBuffer[this.historyBuffer.length - 1];
            const semitoneJump = Math.abs(12 * Math.log2(frequency / lastFreq));
            
            if (semitoneJump > this.config.maxJumpSemitones) {
                // Check if it's a legitimate octave jump
                const octaveRatio = frequency / lastFreq;
                const isOctaveJump = Math.abs(octaveRatio - 2) < 0.1 || 
                                    Math.abs(octaveRatio - 0.5) < 0.05;
                
                if (!isOctaveJump) {
                    return true;
                }
            }
        }
        
        // Statistical outlier detection using IQR method
        if (this.historyBuffer.length >= 5) {
            const sorted = [...this.historyBuffer].sort((a, b) => a - b);
            const q1 = sorted[Math.floor(sorted.length * 0.25)];
            const q3 = sorted[Math.floor(sorted.length * 0.75)];
            const iqr = q3 - q1;
            
            if (frequency < q1 - 1.5 * iqr || frequency > q3 + 1.5 * iqr) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Update history buffers
     */
    private updateHistoryBuffers(frequency: number, confidence: number): void {
        this.historyBuffer.push(frequency);
        this.confidenceBuffer.push(confidence);
        
        // Maintain window size
        if (this.historyBuffer.length > this.config.windowSize) {
            this.historyBuffer.shift();
        }
        if (this.confidenceBuffer.length > this.config.windowSize) {
            this.confidenceBuffer.shift();
        }
    }
    
    /**
     * Apply median filter to reduce noise
     */
    private medianFilter(values: number[]): number {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    
    /**
     * Apply exponential smoothing
     */
    private exponentialSmoothing(currentValue: number): number {
        if (this.smoothedHistory.length === 0) {
            return currentValue;
        }
        
        const lastSmoothed = this.smoothedHistory[this.smoothedHistory.length - 1];
        const smoothingFactor = this.config.enableAdaptiveSmoothing 
            ? this.adaptiveSmoothingFactor 
            : this.config.smoothingFactor;
        
        return smoothingFactor * lastSmoothed + (1 - smoothingFactor) * currentValue;
    }
    
    /**
     * Calculate stability of the signal
     */
    private calculateStability(): number {
        if (this.historyBuffer.length < 3) {
            return 0;
        }
        
        // Calculate coefficient of variation
        const mean = this.historyBuffer.reduce((a, b) => a + b, 0) / this.historyBuffer.length;
        const variance = this.historyBuffer.reduce((sum, val) => {
            return sum + Math.pow(val - mean, 2);
        }, 0) / this.historyBuffer.length;
        
        const stdDev = Math.sqrt(variance);
        const coeffVariation = stdDev / mean;
        
        // Convert to stability score (inverse of variation)
        const stability = Math.max(0, Math.min(1, 1 - coeffVariation * 10));
        
        return stability;
    }
    
    /**
     * Update adaptive smoothing factor based on stability
     */
    private updateAdaptiveSmoothing(stability: number): void {
        // Higher stability -> more smoothing
        // Lower stability -> less smoothing (more responsive)
        const minSmoothing = 0.5;
        const maxSmoothing = 0.95;
        
        this.adaptiveSmoothingFactor = minSmoothing + 
            (maxSmoothing - minSmoothing) * stability;
    }
    
    /**
     * Apply hysteresis for stable note detection
     */
    private applyHysteresis(frequency: number): string {
        const newNote = this.frequencyToNote(frequency);
        
        if (this.currentNote === '') {
            this.currentNote = newNote;
            this.noteStartTime = Date.now();
            return newNote;
        }
        
        // Calculate cents difference from current note
        const currentNoteFreq = this.noteToFrequency(this.currentNote);
        const centsDiff = 1200 * Math.log2(frequency / currentNoteFreq);
        
        // Only change note if difference exceeds threshold
        if (Math.abs(centsDiff) > this.config.hysteresisThresholdCents) {
            // Additional time-based hysteresis
            const timeSinceNoteStart = Date.now() - this.noteStartTime;
            const minNoteTime = 100; // milliseconds
            
            if (timeSinceNoteStart > minNoteTime) {
                this.currentNote = newNote;
                this.noteStartTime = Date.now();
            }
        }
        
        return this.currentNote;
    }
    
    /**
     * Detect trend in pitch movement
     */
    private detectTrend(): 'rising' | 'falling' | 'stable' {
        if (this.smoothedHistory.length < 3) {
            return 'stable';
        }
        
        // Use linear regression on recent samples
        const recentSamples = this.smoothedHistory.slice(-5);
        const n = recentSamples.length;
        
        // Calculate slope
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        recentSamples.forEach((y, x) => {
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        });
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const avgFreq = sumY / n;
        
        // Determine trend based on slope relative to average frequency
        const slopeRatio = Math.abs(slope / avgFreq);
        const threshold = 0.001; // Adjustable sensitivity
        
        if (slopeRatio < threshold) {
            return 'stable';
        }
        return slope > 0 ? 'rising' : 'falling';
    }
    
    /**
     * Get smoothed confidence value
     */
    private getSmoothedConfidence(): number {
        if (this.confidenceBuffer.length === 0) {
            return 0;
        }
        
        // Use weighted average with recent values weighted more
        let weightedSum = 0;
        let weightTotal = 0;
        
        this.confidenceBuffer.forEach((conf, i) => {
            const weight = (i + 1) / this.confidenceBuffer.length;
            weightedSum += conf * weight;
            weightTotal += weight;
        });
        
        return weightTotal > 0 ? weightedSum / weightTotal : 0;
    }
    
    /**
     * Convert frequency to note name
     */
    private frequencyToNote(frequency: number): string {
        if (frequency <= 0) return '';
        
        const A4 = 440;
        const semitones = 12 * Math.log2(frequency / A4);
        const noteNum = Math.round(semitones) + 69; // MIDI number
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNum / 12) - 1;
        const noteIndex = noteNum % 12;
        
        return `${noteNames[noteIndex]}${octave}`;
    }
    
    /**
     * Convert note name to frequency
     */
    private noteToFrequency(note: string): number {
        if (!note) return 0;
        
        const match = note.match(/^([A-G][#]?)(\d+)$/);
        if (!match) return 0;
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIndex = noteNames.indexOf(match[1]);
        const octave = parseInt(match[2]);
        
        const midiNumber = (octave + 1) * 12 + noteIndex;
        const A4 = 440;
        
        return A4 * Math.pow(2, (midiNumber - 69) / 12);
    }
    
    /**
     * Reset the smoother state
     */
    public reset(): void {
        this.historyBuffer = [];
        this.confidenceBuffer = [];
        this.smoothedHistory = [];
        this.currentNote = '';
        this.noteStartTime = 0;
        this.lastValidFrequency = 0;
        this.adaptiveSmoothingFactor = this.config.smoothingFactor;
    }
    
    /**
     * Get current state for debugging
     */
    public getState(): {
        historyBuffer: number[];
        smoothedHistory: number[];
        currentNote: string;
        adaptiveSmoothingFactor: number;
    } {
        return {
            historyBuffer: [...this.historyBuffer],
            smoothedHistory: [...this.smoothedHistory],
            currentNote: this.currentNote,
            adaptiveSmoothingFactor: this.adaptiveSmoothingFactor
        };
    }
    
    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<SmoothingConfig>): void {
        Object.assign(this.config, newConfig);
        
        // Reset adaptive factor if smoothing factor changed
        if (newConfig.smoothingFactor !== undefined) {
            this.adaptiveSmoothingFactor = newConfig.smoothingFactor;
        }
    }
}

export default TemporalSmoothing;