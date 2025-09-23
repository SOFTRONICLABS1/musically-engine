/**
 * Tests for FileProcessor
 */

import { FileProcessor, FileProcessingOptions, ProcessingResult } from '../../../src/platforms/node/FileProcessor';
import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

// Mock the fs module
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readFile: jest.fn(),
        readdir: jest.fn(),
        writeFile: jest.fn()
    },
    createReadStream: jest.fn(),
    createWriteStream: jest.fn()
}));

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
    const mockFfmpeg = jest.fn(() => ({
        format: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        audioFrequency: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        pipe: jest.fn()
    }));
    return mockFfmpeg;
}, { virtual: true });

// Mock stream/promises
jest.mock('stream/promises', () => ({
    pipeline: jest.fn()
}));

describe('FileProcessor', () => {
    let processor: FileProcessor;
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    beforeEach(() => {
        processor = new FileProcessor(44100);
        jest.clearAllMocks();
    });
    
    describe('Initialization', () => {
        test('should create processor with default sample rate', () => {
            const defaultProcessor = new FileProcessor();
            expect(defaultProcessor['sampleRate']).toBe(44100);
        });
        
        test('should create processor with custom sample rate', () => {
            const customProcessor = new FileProcessor(48000);
            expect(customProcessor['sampleRate']).toBe(48000);
        });
        
        test('should have default processing options', () => {
            const defaultOptions = processor['defaultOptions'];
            
            expect(defaultOptions.sampleRate).toBe(44100);
            expect(defaultOptions.channels).toBe(1);
            expect(defaultOptions.bitDepth).toBe(16);
            expect(defaultOptions.chunkSize).toBe(4096);
            expect(defaultOptions.overwrite).toBe(false);
        });
    });
    
    describe('Single File Processing', () => {
        test('should process WAV file successfully', async () => {
            // Mock file access
            mockFs.access.mockResolvedValue(undefined);
            
            // Create mock WAV buffer
            const wavBuffer = createMockWavBuffer([0.5, -0.5, 0.25, -0.25]);
            mockFs.readFile.mockResolvedValue(wavBuffer);
            
            // Define processing function
            const processingFn = jest.fn((chunk: Float32Array) => {
                return { averageAmplitude: chunk.reduce((sum, val) => sum + Math.abs(val), 0) / chunk.length };
            });
            
            const result = await processor.processFile('test.wav', processingFn);
            
            expect(result.success).toBe(true);
            expect(result.inputFile).toBe('test.wav');
            expect(result.samples).toBe(4);
            expect(result.sampleRate).toBe(44100);
            expect(result.analysisData).toHaveLength(1); // One chunk
            expect(processingFn).toHaveBeenCalled();
        });
        
        test('should handle file access errors', async () => {
            mockFs.access.mockRejectedValue(new Error('File not found'));
            
            const processingFn = jest.fn();
            const result = await processor.processFile('nonexistent.wav', processingFn);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('File not found');
            expect(result.samples).toBe(0);
            expect(processingFn).not.toHaveBeenCalled();
        });
        
        test('should handle unsupported file formats', async () => {
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(Buffer.alloc(100));
            
            const processingFn = jest.fn();
            const result = await processor.processFile('test.xyz', processingFn);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported file format');
        });
        
        test('should process file in chunks', async () => {
            mockFs.access.mockResolvedValue(undefined);
            
            // Create larger buffer that will be split into chunks
            const wavBuffer = createMockWavBuffer(new Array(10000).fill(0).map((_, i) => i / 10000));
            mockFs.readFile.mockResolvedValue(wavBuffer);
            
            const processingFn = jest.fn((chunk: Float32Array) => chunk.length);
            
            const result = await processor.processFile('large.wav', processingFn, { chunkSize: 2048 });
            
            expect(result.success).toBe(true);
            expect(processingFn.mock.calls.length).toBeGreaterThan(1);
            
            // Check chunk sizes
            const chunkSizes = processingFn.mock.calls.map(call => call[0].length);
            expect(chunkSizes[0]).toBe(2048);
            expect(chunkSizes[chunkSizes.length - 1]).toBeLessThanOrEqual(2048);
        });
    });
    
    describe('Batch File Processing', () => {
        test('should process multiple files', async () => {
            const filePaths = ['file1.wav', 'file2.wav', 'file3.wav'];
            
            mockFs.access.mockResolvedValue(undefined);
            
            // Mock different audio data for each file
            mockFs.readFile
                .mockResolvedValueOnce(createMockWavBuffer([0.1, 0.2]))
                .mockResolvedValueOnce(createMockWavBuffer([0.3, 0.4]))
                .mockResolvedValueOnce(createMockWavBuffer([0.5, 0.6]));
            
            const processingFn = jest.fn((chunk: Float32Array, metadata) => {
                return { fileName: metadata.fileName, maxAmplitude: Math.max(...chunk.map(Math.abs)) };
            });
            
            const results = await processor.processFiles(filePaths, processingFn);
            
            expect(results).toHaveLength(3);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
            expect(results[2].success).toBe(true);
            
            expect(processingFn).toHaveBeenCalledTimes(3);
            
            // Check metadata passed to processing function
            expect(processingFn.mock.calls[0][1]).toEqual({ fileName: 'file1.wav', index: 0 });
            expect(processingFn.mock.calls[1][1]).toEqual({ fileName: 'file2.wav', index: 1 });
            expect(processingFn.mock.calls[2][1]).toEqual({ fileName: 'file3.wav', index: 2 });
        });
        
        test('should handle mixed success and failure', async () => {
            const filePaths = ['good.wav', 'bad.wav'];
            
            mockFs.access
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('File not found'));
            
            mockFs.readFile.mockResolvedValueOnce(createMockWavBuffer([0.1, 0.2]));
            
            const processingFn = jest.fn((chunk: Float32Array) => ({ processed: true }));
            
            const results = await processor.processFiles(filePaths, processingFn);
            
            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
            expect(results[1].error).toBe('File not found');
        });
    });
    
    describe('Directory Processing', () => {
        test('should process all audio files in directory', async () => {
            const directoryFiles = ['audio1.wav', 'audio2.mp3', 'document.txt', 'audio3.flac'];
            mockFs.readdir.mockResolvedValue(directoryFiles);
            
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(createMockWavBuffer([0.1, 0.2]));
            
            const processingFn = jest.fn((chunk: Float32Array) => ({ processed: true }));
            
            const results = await processor.processDirectory('/test/directory', processingFn);
            
            // Should only process audio files (wav, mp3, flac), not txt
            expect(results).toHaveLength(3);
            expect(mockFs.readFile).toHaveBeenCalledTimes(3);
        });
        
        test('should handle directory read errors', async () => {
            mockFs.readdir.mockRejectedValue(new Error('Directory not found'));
            
            const processingFn = jest.fn();
            
            await expect(processor.processDirectory('/nonexistent', processingFn))
                .rejects.toThrow('Failed to process directory');
        });
    });
    
    describe('Stream Processing', () => {
        test('should process audio stream', async () => {
            const mockStream = new Readable({
                read() {
                    this.push(Buffer.from([1, 0, 2, 0, 3, 0, 4, 0])); // 4 samples
                    this.push(null);
                }
            });
            
            const createReadStreamMock = createReadStream as jest.MockedFunction<typeof createReadStream>;
            createReadStreamMock.mockReturnValue(mockStream as any);
            
            const { pipeline } = require('stream/promises');
            pipeline.mockResolvedValue(undefined);
            
            const processingFn = jest.fn((chunk: Float32Array) => {
                return { analysisData: { sampleCount: chunk.length } };
            });
            
            const result = await processor.streamProcess('test.wav', processingFn);
            
            expect(result.success).toBe(true);
            expect(result.inputFile).toBe('test.wav');
            expect(pipeline).toHaveBeenCalled();
        });
        
        test('should handle stream processing errors', async () => {
            const { pipeline } = require('stream/promises');
            pipeline.mockRejectedValue(new Error('Stream error'));
            
            const mockStream = new Readable({ read() {} });
            const createReadStreamMock = createReadStream as jest.MockedFunction<typeof createReadStream>;
            createReadStreamMock.mockReturnValue(mockStream as any);
            
            const processingFn = jest.fn();
            
            const result = await processor.streamProcess('test.wav', processingFn);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Stream error');
        });
        
        test('should handle output to file', async () => {
            const mockReadStream = new Readable({ read() { this.push(null); } });
            const mockWriteStream = { write: jest.fn(), end: jest.fn() };
            
            const createReadStreamMock = createReadStream as jest.MockedFunction<typeof createReadStream>;
            const createWriteStreamMock = createWriteStream as jest.MockedFunction<typeof createWriteStream>;
            
            createReadStreamMock.mockReturnValue(mockReadStream as any);
            createWriteStreamMock.mockReturnValue(mockWriteStream as any);
            
            const { pipeline } = require('stream/promises');
            pipeline.mockResolvedValue(undefined);
            
            const processingFn = jest.fn(() => ({
                processedChunk: new Float32Array([0.1, 0.2])
            }));
            
            const result = await processor.streamProcess('input.wav', processingFn, 'output.wav');
            
            expect(result.outputFile).toBe('output.wav');
            expect(createWriteStreamMock).toHaveBeenCalledWith('output.wav');
        });
        
        test('should throw error for non-WAV streaming', async () => {
            const processingFn = jest.fn();
            
            await expect(processor.streamProcess('test.mp3', processingFn))
                .rejects.toThrow('Streaming not implemented for compressed formats');
        });
    });
    
    describe('WAV File Decoding', () => {
        test('should decode 16-bit WAV file', () => {
            const samples = [0.5, -0.5, 1.0, -1.0];
            const wavBuffer = createMockWavBuffer(samples, 16);
            
            const decoded = processor['decodeWav'](wavBuffer, {});
            
            expect(decoded).toBeInstanceOf(Float32Array);
            expect(decoded.length).toBe(samples.length);
            
            for (let i = 0; i < samples.length; i++) {
                expect(decoded[i]).toBeCloseTo(samples[i], 3);
            }
        });
        
        test('should decode 24-bit WAV file', () => {
            const samples = [0.5, -0.5];
            const wavBuffer = createMockWavBuffer(samples, 24);
            
            const decoded = processor['decodeWav'](wavBuffer, {});
            
            expect(decoded).toBeInstanceOf(Float32Array);
            expect(decoded.length).toBe(samples.length);
        });
        
        test('should decode 32-bit float WAV file', () => {
            const samples = [0.5, -0.5];
            const wavBuffer = createMockWavBuffer(samples, 32);
            
            const decoded = processor['decodeWav'](wavBuffer, {});
            
            expect(decoded).toBeInstanceOf(Float32Array);
            expect(decoded.length).toBe(samples.length);
        });
    });
    
    describe('FFmpeg Integration', () => {
        test('should decode compressed files with FFmpeg', async () => {
            const ffmpeg = require('fluent-ffmpeg');
            const mockInstance = {
                format: jest.fn().mockReturnThis(),
                audioChannels: jest.fn().mockReturnThis(),
                audioFrequency: jest.fn().mockReturnThis(),
                on: jest.fn((event, callback) => {
                    if (event === 'end') {
                        setTimeout(() => callback(), 0);
                    }
                    return mockInstance;
                }),
                pipe: jest.fn()
            };
            ffmpeg.mockReturnValue(mockInstance);
            
            // Mock the WAV decoder
            const mockWavData = new Float32Array([0.1, 0.2, 0.3]);
            processor['decodeWav'] = jest.fn().mockReturnValue(mockWavData);
            
            const buffer = Buffer.alloc(100);
            const result = await processor['decodeWithFFmpeg'](buffer, 'test.mp3', { channels: 1, sampleRate: 44100 });
            
            expect(result).toBe(mockWavData);
            expect(ffmpeg).toHaveBeenCalled();
            expect(mockInstance.format).toHaveBeenCalledWith('wav');
            expect(mockInstance.audioChannels).toHaveBeenCalledWith(1);
            expect(mockInstance.audioFrequency).toHaveBeenCalledWith(44100);
        });
        
        test('should handle FFmpeg errors', async () => {
            const ffmpeg = require('fluent-ffmpeg');
            const mockInstance = {
                format: jest.fn().mockReturnThis(),
                audioChannels: jest.fn().mockReturnThis(),
                audioFrequency: jest.fn().mockReturnThis(),
                on: jest.fn((event, callback) => {
                    if (event === 'error') {
                        setTimeout(() => callback(new Error('FFmpeg error')), 0);
                    }
                    return mockInstance;
                }),
                pipe: jest.fn()
            };
            ffmpeg.mockReturnValue(mockInstance);
            
            const buffer = Buffer.alloc(100);
            
            await expect(processor['decodeWithFFmpeg'](buffer, 'test.mp3', {}))
                .rejects.toThrow('FFmpeg error');
        });
        
        test('should handle missing FFmpeg', async () => {
            // Mock require to throw error
            const originalRequire = require;
            (global as any).require = jest.fn((module) => {
                if (module === 'fluent-ffmpeg') {
                    throw new Error('Module not found');
                }
                return originalRequire(module);
            });
            
            const buffer = Buffer.alloc(100);
            
            await expect(processor['decodeWithFFmpeg'](buffer, 'test.mp3', {}))
                .rejects.toThrow('FFmpeg not available');
            
            (global as any).require = originalRequire;
        });
    });
    
    describe('Buffer Conversion', () => {
        test('should convert Buffer to Float32Array', () => {
            const buffer = Buffer.alloc(8);
            buffer.writeInt16LE(16384, 0);  // 0.5
            buffer.writeInt16LE(-16384, 2); // -0.5
            buffer.writeInt16LE(32767, 4);  // ~1.0
            buffer.writeInt16LE(-32768, 6); // -1.0
            
            const samples = processor['bufferToFloat32Array'](buffer);
            
            expect(samples).toBeInstanceOf(Float32Array);
            expect(samples.length).toBe(4);
            expect(samples[0]).toBeCloseTo(0.5, 3);
            expect(samples[1]).toBeCloseTo(-0.5, 3);
            expect(samples[2]).toBeCloseTo(1.0, 3);
            expect(samples[3]).toBeCloseTo(-1.0, 3);
        });
        
        test('should convert Float32Array to Buffer', () => {
            const samples = new Float32Array([0.5, -0.5, 1.0, -1.0, 2.0]); // Last value should be clamped
            
            const buffer = processor['float32ArrayToBuffer'](samples);
            
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBe(samples.length * 2);
            
            // Check converted values
            expect(buffer.readInt16LE(0)).toBeCloseTo(16384, 0);   // 0.5 * 32767
            expect(buffer.readInt16LE(2)).toBeCloseTo(-16384, 0);  // -0.5 * 32767
            expect(buffer.readInt16LE(4)).toBeCloseTo(32767, 0);   // 1.0 * 32767
            expect(buffer.readInt16LE(6)).toBeCloseTo(-32767, 0);  // -1.0 * 32767
            expect(buffer.readInt16LE(8)).toBeCloseTo(32767, 0);   // 2.0 clamped to 1.0
        });
    });
    
    describe('File Type Detection', () => {
        test('should identify audio files correctly', () => {
            const audioFiles = ['test.wav', 'test.mp3', 'test.flac', 'test.m4a', 'test.ogg'];
            const nonAudioFiles = ['test.txt', 'test.pdf', 'test.doc'];
            
            audioFiles.forEach(file => {
                expect(processor['isAudioFile'](file)).toBe(true);
            });
            
            nonAudioFiles.forEach(file => {
                expect(processor['isAudioFile'](file)).toBe(false);
            });
        });
        
        test('should handle case insensitive extensions', () => {
            expect(processor['isAudioFile']('TEST.WAV')).toBe(true);
            expect(processor['isAudioFile']('Test.Mp3')).toBe(true);
            expect(processor['isAudioFile']('test.FLAC')).toBe(true);
        });
    });
    
    describe('Export Functions', () => {
        test('should export results to JSON', async () => {
            const results: ProcessingResult[] = [
                {
                    inputFile: 'test1.wav',
                    duration: 1.0,
                    samples: 44100,
                    sampleRate: 44100,
                    success: true
                },
                {
                    inputFile: 'test2.wav',
                    duration: 0,
                    samples: 0,
                    sampleRate: 44100,
                    success: false,
                    error: 'File not found'
                }
            ];
            
            await processor.exportResults(results, 'output.json');
            
            expect(mockFs.writeFile).toHaveBeenCalledWith(
                'output.json',
                JSON.stringify(results, null, 2),
                'utf8'
            );
        });
        
        test('should export results to CSV', async () => {
            const results: ProcessingResult[] = [
                {
                    inputFile: '/path/to/test1.wav',
                    duration: 1.0,
                    samples: 44100,
                    sampleRate: 44100,
                    success: true
                },
                {
                    inputFile: '/path/to/test2.wav',
                    duration: 0,
                    samples: 0,
                    sampleRate: 44100,
                    success: false,
                    error: 'File not found'
                }
            ];
            
            await processor.exportResultsCSV(results, 'output.csv');
            
            const expectedCSV = [
                'fileName,duration,samples,sampleRate,success,error',
                'test1.wav,1,44100,44100,true,',
                'test2.wav,0,0,44100,false,File not found'
            ].join('\n');
            
            expect(mockFs.writeFile).toHaveBeenCalledWith('output.csv', expectedCSV, 'utf8');
        });
    });
    
    describe('Supported Formats', () => {
        test('should return supported formats', () => {
            const formats = processor.getSupportedFormats();
            
            expect(formats.input).toEqual(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac']);
            expect(formats.output).toEqual(['.wav', '.mp3', '.flac']);
        });
    });
});

