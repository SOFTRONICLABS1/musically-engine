import { BaseMusicSystem, NoteInfo, IntervalInfo, ScaleInfo, ChordInfo } from './BaseMusicSystem';
import { CarnaticAnalysis } from '../types/index';

export class CarnaticMusicSystem extends BaseMusicSystem {
  // 16 Swarasthanas in Carnatic music (Just Intonation ratios)
  private static readonly SWARASTHANAS = [
    { swara: 'Sa', ratio: 1, cents: 0 },
    { swara: 'Ri1', ratio: 256/243, cents: 90 },     // Shuddha Ri
    { swara: 'Ri2', ratio: 16/15, cents: 112 },      // Chatushruti Ri
    { swara: 'Ri3', ratio: 10/9, cents: 182 },       // Shatshruti Ri
    { swara: 'Ga1', ratio: 32/27, cents: 294 },      // Shuddha Ga
    { swara: 'Ga2', ratio: 6/5, cents: 316 },        // Sadharana Ga
    { swara: 'Ga3', ratio: 5/4, cents: 386 },        // Antara Ga
    { swara: 'Ma1', ratio: 4/3, cents: 498 },        // Shuddha Ma
    { swara: 'Ma2', ratio: 729/512, cents: 612 },    // Prati Ma
    { swara: 'Pa', ratio: 3/2, cents: 702 },         // Panchama
    { swara: 'Dha1', ratio: 128/81, cents: 792 },    // Shuddha Dha
    { swara: 'Dha2', ratio: 8/5, cents: 814 },       // Chatushruti Dha
    { swara: 'Dha3', ratio: 5/3, cents: 884 },       // Shatshruti Dha
    { swara: 'Ni1', ratio: 16/9, cents: 996 },       // Shuddha Ni
    { swara: 'Ni2', ratio: 9/5, cents: 1018 },       // Kaisika Ni
    { swara: 'Ni3', ratio: 15/8, cents: 1088 }       // Kakali Ni
  ];

  private static readonly OCTAVE_NAMES = {
    'mandra': -1,    // Lower octave
    'madhya': 0,     // Middle octave
    'tara': 1,       // Higher octave
    'anumandra': -2, // Very low octave
    'atitara': 2     // Very high octave
  };

  // Popular Carnatic Ragas with their swarasthana patterns
  private static readonly RAGAS: { [key: string]: { name: string, swaras: string[], aroha: string[], avaroha: string[] } } = {
    'sankarabharanam': {
      name: 'Sankarabharanam',
      swaras: ['Sa', 'Ri2', 'Ga3', 'Ma1', 'Pa', 'Dha2', 'Ni3'],
      aroha: ['Sa', 'Ri2', 'Ga3', 'Ma1', 'Pa', 'Dha2', 'Ni3', 'Sa'],
      avaroha: ['Sa', 'Ni3', 'Dha2', 'Pa', 'Ma1', 'Ga3', 'Ri2', 'Sa']
    },
    'kalyani': {
      name: 'Kalyani',
      swaras: ['Sa', 'Ri2', 'Ga3', 'Ma2', 'Pa', 'Dha2', 'Ni3'],
      aroha: ['Sa', 'Ri2', 'Ga3', 'Ma2', 'Pa', 'Dha2', 'Ni3', 'Sa'],
      avaroha: ['Sa', 'Ni3', 'Dha2', 'Pa', 'Ma2', 'Ga3', 'Ri2', 'Sa']
    },
    'kharaharapriya': {
      name: 'Kharaharapriya',
      swaras: ['Sa', 'Ri2', 'Ga2', 'Ma1', 'Pa', 'Dha2', 'Ni2'],
      aroha: ['Sa', 'Ri2', 'Ga2', 'Ma1', 'Pa', 'Dha2', 'Ni2', 'Sa'],
      avaroha: ['Sa', 'Ni2', 'Dha2', 'Pa', 'Ma1', 'Ga2', 'Ri2', 'Sa']
    },
    'todi': {
      name: 'Hanumatodi',
      swaras: ['Sa', 'Ri1', 'Ga2', 'Ma1', 'Pa', 'Dha1', 'Ni2'],
      aroha: ['Sa', 'Ri1', 'Ga2', 'Ma1', 'Pa', 'Dha1', 'Ni2', 'Sa'],
      avaroha: ['Sa', 'Ni2', 'Dha1', 'Pa', 'Ma1', 'Ga2', 'Ri1', 'Sa']
    },
    'mayamalavagowla': {
      name: 'Mayamalavagowla',
      swaras: ['Sa', 'Ri1', 'Ga3', 'Ma1', 'Pa', 'Dha1', 'Ni3'],
      aroha: ['Sa', 'Ri1', 'Ga3', 'Ma1', 'Pa', 'Dha1', 'Ni3', 'Sa'],
      avaroha: ['Sa', 'Ni3', 'Dha1', 'Pa', 'Ma1', 'Ga3', 'Ri1', 'Sa']
    },
    'bhairavi': {
      name: 'Natabhairavi',
      swaras: ['Sa', 'Ri2', 'Ga2', 'Ma1', 'Pa', 'Dha2', 'Ni2'],
      aroha: ['Sa', 'Ri2', 'Ga2', 'Ma1', 'Pa', 'Dha2', 'Ni2', 'Sa'],
      avaroha: ['Sa', 'Ni2', 'Dha2', 'Pa', 'Ma1', 'Ga2', 'Ri2', 'Sa']
    }
  };

