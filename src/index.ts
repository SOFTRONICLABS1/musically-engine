/**
 * Musically Engine - Platform-Agnostic Audio Processing SDK
 * Universal entry point with automatic platform detection
 */

// Core exports
export { EventEmitter } from './core/EventEmitter';
export { AudioCapture } from './core/AudioCapture';
export { BufferManager } from './core/BufferManager';

// Music System exports
export { BaseMusicSystem, WesternMusicSystem, CarnaticMusicSystem, HindustaniMusicSystem, createMusicSystem } from './musicSystems';
export type { NoteInfo, IntervalInfo, ScaleInfo, ChordInfo } from './musicSystems';

// Platform adapter interfaces
export type { IPlatformAdapter } from './platforms/IPlatformAdapter';
export { BasePlatformAdapter } from './platforms/IPlatformAdapter';

// Platform adapters
export { WebAudioAdapter } from './platforms/browser/WebAudioAdapter';

// Utilities
export { PlatformDetection } from './utils/PlatformDetection';

// Types
export type * from './types';

// Main engine class
import { EventEmitter } from './core/EventEmitter';
import { AudioCapture } from './core/AudioCapture';
import { IPlatformAdapter } from './platforms/IPlatformAdapter';
import { WebAudioAdapter } from './platforms/browser/WebAudioAdapter';
import { NodeAudioAdapter } from './platforms/node/NodeAudioAdapter';
import { PlatformDetection } from './utils/PlatformDetection';
import { createMusicSystem, BaseMusicSystem } from './musicSystems';
import { 
  EngineConfig, 
  Platform, 
  SystemInfo, 
  AnalysisResult,
  AudioType,
  MusicSystem,
  EngineError,
  WesternAnalysis,
  CarnaticAnalysis,
  HindustaniAnalysis
} from './types';

/**
 * Main Musically Engine class
 * Provides a unified API for audio processing across all platforms
 */
export class MusicallyEngine extends EventEmitter {
  private audioCapture: AudioCapture;
  private adapter: IPlatformAdapter;
  private config: Required<EngineConfig>;
  private musicSystem: BaseMusicSystem;
  
  constructor(config: Partial<EngineConfig> = {}) {
    super();
    
    // Set default configuration
    this.config = {
      sampleRate: 44100,
      bufferSize: 2048,
      musicSystem: 'auto',
      audioType: 'auto',
      referencePitch: 440,
      sensitivity: 0.8,
      noiseReduction: {
        enabled: true,
        aggressiveness: 0.6,
        noiseFloorDb: -40,
        spectralSmoothing: 0.8,
        adaptiveMode: true
      },
      realTimeMode: true,
      ...config
    };
    
    // Create platform adapter
    this.adapter = this.createPlatformAdapter();
    
    // Create audio capture
    this.audioCapture = new AudioCapture(this.adapter);
    
    // Create music system
    this.musicSystem = createMusicSystem(this.config.musicSystem, this.config.referencePitch);
    
    // Forward events from audio capture
    this.setupEventForwarding();
  }
  
  /**
   * Create Musically Engine with automatic platform detection
   */
  static create(config: Partial<EngineConfig> = {}): MusicallyEngine {
    return new MusicallyEngine(config);
  }
  
  /**
   * Create Musically Engine for specific platform
   */
  static createForPlatform(platform: Platform, config: Partial<EngineConfig> = {}): MusicallyEngine {
    const engine = new MusicallyEngine(config);
    // Override platform adapter if needed
    return engine;
  }
  
  /**
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    try {
      await this.audioCapture.initialize({
        sampleRate: this.config.sampleRate,
        bufferSize: this.config.bufferSize,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      });
      
      this.emit('initialized', { config: this.config });
    } catch (error) {
      const engineError: EngineError = {
        code: 'ENGINE_INIT_FAILED',
        message: 'Failed to initialize Musically Engine',
        details: error
      };
      this.emit('error', engineError);
      throw engineError;
    }
  }
  
  /**
   * Start microphone capture and analysis
   */
  async startMicrophone(): Promise<void> {
    await this.audioCapture.startMicrophone();
    
    // Register audio data handler for real-time analysis
    this.audioCapture.onAudioData((data: Float32Array) => {
      this.processAudioData(data);
    });
  }
  
  /**
   * Stop microphone capture
   */
  stopMicrophone(): void {
    this.audioCapture.stopMicrophone();
  }
  
  /**
   * Process an audio file
   */
  async processFile(file: File | ArrayBuffer): Promise<AnalysisResult[]> {
    const audioBuffer = await this.audioCapture.loadFile(file);
    
    // Process audio buffer and return analysis results
    const results: AnalysisResult[] = [];
    
    // For now, return empty results - actual processing will be implemented in Phase 2
    return results;
  }
  
  /**
   * Set music system for analysis
   */
  setMusicSystem(system: MusicSystem): void {
    this.config.musicSystem = system;
    this.musicSystem = createMusicSystem(system, this.config.referencePitch);
    this.emit('config_change', { musicSystem: system });
  }
  
  /**
   * Set audio type for analysis
   */
  setAudioType(type: AudioType): void {
    this.config.audioType = type;
    this.emit('config_change', { audioType: type });
  }
  
