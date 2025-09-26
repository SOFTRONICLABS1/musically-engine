export { BaseMusicSystem } from './BaseMusicSystem';
export { WesternMusicSystem } from './Western';
export { CarnaticMusicSystem } from './Carnatic';
export { HindustaniMusicSystem } from './Hindustani';
export { ShrutiDetector } from './ShrutiDetector';
export type { NoteInfo, IntervalInfo, ScaleInfo, ChordInfo } from './BaseMusicSystem';
export type { ShrutiDetectionResult, FrequencyCluster, ShrutiDetectionConfig } from './ShrutiDetector';

import { WesternMusicSystem } from './Western';
import { CarnaticMusicSystem } from './Carnatic';
import { HindustaniMusicSystem } from './Hindustani';
import { MusicSystem } from '../types/index';

export function createMusicSystem(system: MusicSystem, referencePitch: number = 440) {
  switch (system) {
    case 'western':
      return new WesternMusicSystem(referencePitch);
    case 'carnatic':
      return new CarnaticMusicSystem(referencePitch);
    case 'hindustani':
      return new HindustaniMusicSystem(referencePitch);
    case 'auto':
      // Default to Western for auto-detection
      return new WesternMusicSystem(referencePitch);
    default:
      throw new Error(`Unsupported music system: ${system}`);
  }
}