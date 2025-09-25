import { BaseMusicSystem, NoteInfo, IntervalInfo, ScaleInfo, ChordInfo } from './BaseMusicSystem';
import { HindustaniAnalysis } from '../types/index';

export class HindustaniMusicSystem extends BaseMusicSystem {
  // Hindustani notes with komal (flat) and shuddha (natural) variants
  private static readonly SWARAS = [
    { swara: 'Sa', ratio: 1, cents: 0, type: 'achal' },           // Immovable
    { swara: 'Re_komal', ratio: 16/15, cents: 112, type: 'chal' }, // Flat Re
    { swara: 'Re', ratio: 9/8, cents: 204, type: 'chal' },        // Natural Re  
    { swara: 'Ga_komal', ratio: 6/5, cents: 316, type: 'chal' },  // Flat Ga
    { swara: 'Ga', ratio: 5/4, cents: 386, type: 'chal' },        // Natural Ga
    { swara: 'Ma', ratio: 4/3, cents: 498, type: 'chal' },        // Natural Ma
    { swara: 'Ma_tivra', ratio: 45/32, cents: 590, type: 'chal' }, // Sharp Ma
    { swara: 'Pa', ratio: 3/2, cents: 702, type: 'achal' },       // Immovable
    { swara: 'Dha_komal', ratio: 8/5, cents: 814, type: 'chal' }, // Flat Dha
    { swara: 'Dha', ratio: 5/3, cents: 884, type: 'chal' },       // Natural Dha
    { swara: 'Ni_komal', ratio: 9/5, cents: 1018, type: 'chal' }, // Flat Ni
    { swara: 'Ni', ratio: 15/8, cents: 1088, type: 'chal' }       // Natural Ni
  ];

  // Popular Hindustani Ragas
  private static readonly RAGAS: { [key: string]: { 
    name: string, 
    that: string,
    swaras: string[], 
    aroha: string[], 
    avaroha: string[],
    vadi: string,
    samvadi: string,
    time: string,
    season?: string
  } } = {
    'bilawal': {
      name: 'Bilawal',
      that: 'Bilawal',
      swaras: ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'],
      aroha: ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni', 'Sa'],
      avaroha: ['Sa', 'Ni', 'Dha', 'Pa', 'Ma', 'Ga', 'Re', 'Sa'],
      vadi: 'Ga',
      samvadi: 'Ni',
      time: 'Morning'
    },
    'kafi': {
      name: 'Kafi',
      that: 'Kafi',
      swaras: ['Sa', 'Re', 'Ga_komal', 'Ma', 'Pa', 'Dha', 'Ni_komal'],
      aroha: ['Sa', 'Re', 'Ga_komal', 'Ma', 'Pa', 'Dha', 'Ni_komal', 'Sa'],
      avaroha: ['Sa', 'Ni_komal', 'Dha', 'Pa', 'Ma', 'Ga_komal', 'Re', 'Sa'],
      vadi: 'Pa',
      samvadi: 'Sa',
      time: 'Night'
    },
    'bhairav': {
      name: 'Bhairav',
      that: 'Bhairav',
      swaras: ['Sa', 'Re_komal', 'Ga', 'Ma', 'Pa', 'Dha_komal', 'Ni'],
      aroha: ['Sa', 'Re_komal', 'Ga', 'Ma', 'Pa', 'Dha_komal', 'Ni', 'Sa'],
      avaroha: ['Sa', 'Ni', 'Dha_komal', 'Pa', 'Ma', 'Ga', 'Re_komal', 'Sa'],
      vadi: 'Dha_komal',
      samvadi: 'Re_komal',
      time: 'Morning'
    },
    'kalyan': {
      name: 'Yaman Kalyan',
      that: 'Kalyan',
      swaras: ['Sa', 'Re', 'Ga', 'Ma_tivra', 'Pa', 'Dha', 'Ni'],
      aroha: ['Sa', 'Re', 'Ga', 'Ma_tivra', 'Pa', 'Dha', 'Ni', 'Sa'],
      avaroha: ['Sa', 'Ni', 'Dha', 'Pa', 'Ma_tivra', 'Ga', 'Re', 'Sa'],
      vadi: 'Ga',
      samvadi: 'Ni',
      time: 'Evening'
    },
    'asavari': {
      name: 'Asavari',
      that: 'Asavari',
      swaras: ['Sa', 'Re', 'Ga_komal', 'Ma', 'Pa', 'Dha_komal', 'Ni_komal'],
      aroha: ['Sa', 'Re', 'Ga_komal', 'Ma', 'Pa', 'Dha_komal', 'Ni_komal', 'Sa'],
      avaroha: ['Sa', 'Ni_komal', 'Dha_komal', 'Pa', 'Ma', 'Ga_komal', 'Re', 'Sa'],
      vadi: 'Dha_komal',
      samvadi: 'Ga_komal',
      time: 'Morning'
    },
    'marwa': {
      name: 'Marwa',
      that: 'Marwa',
      swaras: ['Sa', 'Re_komal', 'Ga', 'Ma_tivra', 'Dha', 'Ni'],
      aroha: ['Sa', 'Re_komal', 'Ga', 'Ma_tivra', 'Dha', 'Ni', 'Sa'],
      avaroha: ['Sa', 'Ni', 'Dha', 'Ma_tivra', 'Ga', 'Re_komal', 'Sa'],
      vadi: 'Ga',
      samvadi: 'Ni',
      time: 'Evening'
    },
    'todi': {
      name: 'Todi',
      that: 'Todi',
      swaras: ['Sa', 'Re_komal', 'Ga_komal', 'Ma_tivra', 'Pa', 'Dha_komal', 'Ni'],
      aroha: ['Sa', 'Re_komal', 'Ga_komal', 'Ma_tivra', 'Pa', 'Dha_komal', 'Ni', 'Sa'],
      avaroha: ['Sa', 'Ni', 'Dha_komal', 'Pa', 'Ma_tivra', 'Ga_komal', 'Re_komal', 'Sa'],
      vadi: 'Dha_komal',
      samvadi: 'Re_komal',
      time: 'Morning'
    }
  };

