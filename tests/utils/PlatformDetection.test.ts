import { PlatformDetection } from '../../src/utils/PlatformDetection';

// Helper to mock global environment
function mockEnvironment(env: {
  process?: any;
  window?: any;
  document?: any;
  navigator?: any;
  WebAssembly?: any;
  SharedArrayBuffer?: any;
}) {
  const originalProcess = global.process;
  const originalWindow = (global as any).window;
  const originalDocument = (global as any).document;
  const originalNavigator = global.navigator;
  const originalWebAssembly = (global as any).WebAssembly;
  const originalSharedArrayBuffer = (global as any).SharedArrayBuffer;

  // Set up mock environment
  if (env.process !== undefined) {
    (global as any).process = env.process;
  } else if (originalProcess) {
    delete (global as any).process;
  }

  if (env.window !== undefined) {
    (global as any).window = env.window;
  } else if (originalWindow) {
    delete (global as any).window;
  }

  if (env.document !== undefined) {
    (global as any).document = env.document;
  } else if (originalDocument) {
    delete (global as any).document;
  }

  if (env.navigator !== undefined) {
    (global as any).navigator = env.navigator;
  } else if (originalNavigator) {
    delete (global as any).navigator;
  }

  if (env.WebAssembly !== undefined) {
    (global as any).WebAssembly = env.WebAssembly;
  } else if (originalWebAssembly) {
    delete (global as any).WebAssembly;
  }

  if (env.SharedArrayBuffer !== undefined) {
    (global as any).SharedArrayBuffer = env.SharedArrayBuffer;
  } else if (originalSharedArrayBuffer) {
    delete (global as any).SharedArrayBuffer;
  }

  // Return cleanup function
  return () => {
    if (originalProcess !== undefined) {
      (global as any).process = originalProcess;
    } else {
      delete (global as any).process;
    }
    
    if (originalWindow !== undefined) {
      (global as any).window = originalWindow;
    } else {
      delete (global as any).window;
    }
    
    if (originalDocument !== undefined) {
      (global as any).document = originalDocument;
    } else {
      delete (global as any).document;
    }
    
    if (originalNavigator !== undefined) {
      (global as any).navigator = originalNavigator;
    } else {
      delete (global as any).navigator;
    }
    
    if (originalWebAssembly !== undefined) {
      (global as any).WebAssembly = originalWebAssembly;
    } else {
      delete (global as any).WebAssembly;
    }
    
    if (originalSharedArrayBuffer !== undefined) {
      (global as any).SharedArrayBuffer = originalSharedArrayBuffer;
    } else {
      delete (global as any).SharedArrayBuffer;
    }
  };
}

