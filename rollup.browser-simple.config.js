const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: 'src/browser-simple.ts',
  output: {
    file: 'dist/browser/musically-engine.umd.js',
    format: 'umd',
    name: 'MusicallyEngine',
    sourcemap: true,
    exports: 'named'
  },
  external: ['fs', 'stream', 'web-audio-api', 'node:fs', 'node:stream'], // Exclude all Node.js modules
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true,
      compilerOptions: {
        skipLibCheck: true  // Skip type checking for external libraries
      }
    })
  ]
};