  // Meend types in Hindustani music
  private static readonly MEEND_TYPES = [
    'seedha',     // direct glide
    'ulta',       // reverse glide
    'vakra',      // curved/indirect glide
    'koot',       // false/deceptive glide
    'ghoomdar',   // circular glide
    'kampak'      // oscillating glide
  ];

  constructor(referencePitch: number = 440) {
    super(referencePitch, 'Sa');
  }

  analyzeFrequency(frequency: number): HindustaniAnalysis {
    const noteInfo = this.frequencyToNote(frequency);
    const closestSwara = this.findClosestSwara(frequency);
    const octaveName = this.getOctaveName(noteInfo.octave as number);
    const possibleRagas = this.findPossibleRagas(closestSwara.swara);
    const cents = this.getCentsDeviationFromSa(frequency);
    const meend = this.detectMeend(frequency, closestSwara.expectedFrequency);

    return {
      swara: closestSwara.swara,
      cents: cents,
      octave: octaveName,
      possibleRagas: possibleRagas,
      meend: meend
    };
  }

  frequencyToNote(frequency: number): NoteInfo {
    if (frequency <= 0) {
      throw new Error('Frequency must be positive');
    }

    const saFrequency = this.referencePitch * (3/5); // Sa frequency
    const octaveRatio = frequency / saFrequency;
    const octave = Math.floor(Math.log2(octaveRatio));
    const normalizedRatio = octaveRatio / Math.pow(2, octave);
    
    const closestSwara = this.findClosestSwaraByRatio(normalizedRatio);
    const cents = this.calculateCents(normalizedRatio, closestSwara.ratio);

    return {
      note: closestSwara.swara,
      frequency: frequency,
      cents: cents,
      octave: octave
    };
  }

  noteToFrequency(note: string, octave: number = 0): number {
    const swara = HindustaniMusicSystem.SWARAS.find(s => s.swara === note);
    if (!swara) {
      throw new Error(`Invalid swara: ${note}`);
    }

    const saFrequency = this.referencePitch * (3/5);
    return saFrequency * swara.ratio * Math.pow(2, octave);
  }

  getCentsDeviation(frequency: number, targetFrequency: number): number {
    return this.calculateCents(frequency, targetFrequency);
  }

  getScale(ragaName: string): ScaleInfo | null {
    const raga = HindustaniMusicSystem.RAGAS[ragaName.toLowerCase()];
    if (!raga) {
      return null;
    }

    const intervals = raga.swaras.map(swara => {
      const swaraInfo = HindustaniMusicSystem.SWARAS.find(s => s.swara === swara);
      return swaraInfo ? swaraInfo.cents : 0;
    });

    return {
      name: raga.name,
      notes: raga.swaras,
      intervals: intervals
    };
  }

  detectChord(frequencies: number[]): ChordInfo | null {
    // Hindustani music is primarily melodic, but we can detect consonant intervals
    if (frequencies.length < 2) {
      return null;
    }

    const notes = frequencies.map(f => this.frequencyToNote(f).note);
    const uniqueNotes = [...new Set(notes)];

    // Check for Sa-Pa (perfect fifth)
    if (uniqueNotes.includes('Sa') && uniqueNotes.includes('Pa')) {
      return {
        name: 'Sa-Pa Consonance',
        notes: uniqueNotes,
        quality: 'other'
      };
    }

    // Check for Sa-Ma (perfect fourth)
    if (uniqueNotes.includes('Sa') && uniqueNotes.includes('Ma')) {
      return {
        name: 'Sa-Ma Consonance',
        notes: uniqueNotes,
        quality: 'other'
      };
    }

    return {
      name: 'Melodic Interval',
      notes: uniqueNotes,
      quality: 'other'
    };
  }

