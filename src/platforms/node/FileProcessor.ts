/**
 * File processing utilities for Node.js platform
 * Handles batch processing and file format support
 */

import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { join, extname, basename } from 'path';

export interface FileProcessingOptions {
    inputFormat?: string;
    outputFormat?: string;
    sampleRate?: number;
    channels?: number;
    bitDepth?: number;
    chunkSize?: number;
    overwrite?: boolean;
}

export interface ProcessingResult {
    inputFile: string;
    outputFile?: string;
    duration: number;
    samples: number;
    sampleRate: number;
    success: boolean;
    error?: string;
    analysisData?: any;
}

export class FileProcessor {
    private sampleRate: number;
    private defaultOptions: FileProcessingOptions;
    
    constructor(sampleRate: number = 44100) {
        this.sampleRate = sampleRate;
        this.defaultOptions = {
            sampleRate,
            channels: 1,
            bitDepth: 16,
            chunkSize: 4096,
            overwrite: false
        };
    }
    
    /**
     * Process a single audio file
     * @param inputPath Path to input file
     * @param processingFn Function to process audio chunks
     * @param options Processing options
     * @returns Processing result
     */
    public async processFile<T>(
        inputPath: string,
        processingFn: (chunk: Float32Array) => T,
        options?: FileProcessingOptions
    ): Promise<ProcessingResult & { analysisData: T[] }> {
        const opts = { ...this.defaultOptions, ...options };
        
        try {
            // Verify input file exists
            await fs.access(inputPath);
            
            // Read and decode audio file
            const audioBuffer = await this.readAudioFile(inputPath, opts);
            
            // Process in chunks
            const results: T[] = [];
            const chunkSize = opts.chunkSize!;
            
            for (let i = 0; i < audioBuffer.length; i += chunkSize) {
                const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
                const result = processingFn(chunk);
                results.push(result);
            }
            
            return {
                inputFile: inputPath,
                duration: audioBuffer.length / opts.sampleRate!,
                samples: audioBuffer.length,
                sampleRate: opts.sampleRate!,
                success: true,
                analysisData: results
            };
            
        } catch (error) {
            return {
                inputFile: inputPath,
                duration: 0,
                samples: 0,
                sampleRate: opts.sampleRate!,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                analysisData: []
            };
        }
    }
    
    /**
     * Process multiple files in batch
     * @param inputPaths Array of input file paths
     * @param processingFn Function to process audio chunks
     * @param options Processing options
     * @returns Array of processing results
     */
    public async processFiles<T>(
        inputPaths: string[],
        processingFn: (chunk: Float32Array, metadata: { fileName: string; index: number }) => T,
        options?: FileProcessingOptions
    ): Promise<Array<ProcessingResult & { analysisData: T[] }>> {
        const results: Array<ProcessingResult & { analysisData: T[] }> = [];
        
        for (let i = 0; i < inputPaths.length; i++) {
            const inputPath = inputPaths[i];
            const fileName = basename(inputPath);
            
            console.log(`Processing file ${i + 1}/${inputPaths.length}: ${fileName}`);
            
            const result = await this.processFile(
                inputPath,
                (chunk) => processingFn(chunk, { fileName, index: i }),
                options
            );
            
            results.push(result);
        }
        
        return results;
    }
    
    /**
     * Process files from directory
     * @param directoryPath Path to directory containing audio files
     * @param processingFn Function to process audio chunks
     * @param options Processing options
     * @returns Array of processing results
     */
    public async processDirectory<T>(
        directoryPath: string,
        processingFn: (chunk: Float32Array, metadata: { fileName: string; index: number }) => T,
        options?: FileProcessingOptions
    ): Promise<Array<ProcessingResult & { analysisData: T[] }>> {
        try {
            const files = await fs.readdir(directoryPath);
            const audioFiles = files.filter(file => this.isAudioFile(file));
            const fullPaths = audioFiles.map(file => join(directoryPath, file));
            
            return this.processFiles(fullPaths, processingFn, options);
            
        } catch (error) {
            throw new Error(`Failed to process directory: ${error}`);
        }
    }
    
