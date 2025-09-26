/**
 * Simple browser-only entry point
 * Exports only the music systems and core functionality needed for browser
 */

// Export music systems
export { 
  BaseMusicSystem, 
  WesternMusicSystem, 
  CarnaticMusicSystem, 
  HindustaniMusicSystem, 
  createMusicSystem,
  ShrutiDetector
} from './musicSystems';

// Export core audio processors
export { VocalProcessor } from './audioTypes/VocalProcessor';
export { InstrumentProcessor } from './audioTypes/InstrumentProcessor';
export { AdaptiveProcessor } from './audioTypes/AdaptiveProcessor';
export { AutoDetector } from './audioTypes/AutoDetector';

// Export algorithms
export { YIN } from './algorithms/YIN';
export { Autocorrelation } from './algorithms/Autocorrelation';
export { HPS } from './algorithms/HPS';
export { FFT } from './algorithms/FFT';

// Export utilities
export { WindowFunctions } from './utils/WindowFunctions';
export { NoiseReducer } from './core/NoiseReducer';

// Export music system types
export type { 
  NoteInfo, 
  IntervalInfo, 
  ScaleInfo, 
  ChordInfo
} from './musicSystems';

// Export shruti detection types  
export type { 
  ShrutiDetectionResult,
  FrequencyCluster,
  ShrutiDetectionConfig
} from './musicSystems';

// Export other types
export type { 
  AudioType,
  MusicSystem,
  WesternAnalysis,
  CarnaticAnalysis,
  HindustaniAnalysis
} from './types';

// Simplified Engine class for browser
export class MusicallyEngine {
  private initialized: boolean = false;
  
  constructor() {}
  
  async initialize(): Promise<void> {
    this.initialized = true;
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export version
export const version = "1.0.0";