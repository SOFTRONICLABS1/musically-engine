import { BaseMusicSystem, NoteInfo, IntervalInfo, ScaleInfo, ChordInfo } from './BaseMusicSystem';
import { WesternAnalysis } from '../types/index';

export class WesternMusicSystem extends BaseMusicSystem {
  private static readonly NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  private static readonly ENHARMONIC_EQUIVALENTS: { [key: string]: string[] } = {
    'C#': ['Db'],
    'D#': ['Eb'],
    'F#': ['Gb'],
    'G#': ['Ab'],
    'A#': ['Bb']
  };

  private static readonly INTERVALS = {
    'P1': { name: 'Perfect Unison', cents: 0, ratio: 1 },
    'm2': { name: 'Minor 2nd', cents: 100, ratio: 16/15 },
    'M2': { name: 'Major 2nd', cents: 200, ratio: 9/8 },
    'm3': { name: 'Minor 3rd', cents: 300, ratio: 6/5 },
    'M3': { name: 'Major 3rd', cents: 400, ratio: 5/4 },
    'P4': { name: 'Perfect 4th', cents: 500, ratio: 4/3 },
    'TT': { name: 'Tritone', cents: 600, ratio: Math.sqrt(2) },
    'P5': { name: 'Perfect 5th', cents: 700, ratio: 3/2 },
    'm6': { name: 'Minor 6th', cents: 800, ratio: 8/5 },
    'M6': { name: 'Major 6th', cents: 900, ratio: 5/3 },
    'm7': { name: 'Minor 7th', cents: 1000, ratio: 16/9 },
    'M7': { name: 'Major 7th', cents: 1100, ratio: 15/8 },
    'P8': { name: 'Perfect Octave', cents: 1200, ratio: 2 }
  };

  private static readonly SCALES: { [key: string]: ScaleInfo } = {
    'major': {
      name: 'Major Scale',
      notes: ['1', '2', '3', '4', '5', '6', '7'],
      intervals: [0, 200, 400, 500, 700, 900, 1100]
    },
    'minor': {
      name: 'Natural Minor Scale',
      notes: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
      intervals: [0, 200, 300, 500, 700, 800, 1000]
    },
    'harmonic_minor': {
      name: 'Harmonic Minor Scale',
      notes: ['1', '2', 'b3', '4', '5', 'b6', '7'],
      intervals: [0, 200, 300, 500, 700, 800, 1100]
    },
    'melodic_minor': {
      name: 'Melodic Minor Scale',
      notes: ['1', '2', 'b3', '4', '5', '6', '7'],
      intervals: [0, 200, 300, 500, 700, 900, 1100]
    },
    'dorian': {
      name: 'Dorian Mode',
      notes: ['1', '2', 'b3', '4', '5', '6', 'b7'],
      intervals: [0, 200, 300, 500, 700, 900, 1000]
    },
    'phrygian': {
      name: 'Phrygian Mode',
      notes: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
      intervals: [0, 100, 300, 500, 700, 800, 1000]
    },
    'lydian': {
      name: 'Lydian Mode',
      notes: ['1', '2', '3', '#4', '5', '6', '7'],
      intervals: [0, 200, 400, 600, 700, 900, 1100]
    },
    'mixolydian': {
      name: 'Mixolydian Mode',
      notes: ['1', '2', '3', '4', '5', '6', 'b7'],
      intervals: [0, 200, 400, 500, 700, 900, 1000]
    },
    'locrian': {
      name: 'Locrian Mode',
      notes: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
      intervals: [0, 100, 300, 500, 600, 800, 1000]
    }
  };

  constructor(referencePitch: number = 440) {
    super(referencePitch, 'A4');
  }

  analyzeFrequency(frequency: number): WesternAnalysis {
    const noteInfo = this.frequencyToNote(frequency);
    const exactNote = this.getExactNoteFrequency(noteInfo.note, noteInfo.octave as number);
    const cents = this.getCentsDeviation(frequency, exactNote);

    return {
      note: `${noteInfo.note}${noteInfo.octave}`,
      noteFrequency: exactNote,
      cents: cents,
      octave: noteInfo.octave as number
    };
  }

  frequencyToNote(frequency: number): NoteInfo {
    if (frequency <= 0) {
      throw new Error('Frequency must be positive');
    }

    const midi = this.frequencyToMIDI(frequency);
    const noteIndex = Math.round(midi) % 12;
    const octave = Math.floor(Math.round(midi) / 12) - 1;
    const note = WesternMusicSystem.NOTES[noteIndex];
    const exactFrequency = this.midiToFrequency(Math.round(midi));
    const cents = this.calculateCents(frequency, exactFrequency);

    return {
      note: note,
      frequency: frequency,
      cents: cents,
      octave: octave
    };
  }