    /**
     * Stream processing for very large files
     * @param inputPath Path to input file
     * @param processingFn Function to process audio chunks
     * @param outputPath Optional output path for processed audio
     * @param options Processing options
     */
    public async streamProcess<T>(
        inputPath: string,
        processingFn: (chunk: Float32Array) => { processedChunk?: Float32Array; analysisData?: T },
        outputPath?: string,
        options?: FileProcessingOptions
    ): Promise<ProcessingResult & { analysisData: T[] }> {
        const opts = { ...this.defaultOptions, ...options };
        const results: T[] = [];
        let sampleCount = 0;
        
        try {
            await new Promise<void>((resolve, reject) => {
                const audioStream = this.createAudioReadStream(inputPath, opts);
                
                const processingStream = new Transform({
                    objectMode: false,
                    transform: ((chunk: Buffer, encoding, callback) => {
                        try {
                            // Convert buffer to Float32Array
                            const audioChunk = this.bufferToFloat32Array(chunk);
                            sampleCount += audioChunk.length;
                            
                            const result = processingFn(audioChunk);
                            
                            if (result.analysisData) {
                                results.push(result.analysisData);
                            }
                            
                            // Pass through processed audio if available
                            if (result.processedChunk) {
                                const outputBuffer = this.float32ArrayToBuffer(result.processedChunk);
                                callback(null, outputBuffer);
                            } else {
                                callback(null, chunk);
                            }
                        } catch (error) {
                            callback(error);
                        }
                    }).bind(this)
                });
                
                if (outputPath) {
                    const outputStream = createWriteStream(outputPath);
                    pipeline(audioStream, processingStream, outputStream)
                        .then(resolve)
                        .catch(reject);
                } else {
                    pipeline(audioStream, processingStream)
                        .then(resolve)
                        .catch(reject);
                }
            });
            
            return {
                inputFile: inputPath,
                outputFile: outputPath,
                duration: sampleCount / opts.sampleRate!,
                samples: sampleCount,
                sampleRate: opts.sampleRate!,
                success: true,
                analysisData: results
            };
            
        } catch (error) {
            return {
                inputFile: inputPath,
                outputFile: outputPath,
                duration: 0,
                samples: 0,
                sampleRate: opts.sampleRate!,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                analysisData: results
            };
        }
    }
    