// Helper function to create mock WAV buffer
function createMockWavBuffer(samples: number[], bitDepth: number = 16): Buffer {
    const headerSize = 44;
    const bytesPerSample = bitDepth / 8;
    const dataSize = samples.length * bytesPerSample;
    const buffer = Buffer.alloc(headerSize + dataSize);
    
    // Write basic WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // fmt chunk size
    buffer.writeUInt16LE(1, 20);  // audio format (PCM)
    buffer.writeUInt16LE(1, 22);  // number of channels
    buffer.writeUInt32LE(44100, 24); // sample rate
    buffer.writeUInt32LE(44100 * bytesPerSample, 28); // byte rate
    buffer.writeUInt16LE(bytesPerSample, 32); // block align
    buffer.writeUInt16LE(bitDepth, 34); // bits per sample
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    
    // Write sample data
    for (let i = 0; i < samples.length; i++) {
        const offset = headerSize + i * bytesPerSample;
        
        if (bitDepth === 16) {
            const intValue = Math.round(samples[i] * 32767);
            buffer.writeInt16LE(intValue, offset);
        } else if (bitDepth === 24) {
            const intValue = Math.round(samples[i] * 8388607);
            buffer[offset] = intValue & 0xFF;
            buffer[offset + 1] = (intValue >> 8) & 0xFF;
            buffer[offset + 2] = (intValue >> 16) & 0xFF;
        } else if (bitDepth === 32) {
            buffer.writeFloatLE(samples[i], offset);
        }
    }
    
    return buffer;
}