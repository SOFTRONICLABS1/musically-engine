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
  
  describe('Configuration methods', () => {
    beforeEach(async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      await adapter.initialize(config);
    });

    test('should set latency hint', () => {
      expect(() => adapter.setLatencyHint('balanced')).not.toThrow();
      expect(() => adapter.setLatencyHint('playback')).not.toThrow();
    });

    test('should enable processing optimizations', () => {
      expect(() => adapter.enableProcessingOptimizations()).not.toThrow();
    });
  });

  describe('Audio processor creation', () => {
    beforeEach(async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      await adapter.initialize(config);
    });

    test('should create script processor when AudioWorklet fails', async () => {
      // Mock getUserMedia and start microphone to trigger processor creation
      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }]
      };
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);

      await expect(adapter.startMicrophone()).resolves.not.toThrow();
      
      // Verify processor node was created (indirectly through successful start)
      expect(adapter.stopMicrophone).not.toThrow();
    });

    test('should handle processor node creation errors', async () => {
      // Mock a problematic audio context
      const audioContext = adapter.getAudioContext();
      audioContext.createScriptProcessor = jest.fn().mockImplementation(() => {
        throw new Error('Cannot create processor');
      });

      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }]
      };
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);

      await expect(adapter.startMicrophone()).rejects.toThrow();
    });
  });

  describe('Error scenarios', () => {
    test('should handle audio context creation failure', async () => {
      // Mock absence of AudioContext
      const originalAudioContext = window.AudioContext;
      const originalWebkitAudioContext = (window as any).webkitAudioContext;
      
      delete (window as any).AudioContext;
      delete (window as any).webkitAudioContext;

      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };

      await expect(adapter.initialize(config)).rejects.toThrow('not supported');

      // Restore
      window.AudioContext = originalAudioContext;
      (window as any).webkitAudioContext = originalWebkitAudioContext;
    });

    test('should handle audio context resume failure', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };

      // Mock audio context that fails to resume
      const mockAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      mockAudioContext.state = 'suspended';
      mockAudioContext.resume = jest.fn().mockRejectedValue(new Error('Resume failed'));
      
      // Override the constructor to return our mock
      const OriginalAudioContext = window.AudioContext;
      window.AudioContext = jest.fn().mockReturnValue(mockAudioContext);

      await expect(adapter.initialize(config)).rejects.toThrow();

      // Restore
      window.AudioContext = OriginalAudioContext;
    });

    test('should throw when starting microphone without initialization', async () => {
      await expect(adapter.startMicrophone()).rejects.toThrow('not initialized');
    });

    test('should throw when starting microphone twice', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      await adapter.initialize(config);

      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }]
      };
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);

      await adapter.startMicrophone();
      await expect(adapter.startMicrophone()).rejects.toThrow('already active');
    });

    test('should throw when loading file without initialization', async () => {
      const mockFile = new File([''], 'test.wav');
      await expect(adapter.loadFile(mockFile)).rejects.toThrow('not initialized');
    });

    test('should handle file decoding errors', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };
      await adapter.initialize(config);

      // Mock audio context to reject decoding
      const audioContext = adapter.getAudioContext();
      audioContext.decodeAudioData = jest.fn().mockRejectedValue(new Error('Decode failed'));

      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      } as unknown as File;

      await expect(adapter.loadFile(mockFile)).rejects.toThrow('Failed to load audio file');
    });
  });

  describe('Audio context state management', () => {
    test('should handle suspended audio context', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };

      await adapter.initialize(config);
      
      const audioContext = adapter.getAudioContext();
      expect(audioContext.state).toBe('running'); // Should be resumed after init
    });

    test('should close audio context on destroy', async () => {
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

    test('should handle already closed audio context in destroy', async () => {
      const config: AudioCaptureConfig = {
        sampleRate: 44100,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      };

      await adapter.initialize(config);
      const audioContext = adapter.getAudioContext();
      
      // Close it manually first
      await audioContext.close();
      
      // Should not throw when destroying again
      await expect(adapter.destroy()).resolves.not.toThrow();
    });
  });

  describe('Browser support detection', () => {
    test('should detect browser support', () => {
      expect(WebAudioAdapter.isSupported()).toBe(true);
    });

    test('should detect no browser support when APIs missing', () => {
      const originalAudioContext = window.AudioContext;
      const originalWebkitAudioContext = (window as any).webkitAudioContext;
      const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
      
      delete (window as any).AudioContext;
      delete (window as any).webkitAudioContext;
      if (navigator.mediaDevices) {
        delete (navigator.mediaDevices as any).getUserMedia;
      }

      expect(WebAudioAdapter.isSupported()).toBe(false);

      // Restore
      window.AudioContext = originalAudioContext;
      (window as any).webkitAudioContext = originalWebkitAudioContext;
      if (navigator.mediaDevices && originalGetUserMedia) {
        navigator.mediaDevices.getUserMedia = originalGetUserMedia;
      }
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