  // Common gamakas (ornaments) in Carnatic music
  private static readonly GAMAKAS = [
    'kampana',    // oscillation/vibrato
    'nokku',      // grace note approach
    'spuritam',   // grace note departure  
    'ravai',      // slide/glissando
    'jaru',       // continuous slide
    'pratyahatam',// return/rebound
    'tripuccha',  // triple shake
    'ahata',      // struck note
    'ullasita'    // ornamented ascent
  ];

  constructor(referencePitch: number = 440) {
    super(referencePitch, 'Sa'); // Sa is the reference note in Carnatic music
  }

  analyzeFrequency(frequency: number): CarnaticAnalysis {
    const noteInfo = this.frequencyToNote(frequency);
    const closestSwarasthana = this.findClosestSwarasthana(frequency);
    const octaveName = this.getOctaveName(noteInfo.octave as number);
    const possibleRagas = this.findPossibleRagas(closestSwarasthana.swara);
    const cents = this.getCentsDeviationFromSa(frequency);

    return {
      swara: closestSwarasthana.swara,
      swaraSthana: this.getSwarasthanaPosition(closestSwarasthana.swara),
      cents: cents,
      octave: octaveName,
      possibleRagas: possibleRagas,
      gamaka: this.detectGamaka(frequency, closestSwarasthana.expectedFrequency)
    };
  }

  frequencyToNote(frequency: number): NoteInfo {
    if (frequency <= 0) {
      throw new Error('Frequency must be positive');
    }

    const saFrequency = this.referencePitch * (3/5); // Sa is typically C, A440 -> C264
    const octaveRatio = frequency / saFrequency;
    const octave = Math.floor(Math.log2(octaveRatio));
    const normalizedRatio = octaveRatio / Math.pow(2, octave);
    
    const closestSwarasthana = this.findClosestSwarasthanaByRatio(normalizedRatio);
    const cents = this.calculateCents(normalizedRatio, closestSwarasthana.ratio);

    return {
      note: closestSwarasthana.swara,
      frequency: frequency,
      cents: cents,
      octave: octave
    };
  }

  noteToFrequency(note: string, octave: number = 0): number {
    const swarasthana = CarnaticMusicSystem.SWARASTHANAS.find(s => s.swara === note);
    if (!swarasthana) {
      throw new Error(`Invalid swara: ${note}`);
    }

    const saFrequency = this.referencePitch * (3/5); // Convert A440 to Sa
    return saFrequency * swarasthana.ratio * Math.pow(2, octave);
  }

  getCentsDeviation(frequency: number, targetFrequency: number): number {
    return this.calculateCents(frequency, targetFrequency);
  }

  getScale(ragaName: string): ScaleInfo | null {
    const raga = CarnaticMusicSystem.RAGAS[ragaName.toLowerCase()];
    if (!raga) {
      return null;
    }

    const intervals = raga.swaras.map(swara => {
      const swarasthana = CarnaticMusicSystem.SWARASTHANAS.find(s => s.swara === swara);
      return swarasthana ? swarasthana.cents : 0;
    });

    return {
      name: raga.name,
      notes: raga.swaras,
      intervals: intervals
    };
  }

  detectChord(frequencies: number[]): ChordInfo | null {
    // Carnatic music is primarily melodic, but we can detect basic consonant intervals
    if (frequencies.length < 2) {
      return null;
    }

    const notes = frequencies.map(f => this.frequencyToNote(f).note);
    const uniqueNotes = [...new Set(notes)];

    // Check for Sa-Pa (perfect fifth) combination
    if (uniqueNotes.includes('Sa') && uniqueNotes.includes('Pa')) {
      return {
        name: 'Sa-Pa (Shadja-Panchama)',
        notes: uniqueNotes,
        quality: 'other'
      };
    }

    // Check for Sa-Ma (perfect fourth) combination  
    if (uniqueNotes.includes('Sa') && uniqueNotes.includes('Ma1')) {
      return {
        name: 'Sa-Ma (Shadja-Madhyama)',
        notes: uniqueNotes,
        quality: 'other'
      };
    }

    return {
      name: 'Consonant Interval',
      notes: uniqueNotes,
      quality: 'other'
    };
  }

  getInterval(note1: string, note2: string): IntervalInfo {
    const swarasthana1 = CarnaticMusicSystem.SWARASTHANAS.find(s => s.swara === note1);
    const swarasthana2 = CarnaticMusicSystem.SWARASTHANAS.find(s => s.swara === note2);

    if (!swarasthana1 || !swarasthana2) {
      throw new Error('Invalid swara names');
    }

    const cents = Math.abs(swarasthana2.cents - swarasthana1.cents);
    const ratio = swarasthana2.ratio / swarasthana1.ratio;

    return {
      intervalName: this.getIntervalName(note1, note2),
      cents: cents,
      ratio: ratio
    };
  }

