/**
 * Browser-specific entry point for Musically Engine
 * Optimized for Web Audio API and browser environments
 */

// Export everything from core
export * from '../../index';

// Browser-specific exports
export { WebAudioAdapter } from './WebAudioAdapter';

// Re-export main engine class as default
export { default } from '../../index';