    /**
     * Read entire audio file into memory
     * @param filePath Path to audio file
     * @param options Processing options
     * @returns Audio data as Float32Array
     */
    private async readAudioFile(filePath: string, options: FileProcessingOptions): Promise<Float32Array> {
        const buffer = await fs.readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.wav':
                return this.decodeWav(buffer, options);
            case '.mp3':
            case '.m4a':
            case '.flac':
            case '.ogg':
                return this.decodeWithFFmpeg(buffer, filePath, options);
            default:
                throw new Error(`Unsupported file format: ${ext}`);
        }
    }
    
    /**
     * Create audio read stream
     * @param filePath Path to audio file
     * @param options Processing options
     * @returns Readable stream
     */
    private createAudioReadStream(filePath: string, options: FileProcessingOptions): Readable {
        const ext = extname(filePath).toLowerCase();
        
        if (ext === '.wav') {
            // For WAV files, skip header and stream raw PCM data
            const stream = createReadStream(filePath, { start: 44 });
            return stream;
        } else {
            // For other formats, would need ffmpeg streaming
            throw new Error('Streaming not implemented for compressed formats');
        }
    }
    
    /**
     * Decode WAV file
     * @param buffer File buffer
     * @param options Processing options
     * @returns Audio data
     */
    private decodeWav(buffer: Buffer, options: FileProcessingOptions): Float32Array {
        // Simple WAV decoder
        const dataOffset = 44;
        const dataLength = buffer.length - dataOffset;
        
        // Read header information
        const channels = buffer.readUInt16LE(22);
        const sampleRate = buffer.readUInt32LE(24);
        const bitsPerSample = buffer.readUInt16LE(34);
        
        const bytesPerSample = bitsPerSample / 8;
        const sampleCount = dataLength / (bytesPerSample * channels);
        
        const samples = new Float32Array(sampleCount);
        
        for (let i = 0; i < sampleCount; i++) {
            let sample = 0;
            
            if (bitsPerSample === 16) {
                sample = buffer.readInt16LE(dataOffset + i * bytesPerSample * channels) / 32768;
            } else if (bitsPerSample === 24) {
                const byte1 = buffer[dataOffset + i * bytesPerSample * channels];
                const byte2 = buffer[dataOffset + i * bytesPerSample * channels + 1];
                const byte3 = buffer[dataOffset + i * bytesPerSample * channels + 2];
                sample = ((byte3 << 16) | (byte2 << 8) | byte1) / 8388608;
            } else if (bitsPerSample === 32) {
                sample = buffer.readFloatLE(dataOffset + i * bytesPerSample * channels);
            }
            
            samples[i] = sample;
        }
        
        return samples;
    }
    
    /**
     * Decode audio using FFmpeg
     * @param buffer File buffer
     * @param filePath Original file path
     * @param options Processing options
     * @returns Audio data
     */
    private async decodeWithFFmpeg(
        buffer: Buffer, 
        filePath: string, 
        options: FileProcessingOptions
    ): Promise<Float32Array> {
        try {
            const ffmpeg = require('fluent-ffmpeg');
            
            return new Promise((resolve, reject) => {
                const stream = new Readable();
                stream.push(buffer);
                stream.push(null);
                
                const chunks: Buffer[] = [];
                
                ffmpeg(stream)
                    .format('wav')
                    .audioChannels(options.channels || 1)
                    .audioFrequency(options.sampleRate || 44100)
                    .on('data', (chunk: Buffer) => {
                        chunks.push(chunk);
                    })
                    .on('end', () => {
                        const combinedBuffer = Buffer.concat(chunks);
                        const samples = this.decodeWav(combinedBuffer, options);
                        resolve(samples);
                    })
                    .on('error', reject)
                    .pipe();
            });
            
        } catch (error) {
            throw new Error(`FFmpeg not available: ${error}`);
        }
    }
    
    /**
     * Convert Buffer to Float32Array
     * @param buffer Input buffer
     * @returns Float32Array
     */
    private bufferToFloat32Array(buffer: Buffer): Float32Array {
        const samples = new Float32Array(buffer.length / 2);
        
        for (let i = 0; i < samples.length; i++) {
            samples[i] = buffer.readInt16LE(i * 2) / 32768;
        }
        
        return samples;
    }
    
    /**
     * Convert Float32Array to Buffer
     * @param samples Float32Array
     * @returns Buffer
     */
    private float32ArrayToBuffer(samples: Float32Array): Buffer {
        const buffer = Buffer.alloc(samples.length * 2);
        
        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            buffer.writeInt16LE(Math.round(sample * 32767), i * 2);
        }
        
        return buffer;
    }
    
    /**
     * Check if file is an audio file
     * @param fileName File name
     * @returns True if audio file
     */
    private isAudioFile(fileName: string): boolean {
        const ext = extname(fileName).toLowerCase();
        const audioExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.wma'];
        return audioExtensions.includes(ext);
    }
    
    /**
     * Export analysis results to JSON
     * @param results Processing results
     * @param outputPath Output file path
     */
    public async exportResults(results: ProcessingResult[], outputPath: string): Promise<void> {
        const jsonData = JSON.stringify(results, null, 2);
        await fs.writeFile(outputPath, jsonData, 'utf8');
    }
    
    /**
     * Export analysis results to CSV
     * @param results Processing results
     * @param outputPath Output file path
     */
    public async exportResultsCSV(results: ProcessingResult[], outputPath: string): Promise<void> {
        const headers = ['fileName', 'duration', 'samples', 'sampleRate', 'success', 'error'];
        const csvRows = [headers.join(',')];
        
        for (const result of results) {
            const row = [
                basename(result.inputFile),
                result.duration.toString(),
                result.samples.toString(),
                result.sampleRate.toString(),
                result.success.toString(),
                result.error || ''
            ];
            csvRows.push(row.join(','));
        }
        
        await fs.writeFile(outputPath, csvRows.join('\n'), 'utf8');
    }
    
    /**
     * Get supported file formats
     */
    public getSupportedFormats(): { input: string[]; output: string[] } {
        return {
            input: ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'],
            output: ['.wav', '.mp3', '.flac']
        };
    }
}

export default FileProcessor;