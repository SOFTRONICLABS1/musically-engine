import { BasePlatformAdapter } from '../IPlatformAdapter';
import { 
  AudioCaptureConfig, 
  PlatformCapabilities, 
  AudioBuffer as EngineAudioBuffer 
} from '../../types';

/**
 * Browser platform adapter using Web Audio API
 * Supports Chrome 66+, Firefox 60+, Safari 11.1+, Edge 79+
 */
export class WebAudioAdapter extends BasePlatformAdapter {
  readonly platform = 'browser';
  readonly capabilities: PlatformCapabilities = {
    microphone: true,
    fileInput: true,
    streaming: true,
    offlineProcessing: true,
    webAssembly: typeof WebAssembly !== 'undefined'
  };
  
  private audioContext?: AudioContext;
  private mediaStream?: MediaStream;
  private mediaStreamSource?: MediaStreamAudioSourceNode;
  private processorNode?: ScriptProcessorNode | AudioWorkletNode;
  private gainNode?: GainNode;
  
  async initialize(config: AudioCaptureConfig): Promise<void> {
    this.validateConfig(config);
    this.config = config;
    
    try {
      // Initialize Web Audio API context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported in this browser');
      }
      
      this.audioContext = new AudioContextClass({
        sampleRate: config.sampleRate,
        latencyHint: config.latency
      });
      
      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      
      // Resume audio context if suspended (required by browser autoplay policies)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.isInitialized = true;
      this.emit('initialized', { 
        sampleRate: this.audioContext.sampleRate,
        state: this.audioContext.state 
      });
      
    } catch (error) {
      throw new Error(`Failed to initialize Web Audio API: ${error}`);
    }
  }
  
  async destroy(): Promise<void> {
    // Stop microphone if active
    this.stopMicrophone();
    
    // Clean up audio nodes
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = undefined;
    }
    
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = undefined;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = undefined;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = undefined;
    }
    
    this.isInitialized = false;
    this.emit('destroyed', {});
  }
  
  async startMicrophone(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    if (this.mediaStream) {
      throw new Error('Microphone already active');
    }
    
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config!.sampleRate,
          channelCount: this.config!.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        },
        video: false
      });
      
      // Create media stream source
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create audio processor
      await this.createAudioProcessor();
      
      // Connect the audio graph
      this.mediaStreamSource.connect(this.processorNode!);
      
      this.emit('microphone_started', {});
      
    } catch (error) {
      throw new Error(`Failed to start microphone: ${error}`);
    }
  }
  
  stopMicrophone(): void {
    if (this.mediaStream) {
      // Stop all tracks
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = undefined;
    }
    
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = undefined;
    }
    
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = undefined;
    }
    
    this.emit('microphone_stopped', {});
  }
  
  async loadFile(file: File | ArrayBuffer): Promise<EngineAudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    try {
      let arrayBuffer: ArrayBuffer;
      
      if (file instanceof File) {
        arrayBuffer = await file.arrayBuffer();
      } else {
        arrayBuffer = file;
      }
      
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to our engine format
      const engineBuffer: EngineAudioBuffer = {
        sampleRate: audioBuffer.sampleRate,
        length: audioBuffer.length,
        numberOfChannels: audioBuffer.numberOfChannels,
        getChannelData: (channel: number) => audioBuffer.getChannelData(channel)
      };
      
      return engineBuffer;
      
    } catch (error) {
      throw new Error(`Failed to load audio file: ${error}`);
    }
  }
  
  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    return this.audioContext;
  }
  
  getSampleRate(): number {
    return this.audioContext?.sampleRate || this.config?.sampleRate || 44100;
  }
  
  getBufferSize(): number {
    return this.config?.bufferSize || 2048;
  }
  
  setLatencyHint(hint: 'interactive' | 'balanced' | 'playback'): void {
    if (this.config) {
      this.config.latency = hint;
    }
  }
  
  enableProcessingOptimizations(): void {
    // Browser-specific optimizations
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
  
  private async createAudioProcessor(): Promise<void> {
    if (!this.audioContext || !this.config) {
      throw new Error('AudioContext or config not available');
    }
    
    try {
      // Try to use AudioWorklet (modern approach)
      if (this.audioContext.audioWorklet) {
        await this.createAudioWorkletProcessor();
      } else {
        // Fallback to ScriptProcessorNode (deprecated but still supported)
        this.createScriptProcessor();
      }
    } catch (error) {
      // Fallback to ScriptProcessorNode if AudioWorklet fails
      console.warn('AudioWorklet failed, falling back to ScriptProcessorNode:', error);
      this.createScriptProcessor();
    }
  }
  
  private async createAudioWorkletProcessor(): Promise<void> {
    if (!this.audioContext || !this.config) return;
    
    // AudioWorklet implementation would go here
    // For now, fall back to ScriptProcessorNode
    this.createScriptProcessor();
  }
  
  private createScriptProcessor(): void {
    if (!this.audioContext || !this.config) return;
    
    // Create script processor node
    this.processorNode = this.audioContext.createScriptProcessor(
      this.config.bufferSize,
      this.config.channelCount,
      this.config.channelCount
    ) as ScriptProcessorNode;
    
    // Set up audio processing
    (this.processorNode as ScriptProcessorNode).onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const channelData = inputBuffer.getChannelData(0); // Get first channel
      
      // Create a copy of the data to avoid issues with the buffer being reused
      const audioData = new Float32Array(channelData);
      
      // Emit audio data to registered handlers
      this.emitAudioData(audioData);
    };
    
    // Connect to destination to keep the node alive (with zero gain to avoid feedback)
    const silentGain = this.audioContext.createGain();
    silentGain.gain.value = 0;
    this.processorNode.connect(silentGain);
    silentGain.connect(this.audioContext.destination);
  }
  
  /**
   * Check if browser supports required features
   */
  static isSupported(): boolean {
    return !!(
      window.AudioContext || 
      (window as any).webkitAudioContext
    ) && !!navigator.mediaDevices?.getUserMedia;
  }
  
  /**
   * Get browser-specific information
   */
  getBrowserInfo(): {
    userAgent: string;
    audioContextSupport: boolean;
    audioWorkletSupport: boolean;
    getUserMediaSupport: boolean;
  } {
    return {
      userAgent: navigator.userAgent,
      audioContextSupport: !!(window.AudioContext || (window as any).webkitAudioContext),
      audioWorkletSupport: !!(this.audioContext?.audioWorklet),
      getUserMediaSupport: !!navigator.mediaDevices?.getUserMedia
    };
  }
}