  getInterval(note1: string, note2: string): IntervalInfo {
    const swara1 = HindustaniMusicSystem.SWARAS.find(s => s.swara === note1);
    const swara2 = HindustaniMusicSystem.SWARAS.find(s => s.swara === note2);

    if (!swara1 || !swara2) {
      throw new Error('Invalid swara names');
    }

    const cents = Math.abs(swara2.cents - swara1.cents);
    const ratio = swara2.ratio / swara1.ratio;

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
    const swaraIndex = HindustaniMusicSystem.SWARAS.findIndex(s => s.swara === note);
    if (swaraIndex === -1) {
      throw new Error(`Invalid swara: ${note}`);
    }

    const targetCents = HindustaniMusicSystem.SWARAS[swaraIndex].cents + (semitones * 100);
    const normalizedCents = ((targetCents % 1200) + 1200) % 1200;
    
    let closestIndex = 0;
    let minDifference = Math.abs(normalizedCents - HindustaniMusicSystem.SWARAS[0].cents);
    
    for (let i = 1; i < HindustaniMusicSystem.SWARAS.length; i++) {
      const difference = Math.abs(normalizedCents - HindustaniMusicSystem.SWARAS[i].cents);
      if (difference < minDifference) {
        minDifference = difference;
        closestIndex = i;
      }
    }

    return HindustaniMusicSystem.SWARAS[closestIndex].swara;
  }

  // Additional Hindustani-specific methods
  getRagaInfo(ragaName: string): any {
    return HindustaniMusicSystem.RAGAS[ragaName.toLowerCase()] || null;
  }

  isKomalSwara(swara: string): boolean {
    return swara.includes('komal');
  }

  isTivraSwara(swara: string): boolean {
    return swara.includes('tivra');
  }

  getSwaraType(swara: string): 'achal' | 'chal' {
    const swaraInfo = HindustaniMusicSystem.SWARAS.find(s => s.swara === swara);
    return swaraInfo ? swaraInfo.type as 'achal' | 'chal' : 'chal';
  }

  private findClosestSwara(frequency: number): { swara: string, expectedFrequency: number } {
    const saFrequency = this.referencePitch * (3/5);
    const octaveRatio = frequency / saFrequency;
    const normalizedRatio = octaveRatio / Math.pow(2, Math.floor(Math.log2(octaveRatio)));

    let closestSwara = HindustaniMusicSystem.SWARAS[0];
    let minDifference = Math.abs(Math.log2(normalizedRatio / closestSwara.ratio));

    for (const swara of HindustaniMusicSystem.SWARAS) {
      const difference = Math.abs(Math.log2(normalizedRatio / swara.ratio));
      if (difference < minDifference) {
        minDifference = difference;
        closestSwara = swara;
      }
    }

    const expectedFrequency = saFrequency * closestSwara.ratio * 
                             Math.pow(2, Math.floor(Math.log2(octaveRatio)));

    return {
      swara: closestSwara.swara,
      expectedFrequency: expectedFrequency
    };
  }

  private findClosestSwaraByRatio(ratio: number): { swara: string, ratio: number, cents: number, type: string } {
    let closest = HindustaniMusicSystem.SWARAS[0];
    let minDifference = Math.abs(Math.log2(ratio / closest.ratio));

    for (const swara of HindustaniMusicSystem.SWARAS) {
      const difference = Math.abs(Math.log2(ratio / swara.ratio));
      if (difference < minDifference) {
        minDifference = difference;
        closest = swara;
      }
    }

    return closest;
  }

  private getOctaveName(octave: number): string {
    if (octave < -1) return 'anumandra';
    if (octave === -1) return 'mandra';
    if (octave === 0) return 'madhya';
    if (octave === 1) return 'taar';
    return 'atitaar';
  }

  private findPossibleRagas(swara: string): string[] {
    const possibleRagas: string[] = [];
    
    for (const [ragaKey, raga] of Object.entries(HindustaniMusicSystem.RAGAS)) {
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

  private detectMeend(frequency: number, expectedFrequency: number): { type: string, duration: number, targetNote: string } | undefined {
    const deviation = Math.abs(this.calculateCents(frequency, expectedFrequency));
    
    if (deviation > 50 && deviation < 200) {
      const targetSwara = this.findClosestSwara(frequency + (frequency * 0.1)); // Assume upward glide
      return {
        type: 'seedha',
        duration: deviation / 50, // Rough estimate in relative units
        targetNote: targetSwara.swara
      };
    }
    
    return undefined;
  }

  private getIntervalName(note1: string, note2: string): string {
    const intervalMap: { [key: string]: string } = {
      'Sa-Re_komal': 'Komal Rishabha',
      'Sa-Re': 'Shuddha Rishabha',
      'Sa-Ga_komal': 'Komal Gandhara',
      'Sa-Ga': 'Shuddha Gandhara',
      'Sa-Ma': 'Shuddha Madhyama',
      'Sa-Ma_tivra': 'Tivra Madhyama',
      'Sa-Pa': 'Panchama',
      'Sa-Dha_komal': 'Komal Dhaivatha',
      'Sa-Dha': 'Shuddha Dhaivatha',
      'Sa-Ni_komal': 'Komal Nishada',
      'Sa-Ni': 'Shuddha Nishada'
    };
    
    return intervalMap[`${note1}-${note2}`] || `${note1} to ${note2}`;
  }
}