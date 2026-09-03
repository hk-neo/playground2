/**
 * Vite consumption example for @neobiotech/cbct-cpr.
 *
 * Setup in a scratch app:
 *   npm create vite@latest cpr-demo -- --template vanilla-ts
 *   cd cpr-demo
 *   npm install /path/to/playground2   # or the packed tarball
 *   # copy this file to src/main.ts and add the vite.config.ts below
 *   npm run dev
 *
 * Required vite.config.ts:
 *
 *   import { defineConfig } from 'vite';
 *   import { copyFileSync, mkdirSync } from 'node:fs';
 *
 *   export default defineConfig({
 *     // REQUIRED in dev: prebundling rewrites import.meta.url into
 *     // node_modules/.vite/deps/, breaking cpr.wasm / cpr-worker.js
 *     // resolution relative to the package's dist/.
 *     optimizeDeps: { exclude: ['@neobiotech/cbct-cpr'] },
 *     plugins: [
 *       // Production only: Vite's asset pipeline picks up cpr.wasm
 *       // automatically, but NOT cpr-worker.js (the packaged worker URL
 *       // deliberately evades static detection). Copy it into the output
 *       // if you use execution: 'worker'.
 *       {
 *         name: 'copy-cpr-worker',
 *         closeBundle() {
 *           mkdirSync('dist/vendor', { recursive: true });
 *           copyFileSync(
 *             'node_modules/@neobiotech/cbct-cpr/dist/cpr-worker.js',
 *             'dist/vendor/cpr-worker.js',
 *           );
 *         },
 *       },
 *     ],
 *   });
 *
 * Production notes:
 * - cpr.wasm: emitted and rewritten by Vite's asset pipeline automatically.
 * - cpr-worker.js: NOT emitted by design. If you enable execution: 'worker',
 *   copy it as above and pass an explicit factory:
 *     workerFactory: () => new Worker('/vendor/cpr-worker.js', { type: 'module' })
 *
 * This example runs on the main thread, so only the wasm asset matters and
 * no worker copy step is needed.
 */
import {
  createCprEngine,
  type CprCurve,
  type CprEngine,
  type CprVolume,
} from '@neobiotech/cbct-cpr';

function makeDemoVolume(): CprVolume {
  const dimensions = [128, 128, 32] as const;
  const spacing = [0.3, 0.3, 0.5] as const;
  const data = new Int16Array(dimensions[0] * dimensions[1] * dimensions[2]);
  for (let z = 0; z < dimensions[2]; z++) {
    for (let y = 0; y < dimensions[1]; y++) {
      for (let x = 0; x < dimensions[0]; x++) {
        const shell = Math.abs(Math.hypot(x - 64, y - 64) - 40) < 4 ? 800 : 0;
        data[z * dimensions[0] * dimensions[1] + y * dimensions[0] + x] = shell + z;
      }
    }
  }
  return { data, dimensions, spacing };
}

function makeDemoCurve(): CprCurve {
  return {
    points: [
      { x: 16, y: 64, z: 0 },
      { x: 64, y: 88, z: 0 },
      { x: 112, y: 64, z: 0 },
    ],
    sample(t) {
      // crude quadratic through the three points; any sampler is fine
      const clamped = Math.min(1, Math.max(0, t));
      const a = this.points[0];
      const b = this.points[1];
      const c = this.points[2];
      const u = 1 - clamped;
      return {
        x: u * u * a.x + 2 * u * clamped * b.x + clamped * clamped * c.x,
        y: u * u * a.y + 2 * u * clamped * b.y + clamped * clamped * c.y,
        z: 0,
      };
    },
  };
}

let engine: CprEngine | undefined;

async function run(): Promise<void> {
  engine = await createCprEngine({ backend: 'auto' });
  if (engine.backend === 'cpu') {
    console.warn('WASM unavailable, CPU fallback:', engine.fallbackReason);
  }

  await engine.setVolume(makeDemoVolume());
  const result = await engine.extract(makeDemoCurve(), {
    thickness: 10,
    pixelSize: 0.3,
    mode: 'mean',
  });

  document.body.textContent =
    `backend=${result.backend} ${result.width}x${result.height} `
    + `in ${result.elapsedMs.toFixed(1)}ms (${result.data.length} samples)`;
}

void run();

window.addEventListener('pagehide', () => engine?.dispose());
