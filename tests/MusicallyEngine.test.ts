import MusicallyEngine from '../src/index';
import { EngineConfig, AnalysisResult, SystemInfo } from '../src/types';

// Mock PlatformDetection to always return 'browser' in tests
jest.mock('../src/utils/PlatformDetection', () => {
  return {
    PlatformDetection: {
      detect: () => 'browser',
      isBrowser: () => true,
      isNode: () => false,
      isReactNative: () => false,
      isElectron: () => false,
      getEnvironmentInfo: () => ({
        platform: 'browser',
        hasWebAudio: true,
        hasMediaDevices: true,
        hasWebAssembly: false,
        hasSharedArrayBuffer: false
      })
    }
  };
});

// Mock WebAudioAdapter since it's the default
jest.mock('../src/platforms/browser/WebAudioAdapter', () => {
  return {
    WebAudioAdapter: jest.fn().mockImplementation(() => ({
      platform: 'browser',
      capabilities: {
        microphone: true,
        fileInput: true,
        streaming: true,
        offlineProcessing: true,
        webAssembly: false
      },
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      startMicrophone: jest.fn().mockResolvedValue(undefined),
      stopMicrophone: jest.fn(),
      loadFile: jest.fn().mockResolvedValue({
        sampleRate: 44100,
        length: 1024,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(1024)
      }),
      getAudioContext: jest.fn().mockReturnValue({ sampleRate: 44100 }),
      getSampleRate: jest.fn().mockReturnValue(44100),
      getBufferSize: jest.fn().mockReturnValue(2048),
      onAudioData: jest.fn(),
      offAudioData: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    }))
  };
});

