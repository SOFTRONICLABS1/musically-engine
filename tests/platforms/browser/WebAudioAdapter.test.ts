import { WebAudioAdapter } from '../../../src/platforms/browser/WebAudioAdapter';
import { AudioCaptureConfig } from '../../../src/types';

describe('WebAudioAdapter', () => {
  let adapter: WebAudioAdapter;
  
  beforeEach(() => {
    adapter = new WebAudioAdapter();
  });
  
  afterEach(async () => {
    if (adapter) {
      await adapter.destroy();
    }
  });
  
  describe('Platform capabilities', () => {
    test('should have correct platform identifier', () => {
      expect(adapter.platform).toBe('browser');
    });
    
    test('should report correct capabilities', () => {
      const capabilities = adapter.capabilities;
      
      expect(capabilities.microphone).toBe(true);
      expect(capabilities.fileInput).toBe(true);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.offlineProcessing).toBe(true);
      expect(typeof capabilities.webAssembly).toBe('boolean');
    });
  });
  
  describe('Initialization', () => {
    test('should initialize with default config', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await expect(adapter.initialize(config)).resolves.not.toThrow();
      
      expect(adapter.getSampleRate()).toBe(44100);
      expect(adapter.getBufferSize()).toBe(2048);
    });
    
    test('should validate configuration', async () => {
      const invalidConfig: AudioCaptureConfig = {
        sampleRate: -1,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await expect(adapter.initialize(invalidConfig)).rejects.toThrow();
    });
    
    test('should throw error for invalid buffer size', async () => {
      const invalidConfig: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 1000, // Not a power of 2
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await expect(adapter.initialize(invalidConfig)).rejects.toThrow();
    });
  });
  
  describe('Audio context management', () => {
    test('should create audio context on initialization', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await adapter.initialize(config);
      
      const audioContext = adapter.getAudioContext();
      expect(audioContext).toBeDefined();
      expect(audioContext.sampleRate).toBe(44100);
    });
    
    test('should clean up audio context on destroy', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await adapter.initialize(config);
      const audioContext = adapter.getAudioContext();
      
      await adapter.destroy();
      
      expect(audioContext.state).toBe('closed');
    });
  });
  
  describe('Microphone handling', () => {
    test('should handle microphone start/stop cycle', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await adapter.initialize(config);
      
      // Mock successful getUserMedia
      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }]
      };
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);
      
      await expect(adapter.startMicrophone()).resolves.not.toThrow();
      expect(() => adapter.stopMicrophone()).not.toThrow();
    });
    
    test('should handle getUserMedia failure', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await adapter.initialize(config);
      
      // Mock getUserMedia failure
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );
      
      await expect(adapter.startMicrophone()).rejects.toThrow();
    });
  });
  
  describe('File loading', () => {
    test('should load audio file', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await adapter.initialize(config);
      
      // Mock file with arrayBuffer method
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
        name: 'test.wav',
        type: 'audio/wav'
      } as unknown as File;
      
      const audioBuffer = await adapter.loadFile(mockFile);
      
      expect(audioBuffer).toBeDefined();
      expect(audioBuffer.sampleRate).toBe(44100);
      expect(audioBuffer.length).toBe(1024);
      expect(audioBuffer.numberOfChannels).toBe(1);
    });
    
    test('should handle file loading errors', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await adapter.initialize(config);
      
      // Mock invalid file
      const invalidFile = new File(['invalid'], 'test.txt', { type: 'text/plain' });
      
      await expect(adapter.loadFile(invalidFile)).rejects.toThrow();
    });
  });
  
  describe('Event handling', () => {
    test('should register and emit events', () => {
      const handler = jest.fn();
      
      adapter.on('test', handler);
      adapter.emit('test', 'data');
      
      expect(handler).toHaveBeenCalledWith('data');
    });
    
    test('should remove event handlers', () => {
      const handler = jest.fn();
      
      adapter.on('test', handler);
      adapter.off('test', handler);
      adapter.emit('test', 'data');
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('Audio data handling', () => {
    test('should register audio data handlers', () => {
      const handler = jest.fn();
      
      adapter.onAudioData(handler);
      
      // Simulate audio data
      const testData = new Float32Array([0.1, 0.2, 0.3]);
      (adapter as any).emitAudioData(testData);
      
      expect(handler).toHaveBeenCalledWith(testData);
    });
    
    test('should remove audio data handlers', () => {
      const handler = jest.fn();
      
      adapter.onAudioData(handler);
      adapter.offAudioData(handler);
      
      // Simulate audio data
      const testData = new Float32Array([0.1, 0.2, 0.3]);
      (adapter as any).emitAudioData(testData);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('Browser support detection', () => {
    test('should detect browser support', () => {
      expect(WebAudioAdapter.isSupported()).toBe(true);
    });
    
    test('should provide browser information', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      
      await adapter.initialize(config);
      
      const browserInfo = adapter.getBrowserInfo();
      
      expect(browserInfo.userAgent).toBeDefined();
      expect(typeof browserInfo.audioContextSupport).toBe('boolean');
      expect(typeof browserInfo.audioWorkletSupport).toBe('boolean');
      expect(typeof browserInfo.getUserMediaSupport).toBe('boolean');
    });
  });
});