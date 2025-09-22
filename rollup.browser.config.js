const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: 'src/platforms/browser/index.ts',
  output: [
    {
      file: 'dist/browser/index.js',
      format: 'es',
      sourcemap: true
    },
    {
      file: 'dist/browser/index.cjs',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/browser/index.umd.js',
      format: 'umd',
      name: 'MusicallyEngine',
      sourcemap: true
    }
  ],
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