import { WesternAnalysis, CarnaticAnalysis, HindustaniAnalysis } from '../types/index.js';

export interface NoteInfo {
  note: string;
  frequency: number;
  cents: number;
  octave: number | string;
}

export interface IntervalInfo {
  intervalName: string;
  cents: number;
  ratio: number;
}

export interface ScaleInfo {
  name: string;
  notes: string[];
  intervals: number[];
}

export interface ChordInfo {
  name: string;
  notes: string[];
  quality: 'major' | 'minor' | 'diminished' | 'augmented' | 'other';
}

export abstract class BaseMusicSystem {
  protected referencePitch: number;
  protected referenceNote: string;

  constructor(referencePitch: number = 440, referenceNote: string = 'A4') {
    this.referencePitch = referencePitch;
    this.referenceNote = referenceNote;
  }

  abstract analyzeFrequency(frequency: number): WesternAnalysis | CarnaticAnalysis | HindustaniAnalysis;
  
  abstract frequencyToNote(frequency: number): NoteInfo;
  
  abstract noteToFrequency(note: string, octave?: number): number;
  
  abstract getCentsDeviation(frequency: number, targetFrequency: number): number;
  
  abstract getScale(scaleName: string): ScaleInfo | null;
  
  abstract detectChord(frequencies: number[]): ChordInfo | null;
  
  abstract getInterval(note1: string, note2: string): IntervalInfo;
  
  abstract isNoteInScale(note: string, scale: ScaleInfo): boolean;
  
  abstract transposeNote(note: string, semitones: number): string;

  setReferencePitch(pitch: number): void {
    this.referencePitch = pitch;
  }

  getReferencePitch(): number {
    return this.referencePitch;
  }

  protected calculateCents(frequency1: number, frequency2: number): number {
    return Math.round(1200 * Math.log2(frequency1 / frequency2));
  }

  protected frequencyToMIDI(frequency: number): number {
    return 69 + 12 * Math.log2(frequency / this.referencePitch);
  }

  protected midiToFrequency(midi: number): number {
    return this.referencePitch * Math.pow(2, (midi - 69) / 12);
  }
}