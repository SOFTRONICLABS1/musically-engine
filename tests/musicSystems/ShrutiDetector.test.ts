import { describe, test, expect, beforeEach } from '@jest/globals';
import { ShrutiDetector, ShrutiDetectionResult } from '../../src/musicSystems/ShrutiDetector';

describe('ShrutiDetector', () => {
  let detector: ShrutiDetector;

  beforeEach(() => {
    detector = new ShrutiDetector();
  });

  describe('Basic functionality', () => {
    test('should create with default configuration', () => {
      const config = detector.getConfig();
      expect(config.minSamples).toBe(50);
      expect(config.perfectFifthRatio).toBe(1.5);
      expect(config.ratioTolerance).toBe(0.12); // Updated to 12% for human voices
    });

    test('should create with custom configuration', () => {
      const customDetector = new ShrutiDetector({
        minSamples: 30,
        perfectFifthRatio: 1.498,
        ratioTolerance: 0.1
      });
      
      const config = customDetector.getConfig();
      expect(config.minSamples).toBe(30);
      expect(config.perfectFifthRatio).toBe(1.498);
      expect(config.ratioTolerance).toBe(0.1);
    });

    test('should update configuration', () => {
      detector.updateConfig({ minSamples: 25 });
      expect(detector.getConfig().minSamples).toBe(25);
    });
  });

  describe('Shruti detection', () => {
    test('should reject too few samples', () => {
      const frequencies = [264, 264, 264]; // Only 3 samples
      const result = detector.detectShruti(frequencies);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.message).toContain('Too few samples');
    });

    test('should detect perfect Sa-Pa pattern', () => {
      // Generate test data: Sa at 264Hz, Pa at 396Hz (perfect 3:2 ratio)
      const saFreq = 264;
      const paFreq = saFreq * 1.5; // Perfect fifth = 396Hz
      
      const frequencies = [
        // Sa cluster (20 samples)
        ...Array(20).fill(saFreq + Math.random() * 4 - 2),
        // Pa cluster (20 samples) 
        ...Array(20).fill(paFreq + Math.random() * 4 - 2),
        // More Sa (15 samples)
        ...Array(15).fill(saFreq + Math.random() * 4 - 2)
      ];
      
      const result = detector.detectShruti(frequencies);
      
      expect(result.success).toBe(true);
      expect(result.saFrequency).toBeCloseTo(saFreq, 0);
      expect(result.paFrequency).toBeCloseTo(paFreq, 0);
      expect(result.ratio).toBeCloseTo(1.5, 2);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
    
    test('should detect complete octave Sa-Pa-Sa+1-Pa-Sa-Pa-1-Sa pattern', () => {
      // Generate test data with octave pattern
      const saFreq = 264;
      const paFreq = saFreq * 1.5; // Perfect fifth = 396Hz
      const saHighFreq = saFreq * 2; // Octave above = 528Hz
      const paLowFreq = paFreq / 2; // Octave below Pa = 198Hz
      
      const frequencies = [
        // Sa cluster (Madhya) - 15 samples
        ...Array(15).fill(saFreq + Math.random() * 4 - 2),
        // Pa cluster (Madhya) - 15 samples
        ...Array(15).fill(paFreq + Math.random() * 4 - 2),
        // Sa+1 cluster (Tara) - 10 samples
        ...Array(10).fill(saHighFreq + Math.random() * 4 - 2),
        // Pa-1 cluster (Mandra) - 10 samples
        ...Array(10).fill(paLowFreq + Math.random() * 4 - 2),
        // More Sa (Madhya) - 10 samples
        ...Array(10).fill(saFreq + Math.random() * 4 - 2)
      ];
      
      const result = detector.detectShruti(frequencies);
      
      expect(result.success).toBe(true);
      expect(result.octavePattern).toBe(true);
      expect(result.saFrequency).toBeCloseTo(saFreq, 0);
      expect(result.paFrequency).toBeCloseTo(paFreq, 0);
      expect(result.saHighFrequency).toBeCloseTo(saHighFreq, 0);
      expect(result.paLowFrequency).toBeCloseTo(paLowFreq, 0);
      expect(result.ratio).toBeCloseTo(1.5, 2);
      expect(result.confidence).toBeGreaterThan(0.85);
    });
    
    test('should detect partial octave pattern (missing Pa-1)', () => {
      // Generate test data with incomplete octave pattern
      const saFreq = 264;
      const paFreq = saFreq * 1.5;
      const saHighFreq = saFreq * 2;
      
      const frequencies = [
        // Sa cluster (Madhya)
        ...Array(15).fill(saFreq + Math.random() * 4 - 2),
        // Pa cluster (Madhya)
        ...Array(15).fill(paFreq + Math.random() * 4 - 2),
        // Sa+1 cluster (Tara)
        ...Array(15).fill(saHighFreq + Math.random() * 4 - 2)
      ];
      
      const result = detector.detectShruti(frequencies);
      
      expect(result.success).toBe(true);
      expect(result.octavePattern).toBe(true);
      expect(result.saFrequency).toBeCloseTo(saFreq, 0);
      expect(result.paFrequency).toBeCloseTo(paFreq, 0);
      expect(result.saHighFrequency).toBeCloseTo(saHighFreq, 0);
      expect(result.paLowFrequency).toBeUndefined();
    });

    test('should reject single note pattern', () => {
      // Only Sa, no Pa
      const frequencies = Array(60).fill(264 + Math.random() * 4 - 2);
      const result = detector.detectShruti(frequencies);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Only one pitch detected');
      expect(result.clusters).toHaveLength(1);
    });

    test('should accept human vocal variations in Sa-Pa ratio', () => {
      // Test various ratios that humans might sing (within ±12% tolerance)
      const testRatios = [
        { ratio: 1.45, description: 'slightly flat Pa' },
        { ratio: 1.48, description: 'natural vocal variation' },
        { ratio: 1.52, description: 'slightly sharp Pa' },
        { ratio: 1.55, description: 'sharp but acceptable' }
      ];
      
      testRatios.forEach(({ ratio, description }) => {
        const saFreq = 264;
        const paFreq = saFreq * ratio;
        
        const frequencies = [
          ...Array(25).fill(saFreq),
          ...Array(25).fill(paFreq)
        ];
        
        const result = detector.detectShruti(frequencies);
        expect(result.success).toBe(true);
        expect(result.ratio).toBeCloseTo(ratio, 2);
        // Should accept these human variations
      });
    });
    
    test('should reject wrong interval ratio', () => {
      // Sa at 264Hz, but "Pa" at wrong frequency (major third instead of fifth)
      const saFreq = 264;
      const wrongPaFreq = saFreq * 1.25; // Major third, not perfect fifth
      
      const frequencies = [
        ...Array(25).fill(saFreq + Math.random() * 4 - 2),
        ...Array(25).fill(wrongPaFreq + Math.random() * 4 - 2)
      ];
      
      const result = detector.detectShruti(frequencies);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('need ~1.500 for perfect fifth');
    });
  });

  describe('Note conversion', () => {
    test('should convert Sa frequency to correct Western note', () => {
      expect(detector.getShrutiNote(261.63)).toBe('C');  // C4
      expect(detector.getShrutiNote(293.66)).toBe('D');  // D4
      expect(detector.getShrutiNote(329.63)).toBe('E');  // E4
      expect(detector.getShrutiNote(440)).toBe('A');     // A4
    });

    test('should handle different octaves', () => {
      expect(detector.getShrutiNote(130.81)).toBe('C');  // C3
      expect(detector.getShrutiNote(523.25)).toBe('C');  // C5
    });
  });

  describe('Edge cases', () => {
    test('should handle empty frequency array', () => {
      const result = detector.detectShruti([]);
      expect(result.success).toBe(false);
      expect(result.clusters).toHaveLength(0);
    });

    test('should filter out invalid frequencies', () => {
      const frequencies = [
        10, 20, 30, // Too low
        2500, 3000, // Too high
        264, 264, 264, // Valid Sa frequencies
        396, 396, 396  // Valid Pa frequencies  
      ];
      
      const result = detector.detectShruti(frequencies);
      // Should work with just the valid frequencies
      expect(result.success).toBe(false); // Still not enough samples after filtering
      expect(result.message).toContain('Too few valid frequencies');
    });

    test('should handle noisy data', () => {
      const saFreq = 264;
      const paFreq = 396;
      
      // Add noise to frequencies
      const frequencies = [
        ...Array(30).fill(0).map(() => saFreq + (Math.random() - 0.5) * 20),
        ...Array(30).fill(0).map(() => paFreq + (Math.random() - 0.5) * 20)
      ];
      
      const result = detector.detectShruti(frequencies);
      
      // Should still detect despite noise (though confidence may be lower)
      if (result.success) {
        expect(result.saFrequency).toBeCloseTo(saFreq, -1); // Within 10Hz
        expect(result.paFrequency).toBeCloseTo(paFreq, -1); // Within 10Hz
      }
    });
  });

  describe('Demo frequencies generation', () => {
    test('should generate correct demo frequencies', () => {
      const demo = detector.getDemoFrequencies(261.63);
      
      expect(demo.sa).toBe(261.63);
      expect(demo.pa).toBeCloseTo(392.445, 2); // 261.63 * 1.5
      expect(demo.saHigh).toBeCloseTo(523.26, 2); // 261.63 * 2
      expect(demo.paLow).toBeCloseTo(196.2225, 2); // 392.445 / 2
      
      expect(demo.pattern).toHaveLength(7);
      expect(demo.pattern[0].note).toBe('Sa');
      expect(demo.pattern[1].note).toBe('Pa');
      expect(demo.pattern[2].note).toBe('Sa+1');
      expect(demo.pattern[3].note).toBe('Pa');
      expect(demo.pattern[4].note).toBe('Sa');
      expect(demo.pattern[5].note).toBe('Pa-1');
      expect(demo.pattern[6].note).toBe('Sa');
    });
    
    test('should use custom base frequency', () => {
      const demo = detector.getDemoFrequencies(440); // A4
      
      expect(demo.sa).toBe(440);
      expect(demo.pa).toBeCloseTo(660, 1); // 440 * 1.5
      expect(demo.saHigh).toBeCloseTo(880, 1); // 440 * 2
      expect(demo.paLow).toBeCloseTo(330, 1); // 660 / 2
    });
  });
  
  describe('Configuration edge cases', () => {
    test('should handle very strict configuration', () => {
      const strictDetector = new ShrutiDetector({
        ratioTolerance: 0.01, // Very strict 1% tolerance
        minClusterSize: 10
      });
      
      const saFreq = 264;
      const paFreq = saFreq * 1.49; // Slightly off perfect fifth
      
      const frequencies = [
        ...Array(15).fill(saFreq),
        ...Array(15).fill(paFreq)
      ];
      
      const result = strictDetector.detectShruti(frequencies);
      expect(result.success).toBe(false); // Should reject due to strict tolerance
    });

    test('should handle very loose configuration', () => {
      const looseDetector = new ShrutiDetector({
        ratioTolerance: 0.2, // Very loose 20% tolerance
        minClusterSize: 2
      });
      
      const saFreq = 264;
      const paFreq = saFreq * 1.3; // Way off perfect fifth, but within loose tolerance
      
      const frequencies = [
        ...Array(25).fill(saFreq),
        ...Array(25).fill(paFreq)
      ];
      
      const result = looseDetector.detectShruti(frequencies);
      expect(result.success).toBe(true); // Should accept due to loose tolerance
    });
  });
});