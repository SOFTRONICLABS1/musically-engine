import { describe, test, expect, beforeEach } from '@jest/globals';
import { createMusicSystem } from '../../src/musicSystems/index';
import { WesternMusicSystem } from '../../src/musicSystems/Western';
import { CarnaticMusicSystem } from '../../src/musicSystems/Carnatic';
import { HindustaniMusicSystem } from '../../src/musicSystems/Hindustani';

describe('Music System Integration', () => {
  describe('Music System Factory', () => {
    test('should create Western music system', () => {
      const system = createMusicSystem('western', 440);
      expect(system).toBeInstanceOf(WesternMusicSystem);
      expect(system.getReferencePitch()).toBe(440);
    });

    test('should create Carnatic music system', () => {
      const system = createMusicSystem('carnatic', 444);
      expect(system).toBeInstanceOf(CarnaticMusicSystem);
      expect(system.getReferencePitch()).toBe(444);
    });

    test('should create Hindustani music system', () => {
      const system = createMusicSystem('hindustani', 442);
      expect(system).toBeInstanceOf(HindustaniMusicSystem);
      expect(system.getReferencePitch()).toBe(442);
    });

    test('should default to Western for auto system', () => {
      const system = createMusicSystem('auto', 440);
      expect(system).toBeInstanceOf(WesternMusicSystem);
    });

    test('should use default reference pitch when not provided', () => {
      const system = createMusicSystem('western');
      expect(system.getReferencePitch()).toBe(440);
    });

    test('should throw error for unsupported music system', () => {
      expect(() => createMusicSystem('invalid' as any)).toThrow('Unsupported music system');
    });
  });

  describe('Cross-system frequency analysis', () => {
    let westernSystem: WesternMusicSystem;
    let carnaticSystem: CarnaticMusicSystem;
    let hindustaniSystem: HindustaniMusicSystem;

    beforeEach(() => {
      westernSystem = new WesternMusicSystem(440);
      carnaticSystem = new CarnaticMusicSystem(440);
      hindustaniSystem = new HindustaniMusicSystem(440);
    });

    test('should analyze same frequency consistently across systems', () => {
      const frequency = 440; // A4 / Sa in different systems
      
      const westernResult = westernSystem.analyzeFrequency(frequency);
      expect(westernResult.note).toBe('A4');
      expect(westernResult.octave).toBe(4);

      // For Indian systems, 440Hz would be higher than Sa (which is ~264Hz)
      const carnaticResult = carnaticSystem.analyzeFrequency(frequency);
      expect(carnaticResult.swara).toBeDefined();
      
      const hindustaniResult = hindustaniSystem.analyzeFrequency(frequency);
      expect(hindustaniResult.swara).toBeDefined();
    });

    test('should handle reference note frequencies', () => {
      // Western A4 = 440Hz
      const westernA4 = westernSystem.noteToFrequency('A4');
      expect(Math.abs(westernA4 - 440)).toBeLessThan(0.1);

      // Sa frequency in Indian systems (relative to A440)
      const carnaticSa = carnaticSystem.noteToFrequency('Sa');
      const hindustaniSa = hindustaniSystem.noteToFrequency('Sa');
      
      // Sa should be the same frequency in both Indian systems
      expect(Math.abs(carnaticSa - hindustaniSa)).toBeLessThan(0.1);
    });

    test('should maintain octave relationships across systems', () => {
      const baseFreq = 220; // Lower octave
      const upperFreq = 440; // Upper octave (2x)

      // Western system
      const westernBase = westernSystem.frequencyToNote(baseFreq);
      const westernUpper = westernSystem.frequencyToNote(upperFreq);
      expect(westernUpper.octave).toBe((westernBase.octave as number) + 1);

      // Carnatic system  
      const carnaticBase = carnaticSystem.frequencyToNote(baseFreq);
      const carnaticUpper = carnaticSystem.frequencyToNote(upperFreq);
      expect(carnaticUpper.octave).toBe((carnaticBase.octave as number) + 1);

      // Hindustani system
      const hindustaniBase = hindustaniSystem.frequencyToNote(baseFreq);
      const hindustaniUpper = hindustaniSystem.frequencyToNote(upperFreq);
      expect(hindustaniUpper.octave).toBe((hindustaniBase.octave as number) + 1);
    });
  });

  describe('Scale and raga comparisons', () => {
    test('should compare major scale with Bilawal and Sankarabharanam', () => {
      const westernSystem = new WesternMusicSystem(440);
      const carnaticSystem = new CarnaticMusicSystem(440);
      const hindustaniSystem = new HindustaniMusicSystem(440);

      const majorScale = westernSystem.getScale('major');
      const sankarabharanam = carnaticSystem.getScale('sankarabharanam');
      const bilawal = hindustaniSystem.getScale('bilawal');

      // All should have 7 notes
      expect(majorScale!.notes.length).toBe(7);
      expect(sankarabharanam!.notes.length).toBe(7);
      expect(bilawal!.notes.length).toBe(7);

      // Major scale intervals should be similar to just intonation approximations
      expect(majorScale!.intervals).toEqual([0, 200, 400, 500, 700, 900, 1100]);
    });

    test('should identify equivalent intervals across systems', () => {
      const westernSystem = new WesternMusicSystem(440);
      const carnaticSystem = new CarnaticMusicSystem(440);

      // Perfect fifth in Western (C-G) vs Sa-Pa in Carnatic
      const westernFifth = westernSystem.getInterval('C4', 'G4');
      const carnaticFifth = carnaticSystem.getInterval('Sa', 'Pa');

      // Both should be close to 700 cents (3:2 ratio)
      expect(Math.abs(westernFifth.cents - carnaticFifth.cents)).toBeLessThan(10);
    });
  });

  describe('Transposition consistency', () => {
    test('should maintain interval relationships when transposing', () => {
      const westernSystem = new WesternMusicSystem(440);
      
      // Original interval C4-G4 (perfect fifth)
      const originalInterval = westernSystem.getInterval('C4', 'G4');
      
      // Transpose both notes up by 2 semitones: D4-A4
      const transposedNote1 = westernSystem.transposeNote('C4', 2);
      const transposedNote2 = westernSystem.transposeNote('G4', 2);
      const transposedInterval = westernSystem.getInterval(transposedNote1, transposedNote2);
      
      // Interval should remain the same
      expect(Math.abs(originalInterval.cents - transposedInterval.cents)).toBeLessThan(5);
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle extreme frequencies consistently', () => {
      const systems = [
        new WesternMusicSystem(440),
        new CarnaticMusicSystem(440),
        new HindustaniMusicSystem(440)
      ];

      const extremeFreqs = [20, 50, 100, 2000, 5000];

      systems.forEach(system => {
        extremeFreqs.forEach(freq => {
          expect(() => system.frequencyToNote(freq)).not.toThrow();
          const noteInfo = system.frequencyToNote(freq);
          expect(noteInfo.frequency).toBe(freq);
          expect(typeof noteInfo.note).toBe('string');
          expect(typeof noteInfo.octave).toMatch(/string|number/);
        });
      });
    });

    test('should handle reference pitch changes consistently', () => {
      const originalPitch = 440;
      const newPitch = 442;

      const westernSystem = new WesternMusicSystem(originalPitch);
      const carnaticSystem = new CarnaticMusicSystem(originalPitch);
      
      // Change reference pitch
      westernSystem.setReferencePitch(newPitch);
      carnaticSystem.setReferencePitch(newPitch);
      
      expect(westernSystem.getReferencePitch()).toBe(newPitch);
      expect(carnaticSystem.getReferencePitch()).toBe(newPitch);
      
      // Note frequencies should adjust accordingly
      const westernA4 = westernSystem.noteToFrequency('A4');
      expect(Math.abs(westernA4 - newPitch)).toBeLessThan(2); // Allow for more tolerance
    });
  });

  describe('Performance characteristics', () => {
    test('should perform frequency analysis efficiently', () => {
      const system = new WesternMusicSystem(440);
      const frequencies = Array.from({length: 100}, (_, i) => 100 + i * 10);
      
      const startTime = performance.now();
      
      frequencies.forEach(freq => {
        system.analyzeFrequency(freq);
        system.frequencyToNote(freq);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete 200 operations in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('should handle concurrent system operations', () => {
      const systems = [
        createMusicSystem('western', 440),
        createMusicSystem('carnatic', 440),
        createMusicSystem('hindustani', 440)
      ];

      const testFrequencies = [220, 440, 880, 1760];

      // Run analysis on all systems simultaneously
      const promises = systems.map(system => 
        Promise.resolve(testFrequencies.map(freq => system.analyzeFrequency(freq)))
      );

      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(3);
        results.forEach(systemResults => {
          expect(systemResults).toHaveLength(4);
          systemResults.forEach(analysis => {
            expect(analysis).toBeDefined();
            expect(typeof analysis).toBe('object');
          });
        });
      });
    });
  });
});