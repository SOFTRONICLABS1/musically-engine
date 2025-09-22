import { 
  AudioCaptureConfig, 
  PlatformCapabilities, 
  EventHandler,
  AudioBuffer as EngineAudioBuffer 
} from '../types';

/**
 * Platform adapter interface that provides a unified API across all platforms
 * Each platform (Browser, Node.js, React Native, Electron) implements this interface
 */
export interface IPlatformAdapter {
  // Initialization and lifecycle
  initialize(config: AudioCaptureConfig): Promise<void>;
  destroy(): Promise<void>;
  
  // Audio input methods
  startMicrophone(): Promise<void>;
  stopMicrophone(): void;
  loadFile(file: File | string | Buffer | ArrayBuffer): Promise<EngineAudioBuffer>;
  
  // Platform capabilities
  readonly capabilities: PlatformCapabilities;
  readonly platform: string;
  
  // Audio context management
  getAudioContext(): AudioContext | any;
  getSampleRate(): number;
  getBufferSize(): number;
  
  // Real-time audio processing
  onAudioData(handler: EventHandler<Float32Array>): void;
  offAudioData(handler: EventHandler<Float32Array>): void;
  
  // Event handling
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, data: any): void;
  
  // Platform-specific features
  setLatencyHint?(hint: 'interactive' | 'balanced' | 'playback'): void;
  enableProcessingOptimizations?(): void;
}

/**
 * Base platform adapter that provides common functionality
 * All platform-specific adapters should extend this class
 */
export abstract class BasePlatformAdapter implements IPlatformAdapter {
  protected config?: AudioCaptureConfig;
  protected eventHandlers: Map<string, Set<EventHandler>> = new Map();
  protected audioDataHandlers: Set<EventHandler<Float32Array>> = new Set();
  protected isInitialized = false;
  
  abstract readonly capabilities: PlatformCapabilities;
  abstract readonly platform: string;
  
  abstract initialize(config: AudioCaptureConfig): Promise<void>;
  abstract destroy(): Promise<void>;
  abstract startMicrophone(): Promise<void>;
  abstract stopMicrophone(): void;
  abstract loadFile(file: File | string | Buffer | ArrayBuffer): Promise<EngineAudioBuffer>;
  abstract getAudioContext(): AudioContext | any;
  abstract getSampleRate(): number;
  abstract getBufferSize(): number;
  
  // Common event handling implementation
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }
  
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }
  
  emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
  
  // Audio data handler management
  onAudioData(handler: EventHandler<Float32Array>): void {
    this.audioDataHandlers.add(handler);
  }
  
  offAudioData(handler: EventHandler<Float32Array>): void {
    this.audioDataHandlers.delete(handler);
  }
  
  protected emitAudioData(data: Float32Array): void {
    this.audioDataHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in audio data handler:', error);
      }
    });
  }
  
  protected validateConfig(config: AudioCaptureConfig): void {
    if (config.sampleRate <= 0) {
      throw new Error('Sample rate must be positive');
    }
    if (config.bufferSize <= 0 || (config.bufferSize & (config.bufferSize - 1)) !== 0) {
      throw new Error('Buffer size must be a positive power of 2');
    }
    if (config.channelCount < 1) {
      throw new Error('Channel count must be at least 1');
    }
  }
}