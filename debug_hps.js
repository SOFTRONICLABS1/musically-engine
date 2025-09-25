const { HPS } = require('./src/algorithms/HPS.ts');

// Simple debug test
const sampleRate = 44100;
const fftSize = 4096;
const frequency = 440;

console.log('Expected frequency:', frequency);
console.log('Frequency resolution:', sampleRate / fftSize);
console.log('Expected bin:', frequency / (sampleRate / fftSize));

// Generate sine wave
const buffer = new Float32Array(fftSize);
for (let i = 0; i < fftSize; i++) {
    buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
}

const hps = new HPS(fftSize, sampleRate);
const result = hps.detectPitch(buffer);

console.log('Detected frequency:', result.frequency);
console.log('Strength:', result.strength);
console.log('Harmonic amplitudes:', result.harmonicAmplitudes);