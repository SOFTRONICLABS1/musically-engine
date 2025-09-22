/**
 * Universal audio buffer management for cross-platform compatibility
 * Handles buffer pooling, reuse, and memory optimization
 */
export class BufferManager {
  private bufferPools: Map<number, Float32Array[]> = new Map();
  private maxPoolSize = 10;
  private inUseBuffers: Set<Float32Array> = new Set();
  
  /**
   * Get a buffer of specified size, reusing from pool if available
   */
  getBuffer(size: number): Float32Array {
    const pool = this.bufferPools.get(size);
    
    if (pool && pool.length > 0) {
      const buffer = pool.pop()!;
      this.inUseBuffers.add(buffer);
      buffer.fill(0); // Clear the buffer
      return buffer;
    }
    
    // Create new buffer if pool is empty
    const buffer = new Float32Array(size);
    this.inUseBuffers.add(buffer);
    return buffer;
  }
  
  /**
   * Return a buffer to the pool for reuse
   */
  releaseBuffer(buffer: Float32Array): void {
    if (!this.inUseBuffers.has(buffer)) {
      return; // Buffer not managed by this manager
    }
    
    this.inUseBuffers.delete(buffer);
    
    const size = buffer.length;
    
    if (!this.bufferPools.has(size)) {
      this.bufferPools.set(size, []);
    }
    
    const pool = this.bufferPools.get(size)!;
    
    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
    }
    // If pool is full, let the buffer be garbage collected
  }
  
  /**
   * Create a copy of audio data in a new buffer
   */
  copyBuffer(source: Float32Array): Float32Array {
    const buffer = this.getBuffer(source.length);
    buffer.set(source);
    return buffer;
  }
  
  /**
   * Mix multiple audio buffers into one
   */
  mixBuffers(buffers: Float32Array[], weights?: number[]): Float32Array {
    if (buffers.length === 0) {
      throw new Error('Cannot mix empty buffer array');
    }
    
    const length = buffers[0].length;
    const mixed = this.getBuffer(length);
    
    // Verify all buffers have same length
    for (const buffer of buffers) {
      if (buffer.length !== length) {
        throw new Error('All buffers must have the same length for mixing');
      }
    }
    
    // Mix the buffers
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let j = 0; j < buffers.length; j++) {
        const weight = weights ? weights[j] : 1.0;
        sum += buffers[j][i] * weight;
      }
      mixed[i] = sum;
    }
    
    return mixed;
  }
  
  /**
   * Apply a window function to a buffer
   */
  applyWindow(buffer: Float32Array, windowType: 'hann' | 'hamming' | 'blackman' = 'hann'): Float32Array {
    const windowed = this.copyBuffer(buffer);
    const length = windowed.length;
    
    for (let i = 0; i < length; i++) {
      let windowValue: number;
      
      switch (windowType) {
        case 'hann':
          windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
          break;
        case 'hamming':
          windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1));
          break;
        case 'blackman':
          windowValue = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (length - 1)) + 
                       0.08 * Math.cos(4 * Math.PI * i / (length - 1));
          break;
        default:
          windowValue = 1.0;
      }
      
      windowed[i] *= windowValue;
    }
    
    return windowed;
  }
  
  /**
   * Normalize audio buffer to prevent clipping
   */
  normalize(buffer: Float32Array, targetLevel = 0.95): Float32Array {
    const normalized = this.copyBuffer(buffer);
    
    // Find peak amplitude
    let peak = 0;
    for (let i = 0; i < normalized.length; i++) {
      peak = Math.max(peak, Math.abs(normalized[i]));
    }
    
    if (peak === 0) {
      return normalized; // Silent buffer
    }
    
    // Calculate normalization factor
    const factor = targetLevel / peak;
    
    // Apply normalization
    for (let i = 0; i < normalized.length; i++) {
      normalized[i] *= factor;
    }
    
    return normalized;
  }
  
  /**
   * Convert stereo to mono by averaging channels
   */
  stereoToMono(left: Float32Array, right: Float32Array): Float32Array {
    if (left.length !== right.length) {
      throw new Error('Left and right channels must have the same length');
    }
    
    const mono = this.getBuffer(left.length);
    
    for (let i = 0; i < mono.length; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }
    
    return mono;
  }
  
  /**
   * Resample audio buffer to target sample rate
   * Simple linear interpolation - for high quality, use dedicated resampling libraries
   */
  resample(buffer: Float32Array, originalRate: number, targetRate: number): Float32Array {
    if (originalRate === targetRate) {
      return this.copyBuffer(buffer);
    }
    
    const ratio = originalRate / targetRate;
    const newLength = Math.floor(buffer.length / ratio);
    const resampled = this.getBuffer(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const sourceIndexFloor = Math.floor(sourceIndex);
      const sourceIndexCeil = Math.min(sourceIndexFloor + 1, buffer.length - 1);
      const fraction = sourceIndex - sourceIndexFloor;
      
      // Linear interpolation
      resampled[i] = buffer[sourceIndexFloor] * (1 - fraction) + 
                     buffer[sourceIndexCeil] * fraction;
    }
    
    return resampled;
  }
  
  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    pooledBuffers: number;
    inUseBuffers: number;
    totalMemoryKB: number;
  } {
    let totalBuffers = 0;
    let totalMemory = 0;
    
    // Count pooled buffers
    for (const [size, pool] of this.bufferPools) {
      totalBuffers += pool.length;
      totalMemory += pool.length * size * 4; // 4 bytes per float32
    }
    
    // Count in-use buffers
    for (const buffer of this.inUseBuffers) {
      totalMemory += buffer.length * 4;
    }
    
    return {
      pooledBuffers: totalBuffers,
      inUseBuffers: this.inUseBuffers.size,
      totalMemoryKB: Math.round(totalMemory / 1024)
    };
  }
  
  /**
   * Clear all buffer pools and force garbage collection
   */
  clearPools(): void {
    this.bufferPools.clear();
    // Note: In-use buffers are not cleared to avoid breaking active processing
  }
  
  /**
   * Set maximum number of buffers to keep in each pool
   */
  setMaxPoolSize(size: number): void {
    if (size < 0) {
      throw new Error('Max pool size must be non-negative');
    }
    
    this.maxPoolSize = size;
    
    // Trim existing pools if they exceed new limit
    for (const [bufferSize, pool] of this.bufferPools) {
      if (pool.length > size) {
        pool.splice(size);
      }
    }
  }
  
  /**
   * Get current maximum pool size
   */
  getMaxPoolSize(): number {
    return this.maxPoolSize;
  }
}