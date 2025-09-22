import MusicallyEngine from '../../src/index';
import { AnalysisResult } from '../../src/types';

describe('Audio Pipeline Integration Tests', () => {
  let engine: MusicallyEngine;

  beforeEach(() => {
    engine = MusicallyEngine.create({
      sampleRate: 44100,
      bufferSize: 1024,
      musicSystem: 'western',
      audioType: 'auto'
    });
  });

  afterEach(async () => {
    if (engine) {
      await engine.destroy();
    }
  });

  describe('End-to-end audio processing', () => {
    test('should complete full initialization and cleanup cycle', async () => {
      // Initialize
      await expect(engine.initialize()).resolves.not.toThrow();
      expect(engine.getSystemInfo().platform).toBe('browser');

      // Start processing
      await expect(engine.startMicrophone()).resolves.not.toThrow();
      expect(engine.isActive()).toBe(true);

      // Stop processing
      expect(() => engine.stopMicrophone()).not.toThrow();
      expect(engine.isActive()).toBe(false);

      // Cleanup
      await expect(engine.destroy()).resolves.not.toThrow();
    });

    test('should handle rapid start/stop cycles', async () => {
      await engine.initialize();

      // Multiple rapid cycles
      for (let i = 0; i < 3; i++) {
        await engine.startMicrophone();
        expect(engine.isActive()).toBe(true);
        
        engine.stopMicrophone();
        expect(engine.isActive()).toBe(false);
      }
    });

    test('should process audio file and return results', async () => {
      await engine.initialize();

      // Create mock audio file
      const mockArrayBuffer = new ArrayBuffer(4096);
      const results = await engine.processFile(mockArrayBuffer);

      expect(Array.isArray(results)).toBe(true);
    });

    test('should emit analysis events during real-time processing', async () => {
      const analysisEvents: AnalysisResult[] = [];
      
      engine.on('analysis', (result: AnalysisResult) => {
        analysisEvents.push(result);
      });

      await engine.initialize();
      await engine.startMicrophone();

      // Simulate audio data
      const mockData = new Float32Array(1024).fill(0.1);
      (engine as any).processAudioData(mockData);

      expect(analysisEvents.length).toBeGreaterThan(0);
      
      const result = analysisEvents[0];
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('frequency');
      expect(result).toHaveProperty('amplitude');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('western');
      expect(result.western).toHaveProperty('note');
      expect(result.western).toHaveProperty('frequency');
    });
  });

  describe('Configuration changes during operation', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should handle music system changes', async () => {
      const configChanges: any[] = [];
      
      engine.on('config_change', (change) => {
        configChanges.push(change);
      });

      // Change music systems
      engine.setMusicSystem('carnatic');
      engine.setMusicSystem('hindustani');
      engine.setMusicSystem('western');

      expect(configChanges).toHaveLength(3);
      expect(configChanges[0]).toEqual({ musicSystem: 'carnatic' });
      expect(configChanges[1]).toEqual({ musicSystem: 'hindustani' });
      expect(configChanges[2]).toEqual({ musicSystem: 'western' });
    });

    test('should handle audio type changes', async () => {
      const configChanges: any[] = [];
      
      engine.on('config_change', (change) => {
        configChanges.push(change);
      });

      // Change audio types
      engine.setAudioType('piano');
      engine.setAudioType('guitar');
      engine.setAudioType('voice');

      expect(configChanges).toHaveLength(3);
      expect(configChanges[0]).toEqual({ audioType: 'piano' });
      expect(configChanges[1]).toEqual({ audioType: 'guitar' });
      expect(configChanges[2]).toEqual({ audioType: 'voice' });
    });

    test('should handle reference pitch changes', async () => {
      const configChanges: any[] = [];
      
      engine.on('config_change', (change) => {
        configChanges.push(change);
      });

      // Change reference pitches
      engine.setReferencePitch(442);
      engine.setReferencePitch(438);
      engine.setReferencePitch(440);

      expect(configChanges).toHaveLength(3);
      expect(configChanges[0]).toEqual({ referencePitch: 442 });
      expect(configChanges[1]).toEqual({ referencePitch: 438 });
      expect(configChanges[2]).toEqual({ referencePitch: 440 });
    });
  });

  describe('Error recovery scenarios', () => {
    test('should recover from initialization errors', async () => {
      // Mock adapter to fail initially
      const audioCapture = (engine as any).audioCapture;
      let shouldFail = true;
      
      const originalInitialize = audioCapture.initialize;
      audioCapture.initialize = jest.fn().mockImplementation((...args) => {
        if (shouldFail) {
          shouldFail = false;
          return Promise.reject(new Error('Init failed'));
        }
        return originalInitialize.apply(audioCapture, args);
      });

      // First attempt should fail
      await expect(engine.initialize()).rejects.toThrow();

      // Second attempt should succeed
      await expect(engine.initialize()).resolves.not.toThrow();
    });

    test('should handle microphone access errors gracefully', async () => {
      await engine.initialize();

      // Mock microphone failure
      const audioCapture = (engine as any).audioCapture;
      audioCapture.startMicrophone = jest.fn().mockRejectedValue(new Error('Microphone blocked'));

      const errorEvents: any[] = [];
      engine.on('error', (error) => {
        errorEvents.push(error);
      });

      await expect(engine.startMicrophone()).rejects.toThrow();
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    test('should continue operating after non-fatal errors', async () => {
      await engine.initialize();

      // Simulate non-fatal error
      const audioCapture = (engine as any).audioCapture;
      audioCapture.emit('error', { 
        code: 'NON_FATAL_ERROR', 
        message: 'Something went wrong but recoverable' 
      });

      // Should still be able to start microphone
      await expect(engine.startMicrophone()).resolves.not.toThrow();
    });
  });

  describe('Memory and performance', () => {
    test('should handle multiple destroy/recreate cycles', async () => {
      for (let i = 0; i < 3; i++) {
        const testEngine = MusicallyEngine.create();
        await testEngine.initialize();
        await testEngine.startMicrophone();
        testEngine.stopMicrophone();
        await testEngine.destroy();
      }
      
      // No memory leaks expected (would be caught by Jest if severe)
      expect(true).toBe(true); // Test that we get here without crashes
    });

    test('should handle rapid audio data processing', async () => {
      await engine.initialize();
      await engine.startMicrophone();

      const analysisCount = 50;
      const analysisEvents: AnalysisResult[] = [];
      
      engine.on('analysis', (result: AnalysisResult) => {
        analysisEvents.push(result);
      });

      // Process multiple audio buffers rapidly
      for (let i = 0; i < analysisCount; i++) {
        const mockData = new Float32Array(1024).fill(Math.sin(i * 0.1));
        (engine as any).processAudioData(mockData);
      }

      expect(analysisEvents.length).toBe(analysisCount);
    });

    test('should handle large audio files', async () => {
      await engine.initialize();

      // Create large mock audio buffer (simulating 10 seconds at 44.1kHz)
      const largeBuffer = new ArrayBuffer(44100 * 10 * 4); // 10 seconds, 32-bit float
      
      const results = await engine.processFile(largeBuffer);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Platform capabilities integration', () => {
    test('should report correct capabilities', () => {
      const capabilities = engine.getSystemInfo().capabilities;
      
      expect(capabilities).toHaveProperty('microphone');
      expect(capabilities).toHaveProperty('fileInput');
      expect(capabilities).toHaveProperty('streaming');
      expect(capabilities).toHaveProperty('offlineProcessing');
      expect(capabilities).toHaveProperty('webAssembly');
    });

    test('should provide supported formats based on platform', () => {
      const formats = engine.getSupportedFormats();
      
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      
      // Browser should support these formats
      expect(formats).toContain('wav');
      expect(formats).toContain('mp3');
      expect(formats).toContain('m4a');
      expect(formats).toContain('ogg');
    });

    test('should integrate with platform detection', () => {
      const systemInfo = engine.getSystemInfo();
      
      expect(systemInfo.platform).toBe('browser'); // In test environment
      expect(systemInfo.version).toBe('1.0.0');
      expect(systemInfo.capabilities).toBeDefined();
    });
  });

  describe('Real-time audio analysis integration', () => {
    test('should produce consistent analysis results', async () => {
      await engine.initialize();
      await engine.startMicrophone();

      const analysisResults: AnalysisResult[] = [];
      
      engine.on('analysis', (result: AnalysisResult) => {
        analysisResults.push(result);
      });

      // Generate consistent sine wave audio data
      const frequency = 440; // A4
      const sampleRate = 44100;
      const duration = 0.1; // 100ms
      const samples = Math.floor(sampleRate * duration);
      
      const sineWave = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        sineWave[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
      }

      // Process the same sine wave multiple times
      for (let i = 0; i < 5; i++) {
        (engine as any).processAudioData(sineWave);
      }

      expect(analysisResults.length).toBe(5);
      
      // All results should be similar for the same input
      const firstResult = analysisResults[0];
      analysisResults.forEach(result => {
        expect(result.audioType).toBe(firstResult.audioType);
        expect(result.western.note).toBe(firstResult.western.note);
        // Frequency should be close to 440Hz (allowing for processing variations)
        expect(result.frequency).toBeCloseTo(440, 0);
      });
    });

    test('should handle different audio types correctly', async () => {
      await engine.initialize();

      const testConfigs = [
        { audioType: 'voice' as const, expectedType: 'voice' },
        { audioType: 'piano' as const, expectedType: 'piano' },
        { audioType: 'guitar' as const, expectedType: 'guitar' }
      ];

      for (const config of testConfigs) {
        engine.setAudioType(config.audioType);
        
        const analysisResult: AnalysisResult[] = [];
        const handler = (result: AnalysisResult) => {
          analysisResult.push(result);
        };
        
        engine.on('analysis', handler);
        
        // Simulate audio processing
        const mockData = new Float32Array(1024).fill(0.1);
        (engine as any).processAudioData(mockData);
        
        engine.off('analysis', handler);
        
        expect(analysisResult.length).toBe(1);
        expect(analysisResult[0].audioType).toBe(config.expectedType);
      }
    });
  });
});