  noteToFrequency(note: string, octave?: number): number {
    const match = note.match(/^([A-G][#b]?)(\d+)?$/);
    if (!match) {
      throw new Error(`Invalid note format: ${note}`);
    }

    const noteName = match[1];
    const noteOctave = octave !== undefined ? octave : parseInt(match[2] || '4');
    
    const noteIndex = WesternMusicSystem.NOTES.indexOf(this.normalizeNoteName(noteName));
    if (noteIndex === -1) {
      throw new Error(`Invalid note name: ${noteName}`);
    }

    const midi = (noteOctave + 1) * 12 + noteIndex;
    return this.midiToFrequency(midi);
  }

  getCentsDeviation(frequency: number, targetFrequency: number): number {
    return this.calculateCents(frequency, targetFrequency);
  }

  getScale(scaleName: string): ScaleInfo | null {
    return WesternMusicSystem.SCALES[scaleName.toLowerCase()] || null;
  }

  detectChord(frequencies: number[]): ChordInfo | null {
    if (frequencies.length < 3) {
      return null;
    }

    const notes = frequencies.map(f => this.frequencyToNote(f).note).sort();
    const uniqueNotes = [...new Set(notes)];

    if (uniqueNotes.length < 3) {
      return null;
    }

    const intervals = this.getIntervalsFromNotes(uniqueNotes);
    
    if (intervals.includes(400) && intervals.includes(700)) {
      return {
        name: `${uniqueNotes[0]} Major`,
        notes: uniqueNotes,
        quality: 'major'
      };
    }
    
    if (intervals.includes(300) && intervals.includes(700)) {
      return {
        name: `${uniqueNotes[0]} Minor`,
        notes: uniqueNotes,
        quality: 'minor'
      };
    }

    if (intervals.includes(300) && intervals.includes(600)) {
      return {
        name: `${uniqueNotes[0]} Diminished`,
        notes: uniqueNotes,
        quality: 'diminished'
      };
    }

    if (intervals.includes(400) && intervals.includes(800)) {
      return {
        name: `${uniqueNotes[0]} Augmented`,
        notes: uniqueNotes,
        quality: 'augmented'
      };
    }

    return {
      name: `${uniqueNotes[0]} Complex`,
      notes: uniqueNotes,
      quality: 'other'
    };
  }

  getInterval(note1: string, note2: string): IntervalInfo {
    const freq1 = this.noteToFrequency(note1);
    const freq2 = this.noteToFrequency(note2);
    const cents = Math.abs(this.calculateCents(freq2, freq1));
    
    const intervalKey = this.centsToIntervalName(cents);
    const intervalInfo = WesternMusicSystem.INTERVALS[intervalKey];
    
    return {
      intervalName: intervalInfo?.name || 'Unknown Interval',
      cents: cents,
      ratio: freq2 / freq1
    };
  }

  isNoteInScale(note: string, scale: ScaleInfo): boolean {
    // For Western scales, check if the note degree is in the scale
    // Note parameter can be like '3', 'b3', etc.
    return scale.notes.includes(note);
  }

  transposeNote(note: string, semitones: number): string {
    const noteInfo = this.frequencyToNote(this.noteToFrequency(note));
    const noteIndex = WesternMusicSystem.NOTES.indexOf(noteInfo.note);
    const totalSemitones = noteIndex + semitones;
    const newIndex = ((totalSemitones % 12) + 12) % 12; // Handle negative modulo
    const octaveShift = Math.floor(totalSemitones / 12);
    
    return `${WesternMusicSystem.NOTES[newIndex]}${(noteInfo.octave as number) + octaveShift}`;
  }

  private normalizeNoteName(note: string): string {
    const cleanNote = note.replace(/\d+/g, '');
    
    for (const [sharp, flats] of Object.entries(WesternMusicSystem.ENHARMONIC_EQUIVALENTS)) {
      if (flats.includes(cleanNote)) {
        return sharp;
      }
    }
    
    return cleanNote;
  }

  private getExactNoteFrequency(note: string, octave: number): number {
    return this.noteToFrequency(`${note}${octave}`);
  }

  private getIntervalsFromNotes(notes: string[]): number[] {
    const frequencies = notes.map(note => this.noteToFrequency(note));
    const intervals: number[] = [];
    
    for (let i = 1; i < frequencies.length; i++) {
      const cents = Math.abs(this.calculateCents(frequencies[i], frequencies[0]));
      intervals.push(Math.round(cents / 100) * 100);
    }
    
    return intervals;
  }

  private centsToIntervalName(cents: number): string {
    const roundedCents = Math.round(cents / 100) * 100;
    
    for (const [key, interval] of Object.entries(WesternMusicSystem.INTERVALS)) {
      if (Math.abs(interval.cents - roundedCents) < 50) {
        return key;
      }
    }
    
    return 'Unknown';
  }
}