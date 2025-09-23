/**
 * Node.js platform adapter for audio processing
 * Provides file processing and server-side audio capabilities
 */

import { IPlatformAdapter, AudioConfig, SystemInfo } from '../IPlatformAdapter';
import { EventEmitter } from '../../core/EventEmitter';
import { promises as fs } from 'fs';
import { Readable } from 'stream';

export interface NodeAudioConfig extends AudioConfig {
    enableMicrophone?: boolean;
    audioDriver?: 'default' | 'portaudio' | 'pulse' | 'alsa';
}

export class NodeAudioAdapter extends EventEmitter implements IPlatformAdapter {
    private config: NodeAudioConfig;
    private audioContext: any = null;
    private isRecording: boolean = false;
    private recordingStream: any = null;
    private currentBuffer: Float32Array | null = null;
    
    public readonly capabilities = {
        microphone: false, // Will be set based on available modules
        fileInput: true,
        streaming: true,
        offlineProcessing: true,
        webAssembly: true
    };
    
    constructor(config?: Partial<NodeAudioConfig>) {
        super();
        
        this.config = {
            sampleRate: 44100,
            bufferSize: 2048,
            channelCount: 1,
            bitDepth: 32,
            enableMicrophone: false,
            audioDriver: 'default',
            ...config
        };
        
        // Check for optional microphone capabilities
        this.checkMicrophoneCapabilities();
    }
    
    /**
     * Initialize the Node.js audio adapter
     */
    public async initialize(): Promise<void> {
        try {
            // Initialize audio context (using web-audio-api for Node.js if available)
            await this.initializeAudioContext();
            
            this.emit('initialized', {
                platform: 'node',
                capabilities: this.capabilities,
                config: this.config
            });
            
        } catch (error) {
            this.emit('error', {
                type: 'initialization_error',
                message: 'Failed to initialize Node.js audio adapter',
                error
            });
            throw error;
        }
    }
    
    /**
     * Initialize audio context for Node.js
     */
    private async initializeAudioContext(): Promise<void> {
        try {
            // Try to import web-audio-api for Node.js
            const { AudioContext } = await import('web-audio-api');
            this.audioContext = new AudioContext({
                sampleRate: this.config.sampleRate,
                numberOfChannels: this.config.channelCount
            });
        } catch (error) {
            // Fallback to basic audio processing without Web Audio API
            console.warn('Web Audio API not available in Node.js, using basic audio processing');
            this.audioContext = {
                sampleRate: this.config.sampleRate,
                numberOfChannels: this.config.channelCount,
                state: 'running'
            };
        }
    }
    
    /**
     * Check for microphone capabilities
     */
    private checkMicrophoneCapabilities(): void {
        try {
            // Check for audio recording modules
            require.resolve('node-record-lpcm16');
            this.capabilities.microphone = true;
        } catch {
            try {
                require.resolve('mic');
                this.capabilities.microphone = true;
            } catch {
                // No microphone support available
                this.capabilities.microphone = false;
            }
        }
    }
    
    /**
     * Start microphone recording (if supported)
     */
    public async startMicrophone(): Promise<void> {
        if (!this.capabilities.microphone) {
            throw new Error('Microphone not supported. Install node-record-lpcm16 or mic package.');
        }
        
        if (this.isRecording) {
            return;
        }
        
        try {
            await this.initializeMicrophone();
            this.isRecording = true;
            
            this.emit('microphoneStarted', {
                sampleRate: this.config.sampleRate,
                channels: this.config.channelCount
            });
            
        } catch (error) {
            this.emit('error', {
                type: 'microphone_error',
                message: 'Failed to start microphone',
                error
            });
            throw error;
        }
    }
    
    /**
     * Initialize microphone recording
     */
    private async initializeMicrophone(): Promise<void> {
        try {
            // Try node-record-lpcm16 first
            const record = require('node-record-lpcm16');
            
            this.recordingStream = record.record({
                sampleRateHertz: this.config.sampleRate,
                threshold: 0,
                verbose: false,
                recordProgram: this.config.audioDriver === 'pulse' ? 'rec' : 'sox',
                silence: '1.0',
                channels: this.config.channelCount
            });
            
            this.recordingStream.stream().on('data', (data: Buffer) => {
                this.processAudioData(data);
            });
            
        } catch {
            // Fallback to mic package
            try {
                const mic = require('mic');
                
                const micInstance = mic({
                    rate: this.config.sampleRate,
                    channels: this.config.channelCount,
                    debug: false,
                    exitOnSilence: 6
                });
                
                this.recordingStream = micInstance.getAudioStream();
                micInstance.start();
                
                this.recordingStream.on('data', (data: Buffer) => {
                    this.processAudioData(data);
                });
                
            } catch (error) {
                throw new Error('No supported microphone module found');
            }
        }
    }
    
    /**
     * Process incoming audio data
     */
    private processAudioData(data: Buffer): void {
        // Convert buffer to Float32Array
        const samples = new Float32Array(data.length / 2);
        
        for (let i = 0; i < samples.length; i++) {
            // Convert 16-bit PCM to float
            const sample = data.readInt16LE(i * 2) / 32768;
            samples[i] = sample;
        }
        
        this.currentBuffer = samples;
        
        this.emit('audioData', {
            audioBuffer: samples,
            timestamp: Date.now(),
            sampleRate: this.config.sampleRate
        });
    }
    
