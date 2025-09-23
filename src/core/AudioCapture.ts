import { EventEmitter } from './EventEmitter';
import { IPlatformAdapter } from '../platforms/IPlatformAdapter';
import { 
  AudioCaptureConfig, 
  EngineConfig, 
  AudioBuffer as EngineAudioBuffer,
  EngineError 
} from '../types';

/**
 * Universal audio capture interface that works across all platforms
 * Abstracts platform-specific audio input handling
 */
export class AudioCapture extends EventEmitter {
  private adapter: IPlatformAdapter;
  private config: AudioCaptureConfig;
  private isCapturing = false;
  private isInitialized = false;
  
  constructor(adapter: IPlatformAdapter) {
    super();
    this.adapter = adapter;
    
    // Default configuration
    this.config = {
      sampleRate: 44100,
      bufferSize: 2048,
      channelCount: 1,
      bitDepth: 32,
      latency: 'interactive'
    };
    
    // Forward adapter events
    this.setupAdapterEventForwarding();
  }
  
  /**
   * Initialize the audio capture system
   */
  async initialize(config?: Partial<AudioCaptureConfig>): Promise<void> {
    if (this.isInitialized) {
      throw new Error('AudioCapture is already initialized');
    }
    
    // Merge with default config
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    try {
      await this.adapter.initialize(this.config);
      this.isInitialized = true;
      this.emit('initialized', { config: this.config });
    } catch (error) {
      const engineError: EngineError = {
        code: 'ENGINE_INIT_FAILED',
        message: 'Failed to initialize audio capture',
        details: error
      };
      this.emit('error', engineError);
      throw engineError;
    }
  }
  
  /**
   * Start microphone capture
   */
  async startMicrophone(): Promise<void> {
    this.ensureInitialized();
    
    if (this.isCapturing) {
      throw new Error('Audio capture is already active');
    }
    
    if (!this.adapter.capabilities.microphone) {
      throw new Error('Microphone not supported on this platform');
    }
    
    try {
      await this.adapter.startMicrophone();
      this.isCapturing = true;
      this.emit('audio_start', { source: 'microphone' });
    } catch (error) {
      const engineError: EngineError = {
        code: 'MICROPHONE_START_FAILED',
        message: 'Failed to start microphone capture',
        details: error
      };
      this.emit('error', engineError);
      throw engineError;
    }
  }
  
  /**
   * Stop microphone capture
   */
  stopMicrophone(): void {
    if (!this.isCapturing) {
      return;
    }
    
    try {
      this.adapter.stopMicrophone();
      this.isCapturing = false;
      this.emit('audio_stop', { source: 'microphone' });
    } catch (error) {
      const engineError: EngineError = {
        code: 'MICROPHONE_STOP_FAILED',
        message: 'Failed to stop microphone capture',
        details: error
      };
      this.emit('error', engineError);
    }
  }
  
  /**
   * Load and process an audio file
   */
  async loadFile(file: File | string | Buffer | ArrayBuffer): Promise<EngineAudioBuffer> {
    this.ensureInitialized();
    
    if (!this.adapter.capabilities.fileInput) {
      throw new Error('File input not supported on this platform');
    }
    
    try {
      const audioBuffer = await this.adapter.loadFile(file);
      this.emit('file_loaded', { 
        duration: audioBuffer.length / audioBuffer.sampleRate,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      });
      return audioBuffer;
    } catch (error) {
      const engineError: EngineError = {
        code: 'FILE_LOAD_FAILED',
        message: 'Failed to load audio file',
        details: error
      };
      this.emit('error', engineError);
      throw engineError;
    }
  }
  
  /**
   * Register audio data handler for real-time processing
   */
  onAudioData(handler: (data: Float32Array) => void): void {
    this.adapter.onAudioData(handler);
  }
  
  /**
   * Unregister audio data handler
   */
  offAudioData(handler: (data: Float32Array) => void): void {
    this.adapter.offAudioData(handler);
  }
  
  /**
   * Get current audio configuration
   */
  getConfig(): AudioCaptureConfig {
    return { ...this.config };
  }
  
  /**
   * Update audio configuration (requires re-initialization)
   */
  async updateConfig(newConfig: Partial<AudioCaptureConfig>): Promise<void> {
    const wasCapturing = this.isCapturing;
    
    // Stop current capture if active
    if (this.isCapturing) {
      this.stopMicrophone();
    }
    
    // Destroy current adapter
    if (this.isInitialized) {
      await this.adapter.destroy();
      this.isInitialized = false;
    }
    
    // Update config and reinitialize
    this.config = { ...this.config, ...newConfig };
    await this.initialize();
    
    // Restart capture if it was active
    if (wasCapturing) {
      await this.startMicrophone();
    }
    
    this.emit('config_change', { config: this.config });
  }
  
  /**
   * Get platform capabilities
   */
  getCapabilities() {
    return this.adapter.capabilities;
  }
  
  /**
   * Get platform information
   */
  getPlatformInfo() {
    return {
      platform: this.adapter.platform,
      capabilities: this.adapter.capabilities,
      sampleRate: this.adapter.getSampleRate(),
      bufferSize: this.adapter.getBufferSize()
    };
  }
  
  /**
   * Check if currently capturing audio
   */
  isActive(): boolean {
    return this.isCapturing;
  }
  
  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.isCapturing) {
      this.stopMicrophone();
    }
    
    if (this.isInitialized) {
      await this.adapter.destroy();
      this.isInitialized = false;
    }
    
    this.removeAllListeners();
    this.emit('destroyed');
  }
  
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('AudioCapture must be initialized before use');
    }
  }
  
  private setupAdapterEventForwarding(): void {
    // Forward all adapter events to our event system
    this.adapter.on('error', (error) => {
      this.emit('error', error);
    });
    
    this.adapter.on('audio_data', (data) => {
      this.emit('audio_data', data);
    });
  }
}