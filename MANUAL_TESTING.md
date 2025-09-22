# 🧪 Musically Engine - Manual Testing Guide

## Quick Start Testing

### Prerequisites
- Modern web browser (Chrome 66+, Firefox 60+, Safari 11.1+, Edge 79+)
- Microphone access for real-time testing
- Audio files (WAV, MP3, M4A, OGG) for file testing

### 1. Open the Test Page

```bash
# From the project directory
open test.html
# or
python -m http.server 8000  # Then visit http://localhost:8000/test.html
```

## 🎯 What You Can Test

### ✅ **Core Functionality (Phase 1 Complete)**

#### 1. **Engine Initialization**
- Click "Initialize Engine" 
- ✅ **Expected**: Green success message, system info populated
- ✅ **Tests**: Platform detection, Web Audio API support

#### 2. **Microphone Capture** 
- Click "Start Microphone" after initialization
- ✅ **Expected**: Browser asks for microphone permission
- ✅ **Tests**: Real-time audio capture, Web Audio API integration
- ✅ **Expected**: Mock analysis results appear every few seconds

#### 3. **File Processing**
- Select an audio file (WAV, MP3, etc.)
- Click "Process Audio File"
- ✅ **Expected**: File loads successfully, returns empty analysis array
- ✅ **Tests**: File decoding, ArrayBuffer processing

#### 4. **Configuration Changes**
- Try different music systems (Western, Carnatic, Hindustani)
- Try different audio types (Voice, Piano, Guitar)
- ✅ **Expected**: Configuration updates reflected in status

#### 5. **Event System**
- Watch the Event Log for all engine events
- ✅ **Expected**: Real-time event logging with timestamps

### 🚧 **What's NOT Implemented Yet (Phase 2+)**

❌ **Real Audio Analysis**: Currently returns mock data (A4 440Hz)
❌ **Frequency Detection**: No FFT/pitch detection algorithms yet  
❌ **Noise Reduction**: Basic audio capture only
❌ **Music System Processing**: No Carnatic/Hindustani note mapping

## 🎤 Testing Scenarios

### Scenario 1: Basic Functionality Test
1. Open `test.html` in browser
2. Click "Initialize Engine"
3. Click "Start Microphone" → Allow permissions
4. Speak/sing/play instrument near microphone
5. Observe mock analysis results in real-time
6. Click "Stop Microphone"

**✅ Expected Result**: Engine starts, captures audio, shows mock analysis

### Scenario 2: Configuration Testing
1. Initialize engine
2. Try different music systems and audio types
3. Start microphone between changes
4. Observe configuration updates in event log

**✅ Expected Result**: Configuration changes reflected immediately

### Scenario 3: File Processing
1. Initialize engine  
2. Select audio file (try different formats)
3. Click "Process Audio File"
4. Check file status and event log

**✅ Expected Result**: Files load successfully, return empty analysis array

### Scenario 4: Error Handling
1. Try starting microphone without initialization
2. Try processing file without selection
3. Block microphone permission and try to start

**✅ Expected Result**: Graceful error messages, no crashes

## 🔍 What to Look For

### ✅ **Working Features (Phase 1)**
- ✅ Engine initializes without errors
- ✅ Microphone permission requests work
- ✅ Audio capture starts/stops cleanly  
- ✅ File loading works for supported formats
- ✅ Configuration changes update in real-time
- ✅ Event system logs all activities
- ✅ No browser console errors
- ✅ Clean destroy/restart cycles

### 🚧 **Known Limitations (By Design)**
- ❌ Analysis always returns A4 440Hz (mock data)
- ❌ No actual frequency detection yet
- ❌ No noise filtering applied
- ❌ Carnatic/Hindustani modes return Western analysis
- ❌ File processing returns empty results

### 🚨 **What Would Indicate Problems**
- ❌ Browser console errors on initialization
- ❌ Microphone permission failures in modern browsers
- ❌ Engine crashes or becomes unresponsive  
- ❌ Memory leaks on repeated start/stop cycles
- ❌ TypeScript compilation errors in browser

## 📊 Expected Test Results

### Phase 1 Foundation Testing
| Feature | Status | Expected Behavior |
|---------|--------|-------------------|
| Engine Init | ✅ Working | Clean initialization, no errors |
| Microphone | ✅ Working | Permission request, audio capture |
| File Loading | ✅ Working | Supports WAV/MP3/M4A/OGG formats |
| Configuration | ✅ Working | Real-time config updates |
| Events | ✅ Working | Comprehensive event logging |
| Cleanup | ✅ Working | Clean destroy/restart cycles |
| Error Handling | ✅ Working | Graceful error messages |

### Mock Analysis Output
```javascript
{
  timestamp: 1695398400000,
  frequency: 440,           // Always A4
  amplitude: 0.5,           // Mock amplitude
  confidence: 0.8,          // Mock confidence
  audioType: "voice",       // Based on config
  western: {
    note: "A4",
    noteFrequency: 440,
    cents: 0,
    octave: 4
  },
  musicalContext: {
    intervalFromTonic: "unison",
    inScale: true
  }
}
```

## 🐛 Troubleshooting

### Common Issues

**"MusicallyEngine not loaded"**
- Check that `dist/browser/index.umd.js` exists
- Run `npm run build:browser` if missing

**Microphone Permission Denied**
- Use HTTPS or localhost (required by browsers)
- Check browser settings for microphone permissions

**No Audio Analysis Results**
- This is expected! Real analysis comes in Phase 2
- Mock results should appear every few seconds

**File Loading Fails**
- Try different audio formats (WAV works best)
- Check browser console for decode errors

## 🎯 Success Criteria for Phase 1

✅ **You should see:**
- Engine initializes without console errors
- Microphone capture works with permission
- Configuration changes update immediately  
- Files load successfully
- Event system logs all activities
- Mock analysis results appear during capture
- Clean destroy/restart behavior

🚀 **This confirms Phase 1 is working correctly and ready for Phase 2 signal processing!**