describe('MusicallyEngine', () => {
  let engine: MusicallyEngine;

  beforeEach(() => {
    engine = MusicallyEngine.create();
  });

  afterEach(async () => {
    if (engine) {
      await engine.destroy();
    }
  });

  describe('Initialization', () => {
    test('should create engine with default configuration', () => {
      expect(engine).toBeInstanceOf(MusicallyEngine);
      
      const config = engine.getConfig();
      expect(config.sampleRate).toBe(44100);
      expect(config.bufferSize).toBe(2048);
      expect(config.musicSystem).toBe('auto');
      expect(config.audioType).toBe('auto');
      expect(config.referencePitch).toBe(440);
      expect(config.sensitivity).toBe(0.8);
      expect(config.realTimeMode).toBe(true);
    });

    test('should create engine with custom configuration', () => {
      const customConfig: Partial<EngineConfig> = {
        sampleRate: 48000,
        musicSystem: 'western',
        audioType: 'piano',
        referencePitch: 442
      };

      const customEngine = MusicallyEngine.create(customConfig);
      const config = customEngine.getConfig();

      expect(config.sampleRate).toBe(48000);
      expect(config.musicSystem).toBe('western');
      expect(config.audioType).toBe('piano');
      expect(config.referencePitch).toBe(442);

      customEngine.destroy();
    });

    test('should initialize successfully', async () => {
      const initHandler = jest.fn();
      engine.on('initialized', initHandler);

      await engine.initialize();

      expect(initHandler).toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      const errorHandler = jest.fn();
      engine.on('error', errorHandler);

      // Mock adapter to throw error
      const audioCapture = (engine as any).audioCapture;
      audioCapture.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));

      await expect(engine.initialize()).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ENGINE_INIT_FAILED'
        })
      );
    });
  });

  describe('Static factory methods', () => {
    test('should create engine with create method', () => {
      const newEngine = MusicallyEngine.create();
      expect(newEngine).toBeInstanceOf(MusicallyEngine);
      newEngine.destroy();
    });

    test('should create engine for specific platform', () => {
      const browserEngine = MusicallyEngine.createForPlatform('browser');
      expect(browserEngine).toBeInstanceOf(MusicallyEngine);
      browserEngine.destroy();
    });
  });

  describe('Audio input', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should start microphone capture', async () => {
      await expect(engine.startMicrophone()).resolves.not.toThrow();
    });

    test('should stop microphone capture', async () => {
      await engine.startMicrophone();
      expect(() => engine.stopMicrophone()).not.toThrow();
    });

    test('should process audio file', async () => {
      const mockFile = new File([''], 'test.wav');
      const results = await engine.processFile(mockFile);

      expect(Array.isArray(results)).toBe(true);
    });

    test('should process ArrayBuffer', async () => {
      const mockBuffer = new ArrayBuffer(1024);
      const results = await engine.processFile(mockBuffer);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Configuration management', () => {
    test('should set music system', () => {
      const configChangeHandler = jest.fn();
      engine.on('config_change', configChangeHandler);

      engine.setMusicSystem('carnatic');

      expect(engine.getConfig().musicSystem).toBe('carnatic');
      expect(configChangeHandler).toHaveBeenCalledWith({ musicSystem: 'carnatic' });
    });

    test('should set audio type', () => {
      const configChangeHandler = jest.fn();
      engine.on('config_change', configChangeHandler);

      engine.setAudioType('guitar');

      expect(engine.getConfig().audioType).toBe('guitar');
      expect(configChangeHandler).toHaveBeenCalledWith({ audioType: 'guitar' });
    });

    test('should set reference pitch', () => {
      const configChangeHandler = jest.fn();
      engine.on('config_change', configChangeHandler);

      engine.setReferencePitch(442);

      expect(engine.getConfig().referencePitch).toBe(442);
      expect(configChangeHandler).toHaveBeenCalledWith({ referencePitch: 442 });
    });

    test('should validate reference pitch', () => {
      expect(() => engine.setReferencePitch(0)).toThrow('must be positive');
      expect(() => engine.setReferencePitch(-100)).toThrow('must be positive');
    });

    test('should return complete configuration', () => {
      const config = engine.getConfig();

      expect(config).toHaveProperty('sampleRate');
      expect(config).toHaveProperty('bufferSize');
      expect(config).toHaveProperty('musicSystem');
      expect(config).toHaveProperty('audioType');
      expect(config).toHaveProperty('referencePitch');
      expect(config).toHaveProperty('sensitivity');
      expect(config).toHaveProperty('noiseReduction');
      expect(config).toHaveProperty('realTimeMode');
    });
  });

  describe('System information', () => {
    test('should return system information', () => {
      const systemInfo: SystemInfo = engine.getSystemInfo();

      expect(systemInfo).toHaveProperty('platform');
      expect(systemInfo).toHaveProperty('capabilities');
      expect(systemInfo).toHaveProperty('version');
      expect(systemInfo.platform).toBe('browser');
      expect(systemInfo.version).toBe('1.0.0');
    });

    test('should return supported formats', () => {
      const formats = engine.getSupportedFormats();

      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain('wav');
      expect(formats).toContain('mp3');
    });

    test('should return platform-specific supported formats', () => {
      // For browser platform
      const formats = engine.getSupportedFormats();
      expect(formats).toEqual(['wav', 'mp3', 'm4a', 'ogg']);
    });
  });

  describe('Activity tracking', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should track active state', async () => {
      expect(engine.isActive()).toBe(false);

      await engine.startMicrophone();
      expect(engine.isActive()).toBe(true);

      engine.stopMicrophone();
      expect(engine.isActive()).toBe(false);
    });
  });

  describe('Real-time analysis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should emit analysis events during microphone capture', async () => {
      const analysisHandler = jest.fn();
      engine.on('analysis', analysisHandler);

      await engine.startMicrophone();

      // Simulate audio data processing
      const mockData = new Float32Array([0.1, 0.2, 0.3]);
      (engine as any).processAudioData(mockData);

      expect(analysisHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          frequency: expect.any(Number),
          amplitude: expect.any(Number),
          confidence: expect.any(Number),
          audioType: expect.any(String),
          western: expect.objectContaining({
            note: expect.any(String),
            noteFrequency: expect.any(Number),
            cents: expect.any(Number),
            octave: expect.any(Number)
          }),
          musicalContext: expect.objectContaining({
            intervalFromTonic: expect.any(String),
            inScale: expect.any(Boolean)
          })
        })
      );
    });

    test('should respect configured audio type in analysis', async () => {
      engine.setAudioType('piano');
      
      const analysisHandler = jest.fn();
      engine.on('analysis', analysisHandler);

      await engine.startMicrophone();

      const mockData = new Float32Array([0.1, 0.2, 0.3]);
      (engine as any).processAudioData(mockData);

      expect(analysisHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          audioType: 'piano'
        })
      );
    });

    test('should use auto detection when audioType is auto', async () => {
      engine.setAudioType('auto');
      
      const analysisHandler = jest.fn();
      engine.on('analysis', analysisHandler);

      await engine.startMicrophone();

      const mockData = new Float32Array([0.1, 0.2, 0.3]);
      (engine as any).processAudioData(mockData);

      expect(analysisHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          audioType: 'voice' // Default auto-detected type
        })
      );
    });
  });

  describe('Event handling', () => {
    test('should support event listeners', () => {
      const testHandler = jest.fn();
      
      engine.on('test', testHandler);
      engine.emit('test', 'data');

      expect(testHandler).toHaveBeenCalledWith('data');
    });

    test('should support removing event listeners', () => {
      const testHandler = jest.fn();
      
      engine.on('test', testHandler);
      engine.off('test', testHandler);
      engine.emit('test', 'data');

      expect(testHandler).not.toHaveBeenCalled();
    });

    test('should support once listeners', () => {
      const testHandler = jest.fn();
      
      engine.once('test', testHandler);
      engine.emit('test', 'data1');
      engine.emit('test', 'data2');

      expect(testHandler).toHaveBeenCalledTimes(1);
      expect(testHandler).toHaveBeenCalledWith('data1');
    });
  });

  describe('Error handling', () => {
    test('should emit error events', () => {
      const errorHandler = jest.fn();
      engine.on('error', errorHandler);

      // Simulate error from audio capture
      const audioCapture = (engine as any).audioCapture;
      audioCapture.emit('error', { code: 'TEST_ERROR', message: 'Test' });

      expect(errorHandler).toHaveBeenCalledWith({
        code: 'TEST_ERROR',
        message: 'Test'
      });
    });

    test('should handle adapter creation errors gracefully', () => {
      // This would test error handling in createPlatformAdapter
      // For now, it always succeeds with browser adapter
      expect(() => MusicallyEngine.create()).not.toThrow();
    });
  });

  describe('Lifecycle management', () => {
    test('should destroy cleanly', async () => {
      await engine.initialize();
      await engine.startMicrophone();

      await expect(engine.destroy()).resolves.not.toThrow();
    });

    test('should handle destroy when not initialized', async () => {
      await expect(engine.destroy()).resolves.not.toThrow();
    });

    test('should stop capture when destroying', async () => {
      await engine.initialize();
      await engine.startMicrophone();

      expect(engine.isActive()).toBe(true);

      await engine.destroy();

      expect(engine.isActive()).toBe(false);
    });

    test('should remove all listeners on destroy', async () => {
      const testHandler = jest.fn();
      engine.on('test', testHandler);

      await engine.destroy();

      // Should not receive events after destroy
      engine.emit('test', 'data');
      expect(testHandler).not.toHaveBeenCalled();
    });
  });

  describe('Noise reduction configuration', () => {
    test('should have default noise reduction settings', () => {
      const config = engine.getConfig();

      expect(config.noiseReduction.enabled).toBe(true);
      expect(config.noiseReduction.aggressiveness).toBe(0.6);
      expect(config.noiseReduction.noiseFloorDb).toBe(-40);
      expect(config.noiseReduction.spectralSmoothing).toBe(0.8);
      expect(config.noiseReduction.adaptiveMode).toBe(true);
    });

    test('should allow custom noise reduction settings', () => {
      const customEngine = MusicallyEngine.create({
        noiseReduction: {
          enabled: false,
          aggressiveness: 0.8,
          noiseFloorDb: -50,
          spectralSmoothing: 0.9,
          adaptiveMode: false
        }
      });

      const config = customEngine.getConfig();
      expect(config.noiseReduction.enabled).toBe(false);
      expect(config.noiseReduction.aggressiveness).toBe(0.8);
      expect(config.noiseReduction.noiseFloorDb).toBe(-50);
      expect(config.noiseReduction.spectralSmoothing).toBe(0.9);
      expect(config.noiseReduction.adaptiveMode).toBe(false);

      customEngine.destroy();
    });
  });
});