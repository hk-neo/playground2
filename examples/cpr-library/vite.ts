/**
 * Vite consumption example for @neobiotech/cbct-cpr.
 *
 * Setup in a scratch app:
 *   npm create vite@latest cpr-demo -- --template vanilla-ts
 *   cd cpr-demo
 *   npm install /path/to/playground2   # or the packed tarball
 *   # copy this file to src/main.ts
 *   npm run dev
 *
 * No Vite configuration is required: the package resolves cpr.wasm and
 * cpr-worker.js relative to its own dist/ chunks via import.meta.url.
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
