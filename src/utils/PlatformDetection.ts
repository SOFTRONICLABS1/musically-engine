import { Platform } from '../types';

/**
 * Platform detection utility for automatic adapter selection
 * Detects the current runtime environment and returns appropriate platform identifier
 */
export class PlatformDetection {
  /**
   * Detect the current platform
   */
  static detect(): Platform {
    // Check for Node.js environment
    if (typeof process !== 'undefined' && 
        process.versions && 
        process.versions.node) {
      
      // Check if we're in Electron (which has both Node.js and browser APIs)
      if (typeof window !== 'undefined' && 
          typeof require !== 'undefined' && 
          (window as any).process?.type) {
        return 'electron';
      }
      
      return 'node';
    }
    
    // Check for React Native environment
    if (typeof navigator !== 'undefined' && 
        navigator.product === 'ReactNative') {
      return 'react-native';
    }
    
    // Check for browser environment
    if (typeof window !== 'undefined' && 
        typeof document !== 'undefined') {
      return 'browser';
    }
    
    // Default fallback
    return 'browser';
  }
  
  /**
   * Check if running in a browser environment
   */
  static isBrowser(): boolean {
    return typeof window !== 'undefined' && 
           typeof document !== 'undefined' &&
           typeof navigator !== 'undefined';
  }
  
  /**
   * Check if running in Node.js environment
   */
  static isNode(): boolean {
    return typeof process !== 'undefined' && 
           process.versions && 
           !!process.versions.node &&
           typeof window === 'undefined';
  }
  
  /**
   * Check if running in React Native environment
   */
  static isReactNative(): boolean {
    return typeof navigator !== 'undefined' && 
           navigator.product === 'ReactNative';
  }
  
  /**
   * Check if running in Electron environment
   */
  static isElectron(): boolean {
    return typeof window !== 'undefined' && 
           typeof require !== 'undefined' && 
           !!(window as any).process?.type;
  }
  
  /**
   * Get detailed environment information
   */
  static getEnvironmentInfo(): {
    platform: Platform;
    userAgent?: string;
    nodeVersion?: string;
    electronVersion?: string;
    reactNativeVersion?: string;
    hasWebAudio: boolean;
    hasMediaDevices: boolean;
    hasWebAssembly: boolean;
    hasSharedArrayBuffer: boolean;
  } {
    const platform = this.detect();
    
    const info = {
      platform,
      hasWebAudio: this.hasWebAudioSupport(),
      hasMediaDevices: this.hasMediaDevicesSupport(),
      hasWebAssembly: this.hasWebAssemblySupport(),
      hasSharedArrayBuffer: this.hasSharedArrayBufferSupport(),
      userAgent: undefined as string | undefined,
      nodeVersion: undefined as string | undefined,
      electronVersion: undefined as string | undefined,
      reactNativeVersion: undefined as string | undefined
    };
    
    // Browser-specific info
    if (this.isBrowser() || this.isElectron()) {
      info.userAgent = navigator.userAgent;
    }
    
    // Node.js-specific info
    if (this.isNode() || this.isElectron()) {
      info.nodeVersion = process.versions.node;
    }
    
    // Electron-specific info
    if (this.isElectron()) {
      info.electronVersion = (process.versions as any).electron;
    }
    
    // React Native-specific info
    if (this.isReactNative()) {
      // React Native version detection would require platform-specific code
      info.reactNativeVersion = 'unknown';
    }
    
    return info;
  }
  
  /**
   * Check for Web Audio API support
   */
  static hasWebAudioSupport(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }
  
  /**
   * Check for MediaDevices API support
   */
  static hasMediaDevicesSupport(): boolean {
    if (typeof navigator === 'undefined') return false;
    return !!navigator.mediaDevices?.getUserMedia;
  }
  
  /**
   * Check for WebAssembly support
   */
  static hasWebAssemblySupport(): boolean {
    return typeof WebAssembly !== 'undefined';
  }
  
  /**
   * Check for SharedArrayBuffer support
   */
  static hasSharedArrayBufferSupport(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
  }
  
  /**
   * Get browser information (browser and Electron only)
   */
  static getBrowserInfo(): {
    name: string;
    version: string;
    vendor: string;
  } | null {
    if (!this.isBrowser() && !this.isElectron()) {
      return null;
    }
    
    const userAgent = navigator.userAgent;
    
    // Simple browser detection (can be enhanced for more accuracy)
    let name = 'Unknown';
    let version = 'Unknown';
    let vendor = 'Unknown';
    
    if (userAgent.includes('Chrome')) {
      name = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'Unknown';
      vendor = 'Google';
    } else if (userAgent.includes('Firefox')) {
      name = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? match[1] : 'Unknown';
      vendor = 'Mozilla';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      name = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      version = match ? match[1] : 'Unknown';
      vendor = 'Apple';
    } else if (userAgent.includes('Edge')) {
      name = 'Edge';
      const match = userAgent.match(/Edge\/(\d+)/);
      version = match ? match[1] : 'Unknown';
      vendor = 'Microsoft';
    }
    
    return { name, version, vendor };
  }
  
  /**
   * Check if the current environment meets minimum requirements
   */
  static checkCompatibility(): {
    supported: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    const platform = this.detect();
    
    switch (platform) {
      case 'browser':
        if (!this.hasWebAudioSupport()) {
          issues.push('Web Audio API not supported');
          recommendations.push('Use a modern browser (Chrome 66+, Firefox 60+, Safari 11.1+, Edge 79+)');
        }
        
        if (!this.hasMediaDevicesSupport()) {
          issues.push('MediaDevices API not supported');
          recommendations.push('Enable microphone permissions and use HTTPS');
        }
        
        break;
        
      case 'node':
        // Node.js specific checks would go here
        break;
        
      case 'react-native':
        // React Native specific checks would go here
        break;
        
      case 'electron':
        if (!this.hasWebAudioSupport()) {
          issues.push('Web Audio API not available in Electron renderer');
          recommendations.push('Update Electron version or enable web security');
        }
        break;
    }
    
    return {
      supported: issues.length === 0,
      issues,
      recommendations
    };
  }
}