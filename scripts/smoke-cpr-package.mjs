import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const distUrl = new URL('../dist/', import.meta.url);
const distDir = fileURLToPath(distUrl);

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

console.log('smoke: dist artifacts');
for (const file of ['index.js', 'index.d.ts', 'cpr.wasm', 'cpr-worker.js']) {
  check(`dist/${file} exists`, existsSync(new URL(file, distUrl)));
}

if (failures.length > 0) {
  console.error(`\nsmoke FAILED: missing artifacts in ${distDir}. Run "npm run build" first.`);
  process.exit(1);
}

console.log('smoke: module surface');
const entry = await import(pathToFileURL(fileURLToPath(new URL('index.js', distUrl))).href);
check('createCprEngine is exported', typeof entry.createCprEngine === 'function');
check(
  'CprRequestSupersededError is exported',
  typeof entry.CprRequestSupersededError === 'function',
);
check(
  'normalizeExtractOptions is exported',
  typeof entry.normalizeExtractOptions === 'function',
);

const dimensions = [24, 16, 8];
const spacing = [0.5, 0.5, 1];
const data = new Int16Array(dimensions[0] * dimensions[1] * dimensions[2]);
for (let z = 0; z < dimensions[2]; z++) {
  for (let y = 0; y < dimensions[1]; y++) {
    for (let x = 0; x < dimensions[0]; x++) {
      data[z * dimensions[0] * dimensions[1] + y * dimensions[0] + x] = z * 100 + y;
    }
  }
}
const volume = { data, dimensions, spacing };
const curve = {
  points: [
    { x: 2, y: 8, z: 0 },
    { x: 21, y: 8, z: 0 },
  ],
  sample: (t) => ({ x: 2 + 19 * Math.min(1, Math.max(0, t)), y: 8, z: 0 }),
};
const extractOptions = { thickness: 3, pixelSize: 0.5, mode: 'mean', depthRangeMm: [0, 8] };

function validateResult(label, result, expectedBackend) {
  check(`${label}: backend is ${expectedBackend}`, result.backend === expectedBackend);
  check(`${label}: width is positive`, Number.isInteger(result.width) && result.width > 0);
  check(`${label}: height is positive`, Number.isInteger(result.height) && result.height > 0);
  check(
    `${label}: data covers width*height`,
    result.data instanceof Float32Array && result.data.length === result.width * result.height,
  );
  check(
    `${label}: output is finite`,
    result.data.every((value) => Number.isFinite(value)),
  );
  check(`${label}: elapsedMs is finite`, Number.isFinite(result.elapsedMs));
}

console.log('smoke: CPU extraction from built artifact');
const cpuEngine = await entry.createCprEngine({ backend: 'cpu' });
await cpuEngine.setVolume(volume);
const cpuResult = await cpuEngine.extract(curve, extractOptions);
validateResult('cpu', cpuResult, 'cpu');
cpuEngine.dispose();

console.log('smoke: WASM extraction from built artifact (default wasm resolution)');
try {
  const wasmEngine = await entry.createCprEngine({ backend: 'wasm' });
  await wasmEngine.setVolume({ ...volume, data: data.slice() });
  const wasmResult = await wasmEngine.extract(curve, extractOptions);
  validateResult('wasm', wasmResult, 'wasm');
  check(
    'wasm output geometry matches cpu',
    wasmResult.width === cpuResult.width && wasmResult.height === cpuResult.height,
  );
  let maxDelta = 0;
  for (let index = 0; index < cpuResult.data.length; index++) {
    maxDelta = Math.max(maxDelta, Math.abs(wasmResult.data[index] - cpuResult.data[index]));
  }
  check('wasm output matches cpu within 1e-3', maxDelta < 1e-3, `max delta ${maxDelta}`);
  wasmEngine.dispose();
} catch (error) {
  check('wasm extraction runs', false, error instanceof Error ? error.message : String(error));
}

const workerSource = await import('node:fs/promises').then((fs) =>
  fs.readFile(new URL('cpr-worker.js', distUrl), 'utf8'),
);
check(
  'cpr-worker.js is a module worker entry',
  workerSource.includes('onmessage') && workerSource.length > 1000,
);

if (failures.length > 0) {
  console.error(`\nsmoke FAILED: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nsmoke PASSED');
