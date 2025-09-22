const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

const external = ['fs', 'path', 'util', 'events'];

// Base configuration shared across all builds
const baseConfig = {
  input: 'src/index.ts',
  external,
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true
    })
  ]
};

// Universal build (includes all platforms)
const universalConfig = {
  ...baseConfig,
  output: [
    {
      file: 'dist/universal/index.js',
      format: 'es',
      sourcemap: true
    },
    {
      file: 'dist/universal/index.cjs',
      format: 'cjs',
      sourcemap: true
    }
  ]
};

module.exports = universalConfig;