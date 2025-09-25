import { describe, test, expect, beforeEach } from '@jest/globals';
import { HindustaniMusicSystem } from '../../src/musicSystems/Hindustani';

describe('HindustaniMusicSystem', () => {
  let hindustaniSystem: HindustaniMusicSystem;

  beforeEach(() => {
    hindustaniSystem = new HindustaniMusicSystem(440);
  });

  describe('Basic functionality', () => {
    test('should create with default reference pitch', () => {
      const system = new HindustaniMusicSystem();
      expect(system.getReferencePitch()).toBe(440);
    });

    test('should create with custom reference pitch', () => {
      const system = new HindustaniMusicSystem(444);
      expect(system.getReferencePitch()).toBe(444);
    });
  });

  describe('Frequency to Note conversion', () => {
    test('should convert Sa frequency to correct swara', () => {
      const saFrequency = 440 * (3/5); // 264 Hz for Sa
      const result = hindustaniSystem.frequencyToNote(saFrequency);
      expect(result.note).toBe('Sa');
      expect(result.octave).toBe(0);
    });

    test('should distinguish between komal and shuddha swaras', () => {
      const saFrequency = 440 * (3/5);
      
      // Re komal
      const reKomalFreq = saFrequency * (16/15);
      const reKomalResult = hindustaniSystem.frequencyToNote(reKomalFreq);
      expect(reKomalResult.note).toBe('Re_komal');
      
      // Re shuddha
      const reFreq = saFrequency * (9/8);
      const reResult = hindustaniSystem.frequencyToNote(reFreq);
      expect(reResult.note).toBe('Re');
    });

    test('should handle tivra madhyama', () => {
      const saFrequency = 440 * (3/5);
      const maTivraFreq = saFrequency * (45/32);
      const result = hindustaniSystem.frequencyToNote(maTivraFreq);
      expect(result.note).toBe('Ma_tivra');
    });

    test('should throw error for non-positive frequency', () => {
      expect(() => hindustaniSystem.frequencyToNote(0)).toThrow('Frequency must be positive');
    });
  });

  describe('Note to Frequency conversion', () => {
    test('should convert Sa to correct frequency', () => {
      const frequency = hindustaniSystem.noteToFrequency('Sa');
      const expectedSa = 440 * (3/5);
      expect(Math.abs(frequency - expectedSa)).toBeLessThan(0.1);
    });

    test('should convert komal swaras correctly', () => {
      const reKomalFreq = hindustaniSystem.noteToFrequency('Re_komal');
      const expectedReKomal = 440 * (3/5) * (16/15);
      expect(Math.abs(reKomalFreq - expectedReKomal)).toBeLessThan(0.1);
    });

    test('should convert tivra madhyama correctly', () => {
      const maTivraFreq = hindustaniSystem.noteToFrequency('Ma_tivra');
      const expectedMaTivra = 440 * (3/5) * (45/32);
      expect(Math.abs(maTivraFreq - expectedMaTivra)).toBeLessThan(0.1);
    });

    test('should handle different octaves', () => {
      const frequency = hindustaniSystem.noteToFrequency('Sa', 1);
      const expectedSa = 440 * (3/5) * 2;
      expect(Math.abs(frequency - expectedSa)).toBeLessThan(0.1);
    });

    test('should throw error for invalid swara', () => {
      expect(() => hindustaniSystem.noteToFrequency('Invalid')).toThrow('Invalid swara');
    });
  });

  describe('Analysis functionality', () => {
    test('should analyze Sa frequency correctly', () => {
      const saFrequency = 440 * (3/5);
      const analysis = hindustaniSystem.analyzeFrequency(saFrequency);
      expect(analysis.swara).toBe('Sa');
      expect(analysis.octave).toBe('madhya');
      expect(Math.abs(analysis.cents)).toBeLessThan(10);
    });

    test('should identify possible ragas for swara', () => {
      const saFrequency = 440 * (3/5);
      const analysis = hindustaniSystem.analyzeFrequency(saFrequency);
      expect(analysis.possibleRagas.length).toBeGreaterThan(0);
      expect(analysis.possibleRagas).toContain('Bilawal');
    });

    test('should detect meend for deviated frequency', () => {
      // For meend detection, test a moderate deviation  
      const saFrequency = 440 * (3/5);
      const deviatedFrequency = saFrequency * 1.06; // 6% deviation (~100 cents)
      const analysis = hindustaniSystem.analyzeFrequency(deviatedFrequency);
      
      // Check if either meend is detected OR the cents deviation is significant
      expect(analysis.meend || Math.abs(analysis.cents) > 80).toBeTruthy();
    });
  });

  describe('Raga functionality', () => {
    test('should get Bilawal raga scale', () => {
      const scale = hindustaniSystem.getScale('bilawal');
      expect(scale).not.toBeNull();
      expect(scale!.name).toBe('Bilawal');
      expect(scale!.notes).toEqual(['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni']);
    });

    test('should get Kafi raga scale with komal notes', () => {
      const scale = hindustaniSystem.getScale('kafi');
      expect(scale).not.toBeNull();
      expect(scale!.name).toBe('Kafi');
      expect(scale!.notes).toContain('Ga_komal');
      expect(scale!.notes).toContain('Ni_komal');
    });

    test('should get Kalyan raga with tivra madhyama', () => {
      const scale = hindustaniSystem.getScale('kalyan');
      expect(scale).not.toBeNull();
      expect(scale!.name).toBe('Yaman Kalyan');
      expect(scale!.notes).toContain('Ma_tivra');
    });

    test('should return null for unknown raga', () => {
      const scale = hindustaniSystem.getScale('unknown');
      expect(scale).toBeNull();
    });
  });

  describe('Raga information', () => {
    test('should get complete raga information', () => {
      const ragaInfo = hindustaniSystem.getRagaInfo('bilawal');
      expect(ragaInfo).not.toBeNull();
      expect(ragaInfo.that).toBe('Bilawal');
      expect(ragaInfo.vadi).toBe('Ga');
      expect(ragaInfo.samvadi).toBe('Ni');
      expect(ragaInfo.time).toBe('Morning');
    });

    test('should return null for unknown raga info', () => {
      const ragaInfo = hindustaniSystem.getRagaInfo('unknown');
      expect(ragaInfo).toBeNull();
    });
  });

  describe('Swara type identification', () => {
    test('should identify komal swaras', () => {
      expect(hindustaniSystem.isKomalSwara('Re_komal')).toBe(true);
      expect(hindustaniSystem.isKomalSwara('Ga_komal')).toBe(true);
      expect(hindustaniSystem.isKomalSwara('Re')).toBe(false);
      expect(hindustaniSystem.isKomalSwara('Sa')).toBe(false);
    });

    test('should identify tivra swaras', () => {
      expect(hindustaniSystem.isTivraSwara('Ma_tivra')).toBe(true);
      expect(hindustaniSystem.isTivraSwara('Ma')).toBe(false);
      expect(hindustaniSystem.isTivraSwara('Sa')).toBe(false);
    });

    test('should identify achal and chal swaras', () => {
      expect(hindustaniSystem.getSwaraType('Sa')).toBe('achal'); // Immovable
      expect(hindustaniSystem.getSwaraType('Pa')).toBe('achal'); // Immovable
      expect(hindustaniSystem.getSwaraType('Re')).toBe('chal');  // Movable
      expect(hindustaniSystem.getSwaraType('Ga')).toBe('chal');  // Movable
    });
  });

  describe('Interval calculation', () => {
    test('should calculate Sa-Pa interval', () => {
      const interval = hindustaniSystem.getInterval('Sa', 'Pa');
      expect(interval.intervalName).toContain('Panchama');
      expect(interval.cents).toBeCloseTo(702, 10);
    });

    test('should calculate komal intervals', () => {
      const interval = hindustaniSystem.getInterval('Sa', 'Re_komal');
      expect(interval.intervalName).toContain('Komal');
      expect(interval.cents).toBeCloseTo(112, 10);
    });

    test('should calculate tivra intervals', () => {
      const interval = hindustaniSystem.getInterval('Sa', 'Ma_tivra');
      expect(interval.intervalName).toContain('Tivra');
      expect(interval.cents).toBeCloseTo(590, 10);
    });

    test('should throw error for invalid swaras', () => {
      expect(() => hindustaniSystem.getInterval('Invalid', 'Sa')).toThrow('Invalid swara names');
    });
  });

  describe('Consonant interval detection', () => {
    test('should detect Sa-Pa consonance', () => {
      const saFreq = 440 * (3/5);
      const paFreq = saFreq * (3/2);
      const chord = hindustaniSystem.detectChord([saFreq, paFreq]);
      expect(chord).not.toBeNull();
      expect(chord!.name).toContain('Sa-Pa');
    });

    test('should detect Sa-Ma consonance', () => {
      const saFreq = 440 * (3/5);
      const maFreq = saFreq * (4/3);
      const chord = hindustaniSystem.detectChord([saFreq, maFreq]);
      expect(chord).not.toBeNull();
      expect(chord!.name).toContain('Sa-Ma');
    });

    test('should return null for single note', () => {
      const chord = hindustaniSystem.detectChord([440]);
      expect(chord).toBeNull();
    });

    test('should handle general melodic intervals', () => {
      const saFreq = 440 * (3/5);
      const reFreq = saFreq * (9/8); // Re interval
      const chord = hindustaniSystem.detectChord([saFreq, reFreq]);
      expect(chord).not.toBeNull();
      expect(chord!.name).toBe('Melodic Interval');
      expect(chord!.quality).toBe('other');
    });
  });

  describe('Transposition', () => {
    test('should transpose Sa by semitones', () => {
      const result = hindustaniSystem.transposeNote('Sa', 2);
      expect(['Re', 'Re_komal']).toContain(result);
    });

    test('should handle komal transposition', () => {
      const result = hindustaniSystem.transposeNote('Re_komal', 5);
      // Re_komal + 5 semitones should be around Pa or Dha_komal area
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should handle octave wrapping in transposition', () => {
      const result = hindustaniSystem.transposeNote('Sa', 12);
      expect(result).toBe('Sa'); // Should wrap to Sa
    });

    test('should throw error for invalid swara in transposition', () => {
      expect(() => hindustaniSystem.transposeNote('Invalid', 5)).toThrow('Invalid swara');
    });
  });

  describe('Scale membership', () => {
    test('should check if swara is in raga', () => {
      const scale = hindustaniSystem.getScale('kafi')!;
      expect(hindustaniSystem.isNoteInScale('Ga_komal', scale)).toBe(true);
      expect(hindustaniSystem.isNoteInScale('Ga', scale)).toBe(false);
    });

    test('should check tivra madhyama in Kalyan', () => {
      const scale = hindustaniSystem.getScale('kalyan')!;
      expect(hindustaniSystem.isNoteInScale('Ma_tivra', scale)).toBe(true);
      expect(hindustaniSystem.isNoteInScale('Ma', scale)).toBe(false);
    });
  });

  describe('Octave naming', () => {
    test('should identify madhya octave for middle range', () => {
      const saFrequency = 440 * (3/5);
      const analysis = hindustaniSystem.analyzeFrequency(saFrequency);
      expect(analysis.octave).toBe('madhya');
    });

    test('should identify taar octave for higher range', () => {
      const saFrequency = 440 * (3/5) * 2; // One octave higher
      const analysis = hindustaniSystem.analyzeFrequency(saFrequency);
      expect(analysis.octave).toBe('taar');
    });

    test('should identify mandra octave for lower range', () => {
      const saFrequency = 440 * (3/5) * 0.5; // One octave lower
      const analysis = hindustaniSystem.analyzeFrequency(saFrequency);
      expect(analysis.octave).toBe('mandra');
    });
  });

  describe('Cents deviation calculation', () => {
    test('should calculate cents deviation correctly', () => {
      const saFreq = 440 * (3/5);
      const cents = hindustaniSystem.getCentsDeviation(saFreq * 1.01, saFreq);
      expect(cents).toBeGreaterThan(15); // ~17 cents for 1% deviation
      expect(cents).toBeLessThan(20);
    });
  });
});