  /**
   * Set reference pitch (e.g., A4 = 440Hz)
   */
  setReferencePitch(frequency: number): void {
    if (frequency <= 0) {
      throw new Error('Reference pitch must be positive');
    }
    this.config.referencePitch = frequency;
    this.musicSystem.setReferencePitch(frequency);
    this.emit('config_change', { referencePitch: frequency });
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Required<EngineConfig> {
    return { ...this.config };
  }

  /**
   * Get current music system instance
   */
  getMusicSystem(): BaseMusicSystem {
    return this.musicSystem;
  }

  /**
   * Analyze a frequency using the current music system
   */
  analyzeFrequency(frequency: number): WesternAnalysis | CarnaticAnalysis | HindustaniAnalysis {
    return this.musicSystem.analyzeFrequency(frequency);
  }

  /**
   * Convert frequency to note using the current music system
   */
  frequencyToNote(frequency: number) {
    return this.musicSystem.frequencyToNote(frequency);
  }

  /**
   * Convert note to frequency using the current music system
   */
  noteToFrequency(note: string, octave?: number): number {
    return this.musicSystem.noteToFrequency(note, octave);
  }
  
  /**
   * Get system information
   */
  getSystemInfo(): SystemInfo {
    const platformInfo = PlatformDetection.getEnvironmentInfo();
    
    return {
      platform: platformInfo.platform,
      capabilities: this.adapter.capabilities,
      version: '1.0.0', // TODO: Get from package.json
      audioContext: this.adapter.getAudioContext()
    };
  }
  
  /**
   * Get supported audio formats
   */
  getSupportedFormats(): string[] {
    const platform = PlatformDetection.detect();
    
    switch (platform) {
      case 'browser':
        return ['wav', 'mp3', 'm4a', 'ogg'];
      case 'node':
        return ['wav', 'mp3', 'm4a', 'ogg', 'flac'];
      case 'react-native':
        return ['wav', 'mp3', 'm4a'];
      case 'electron':
        return ['wav', 'mp3', 'm4a', 'ogg', 'flac'];
      default:
        return ['wav', 'mp3'];
    }
  }
  
  /**
   * Check if the engine is currently processing audio
   */
  isActive(): boolean {
    return this.audioCapture.isActive();
  }
  
  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.audioCapture.destroy();
    this.removeAllListeners();
  }
  
  private createPlatformAdapter(): IPlatformAdapter {
    const platform = PlatformDetection.detect();
    
    switch (platform) {
      case 'browser':
        return new WebAudioAdapter();
      case 'node':
        return new NodeAudioAdapter();
      case 'react-native':
        // TODO: Implement RNAudioAdapter in Phase 5
        throw new Error('React Native adapter not yet implemented');
      case 'electron':
        // TODO: Implement ElectronAdapter in Phase 5
        throw new Error('Electron adapter not yet implemented');
      default:
        // Default to browser adapter
        return new WebAudioAdapter();
    }
  }
  
  private setupEventForwarding(): void {
    // Forward all audio capture events
    const eventsToForward = [
      'initialized', 'audio_start', 'audio_stop', 
      'file_loaded', 'config_change', 'error'
    ];
    
    eventsToForward.forEach(event => {
      this.audioCapture.on(event, (data) => {
        this.emit(event, data);
      });
    });
  }
  
  private processAudioData(data: Float32Array): void {
    // TODO: Implement actual FFT and pitch detection in Phase 2
    // For now, create a mock frequency for demonstration
    const mockFrequency = 440; // This would come from actual pitch detection
    
    // Use the music system to analyze the frequency
    const musicAnalysis = this.musicSystem.analyzeFrequency(mockFrequency);
    
    // Create analysis result based on music system type
    let result: AnalysisResult;
    
    if (this.config.musicSystem === 'western' || this.config.musicSystem === 'auto') {
      const westernAnalysis = musicAnalysis as WesternAnalysis;
      result = {
        timestamp: Date.now(),
        frequency: mockFrequency,
        amplitude: 0.5, // TODO: Calculate from audio data
        confidence: 0.8, // TODO: Calculate confidence based on pitch detection
        audioType: this.config.audioType === 'auto' ? 'voice' : this.config.audioType,
        western: westernAnalysis,
        musicalContext: {
          intervalFromTonic: 'unison', // TODO: Calculate interval
          inScale: true // TODO: Check against current scale
        }
      };
    } else if (this.config.musicSystem === 'carnatic') {
      const carnaticAnalysis = musicAnalysis as CarnaticAnalysis;
      result = {
        timestamp: Date.now(),
        frequency: mockFrequency,
        amplitude: 0.5,
        confidence: 0.8,
        audioType: this.config.audioType === 'auto' ? 'voice' : this.config.audioType,
        western: {
          note: 'A4', // Provide basic Western equivalent
          noteFrequency: mockFrequency,
          cents: 0,
          octave: 4
        },
        carnatic: carnaticAnalysis,
        musicalContext: {
          intervalFromTonic: 'unison',
          inScale: true
        }
      };
    } else { // hindustani
      const hindustaniAnalysis = musicAnalysis as HindustaniAnalysis;
      result = {
        timestamp: Date.now(),
        frequency: mockFrequency,
        amplitude: 0.5,
        confidence: 0.8,
        audioType: this.config.audioType === 'auto' ? 'voice' : this.config.audioType,
        western: {
          note: 'A4', // Provide basic Western equivalent
          noteFrequency: mockFrequency,
          cents: 0,
          octave: 4
        },
        hindustani: hindustaniAnalysis,
        musicalContext: {
          intervalFromTonic: 'unison',
          inScale: true
        }
      };
    }
    
    this.emit('analysis', result);
  }
}

// Default export for convenience
export default MusicallyEngine;