    /**
     * Stop microphone recording
     */
    public stopMicrophone(): void {
        if (!this.isRecording) {
            return;
        }
        
        this.isRecording = false;
        
        if (this.recordingStream) {
            if (typeof this.recordingStream.stop === 'function') {
                this.recordingStream.stop();
            } else if (typeof this.recordingStream.end === 'function') {
                this.recordingStream.end();
            }
            this.recordingStream = null;
        }
        
        this.emit('microphoneStopped');
    }
    
    /**
     * Load and process audio file
     */
    public async loadFile(filePath: string): Promise<Float32Array> {
        try {
            // Read file
            const fileBuffer = await fs.readFile(filePath);
            
            // Determine file format and decode
            const audioBuffer = await this.decodeAudioFile(fileBuffer, filePath);
            
            this.emit('fileLoaded', {
                filePath,
                duration: audioBuffer.length / this.config.sampleRate,
                sampleRate: this.config.sampleRate,
                samples: audioBuffer.length
            });
            
            return audioBuffer;
            
        } catch (error) {
            this.emit('error', {
                type: 'file_error',
                message: `Failed to load file: ${filePath}`,
                error
            });
            throw error;
        }
    }
    
    /**
     * Decode audio file to Float32Array
     */
    private async decodeAudioFile(buffer: Buffer, filePath: string): Promise<Float32Array> {
        const ext = filePath.toLowerCase().split('.').pop();
        
        switch (ext) {
            case 'wav':
                return this.decodeWavFile(buffer);
            case 'mp3':
            case 'm4a':
            case 'flac':
            case 'ogg':
                return this.decodeCompressedFile(buffer);
            default:
                throw new Error(`Unsupported file format: ${ext}`);
        }
    }
    
    /**
     * Decode WAV file
     */
    private decodeWavFile(buffer: Buffer): Float32Array {
        // Simple WAV decoder (44-byte header + PCM data)
        const dataOffset = 44;
        const dataLength = buffer.length - dataOffset;
        const sampleCount = dataLength / 2; // 16-bit samples
        
        const samples = new Float32Array(sampleCount);
        
        for (let i = 0; i < sampleCount; i++) {
            const sample = buffer.readInt16LE(dataOffset + i * 2) / 32768;
            samples[i] = sample;
        }
        
        return samples;
    }
    
    /**
     * Decode compressed audio files using ffmpeg
     */
    private async decodeCompressedFile(buffer: Buffer): Promise<Float32Array> {
        try {
            // Try to use ffmpeg via fluent-ffmpeg
            const ffmpeg = require('fluent-ffmpeg');
            
            return new Promise((resolve, reject) => {
                const stream = new Readable();
                stream.push(buffer);
                stream.push(null);
                
                const chunks: Buffer[] = [];
                
                ffmpeg(stream)
                    .format('wav')
                    .audioChannels(this.config.channelCount)
                    .audioFrequency(this.config.sampleRate)
                    .on('data', (chunk: Buffer) => {
                        chunks.push(chunk);
                    })
                    .on('end', () => {
                        const combinedBuffer = Buffer.concat(chunks);
                        const samples = this.decodeWavFile(combinedBuffer);
                        resolve(samples);
                    })
                    .on('error', reject)
                    .pipe();
            });
            
        } catch (error) {
            throw new Error('ffmpeg not available for compressed audio decoding');
        }
    }
    
    /**
     * Create audio stream for real-time processing
     */
    public createAudioStream(): NodeJS.ReadableStream {
        const stream = new Readable({
            objectMode: false,
            read() {
                // Stream will be fed by audio events
            }
        });
        
        this.on('audioData', (event: any) => {
            const buffer = Buffer.from(event.audioBuffer.buffer);
            stream.push(buffer);
        });
        
        return stream;
    }
    
    /**
     * Get audio context
     */
    public getAudioContext(): any {
        return this.audioContext;
    }
    
    /**
     * Get sample rate
     */
    public getSampleRate(): number {
        return this.config.sampleRate;
    }
    
    /**
     * Get buffer size
     */
    public getBufferSize(): number {
        return this.config.bufferSize;
    }
    
    /**
     * Get current audio buffer
     */
    public getAudioBuffer(): Float32Array | null {
        return this.currentBuffer;
    }
    
    /**
     * Check if microphone is active
     */
    public isMicrophoneActive(): boolean {
        return this.isRecording;
    }
    
    /**
     * Get system information
     */
    public getSystemInfo(): SystemInfo {
        return {
            platform: 'node',
            version: process.version,
            architecture: process.arch,
            operatingSystem: process.platform,
            audioSupport: {
                sampleRates: [8000, 16000, 22050, 44100, 48000, 96000],
                maxChannels: 8,
                bitDepths: [16, 24, 32]
            },
            capabilities: this.capabilities
        };
    }
    
    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<NodeAudioConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Restart microphone if config changed and it's active
        if (this.isRecording && (newConfig.sampleRate || newConfig.channelCount)) {
            this.stopMicrophone();
            this.startMicrophone();
        }
    }
    
    /**
     * Cleanup resources
     */
    public async destroy(): Promise<void> {
        this.stopMicrophone();
        
        if (this.audioContext && typeof this.audioContext.close === 'function') {
            await this.audioContext.close();
        }
        
        this.removeAllListeners();
        
        this.emit('destroyed');
    }
}

export default NodeAudioAdapter;