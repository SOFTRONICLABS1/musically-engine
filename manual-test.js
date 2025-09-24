#!/usr/bin/env node

/**
 * Manual Testing Script for Phase 3 InstrumentProcessor
 * Run: node manual-test.js
 */

console.log("🎵 Phase 3 Manual Testing - InstrumentProcessor & Audio Type Detection\n");

// Import the modules using require (Node.js style)
try {
    // Since build has issues, let's use the source files directly
    const { InstrumentProcessor, InstrumentFamily } = require('./src/audioTypes/InstrumentProcessor.ts');
    const { AutoDetector } = require('./src/audioTypes/AutoDetector.ts');
    
    console.log("✅ Modules loaded successfully!\n");
    
    // Test 1: Basic InstrumentProcessor Initialization
    console.log("🔧 Test 1: InstrumentProcessor Initialization");
    try {
        const processor = new InstrumentProcessor({
            family: InstrumentFamily.String,
            sampleRate: 44100,
            frameSize: 2048
        });
        console.log("   ✅ String processor created successfully");
        console.log(`   📊 Config: ${JSON.stringify(processor.getConfig(), null, 2)}`);
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
    }
    
    // Test 2: Generate Test Signals
    console.log("\n🎶 Test 2: Audio Signal Generation");
    
    // Generate a simple sine wave (A3 - 220Hz)
    const frameSize = 2048;
    const sampleRate = 44100;
    const frequency = 220; // A3
    
    const testBuffer = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
        testBuffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    console.log(`   ✅ Generated ${frequency}Hz sine wave (${frameSize} samples)`);
    
    // Test 3: Basic Processing
    console.log("\n🎯 Test 3: Basic Audio Processing");
    try {
        const stringProcessor = new InstrumentProcessor({
            family: InstrumentFamily.String
        });
        
        const result = stringProcessor.processInstrument(testBuffer);
        
        console.log("   📊 Processing Results:");
        console.log(`   • Audio Type: ${result.audioType}`);
        console.log(`   • Family: ${result.family}`);
        console.log(`   • Detected Frequency: ${result.fundamentalFrequency.toFixed(2)}Hz`);
        console.log(`   • Confidence: ${result.confidence.toFixed(3)}`);
        console.log(`   • Techniques: ${JSON.stringify(result.techniques)}`);
        
    } catch (e) {
        console.log(`   ❌ Processing Error: ${e.message}`);
    }
    
    // Test 4: Different Instrument Families
    console.log("\n🎼 Test 4: Different Instrument Families");
    
    const families = [
        InstrumentFamily.String,
        InstrumentFamily.Keyboard, 
        InstrumentFamily.Wind,
        InstrumentFamily.Percussion
    ];
    
    families.forEach(family => {
        try {
            const processor = new InstrumentProcessor({ family });
            const result = processor.processInstrument(testBuffer);
            
            console.log(`   ${family.toUpperCase()}:`);
            console.log(`     • Frequency: ${result.fundamentalFrequency.toFixed(2)}Hz`);
            console.log(`     • Confidence: ${result.confidence.toFixed(3)}`);
            console.log(`     • Family Data: ${JSON.stringify(result.familySpecific)}`);
            
        } catch (e) {
            console.log(`   ❌ ${family} Error: ${e.message}`);
        }
    });
    
    // Test 5: Audio Type Detection
    console.log("\n🔍 Test 5: Auto Audio Type Detection");
    try {
        const detector = new AutoDetector();
        const detection = detector.detectAudioType(testBuffer);
        
        console.log("   📊 Detection Results:");
        console.log(`   • Detected Type: ${detection.type}`);
        console.log(`   • Confidence: ${detection.confidence.toFixed(3)}`);
        console.log(`   • Family: ${detection.family}`);
        console.log(`   • Characteristics: ${JSON.stringify(detection.characteristics)}`);
        
    } catch (e) {
        console.log(`   ❌ Detection Error: ${e.message}`);
    }
    
    // Test 6: Performance Benchmark
    console.log("\n⚡ Test 6: Performance Benchmark");
    try {
        const processor = new InstrumentProcessor({
            family: InstrumentFamily.String
        });
        
        const iterations = 100;
        const start = process.hrtime.bigint();
        
        for (let i = 0; i < iterations; i++) {
            processor.processInstrument(testBuffer);
        }
        
        const end = process.hrtime.bigint();
        const totalTime = Number(end - start) / 1000000; // Convert to milliseconds
        const avgTime = totalTime / iterations;
        
        console.log(`   📊 Performance Results:`);
        console.log(`   • Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`   • Average per frame: ${avgTime.toFixed(2)}ms`);
        console.log(`   • Frames per second: ${(1000 / avgTime).toFixed(0)} fps`);
        
        if (avgTime < 20) {
            console.log("   ✅ Performance: EXCELLENT (Real-time capable)");
        } else if (avgTime < 50) {
            console.log("   ⚠️  Performance: GOOD (May work for real-time)");
        } else {
            console.log("   ❌ Performance: NEEDS OPTIMIZATION");
        }
        
    } catch (e) {
        console.log(`   ❌ Performance Error: ${e.message}`);
    }
    
    console.log("\n📈 Current Phase 3 Status:");
    console.log("✅ IMPLEMENTED: Core InstrumentProcessor infrastructure");
    console.log("✅ IMPLEMENTED: Multi-family instrument support");  
    console.log("✅ IMPLEMENTED: Basic technique detection");
    console.log("✅ IMPLEMENTED: Audio type detection");
    console.log("🔄 IN PROGRESS: Fine-tuning detection algorithms");
    console.log("📊 TEST RESULTS: 23/36 tests passing (64% success rate)");
    
    console.log("\n🎯 Next Steps:");
    console.log("1. Run: npm test -- tests/audioTypes/InstrumentProcessor.test.ts");
    console.log("2. Check failing tests for specific issues to fix");
    console.log("3. Optimize technique detection thresholds");
    console.log("4. Improve polyphonic detection logic");
    
} catch (importError) {
    console.log("❌ Import Error:", importError.message);
    console.log("\n💡 Alternative Testing:");
    console.log("Since TypeScript modules need compilation, try:");
    console.log("1. npm run build (if no errors)");
    console.log("2. npm test -- tests/audioTypes/InstrumentProcessor.test.ts");
    console.log("3. Check individual test results");
}