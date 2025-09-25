import { AudioCapture } from '../../src/core/AudioCapture';
import { IPlatformAdapter } from '../../src/platforms/IPlatformAdapter';
import { AudioCaptureConfig, PlatformCapabilities, AudioBuffer as EngineAudioBuffer } from '../../src/types';

// Mock platform adapter
class MockPlatformAdapter implements IPlatformAdapter {
  readonly platform = 'mock';
  readonly capabilities: PlatformCapabilities = {
    microphone: true,
    fileInput: true,
    streaming: true,
    offlineProcessing: true,
    webAssembly: false
  };

  private eventHandlers: Map<string, Set<Function>> = new Map();
  private audioDataHandlers: Set<Function> = new Set();
  private initialized = false;
  private capturing = false;

  async initialize(config: AudioCaptureConfig): Promise<void> {
    this.initialized = true;
    this.emit('initialized', config);
  }

  async destroy(): Promise<void> {
    this.initialized = false;
    this.capturing = false;
    this.emit('destroyed', {});
  }

  async startMicrophone(): Promise<void> {
    if (!this.initialized) throw new Error('Not initialized');
    this.capturing = true;
    this.emit('microphone_started', {});
  }

  stopMicrophone(): void {
    this.capturing = false;
    this.emit('microphone_stopped', {});
  }

  async loadFile(file: File | string | Buffer | ArrayBuffer): Promise<EngineAudioBuffer> {
    return {
      sampleRate: 44100,
      length: 1024,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(1024)
    };
  }

  getAudioContext(): any {
    return { sampleRate: 44100 };
  }

  getSampleRate(): number {
    return 44100;
  }

  getBufferSize(): number {
    return 2048;
  }

  onAudioData(handler: Function): void {
    this.audioDataHandlers.add(handler);
  }