describe('PlatformDetection', () => {
  describe('Platform detection', () => {
    test('should detect browser environment', () => {
      const cleanup = mockEnvironment({
        window: {},
        document: {},
        navigator: { userAgent: 'Browser' }
      });

      expect(PlatformDetection.detect()).toBe('browser');
      expect(PlatformDetection.isBrowser()).toBe(true);
      expect(PlatformDetection.isNode()).toBe(false);
      expect(PlatformDetection.isReactNative()).toBe(false);
      expect(PlatformDetection.isElectron()).toBe(false);

      cleanup();
    });

    test('should detect Node.js environment', () => {
      const cleanup = mockEnvironment({
        process: {
          versions: { node: '16.0.0' }
        }
      });

      expect(PlatformDetection.detect()).toBe('node');
      expect(PlatformDetection.isNode()).toBe(true);
      expect(PlatformDetection.isBrowser()).toBe(false);
      expect(PlatformDetection.isReactNative()).toBe(false);
      expect(PlatformDetection.isElectron()).toBe(false);

      cleanup();
    });

    test('should detect React Native environment', () => {
      const cleanup = mockEnvironment({
        navigator: { product: 'ReactNative' }
      });

      expect(PlatformDetection.detect()).toBe('react-native');
      expect(PlatformDetection.isReactNative()).toBe(true);
      expect(PlatformDetection.isBrowser()).toBe(false);
      expect(PlatformDetection.isNode()).toBe(false);
      expect(PlatformDetection.isElectron()).toBe(false);

      cleanup();
    });

    test('should detect Electron environment', () => {
      const cleanup = mockEnvironment({
        window: {},
        process: {
          versions: { node: '16.0.0', electron: '13.0.0' },
          type: 'renderer'
        }
      });

      expect(PlatformDetection.detect()).toBe('electron');
      expect(PlatformDetection.isElectron()).toBe(true);
      expect(PlatformDetection.isBrowser()).toBe(true); // Electron has both
      expect(PlatformDetection.isNode()).toBe(false); // Has window, so not pure Node
      expect(PlatformDetection.isReactNative()).toBe(false);

      cleanup();
    });

    test('should default to browser when platform unclear', () => {
      const cleanup = mockEnvironment({});

      expect(PlatformDetection.detect()).toBe('browser');

      cleanup();
    });
  });

  describe('Feature detection', () => {
    test('should detect Web Audio API support', () => {
      const cleanup = mockEnvironment({
        window: {
          AudioContext: class MockAudioContext {},
          webkitAudioContext: undefined
        }
      });

      expect(PlatformDetection.hasWebAudioSupport()).toBe(true);

      cleanup();
    });

    test('should detect webkit Audio API support', () => {
      const cleanup = mockEnvironment({
        window: {
          AudioContext: undefined,
          webkitAudioContext: class MockWebkitAudioContext {}
        }
      });

      expect(PlatformDetection.hasWebAudioSupport()).toBe(true);

      cleanup();
    });

    test('should detect no Web Audio API support', () => {
      const cleanup = mockEnvironment({
        window: {}
      });

      expect(PlatformDetection.hasWebAudioSupport()).toBe(false);

      cleanup();
    });

    test('should detect MediaDevices support', () => {
      const cleanup = mockEnvironment({
        navigator: {
          mediaDevices: {
            getUserMedia: jest.fn()
          }
        }
      });

      expect(PlatformDetection.hasMediaDevicesSupport()).toBe(true);

      cleanup();
    });

    test('should detect no MediaDevices support', () => {
      const cleanup = mockEnvironment({
        navigator: {}
      });

      expect(PlatformDetection.hasMediaDevicesSupport()).toBe(false);

      cleanup();
    });

    test('should detect WebAssembly support', () => {
      const cleanup = mockEnvironment({
        WebAssembly: {
          instantiate: jest.fn(),
          compile: jest.fn()
        }
      });

      expect(PlatformDetection.hasWebAssemblySupport()).toBe(true);

      cleanup();
    });

    test('should detect no WebAssembly support', () => {
      const cleanup = mockEnvironment({});

      expect(PlatformDetection.hasWebAssemblySupport()).toBe(false);

      cleanup();
    });

    test('should detect SharedArrayBuffer support', () => {
      const cleanup = mockEnvironment({
        SharedArrayBuffer: ArrayBuffer
      });

      expect(PlatformDetection.hasSharedArrayBufferSupport()).toBe(true);

      cleanup();
    });

    test('should detect no SharedArrayBuffer support', () => {
      const cleanup = mockEnvironment({});

      expect(PlatformDetection.hasSharedArrayBufferSupport()).toBe(false);

      cleanup();
    });
  });

  describe('Environment information', () => {
    test('should return complete environment info for browser', () => {
      const cleanup = mockEnvironment({
        window: {},
        document: {},
        navigator: { userAgent: 'Mozilla/5.0 Chrome/91.0' },
        WebAssembly: {},
        SharedArrayBuffer: ArrayBuffer
      });

      const info = PlatformDetection.getEnvironmentInfo();

      expect(info.platform).toBe('browser');
      expect(info.userAgent).toBe('Mozilla/5.0 Chrome/91.0');
      expect(info.hasWebAudio).toBe(false); // No AudioContext in mock
      expect(info.hasWebAssembly).toBe(true);
      expect(info.hasSharedArrayBuffer).toBe(true);

      cleanup();
    });

    test('should return complete environment info for Node.js', () => {
      const cleanup = mockEnvironment({
        process: {
          versions: { node: '16.14.0' }
        }
      });

      const info = PlatformDetection.getEnvironmentInfo();

      expect(info.platform).toBe('node');
      expect(info.nodeVersion).toBe('16.14.0');
      expect(info.userAgent).toBeUndefined();

      cleanup();
    });

    test('should return complete environment info for Electron', () => {
      const cleanup = mockEnvironment({
        window: {},
        navigator: { userAgent: 'Electron/13.0.0' },
        process: {
          versions: { 
            node: '16.14.0',
            electron: '13.0.0'
          },
          type: 'renderer'
        }
      });

      const info = PlatformDetection.getEnvironmentInfo();

      expect(info.platform).toBe('electron');
      expect(info.userAgent).toBe('Electron/13.0.0');
      expect(info.nodeVersion).toBe('16.14.0');
      expect(info.electronVersion).toBe('13.0.0');

      cleanup();
    });

    test('should return complete environment info for React Native', () => {
      const cleanup = mockEnvironment({
        navigator: { product: 'ReactNative' }
      });

      const info = PlatformDetection.getEnvironmentInfo();

      expect(info.platform).toBe('react-native');
      expect(info.reactNativeVersion).toBe('unknown');

      cleanup();
    });
  });

  describe('Browser information', () => {
    test('should detect Chrome browser', () => {
      const cleanup = mockEnvironment({
        window: {},
        document: {},
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      });

      const browserInfo = PlatformDetection.getBrowserInfo();

      expect(browserInfo?.name).toBe('Chrome');
      expect(browserInfo?.version).toBe('91');
      expect(browserInfo?.vendor).toBe('Google');

      cleanup();
    });

    test('should detect Firefox browser', () => {
      const cleanup = mockEnvironment({
        window: {},
        document: {},
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0' }
      });

      const browserInfo = PlatformDetection.getBrowserInfo();

      expect(browserInfo?.name).toBe('Firefox');
      expect(browserInfo?.version).toBe('89');
      expect(browserInfo?.vendor).toBe('Mozilla');

      cleanup();
    });

    test('should detect Safari browser', () => {
      const cleanup = mockEnvironment({
        window: {},
        document: {},
        navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15' }
      });

      const browserInfo = PlatformDetection.getBrowserInfo();

      expect(browserInfo?.name).toBe('Safari');
      expect(browserInfo?.version).toBe('14');
      expect(browserInfo?.vendor).toBe('Apple');

      cleanup();
    });

    test('should detect Edge browser', () => {
      const cleanup = mockEnvironment({
        window: {},
        document: {},
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59' }
      });

      const browserInfo = PlatformDetection.getBrowserInfo();

      expect(browserInfo?.name).toBe('Chrome'); // Edge reports as Chrome in modern versions
      expect(browserInfo?.vendor).toBe('Google');

      cleanup();
    });

    test('should return null for non-browser environments', () => {
      const cleanup = mockEnvironment({
        process: { versions: { node: '16.0.0' } }
      });

      const browserInfo = PlatformDetection.getBrowserInfo();

      expect(browserInfo).toBeNull();

      cleanup();
    });
  });

  describe('Compatibility checking', () => {
    test('should pass compatibility check for modern browser', () => {
      const cleanup = mockEnvironment({
        window: {
          AudioContext: class MockAudioContext {}
        },
        document: {},
        navigator: {
          userAgent: 'Chrome/91.0',
          mediaDevices: {
            getUserMedia: jest.fn()
          }
        }
      });

      const compatibility = PlatformDetection.checkCompatibility();

      expect(compatibility.supported).toBe(true);
      expect(compatibility.issues).toHaveLength(0);
      expect(compatibility.recommendations).toHaveLength(0);

      cleanup();
    });

    test('should fail compatibility check for browser without Web Audio', () => {
      const cleanup = mockEnvironment({
        window: {},
        document: {},
        navigator: { userAgent: 'Old Browser' }
      });

      const compatibility = PlatformDetection.checkCompatibility();

      expect(compatibility.supported).toBe(false);
      expect(compatibility.issues).toContain('Web Audio API not supported');
      expect(compatibility.recommendations).toContain('Use a modern browser (Chrome 66+, Firefox 60+, Safari 11.1+, Edge 79+)');

      cleanup();
    });

    test('should fail compatibility check for browser without MediaDevices', () => {
      const cleanup = mockEnvironment({
        window: {
          AudioContext: class MockAudioContext {}
        },
        document: {},
        navigator: { userAgent: 'Chrome/91.0' }
      });

      const compatibility = PlatformDetection.checkCompatibility();

      expect(compatibility.supported).toBe(false);
      expect(compatibility.issues).toContain('MediaDevices API not supported');
      expect(compatibility.recommendations).toContain('Enable microphone permissions and use HTTPS');

      cleanup();
    });

    test('should pass compatibility check for Node.js', () => {
      const cleanup = mockEnvironment({
        process: { versions: { node: '16.0.0' } }
      });

      const compatibility = PlatformDetection.checkCompatibility();

      expect(compatibility.supported).toBe(true);

      cleanup();
    });

    test('should pass compatibility check for React Native', () => {
      const cleanup = mockEnvironment({
        navigator: { product: 'ReactNative' }
      });

      const compatibility = PlatformDetection.checkCompatibility();

      expect(compatibility.supported).toBe(true);

      cleanup();
    });

    test('should handle Electron compatibility', () => {
      const cleanup = mockEnvironment({
        window: {},
        process: {
          versions: { node: '16.0.0', electron: '13.0.0' },
          type: 'renderer'
        },
        navigator: { userAgent: 'Electron' }
      });

      const compatibility = PlatformDetection.checkCompatibility();

      expect(compatibility.supported).toBe(false); // No AudioContext in mock
      expect(compatibility.issues).toContain('Web Audio API not available in Electron renderer');

      cleanup();
    });
  });

  describe('Edge cases', () => {
    test('should handle missing process.versions', () => {
      const cleanup = mockEnvironment({
        process: {}
      });

      expect(PlatformDetection.isNode()).toBe(false);

      cleanup();
    });

    test('should handle process without versions.node', () => {
      const cleanup = mockEnvironment({
        process: {
          versions: {}
        }
      });

      expect(PlatformDetection.isNode()).toBe(false);

      cleanup();
    });

    test('should handle partial navigator object', () => {
      const cleanup = mockEnvironment({
        navigator: {}
      });

      expect(PlatformDetection.isReactNative()).toBe(false);
      expect(PlatformDetection.hasMediaDevicesSupport()).toBe(false);

      cleanup();
    });

    test('should handle environment with only window', () => {
      const cleanup = mockEnvironment({
        window: {}
      });

      expect(PlatformDetection.isBrowser()).toBe(false); // Needs document too

      cleanup();
    });

    test('should handle environment with window and document but no navigator', () => {
      const cleanup = mockEnvironment({
        window: {},
        document: {}
      });

      expect(PlatformDetection.isBrowser()).toBe(false); // Needs navigator too

      cleanup();
    });
  });
});