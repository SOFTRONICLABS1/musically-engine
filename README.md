# Musically Engine

A comprehensive, platform-agnostic audio processing SDK for musical note detection and analysis. Works universally across Browser, Node.js, React Native, and Electron platforms.

## 🎵 Features

- **Platform-Agnostic**: Runs on Browser, Node.js, React Native, and Electron
- **Real-time Audio Processing**: Low-latency microphone and file analysis
- **Universal Instrument Support**: Voice, piano, guitar, violin, sitar, flute, and more
- **Multi-System Music Analysis**:
  - Western 12-tone equal temperament
  - Carnatic (South Indian classical) with 16 swarasthanas
  - Hindustani (North Indian classical) with komal/shuddha notes
- **Advanced Features**: Noise reduction, pitch detection, ornament recognition
- **TypeScript Support**: Full type definitions included

## 🚀 Quick Start

### Installation

```bash
npm install @musically-engine/core
```

### Browser Usage

```javascript
import MusicallyEngine from '@musically-engine/browser';

const engine = MusicallyEngine.create({
  sampleRate: 44100,
  musicSystem: 'western',
  audioType: 'auto'
});

await engine.initialize();

// Start real-time analysis
engine.on('analysis', (result) => {
  console.log(`Detected: ${result.western.note} at ${result.frequency}Hz`);
});

await engine.startMicrophone();
```

### Node.js Usage

```javascript
const MusicallyEngine = require('@musically-engine/node');

const engine = MusicallyEngine.create({
  musicSystem: 'carnatic',
  audioType: 'voice'
});

await engine.initialize();

// Process audio file
const results = await engine.processFile('audio.wav');
console.log('Analysis results:', results);
```

## 📋 Current Status - Phase 1 Complete

✅ **Implemented:**
- Multi-platform project structure with TypeScript
- Platform abstraction layer and adapter interface
- Universal audio processing core with buffer management
- Cross-platform event system
- Browser adapter with Web Audio API support
- Platform detection utility
- Build configuration for multi-target bundling
- Comprehensive unit tests

🚧 **Coming Next (Phase 2):**
- Signal processing algorithms (FFT, YIN, Autocorrelation)
- Noise reduction implementation
- Node.js platform adapter
- Performance optimization

## 🏗 Architecture

The Musically Engine uses a platform-agnostic core with platform-specific adapters:

```
┌─────────────────────────────────────────────────────────────┐
│                Platform-Specific Adapters                   │
├─────────────────────────────────────────────────────────────┤
│  Browser          │ Node.js       │ React Native │ Electron │
│  (Web Audio API)  │ (PortAudio)   │ (Native)     │ (Hybrid) │
├─────────────────────────────────────────────────────────────┤
│                    Platform Abstraction Layer               │
├─────────────────────────────────────────────────────────────┤
│                 Musically Engine Core (Universal)           │
└─────────────────────────────────────────────────────────────┘
```

## 📚 API Reference

### Main Engine Class

```typescript
class MusicallyEngine {
  // Initialization
  static create(config?: EngineConfig): MusicallyEngine
  async initialize(): Promise<void>
  
  // Audio Input
  async startMicrophone(): Promise<void>
  stopMicrophone(): void
  async processFile(file: File | ArrayBuffer): Promise<AnalysisResult[]>
  
  // Configuration
  setMusicSystem(system: 'western' | 'carnatic' | 'hindustani'): void
  setAudioType(type: 'voice' | 'piano' | 'guitar' | 'auto'): void
  setReferencePitch(frequency: number): void
  
  // Events
  on(event: 'analysis' | 'error', handler: Function): void
  
  // Utility
  getSystemInfo(): SystemInfo
  isActive(): boolean
  async destroy(): Promise<void>
}
```

### Analysis Result Structure

```typescript
interface AnalysisResult {
  timestamp: number;
  frequency: number;
  amplitude: number;
  confidence: number;
  audioType: string;
  
  // Multi-system analysis
  western: {
    note: string;        // "C4", "F#3", etc.
    noteFrequency: number;
    cents: number;       // Deviation from equal temperament
    octave: number;
  };
  
  carnatic?: {
    swara: string;       // "Sa", "Ri2", "Ga1", etc.
    cents: number;
    octave: string;      // "Mandra", "Madhya", "Tara"
    possibleRagas: string[];
  };
  
  hindustani?: {
    swara: string;       // "Sa", "Re_komal", etc.
    cents: number;
    possibleRagas: string[];
  };
}
```

## 🧪 Development

### Setup

```bash
git clone https://github.com/SOFTRONICLABS1/musically-engine.git
cd musically-engine
npm install
```

### Build

```bash
npm run build          # Build all platforms
npm run build:browser  # Browser-specific build
npm run build:node     # Node.js-specific build
```

### Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Linting

```bash
npm run lint          # Check code style
npm run lint:fix      # Fix auto-fixable issues
```

## 🗺 Roadmap

- **Phase 1** ✅: Platform-agnostic core infrastructure
- **Phase 2** 🚧: Signal processing algorithms and Node.js support
- **Phase 3**: Audio type detection and instrument processing
- **Phase 4**: Music system implementations (Western, Carnatic, Hindustani)
- **Phase 5**: Mobile and desktop platform integration
- **Phase 6**: Package distribution and documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our GitHub repository.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/SOFTRONICLABS1/musically-engine/issues)
- **Documentation**: [API Docs](docs/)
- **Examples**: [Examples Directory](examples/)

---

Built with ❤️ for musicians and developers worldwide.