  offAudioData(handler: Function): void {
    this.audioDataHandlers.delete(handler);
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // Test helpers
  simulateAudioData(data: Float32Array): void {
    this.audioDataHandlers.forEach(handler => handler(data));
    this.emit('audio_data', data);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isCapturing(): boolean {
    return this.capturing;
  }
}

// Failing mock adapters for specific tests
class FailingInitializeMockAdapter extends MockPlatformAdapter {
  async initialize(config: AudioCaptureConfig): Promise<void> {
    throw new Error('Init failed');
  }
}

class FailingLoadFileMockAdapter extends MockPlatformAdapter {
  async loadFile(file: File | string | Buffer | ArrayBuffer): Promise<EngineAudioBuffer> {
    throw new Error('File load failed');
  }
}

class FailingStartMicMockAdapter extends MockPlatformAdapter {
  async startMicrophone(): Promise<void> {
    throw new Error('Mic failed');
  }
}

describe('AudioCapture', () => {
  let mockAdapter: MockPlatformAdapter;
  let audioCapture: AudioCapture;

  beforeEach(() => {
    mockAdapter = new MockPlatformAdapter();
    audioCapture = new AudioCapture(mockAdapter);
  });

  afterEach(async () => {
    if (audioCapture) {
      await audioCapture.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default config', async () => {
      const initHandler = jest.fn();
      audioCapture.on('initialized', initHandler);

      await audioCapture.initialize();

      expect(mockAdapter.isInitialized()).toBe(true);
      expect(initHandler).toHaveBeenCalledWith({ 
        config: expect.objectContaining({
          sampleRate: 44100,
          bufferSize: 2048,
          channelCount: 1,
          bitDepth: 32,
          latency: 'interactive'
        })
      });
    });

    test('should initialize with custom config', async () => {
      const customConfig = {
        sampleRate: 48000,
        bufferSize: 4096
      };

      await audioCapture.initialize(customConfig);

      expect(mockAdapter.isInitialized()).toBe(true);
    });

    test('should throw error when already initialized', async () => {
      await audioCapture.initialize();

      await expect(audioCapture.initialize()).rejects.toThrow('already initialized');
    });

    test('should emit error on initialization failure', async () => {
      const failingAdapter = new FailingInitializeMockAdapter();
      const testAudioCapture = new AudioCapture(failingAdapter);
      const errorHandler = jest.fn();
      testAudioCapture.on('error', errorHandler);

      await expect(testAudioCapture.initialize()).rejects.toMatchObject({
        code: 'ENGINE_INIT_FAILED',
        message: 'Failed to initialize audio capture'
      });
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ENGINE_INIT_FAILED'
        })
      );
    });
  });

  describe('Microphone capture', () => {
    beforeEach(async () => {
      await audioCapture.initialize();
    });

    test('should start microphone capture', async () => {
      const startHandler = jest.fn();
      audioCapture.on('audio_start', startHandler);

      await audioCapture.startMicrophone();

      expect(mockAdapter.isCapturing()).toBe(true);
      expect(startHandler).toHaveBeenCalledWith({ source: 'microphone' });
    });

    test('should stop microphone capture', async () => {
      const stopHandler = jest.fn();
      audioCapture.on('audio_stop', stopHandler);

      await audioCapture.startMicrophone();
      audioCapture.stopMicrophone();

      expect(mockAdapter.isCapturing()).toBe(false);
      expect(stopHandler).toHaveBeenCalledWith({ source: 'microphone' });
    });

    test('should throw error when starting capture while already active', async () => {
      await audioCapture.startMicrophone();

      await expect(audioCapture.startMicrophone()).rejects.toThrow('already active');
    });

    test('should handle multiple stop calls gracefully', async () => {
      await audioCapture.startMicrophone();
      
      expect(() => {
        audioCapture.stopMicrophone();
        audioCapture.stopMicrophone();
      }).not.toThrow();
    });

    test('should throw error when microphone not supported', async () => {
      mockAdapter.capabilities.microphone = false;

      await expect(audioCapture.startMicrophone()).rejects.toThrow('not supported');
    });

    test('should require initialization before starting microphone', async () => {
      const uninitializedCapture = new AudioCapture(new MockPlatformAdapter());

      await expect(uninitializedCapture.startMicrophone()).rejects.toThrow('must be initialized');
    });
  });

  describe('File processing', () => {
    beforeEach(async () => {
      await audioCapture.initialize();
    });

    test('should load and process audio file', async () => {
      const fileHandler = jest.fn();
      audioCapture.on('file_loaded', fileHandler);

      const mockFile = new File([''], 'test.wav');
      const result = await audioCapture.loadFile(mockFile);

      expect(result.sampleRate).toBe(44100);
      expect(result.length).toBe(1024);
      expect(fileHandler).toHaveBeenCalledWith({
        duration: expect.any(Number),
        sampleRate: 44100,
        channels: 1
      });
    });

    test('should throw error when file input not supported', async () => {
      mockAdapter.capabilities.fileInput = false;

      const mockFile = new File([''], 'test.wav');
      await expect(audioCapture.loadFile(mockFile)).rejects.toThrow('not supported');
    });

    test('should require initialization before loading file', async () => {
      const uninitializedCapture = new AudioCapture(new MockPlatformAdapter());

      await expect(uninitializedCapture.loadFile(new File([''], 'test.wav')))
        .rejects.toThrow('must be initialized');
    });

    test('should handle file load errors', async () => {
      const failingAdapter = new FailingLoadFileMockAdapter();
      const testAudioCapture = new AudioCapture(failingAdapter);
      await testAudioCapture.initialize();
      
      const errorHandler = jest.fn();
      testAudioCapture.on('error', errorHandler);

      await expect(testAudioCapture.loadFile(new File([''], 'test.wav'))).rejects.toMatchObject({
        code: 'FILE_LOAD_FAILED',
        message: 'Failed to load audio file'
      });
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FILE_LOAD_FAILED'
        })
      );
    });
  });

  describe('Audio data handling', () => {
    beforeEach(async () => {
      await audioCapture.initialize();
    });

    test('should register and receive audio data', async () => {
      const audioDataHandler = jest.fn();
      audioCapture.onAudioData(audioDataHandler);

      const testData = new Float32Array([0.1, 0.2, 0.3]);
      mockAdapter.simulateAudioData(testData);

      expect(audioDataHandler).toHaveBeenCalledWith(testData);
    });

    test('should unregister audio data handler', () => {
      const audioDataHandler = jest.fn();
      
      audioCapture.onAudioData(audioDataHandler);
      audioCapture.offAudioData(audioDataHandler);

      const testData = new Float32Array([0.1, 0.2, 0.3]);
      mockAdapter.simulateAudioData(testData);

      expect(audioDataHandler).not.toHaveBeenCalled();
    });

    test('should forward audio data events', () => {
      const audioDataEventHandler = jest.fn();
      audioCapture.on('audio_data', audioDataEventHandler);

      const testData = new Float32Array([0.1, 0.2, 0.3]);
      mockAdapter.simulateAudioData(testData);

      expect(audioDataEventHandler).toHaveBeenCalledWith(testData);
    });
  });

  describe('Configuration management', () => {
    test('should return current configuration', async () => {
      const config = {
        sampleRate: 48000,
        bufferSize: 4096
      };

      await audioCapture.initialize(config);
      const currentConfig = audioCapture.getConfig();

      expect(currentConfig.sampleRate).toBe(48000);
      expect(currentConfig.bufferSize).toBe(4096);
    });

    test('should update configuration', async () => {
      const configChangeHandler = jest.fn();
      audioCapture.on('config_change', configChangeHandler);

      await audioCapture.initialize();
      await audioCapture.updateConfig({ sampleRate: 48000 });

      expect(configChangeHandler).toHaveBeenCalledWith({
        config: expect.objectContaining({ sampleRate: 48000 })
      });
    });

    test('should restart capture when updating config during active capture', async () => {
      await audioCapture.initialize();
      await audioCapture.startMicrophone();

      expect(audioCapture.isActive()).toBe(true);

      await audioCapture.updateConfig({ bufferSize: 4096 });

      expect(audioCapture.isActive()).toBe(true); // Should restart automatically
    });
  });

  describe('Platform capabilities', () => {
    test('should return platform capabilities', () => {
      const capabilities = audioCapture.getCapabilities();

      expect(capabilities.microphone).toBe(true);
      expect(capabilities.fileInput).toBe(true);
      expect(capabilities.streaming).toBe(true);
    });

    test('should return platform information', () => {
      const platformInfo = audioCapture.getPlatformInfo();

      expect(platformInfo.platform).toBe('mock');
      expect(platformInfo.capabilities).toBeDefined();
      expect(platformInfo.sampleRate).toBe(44100);
      expect(platformInfo.bufferSize).toBe(2048);
    });
  });

  describe('Lifecycle management', () => {
    test('should track active state', async () => {
      expect(audioCapture.isActive()).toBe(false);

      await audioCapture.initialize();
      await audioCapture.startMicrophone();

      expect(audioCapture.isActive()).toBe(true);

      audioCapture.stopMicrophone();
      expect(audioCapture.isActive()).toBe(false);
    });

    test('should clean up resources on destroy', async () => {
      const destroyedHandler = jest.fn();
      audioCapture.on('destroyed', destroyedHandler);

      await audioCapture.initialize();
      await audioCapture.startMicrophone();

      await audioCapture.destroy();

      expect(mockAdapter.isInitialized()).toBe(false);
      expect(mockAdapter.isCapturing()).toBe(false);
      expect(destroyedHandler).toHaveBeenCalled();
    });

    test('should handle destroy when not initialized', async () => {
      await expect(audioCapture.destroy()).resolves.not.toThrow();
    });
  });

  describe('Error handling', () => {
    test('should forward adapter errors', () => {
      const errorHandler = jest.fn();
      audioCapture.on('error', errorHandler);

      const testError = { code: 'TEST_ERROR', message: 'Test error' };
      mockAdapter.emit('error', testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
    });

    test('should handle microphone start errors', async () => {
      const failingAdapter = new FailingStartMicMockAdapter();
      const testAudioCapture = new AudioCapture(failingAdapter);
      await testAudioCapture.initialize();

      const errorHandler = jest.fn();
      testAudioCapture.on('error', errorHandler);

      await expect(testAudioCapture.startMicrophone()).rejects.toMatchObject({
        code: 'MICROPHONE_START_FAILED',
        message: 'Failed to start microphone capture'
      });
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MICROPHONE_START_FAILED'
        })
      );
    });

    test('should handle microphone stop errors gracefully', async () => {
      await audioCapture.initialize();
      await audioCapture.startMicrophone();

      const errorHandler = jest.fn();
      audioCapture.on('error', errorHandler);

      mockAdapter.stopMicrophone = jest.fn().mockImplementation(() => {
        throw new Error('Stop failed');
      });

      expect(() => audioCapture.stopMicrophone()).not.toThrow();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MICROPHONE_STOP_FAILED'
        })
      );
    });
  });
});