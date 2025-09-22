// Core type definitions for Musically Engine

export type Platform = 'browser' | 'node' | 'react-native' | 'electron' | 'auto';

export type MusicSystem = 'western' | 'carnatic' | 'hindustani' | 'auto';

export type AudioType = 'voice' | 'piano' | 'guitar' | 'violin' | 'sitar' | 'flute' | 'instrument' | 'auto';

// Core configuration interfaces
export interface EngineConfig {
  sampleRate?: number;        // Default: 44100
  bufferSize?: number;        // Default: 2048
  musicSystem?: MusicSystem;  // Default: 'auto'
  audioType?: AudioType;      // Default: 'auto'
  referencePitch?: number;    // Default: 440 (A4)
  sensitivity?: number;       // 0.0 to 1.0, Default: 0.8
  noiseReduction?: NoiseConfig;
  realTimeMode?: boolean;     // Default: true
}

export interface NoiseConfig {
  enabled: boolean;
  aggressiveness: number;        // 0.0 to 1.0
  noiseFloorDb: number;          // dB threshold
  spectralSmoothing: number;     // smoothing factor
  adaptiveMode: boolean;         // auto-adjust to changing noise
}

// Platform capabilities interface
export interface PlatformCapabilities {
  microphone: boolean;
  fileInput: boolean;
  streaming: boolean;
  offlineProcessing: boolean;
  webAssembly: boolean;
}

// Audio buffer interface
export interface AudioBuffer {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

// Analysis result interfaces
export interface AnalysisResult {
  timestamp: number;
  
  // Universal Analysis
  frequency: number;
  amplitude: number;
  confidence: number;
  audioType: AudioType;
  
  // Multi-system Analysis
  western: WesternAnalysis;
  carnatic?: CarnaticAnalysis;
  hindustani?: HindustaniAnalysis;
  
  // Context Information
  musicalContext: MusicalContext;
}

export interface WesternAnalysis {
  note: string;           // "C4", "F#3", etc.
  noteFrequency: number;  // Hz
  cents: number;          // -50 to +50 cents from note
  octave: number;
}

export interface CarnaticAnalysis {
  swara: string;          // "Sa", "Ri2", "Ga1", etc.
  swaraSthana: number;    // Position in 16-note system
  cents: number;          // Deviation from just intonation
  octave: string;         // "Mandra", "Madhya", "Tara"
  possibleRagas: string[];
  gamaka?: string;        // Detected ornament
}

export interface HindustaniAnalysis {
  swara: string;          // "Sa", "Re_komal", etc.
  cents: number;
  octave: string;
  possibleRagas: string[];
  meend?: {
    type: string;
    duration: number;
    targetNote: string;
  };
}

export interface MusicalContext {
  intervalFromTonic: string;
  harmonicNumber?: number;
  inScale: boolean;
  chordContext?: string;
}

// Event types
export type EngineEvent = 
  | 'analysis'
  | 'audio_start' 
  | 'audio_stop'
  | 'error'
  | 'config_change';

export interface EngineError {
  code: string;
  message: string;
  details?: any;
}

// Audio capture configuration
export interface AudioCaptureConfig {
  sampleRate: number;          // Hz
  bufferSize: number;          // samples
  channelCount: number;        // mono processing
  bitDepth: number;            // Float32Array
  latency: 'interactive' | 'balanced' | 'playback';
}

// System information
export interface SystemInfo {
  platform: Platform;
  capabilities: PlatformCapabilities;
  version: string;
  audioContext?: any;
}

// Event handler type
export type EventHandler<T = any> = (data: T) => void;