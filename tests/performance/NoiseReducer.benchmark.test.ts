/**
 * Performance Benchmark Tests for Enhanced NoiseReducer
 * 
 * Comprehensive performance testing and memory profiling for the enhanced
 * NoiseReducer with psychoacoustic processing, environment detection,
 * and real-time optimization.
 */

import { NoiseReducer } from '../../src/core/NoiseReducer';

describe('NoiseReducer Performance Benchmarks', () => {
    let noiseReducer: NoiseReducer;
    const sampleRate = 44100;
    
    beforeEach(() => {
        noiseReducer = new NoiseReducer(sampleRate);
    });
    
    afterEach(() => {
        noiseReducer.stopNoiseLearning();
        noiseReducer.resetNoiseProfile();
    });
    
    describe('Processing Speed Benchmarks', () => {
        test('should process 1024-sample buffers in real-time', () => {
            const bufferSize = 1024;
            const numBuffers = 100;
            const signal = generateTestSignal(bufferSize);
            
            const startTime = performance.now();
            
            for (let i = 0; i < numBuffers; i++) {
                noiseReducer.process(signal);
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTimePerBuffer = totalTime / numBuffers;
            
            // At 44.1kHz, 1024 samples = ~23.2ms
            // Should process much faster than real-time
            expect(avgTimePerBuffer).toBeLessThan(10); // Max 10ms per buffer
            
            console.log(`Average processing time per 1024-sample buffer: ${avgTimePerBuffer.toFixed(2)}ms`);
        });
        
        test('should process 2048-sample buffers efficiently', () => {
            const bufferSize = 2048;
            const numBuffers = 50;
            const signal = generateComplexSignal(bufferSize);
            
            const startTime = performance.now();
            
            for (let i = 0; i < numBuffers; i++) {
                noiseReducer.process(signal);
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTimePerBuffer = totalTime / numBuffers;
            
            // At 44.1kHz, 2048 samples = ~46.4ms
            expect(avgTimePerBuffer).toBeLessThan(20); // Max 20ms per buffer
            
            console.log(`Average processing time per 2048-sample buffer: ${avgTimePerBuffer.toFixed(2)}ms`);
        });
        
        test('should handle rapid buffer size changes efficiently', () => {
            const bufferSizes = [512, 1024, 2048, 4096];
            const numBuffersPerSize = 25;
            
            const startTime = performance.now();
            
            for (const bufferSize of bufferSizes) {
                noiseReducer.setConfig({ windowSize: bufferSize });
                const signal = generateTestSignal(bufferSize);
                
                for (let i = 0; i < numBuffersPerSize; i++) {
                    noiseReducer.process(signal);
                }
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const totalBuffers = bufferSizes.length * numBuffersPerSize;
            const avgTime = totalTime / totalBuffers;
            
            expect(avgTime).toBeLessThan(15);
            console.log(`Average time across varying buffer sizes: ${avgTime.toFixed(2)}ms`);
        });
    });
    
    describe('Enhanced Feature Performance', () => {
        test('should process with psychoacoustic masking efficiently', () => {
            noiseReducer.setConfig({ 
                enablePsychoacoustic: true,
                psychoacousticThreshold: -20
            });
            
            const bufferSize = 2048;
            const numBuffers = 30;
            const signal = generateHarmonicSignal(440, sampleRate, bufferSize);
            
            const startTime = performance.now();
            
            for (let i = 0; i < numBuffers; i++) {
                noiseReducer.process(signal);
            }
            
            const endTime = performance.now();
            const avgTime = (endTime - startTime) / numBuffers;
            
            // Psychoacoustic processing adds overhead but should still be real-time
            expect(avgTime).toBeLessThan(25);
            console.log(`Psychoacoustic processing time: ${avgTime.toFixed(2)}ms per buffer`);
        });
        
        test('should handle environment detection with minimal overhead', () => {
            noiseReducer.setConfig({ 
                enableEnvironmentDetection: true,
                enableAdaptiveLearning: true
            });
            
            noiseReducer.startNoiseLearning(100);
            
            const bufferSize = 2048;
            const numBuffers = 20;
            const environments = ['studio', 'live', 'outdoor', 'vehicle'];
            
            const startTime = performance.now();
            
            for (let i = 0; i < numBuffers; i++) {
                const env = environments[i % environments.length];
                const envSignal = generateEnvironmentNoise(env, bufferSize);
                noiseReducer.process(envSignal);
            }
            
            const endTime = performance.now();
            const avgTime = (endTime - startTime) / numBuffers;
            
            expect(avgTime).toBeLessThan(30);
            console.log(`Environment detection time: ${avgTime.toFixed(2)}ms per buffer`);
        });
        
        test('should optimize parameters in real-time without lag', () => {
            noiseReducer.setConfig({ 
                enableRealTimeOptimization: true,
                enablePsychoacoustic: true,
                enableMusicalNoiseReduction: true
            });
            
            const bufferSize = 2048;
            const numBuffers = 25;
            
            const startTime = performance.now();
            
            for (let i = 0; i < numBuffers; i++) {
                // Vary signal characteristics to trigger optimization
                const freq = 200 + (i * 50) % 800;
                const signal = generateHarmonicSignal(freq, sampleRate, bufferSize);
                noiseReducer.process(signal);
            }
            
            const endTime = performance.now();
            const avgTime = (endTime - startTime) / numBuffers;
            
            expect(avgTime).toBeLessThan(35);
            console.log(`Real-time optimization time: ${avgTime.toFixed(2)}ms per buffer`);
        });
    });
    
    describe('Memory Usage Benchmarks', () => {
        test('should maintain stable memory usage during long processing', () => {
            const bufferSize = 2048;
            const numBuffers = 200; // Simulate longer processing session
            const signal = generateTestSignal(bufferSize);
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const initialMemory = process.memoryUsage();
            
            for (let i = 0; i < numBuffers; i++) {
                noiseReducer.process(signal);
                
                // Periodically check for memory leaks
                if (i % 50 === 0 && global.gc) {
                    global.gc();
                }
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Memory increase should be minimal (less than 10MB)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
            
            console.log(`Memory increase after ${numBuffers} buffers: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        });
        
        test('should handle multiple NoiseReducer instances efficiently', () => {
            const numInstances = 5;
            const instances: NoiseReducer[] = [];
            
            const initialMemory = process.memoryUsage();
            
            // Create multiple instances
            for (let i = 0; i < numInstances; i++) {
                instances.push(new NoiseReducer(sampleRate));
            }
            
            const afterCreationMemory = process.memoryUsage();
            const creationMemory = afterCreationMemory.heapUsed - initialMemory.heapUsed;
            
            // Process with all instances
            const signal = generateTestSignal(2048);
            for (let i = 0; i < 20; i++) {
                instances.forEach(instance => instance.process(signal));
            }
            
            const finalMemory = process.memoryUsage();
            const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log(`Memory per instance: ${(creationMemory / numInstances / 1024 / 1024).toFixed(2)}MB`);
            console.log(`Total memory for ${numInstances} instances: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
            
            // Clean up
            instances.forEach(instance => {
                instance.stopNoiseLearning();
                instance.resetNoiseProfile();
            });
            
            // Each instance should use reasonable memory
            expect(creationMemory / numInstances).toBeLessThan(50 * 1024 * 1024); // Max 50MB per instance
        });
    });
    
    describe('Stress Tests', () => {
        test('should handle continuous processing under load', () => {
            const bufferSize = 1024;
            const processingTimeSeconds = 2; // 2 seconds of continuous processing
            const buffersPerSecond = sampleRate / bufferSize;
            const totalBuffers = Math.floor(processingTimeSeconds * buffersPerSecond);
            
            const signal = generateComplexSignal(bufferSize);
            let processedBuffers = 0;
            const startTime = performance.now();
            
            for (let i = 0; i < totalBuffers; i++) {
                noiseReducer.process(signal);
                processedBuffers++;
            }
            
            const endTime = performance.now();
            const actualTime = (endTime - startTime) / 1000; // Convert to seconds
            const realTimeRatio = actualTime / processingTimeSeconds;
            
            console.log(`Processed ${processedBuffers} buffers in ${actualTime.toFixed(2)}s`);
            console.log(`Real-time ratio: ${realTimeRatio.toFixed(2)}x`);
            
            // Should process faster than real-time
            expect(realTimeRatio).toBeLessThan(0.5); // Should be at least 2x faster than real-time
        });
        
        test('should maintain performance with all features enabled', () => {
            // Enable all enhanced features for maximum load
            noiseReducer.setConfig({
                enablePsychoacoustic: true,
                enableMusicalNoiseReduction: true,
                enableAdaptiveLearning: true,
                enableEnvironmentDetection: true,
                enableRealTimeOptimization: true,
                aggressiveness: 0.8,
                psychoacousticThreshold: -18,
                musicalNoiseThreshold: 0.1
            });
            
            noiseReducer.startNoiseLearning(100);
            
            const bufferSize = 2048;
            const numBuffers = 50;
            
            const startTime = performance.now();
            
            for (let i = 0; i < numBuffers; i++) {
                // Use complex signals to stress all features
                const signal = generateComplexMusicalSignal(bufferSize);
                noiseReducer.process(signal);
            }
            
            const endTime = performance.now();
            const avgTime = (endTime - startTime) / numBuffers;
            
            // Even with all features, should maintain reasonable performance
            expect(avgTime).toBeLessThan(50); // Max 50ms per buffer with all features
            
            console.log(`Full-featured processing time: ${avgTime.toFixed(2)}ms per buffer`);
        });
    });
});

// Enhanced test signal generators for benchmarking
function generateTestSignal(length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    }
    return buffer;
}

function generateComplexSignal(length: number): Float32Array {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        // Multi-frequency signal with harmonics
        buffer[i] = 0.4 * Math.sin(2 * Math.PI * 220 * i / 44100) +
                   0.3 * Math.sin(2 * Math.PI * 440 * i / 44100) +
                   0.2 * Math.sin(2 * Math.PI * 880 * i / 44100) +
                   0.1 * Math.sin(2 * Math.PI * 1760 * i / 44100);
    }
    return buffer;
}

function generateHarmonicSignal(fundamental: number, sampleRate: number, length: number): Float32Array {
    const buffer = new Float32Array(length);
    const harmonics = [1, 0.5, 0.3, 0.2, 0.1];
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        for (let h = 0; h < harmonics.length; h++) {
            sample += harmonics[h] * Math.sin(2 * Math.PI * fundamental * (h + 1) * i / sampleRate);
        }
        buffer[i] = sample / harmonics.length;
    }
    return buffer;
}

function generateComplexMusicalSignal(length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        // Simulate complex musical content
        let sample = 0;
        
        // Base notes (chord)
        sample += 0.3 * Math.sin(2 * Math.PI * 261.63 * i / 44100); // C4
        sample += 0.3 * Math.sin(2 * Math.PI * 329.63 * i / 44100); // E4
        sample += 0.3 * Math.sin(2 * Math.PI * 392.00 * i / 44100); // G4
        
        // Harmonics
        sample += 0.1 * Math.sin(2 * Math.PI * 523.25 * i / 44100); // C5
        sample += 0.05 * Math.sin(2 * Math.PI * 659.25 * i / 44100); // E5
        
        // Add some realistic noise
        sample += (Math.random() - 0.5) * 0.02;
        
        buffer[i] = sample * 0.3; // Scale to reasonable level
    }
    return buffer;
}

function generateEnvironmentNoise(environment: string, length: number): Float32Array {
    const buffer = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        let sample = 0;
        
        switch (environment) {
            case 'studio':
                sample = (Math.random() - 0.5) * 0.05;
                break;
            case 'live':
                sample = (Math.random() - 0.5) * 0.15;
                if (Math.random() < 0.01) sample += (Math.random() - 0.5) * 0.3;
                break;
            case 'outdoor':
                sample = (Math.random() - 0.5) * 0.2;
                sample += 0.1 * Math.sin(2 * Math.PI * 0.5 * i / 44100);
                break;
            case 'vehicle':
                sample = 0.1 * Math.sin(2 * Math.PI * 80 * i / 44100);
                sample += 0.05 * Math.sin(2 * Math.PI * 160 * i / 44100);
                sample += (Math.random() - 0.5) * 0.1;
                break;
        }
        
        buffer[i] = sample;
    }
    return buffer;
}