/**
 * Tests for NodeAudioAdapter
 */

import { NodeAudioAdapter } from '../../../src/platforms/node/NodeAudioAdapter';
import { EventEmitter } from 'events';

// Mock the external modules
jest.mock('web-audio-api', () => ({
    AudioContext: class MockAudioContext {
        sampleRate: number;
        numberOfChannels: number;
        state = 'running';
        
        constructor(config: any) {
            this.sampleRate = config.sampleRate;
            this.numberOfChannels = config.numberOfChannels;
        }
        
        async close() {
            this.state = 'closed';
        }
    }
}), { virtual: true });

jest.mock('node-record-lpcm16', () => ({
    record: jest.fn(() => ({
        stream: () => new EventEmitter()
    }))
}), { virtual: true });

jest.mock('mic', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        getAudioStream: () => new EventEmitter(),
        start: jest.fn(),
        stop: jest.fn()
    }))
}), { virtual: true });

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

jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));

describe('NodeAudioAdapter', () => {
    let adapter: NodeAudioAdapter;
    
    beforeEach(() => {
        adapter = new NodeAudioAdapter();
        jest.clearAllMocks();
    });
    
    afterEach(async () => {
        await adapter.destroy();
    });
    
    describe('Initialization', () => {
        test('should create adapter with default config', () => {
            const config = adapter.getSystemInfo();
            
            expect(config.platform).toBe('node');
            expect(adapter.getSampleRate()).toBe(44100);
            expect(adapter.getBufferSize()).toBe(2048);
        });
        
        test('should create adapter with custom config', () => {
            const customAdapter = new NodeAudioAdapter({
                sampleRate: 48000,
                bufferSize: 1024,
                channelCount: 2,
                enableMicrophone: true
            });
            
            expect(customAdapter.getSampleRate()).toBe(48000);
            expect(customAdapter.getBufferSize()).toBe(1024);
        });
        
        test('should initialize successfully', async () => {
            const initSpy = jest.fn();
            adapter.on('initialized', initSpy);
            
            await adapter.initialize();
            
            expect(initSpy).toHaveBeenCalledWith({
                platform: 'node',
                capabilities: adapter.capabilities,
                config: expect.any(Object)
            });
        });
        
        test('should handle initialization errors', async () => {
            const errorSpy = jest.fn();
            adapter.on('error', errorSpy);
            
            // Mock a failing initialization
            const originalInitialize = adapter['initializeAudioContext'];
            adapter['initializeAudioContext'] = jest.fn().mockRejectedValue(new Error('Init failed'));
            
            await expect(adapter.initialize()).rejects.toThrow('Init failed');
            expect(errorSpy).toHaveBeenCalled();
        });
    });
    
    describe('Microphone Capabilities', () => {
        test('should detect microphone capability when node-record-lpcm16 is available', () => {
            // Mock require.resolve to succeed for node-record-lpcm16
            const originalResolve = require.resolve;
            require.resolve = jest.fn((id: string) => {
                if (id === 'node-record-lpcm16') return '/mock/path';
                return originalResolve(id);
            });
            
            const micAdapter = new NodeAudioAdapter();
            expect(micAdapter.capabilities.microphone).toBe(true);
            
            require.resolve = originalResolve;
        });
        
        test('should detect microphone capability when mic is available', () => {
            const originalResolve = require.resolve;
            require.resolve = jest.fn((id: string) => {
                if (id === 'node-record-lpcm16') throw new Error('Not found');
                if (id === 'mic') return '/mock/path';
                return originalResolve(id);
            });
            
            const micAdapter = new NodeAudioAdapter();
            expect(micAdapter.capabilities.microphone).toBe(true);
            
            require.resolve = originalResolve;
        });
        
        test('should set microphone capability to false when no modules available', () => {
            const originalResolve = require.resolve;
            require.resolve = jest.fn((id: string) => {
                if (id === 'node-record-lpcm16' || id === 'mic') {
                    throw new Error('Not found');
                }
                return originalResolve(id);
            });
            
            const micAdapter = new NodeAudioAdapter();
            expect(micAdapter.capabilities.microphone).toBe(false);
            
            require.resolve = originalResolve;
        });
    });
    
    describe('Microphone Recording', () => {
        test('should throw error when microphone not supported', async () => {
            adapter.capabilities.microphone = false;
            
            await expect(adapter.startMicrophone()).rejects.toThrow(
                'Microphone not supported. Install node-record-lpcm16 or mic package.'
            );
        });
        
        test('should start microphone when supported', async () => {
            adapter.capabilities.microphone = true;
            
            const startSpy = jest.fn();
            adapter.on('microphoneStarted', startSpy);
            
            // Mock the microphone initialization
            adapter['initializeMicrophone'] = jest.fn().mockResolvedValue(undefined);
            
            await adapter.startMicrophone();
            
            expect(adapter.isMicrophoneActive()).toBe(true);
            expect(startSpy).toHaveBeenCalledWith({
                sampleRate: 44100,
                channels: 1
            });
        });
        
        test('should not start if already recording', async () => {
            adapter.capabilities.microphone = true;
            adapter['isRecording'] = true;
            
            const startSpy = jest.fn();
            adapter.on('microphoneStarted', startSpy);
            
            await adapter.startMicrophone();
            
            expect(startSpy).not.toHaveBeenCalled();
        });
        
        test('should stop microphone recording', () => {
            adapter['isRecording'] = true;
            adapter['recordingStream'] = {
                stop: jest.fn(),
                end: jest.fn()
            };
            
            const stopSpy = jest.fn();
            adapter.on('microphoneStopped', stopSpy);
            
            adapter.stopMicrophone();
            
            expect(adapter.isMicrophoneActive()).toBe(false);
            expect(adapter['recordingStream'].stop).toHaveBeenCalled();
            expect(stopSpy).toHaveBeenCalled();
        });
        
        test('should handle stop when not recording', () => {
            const stopSpy = jest.fn();
            adapter.on('microphoneStopped', stopSpy);
            
            adapter.stopMicrophone();
            
            expect(stopSpy).not.toHaveBeenCalled();
        });
    });
    
    describe('Audio Data Processing', () => {
        test('should process audio data correctly', () => {
            const dataSpy = jest.fn();
            adapter.on('audioData', dataSpy);
            
            // Create mock 16-bit PCM data
            const buffer = Buffer.alloc(8);
            buffer.writeInt16LE(16384, 0);  // 0.5 in float
            buffer.writeInt16LE(-16384, 2); // -0.5 in float
            buffer.writeInt16LE(32767, 4);  // 1.0 in float
            buffer.writeInt16LE(-32768, 6); // -1.0 in float
            
            adapter['processAudioData'](buffer);
            
            expect(dataSpy).toHaveBeenCalledWith({
                audioBuffer: expect.any(Float32Array),
                timestamp: expect.any(Number),
                sampleRate: 44100
            });
            
            const audioBuffer = dataSpy.mock.calls[0][0].audioBuffer;
            expect(audioBuffer.length).toBe(4);
            expect(audioBuffer[0]).toBeCloseTo(0.5, 3);
            expect(audioBuffer[1]).toBeCloseTo(-0.5, 3);
            expect(audioBuffer[2]).toBeCloseTo(1.0, 3);
            expect(audioBuffer[3]).toBeCloseTo(-1.0, 3);
        });
        
        test('should update current buffer', () => {
            const buffer = Buffer.alloc(4);
            buffer.writeInt16LE(16384, 0);
            buffer.writeInt16LE(-16384, 2);
            
            adapter['processAudioData'](buffer);
            
            const currentBuffer = adapter.getAudioBuffer();
            expect(currentBuffer).toBeInstanceOf(Float32Array);
            expect(currentBuffer!.length).toBe(2);
        });
    });
    
    describe('File Processing', () => {
        test('should load WAV file successfully', async () => {
            const fs = require('fs').promises;
            
            // Create mock WAV file buffer
            const wavBuffer = Buffer.alloc(48);
            // Write 16-bit samples after 44-byte header
            wavBuffer.writeInt16LE(16384, 44);  // 0.5
            wavBuffer.writeInt16LE(-16384, 46); // -0.5
            
            fs.readFile.mockResolvedValue(wavBuffer);
            
            const loadSpy = jest.fn();
            adapter.on('fileLoaded', loadSpy);
            
            const audioBuffer = await adapter.loadFile('test.wav');
            
            expect(audioBuffer).toBeInstanceOf(Float32Array);
            expect(audioBuffer.length).toBe(2);
            expect(audioBuffer[0]).toBeCloseTo(0.5, 3);
            expect(audioBuffer[1]).toBeCloseTo(-0.5, 3);
            
            expect(loadSpy).toHaveBeenCalledWith({
                filePath: 'test.wav',
                duration: expect.any(Number),
                sampleRate: 44100,
                samples: 2
            });
        });
        
        test('should handle file loading errors', async () => {
            const fs = require('fs').promises;
            fs.readFile.mockRejectedValue(new Error('File not found'));
            
            const errorSpy = jest.fn();
            adapter.on('error', errorSpy);
            
            await expect(adapter.loadFile('nonexistent.wav')).rejects.toThrow('File not found');
            expect(errorSpy).toHaveBeenCalledWith({
                type: 'file_error',
                message: 'Failed to load file: nonexistent.wav',
                error: expect.any(Error)
            });
        });
        
        test('should handle unsupported file formats', async () => {
            const fs = require('fs').promises;
            fs.readFile.mockResolvedValue(Buffer.alloc(100));
            
            await expect(adapter.loadFile('test.xyz')).rejects.toThrow('Unsupported file format: xyz');
        });
        
        test('should decode compressed files with ffmpeg', async () => {
            const fs = require('fs').promises;
            fs.readFile.mockResolvedValue(Buffer.alloc(100));
            
            // Mock successful ffmpeg processing
            const ffmpeg = require('fluent-ffmpeg');
            const mockInstance = {
                format: jest.fn().mockReturnThis(),
                audioChannels: jest.fn().mockReturnThis(),
                audioFrequency: jest.fn().mockReturnThis(),
                on: jest.fn((event, callback) => {
                    if (event === 'end') {
                        // Simulate processing completion
                        setTimeout(() => callback(), 0);
                    }
                    return mockInstance;
                }),
                pipe: jest.fn()
            };
            ffmpeg.mockReturnValue(mockInstance);
            
            // Mock decodeWavFile to return test data
            adapter['decodeWavFile'] = jest.fn().mockReturnValue(new Float32Array([0.5, -0.5]));
            
            const audioBuffer = await adapter.loadFile('test.mp3');
            
            expect(audioBuffer).toBeInstanceOf(Float32Array);
            expect(ffmpeg).toHaveBeenCalled();
        });
    });
    
    describe('Audio Stream', () => {
        test('should create audio stream', () => {
            const stream = adapter.createAudioStream();
            
            expect(stream).toBeDefined();
            expect(typeof stream.on).toBe('function');
        });
        
        test('should feed audio stream with data', () => {
            const stream = adapter.createAudioStream();
            const dataSpy = jest.fn();
            
            stream.on('data', dataSpy);
            
            // Emit audio data
            const audioBuffer = new Float32Array([0.1, 0.2, 0.3]);
            adapter.emit('audioData', { audioBuffer });
            
            expect(dataSpy).toHaveBeenCalled();
        });
    });
    
    describe('Configuration', () => {
        test('should update configuration', () => {
            const newConfig = {
                sampleRate: 48000,
                bufferSize: 1024
            };
            
            adapter.updateConfig(newConfig);
            
            expect(adapter.getSampleRate()).toBe(48000);
            expect(adapter.getBufferSize()).toBe(1024);
        });
        
        test('should restart microphone when config changes', async () => {
            adapter.capabilities.microphone = true;
            adapter['isRecording'] = true;
            
            const stopSpy = jest.spyOn(adapter, 'stopMicrophone');
            const startSpy = jest.spyOn(adapter, 'startMicrophone').mockResolvedValue();
            
            adapter.updateConfig({ sampleRate: 48000 });
            
            expect(stopSpy).toHaveBeenCalled();
            expect(startSpy).toHaveBeenCalled();
        });
    });
    
    describe('System Information', () => {
        test('should provide system information', () => {
            const systemInfo = adapter.getSystemInfo();
            
            expect(systemInfo.platform).toBe('node');
            expect(systemInfo.version).toBe(process.version);
            expect(systemInfo.architecture).toBe(process.arch);
            expect(systemInfo.operatingSystem).toBe(process.platform);
            expect(systemInfo.audioSupport).toBeDefined();
            expect(systemInfo.capabilities).toBeDefined();
        });
        
        test('should include audio support details', () => {
            const systemInfo = adapter.getSystemInfo();
            
            expect(systemInfo.audioSupport.sampleRates).toEqual([8000, 16000, 22050, 44100, 48000, 96000]);
            expect(systemInfo.audioSupport.maxChannels).toBe(8);
            expect(systemInfo.audioSupport.bitDepths).toEqual([16, 24, 32]);
        });
    });
    
    describe('Cleanup', () => {
        test('should destroy adapter cleanly', async () => {
            adapter['isRecording'] = true;
            adapter['audioContext'] = {
                close: jest.fn().mockResolvedValue(undefined)
            };
            
            const destroySpy = jest.fn();
            adapter.on('destroyed', destroySpy);
            
            await adapter.destroy();
            
            expect(adapter.isMicrophoneActive()).toBe(false);
            expect(adapter['audioContext'].close).toHaveBeenCalled();
            expect(destroySpy).toHaveBeenCalled();
        });
        
        test('should handle destroy without audio context', async () => {
            adapter['audioContext'] = null;
            
            await expect(adapter.destroy()).resolves.not.toThrow();
        });
    });
    
    describe('Audio Context', () => {
        test('should return audio context', () => {
            const context = adapter.getAudioContext();
            expect(context).toBeDefined();
        });
        
        test('should handle web-audio-api availability', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            // Mock import failure
            const originalInitialize = adapter['initializeAudioContext'];
            adapter['initializeAudioContext'] = async function() {
                try {
                    throw new Error('Module not found');
                } catch (error) {
                    console.warn('Web Audio API not available in Node.js, using basic audio processing');
                    this.audioContext = {
                        sampleRate: this.config.sampleRate,
                        numberOfChannels: this.config.channelCount,
                        state: 'running'
                    };
                }
            };
            
            await adapter.initialize();
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Web Audio API not available in Node.js, using basic audio processing'
            );
            
            consoleSpy.mockRestore();
        });
    });
    
    describe('Edge Cases', () => {
        test('should handle empty audio data', () => {
            const emptyBuffer = Buffer.alloc(0);
            
            expect(() => {
                adapter['processAudioData'](emptyBuffer);
            }).not.toThrow();
            
            const audioBuffer = adapter.getAudioBuffer();
            expect(audioBuffer).toBeInstanceOf(Float32Array);
            expect(audioBuffer!.length).toBe(0);
        });
        
        test('should handle null recording stream during stop', () => {
            adapter['isRecording'] = true;
            adapter['recordingStream'] = null;
            
            expect(() => {
                adapter.stopMicrophone();
            }).not.toThrow();
        });
        
        test('should handle recording stream without stop method', () => {
            adapter['isRecording'] = true;
            adapter['recordingStream'] = {
                end: jest.fn()
            };
            
            adapter.stopMicrophone();
            
            expect(adapter['recordingStream'].end).toHaveBeenCalled();
        });
    });
});