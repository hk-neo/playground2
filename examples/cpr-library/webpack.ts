/**
 * webpack 5 consumption example for @neobiotech/cbct-cpr.
 *
 * Setup in a scratch app:
 *   npm init -y && npm install webpack webpack-cli ts-loader typescript html-webpack-plugin copy-webpack-plugin
 *   npm install /path/to/playground2   # or the packed tarball
 *   # copy this file to src/index.ts, then use the config below
 *
 * webpack.config.js:
 *   const path = require('path');
 *   const CopyPlugin = require('copy-webpack-plugin');
 *
 *   module.exports = {
 *     mode: 'production',
 *     entry: './src/index.ts',
 *     module: {
 *       rules: [
 *         { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
 *         // IMPORTANT: do not route .wasm through asset modules when it is
 *         // loaded at runtime via fetch(); exclude the package's wasm file:
 *         { test: /\.wasm$/, exclude: /node_modules[\\/]@neobiotech[\\/]cbct-cpr/ },
 *       ],
 *     },
 *     resolve: { extensions: ['.ts', '.js'] },
 *     plugins: [
 *       // Optional: serve cpr.wasm / cpr-worker.js from a fixed path instead
 *       // of relying on import.meta.url resolution from node_modules.
 *       new CopyPlugin({
 *         patterns: [
 *           {
 *             from: 'node_modules/@neobiotech/cbct-cpr/dist/cpr.wasm',
 *             to: 'cpr.wasm',
 *           },
 *         ],
 *       }),
 *     ],
 *   };
 *
 * The library's runtime `new URL(..., import.meta.url)` references are left
 * untouched by webpack (they are not bundler-time imports), so default
 * resolution works as long as the package's dist/ files are served verbatim.
 */
import { createCprEngine, type CprCurve, type CprVolume } from '@neobiotech/cbct-cpr';

async function main(): Promise<void> {
  // When hashing/rewriting dist assets, pass wasmUrl explicitly:
  const engine = await createCprEngine({
    backend: 'auto',
    // wasmUrl: '/cpr.wasm', // matches the CopyPlugin target above
  });

  const volume: CprVolume = {
    data: new Int16Array(64 * 64 * 16).fill(120),
    dimensions: [64, 64, 16],
    spacing: [0.3, 0.3, 0.5],
  };
  const curve: CprCurve = {
    points: [
      { x: 8, y: 32, z: 0 },
      { x: 56, y: 32, z: 0 },
    ],
    sample: (t) => ({ x: 8 + 48 * t, y: 32, z: 0 }),
  };

  await engine.setVolume(volume);
  const result = await engine.extract(curve, { thickness: 8, pixelSize: 0.4, mode: 'mean' });

  const status = document.createElement('pre');
  status.textContent =
    `backend=${result.backend} ${result.width}x${result.height} in ${result.elapsedMs.toFixed(1)}ms`;
  document.body.appendChild(status);

  engine.dispose();
}

void main();
