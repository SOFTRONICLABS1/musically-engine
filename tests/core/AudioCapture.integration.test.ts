import { AudioCapture } from '../../src/core/AudioCapture';
import { WebAudioAdapter } from '../../src/platforms/browser/WebAudioAdapter';

describe('AudioCapture Integration Tests', () => {
  let audioCapture: AudioCapture;
  let adapter: WebAudioAdapter;

  beforeEach(() => {
    adapter = new WebAudioAdapter();
    audioCapture = new AudioCapture(adapter);
  });

  afterEach(async () => {
    if (audioCapture) {
      await audioCapture.destroy();
    }
  });

  describe('Real adapter integration', () => {
    test('should initialize with real WebAudioAdapter', async () => {
      await expect(audioCapture.initialize()).resolves.not.toThrow();
      expect(audioCapture.getCapabilities().microphone).toBe(true);
    });

    test('should return platform information', async () => {
      await audioCapture.initialize();
      
      const platformInfo = audioCapture.getPlatformInfo();
      expect(platformInfo.platform).toBe('browser');
      expect(platformInfo.sampleRate).toBe(44100);
      expect(platformInfo.bufferSize).toBe(2048);
    });

    test('should handle configuration updates', async () => {
      await audioCapture.initialize();
      
      const configHandler = jest.fn();
      audioCapture.on('config_change', configHandler);
      
      await audioCapture.updateConfig({ bufferSize: 4096 });
      
      expect(configHandler).toHaveBeenCalledWith({
        config: expect.objectContaining({ bufferSize: 4096 })
      });
    });

    test('should clean up properly', async () => {
      await audioCapture.initialize();
      await expect(audioCapture.destroy()).resolves.not.toThrow();
    });
  });

  describe('Error handling with real adapter', () => {
    test('should handle initialization errors gracefully', async () => {
      const errorHandler = jest.fn();
      audioCapture.on('error', errorHandler);

      // Force an error by passing invalid config
      await expect(audioCapture.initialize({
        sampleRate: -1,
        bufferSize: 2048,
        channelCount: 1,
        bitDepth: 32,
        latency: 'interactive'
      })).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalled();
    });
  });
});