  isNoteInScale(note: string, scale: ScaleInfo): boolean {
    return scale.notes.includes(note);
  }

  transposeNote(note: string, semitones: number): string {
    const swarasthanaIndex = CarnaticMusicSystem.SWARASTHANAS.findIndex(s => s.swara === note);
    if (swarasthanaIndex === -1) {
      throw new Error(`Invalid swara: ${note}`);
    }

    // Convert semitones to cents and find closest swarasthana
    const targetCents = CarnaticMusicSystem.SWARASTHANAS[swarasthanaIndex].cents + (semitones * 100);
    const normalizedCents = ((targetCents % 1200) + 1200) % 1200;
    
    let closestIndex = 0;
    let minDifference = Math.abs(normalizedCents - CarnaticMusicSystem.SWARASTHANAS[0].cents);
    
    for (let i = 1; i < CarnaticMusicSystem.SWARASTHANAS.length; i++) {
      const difference = Math.abs(normalizedCents - CarnaticMusicSystem.SWARASTHANAS[i].cents);
      if (difference < minDifference) {
        minDifference = difference;
        closestIndex = i;
      }
    }

    return CarnaticMusicSystem.SWARASTHANAS[closestIndex].swara;
  }

  private findClosestSwarasthana(frequency: number): { swara: string, expectedFrequency: number } {
    const saFrequency = this.referencePitch * (3/5);
    const octaveRatio = frequency / saFrequency;
    const normalizedRatio = octaveRatio / Math.pow(2, Math.floor(Math.log2(octaveRatio)));

    let closestSwarasthana = CarnaticMusicSystem.SWARASTHANAS[0];
    let minDifference = Math.abs(Math.log2(normalizedRatio / closestSwarasthana.ratio));

    for (const swarasthana of CarnaticMusicSystem.SWARASTHANAS) {
      const difference = Math.abs(Math.log2(normalizedRatio / swarasthana.ratio));
      if (difference < minDifference) {
        minDifference = difference;
        closestSwarasthana = swarasthana;
      }
    }

    const expectedFrequency = saFrequency * closestSwarasthana.ratio * 
                             Math.pow(2, Math.floor(Math.log2(octaveRatio)));

    return {
      swara: closestSwarasthana.swara,
      expectedFrequency: expectedFrequency
    };
  }

  private findClosestSwarasthanaByRatio(ratio: number): { swara: string, ratio: number, cents: number } {
    let closest = CarnaticMusicSystem.SWARASTHANAS[0];
    let minDifference = Math.abs(Math.log2(ratio / closest.ratio));

    for (const swarasthana of CarnaticMusicSystem.SWARASTHANAS) {
      const difference = Math.abs(Math.log2(ratio / swarasthana.ratio));
      if (difference < minDifference) {
        minDifference = difference;
        closest = swarasthana;
      }
    }

    return closest;
  }

  private getSwarasthanaPosition(swara: string): number {
    const index = CarnaticMusicSystem.SWARASTHANAS.findIndex(s => s.swara === swara);
    return index + 1; // 1-indexed
  }

  private getOctaveName(octave: number): string {
    if (octave < -1) return 'anumandra';
    if (octave === -1) return 'mandra';
    if (octave === 0) return 'madhya';
    if (octave === 1) return 'tara';
    return 'atitara';
  }

  private findPossibleRagas(swara: string): string[] {
    const possibleRagas: string[] = [];
    
    for (const [ragaKey, raga] of Object.entries(CarnaticMusicSystem.RAGAS)) {
      if (raga.swaras.includes(swara)) {
        possibleRagas.push(raga.name);
      }
    }

    return possibleRagas;
  }

  private getCentsDeviationFromSa(frequency: number): number {
    const saFrequency = this.referencePitch * (3/5);
    const octaveRatio = frequency / saFrequency;
    const cents = Math.round(1200 * Math.log2(octaveRatio));
    return cents % 1200;
  }

  private detectGamaka(frequency: number, expectedFrequency: number): string | undefined {
    const deviation = Math.abs(this.calculateCents(frequency, expectedFrequency));
    
    if (deviation > 25 && deviation < 75) {
      return 'kampana'; // vibrato/oscillation
    }
    
    if (deviation > 75) {
      return 'jaru'; // slide
    }
    
    return undefined;
  }

  private getIntervalName(note1: string, note2: string): string {
    // Basic interval names in Carnatic context
    const intervalMap: { [key: string]: string } = {
      'Sa-Ri1': 'Shuddha Rishabha',
      'Sa-Ri2': 'Chatushruti Rishabha', 
      'Sa-Ga3': 'Antara Gandhara',
      'Sa-Ma1': 'Shuddha Madhyama',
      'Sa-Ma2': 'Prati Madhyama',
      'Sa-Pa': 'Panchama',
      'Sa-Dha2': 'Chatushruti Dhaivatha',
      'Sa-Ni3': 'Kakali Nishada'
    };
    
    return intervalMap[`${note1}-${note2}`] || `${note1} to ${note2}`;
  }
}