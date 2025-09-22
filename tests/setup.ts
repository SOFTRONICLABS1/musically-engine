/**
 * Jest test setup file
 * Configures global test environment and mocks
 */

// Mock Web Audio API for testing
class MockAudioContext {
  sampleRate = 44100;
  state = 'running';
  
  createGain() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
      gain: { value: 1 }
    };
  }
  
  createScriptProcessor() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: null
    };
  }
  
  createMediaStreamSource() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn()
    };
  }
  
  resume() {
    return Promise.resolve();
  }
  
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  
  decodeAudioData() {
    return Promise.resolve({
      sampleRate: 44100,
      length: 1024,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(1024)
    });
  }
}

// Mock MediaDevices API
const mockGetUserMedia = jest.fn(() => 
  Promise.resolve({
    getTracks: () => [{ stop: jest.fn() }]
  })
);

// Global mocks
(global as any).AudioContext = MockAudioContext;
(global as any).webkitAudioContext = MockAudioContext;

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  },
  writable: true
});

Object.defineProperty(global.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Test Environment)',
  writable: true
});

// Mock SharedArrayBuffer if not available
if (typeof SharedArrayBuffer === 'undefined') {
  (global as any).SharedArrayBuffer = ArrayBuffer;
}

// Mock WebAssembly if not available
if (typeof WebAssembly === 'undefined') {
  (global as any).WebAssembly = {
    instantiate: jest.fn(),
    compile: jest.fn()
  };
}