import { BufferManager } from '../../src/core/BufferManager';

describe('BufferManager', () => {
  let bufferManager: BufferManager;
  
  beforeEach(() => {
    bufferManager = new BufferManager();
  });
  
  describe('Buffer allocation and release', () => {
    test('should allocate new buffers', () => {
      const buffer = bufferManager.getBuffer(1024);
      
      expect(buffer).toBeInstanceOf(Float32Array);
      expect(buffer.length).toBe(1024);
      expect(Array.from(buffer)).toEqual(new Array(1024).fill(0));
    });
    
    test('should reuse released buffers', () => {
      const buffer1 = bufferManager.getBuffer(1024);
      bufferManager.releaseBuffer(buffer1);
      
      const buffer2 = bufferManager.getBuffer(1024);
      
      expect(buffer2).toBe(buffer1);
    });
    
    test('should create new buffer when pool is empty', () => {
      const buffer1 = bufferManager.getBuffer(1024);
      const buffer2 = bufferManager.getBuffer(1024);
      
      expect(buffer1).not.toBe(buffer2);
      expect(buffer1.length).toBe(1024);
      expect(buffer2.length).toBe(1024);
    });
    
    test('should maintain separate pools for different sizes', () => {
      const buffer1024 = bufferManager.getBuffer(1024);
      const buffer2048 = bufferManager.getBuffer(2048);
      
      bufferManager.releaseBuffer(buffer1024);
      bufferManager.releaseBuffer(buffer2048);
      
      const newBuffer1024 = bufferManager.getBuffer(1024);
      const newBuffer2048 = bufferManager.getBuffer(2048);
      
      expect(newBuffer1024).toBe(buffer1024);
      expect(newBuffer2048).toBe(buffer2048);
    });
  });
  
  describe('Buffer operations', () => {
    test('should copy buffers', () => {
      const source = new Float32Array([1, 2, 3, 4, 5]);
      const copy = bufferManager.copyBuffer(source);
      
      expect(copy).not.toBe(source);
      expect(Array.from(copy)).toEqual([1, 2, 3, 4, 5]);
    });
    
    test('should mix buffers', () => {
      const buffer1 = new Float32Array([1, 2, 3]);
      const buffer2 = new Float32Array([4, 5, 6]);
      
      const mixed = bufferManager.mixBuffers([buffer1, buffer2]);
      
      expect(Array.from(mixed)).toEqual([5, 7, 9]);
      bufferManager.releaseBuffer(mixed);
    });
    
    test('should mix buffers with weights', () => {
      const buffer1 = new Float32Array([1, 2, 3]);
      const buffer2 = new Float32Array([4, 5, 6]);
      
      const mixed = bufferManager.mixBuffers([buffer1, buffer2], [0.5, 0.5]);
      
      expect(Array.from(mixed)).toEqual([2.5, 3.5, 4.5]);
      bufferManager.releaseBuffer(mixed);
    });
    
    test('should normalize buffers', () => {
      const buffer = new Float32Array([0.5, -1.0, 0.25]);
      const normalized = bufferManager.normalize(buffer, 0.8);
      
      expect(normalized[1]).toBeCloseTo(-0.8, 5);
      expect(Math.max(...Array.from(normalized).map(Math.abs))).toBeCloseTo(0.8, 5);
      
      bufferManager.releaseBuffer(normalized);
    });
    
    test('should convert stereo to mono', () => {
      const left = new Float32Array([1, 3, 5]);
      const right = new Float32Array([2, 4, 6]);
      
      const mono = bufferManager.stereoToMono(left, right);
      
      expect(Array.from(mono)).toEqual([1.5, 3.5, 5.5]);
      bufferManager.releaseBuffer(mono);
    });
  });
  
  describe('Window functions', () => {
    test('should apply Hann window', () => {
      const buffer = new Float32Array([1, 1, 1, 1]);
      const windowed = bufferManager.applyWindow(buffer, 'hann');
      
      expect(windowed[0]).toBeCloseTo(0, 5);
      expect(windowed[windowed.length - 1]).toBeCloseTo(0, 5);
      expect(windowed[1]).toBeGreaterThan(0);
      expect(windowed[2]).toBeGreaterThan(0);
      
      bufferManager.releaseBuffer(windowed);
    });
    
    test('should apply Hamming window', () => {
      const buffer = new Float32Array([1, 1, 1, 1]);
      const windowed = bufferManager.applyWindow(buffer, 'hamming');
      
      expect(windowed[0]).toBeCloseTo(0.08, 2);
      expect(windowed[windowed.length - 1]).toBeCloseTo(0.08, 2);
      
      bufferManager.releaseBuffer(windowed);
    });
  });
  
  describe('Resampling', () => {
    test('should handle same sample rate', () => {
      const buffer = new Float32Array([1, 2, 3, 4]);
      const resampled = bufferManager.resample(buffer, 44100, 44100);
      
      expect(Array.from(resampled)).toEqual([1, 2, 3, 4]);
      bufferManager.releaseBuffer(resampled);
    });
    
    test('should downsample', () => {
      const buffer = new Float32Array([1, 2, 3, 4]);
      const resampled = bufferManager.resample(buffer, 44100, 22050);
      
      expect(resampled.length).toBe(2);
      bufferManager.releaseBuffer(resampled);
    });
  });
  
  describe('Memory management', () => {
    test('should track memory usage', () => {
      const stats1 = bufferManager.getMemoryStats();
      expect(stats1.inUseBuffers).toBe(0);
      expect(stats1.pooledBuffers).toBe(0);
      
      const buffer = bufferManager.getBuffer(1024);
      const stats2 = bufferManager.getMemoryStats();
      expect(stats2.inUseBuffers).toBe(1);
      
      bufferManager.releaseBuffer(buffer);
      const stats3 = bufferManager.getMemoryStats();
      expect(stats3.inUseBuffers).toBe(0);
      expect(stats3.pooledBuffers).toBe(1);
    });
    
    test('should clear pools', () => {
      const buffer = bufferManager.getBuffer(1024);
      bufferManager.releaseBuffer(buffer);
      
      expect(bufferManager.getMemoryStats().pooledBuffers).toBe(1);
      
      bufferManager.clearPools();
      expect(bufferManager.getMemoryStats().pooledBuffers).toBe(0);
    });
    
    test('should respect max pool size', () => {
      bufferManager.setMaxPoolSize(1);
      
      const buffer1 = bufferManager.getBuffer(1024);
      const buffer2 = bufferManager.getBuffer(1024);
      
      bufferManager.releaseBuffer(buffer1);
      bufferManager.releaseBuffer(buffer2);
      
      expect(bufferManager.getMemoryStats().pooledBuffers).toBe(1);
    });
  });
  
  describe('Error handling', () => {
    test('should throw error for mixing buffers of different lengths', () => {
      const buffer1 = new Float32Array([1, 2]);
      const buffer2 = new Float32Array([1, 2, 3]);
      
      expect(() => {
        bufferManager.mixBuffers([buffer1, buffer2]);
      }).toThrow();
    });
    
    test('should throw error for empty buffer array in mix', () => {
      expect(() => {
        bufferManager.mixBuffers([]);
      }).toThrow();
    });
    
    test('should throw error for negative max pool size', () => {
      expect(() => {
        bufferManager.setMaxPoolSize(-1);
      }).toThrow();
    });
  });
});