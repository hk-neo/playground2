import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootUrl = new URL('../', import.meta.url);
const rootDir = fileURLToPath(rootUrl);
const generatedWasmPath = fileURLToPath(new URL('src/cpr/generated/cpr.wasm', rootUrl));
const cacheDir = fileURLToPath(new URL('node_modules/.cache/cpr-benchmark/', rootUrl));

if (!existsSync(generatedWasmPath)) {
  console.error(
    'src/cpr/generated/cpr.wasm is missing. Run "npm run build:wasm" first.',
  );
  process.exit(1);
}

function repackageCprUrls() {
  return {
    name: 'cpr-benchmark:repackage-urls',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('src/cpr/worker-engine.ts')) {
        const original =
          "const worker = new Worker(new URL('./cpr-worker.ts', import.meta.url), { type: 'module' });";
        if (!code.includes(original)) {
          this.error('worker-engine.ts no longer constructs the default worker inline');
        }
        const rewritten = code.replace(
          original,
          'const worker = new Worker(bundledCprWorkerUrl(), { type: \'module\' });',
        );
        return `${rewritten}\nfunction bundledCprWorkerUrl(): URL {\n`
          + "  return new URL('./cpr-' + 'worker.js', import.meta.url);\n}\n";
      }
      if (id.includes('src/cpr/generated/cpr.js')) {
        const original = 'new URL("cpr.wasm", import.meta.url)';
        if (!code.includes(original)) {
          this.error('generated cpr.js no longer resolves cpr.wasm relative to itself');
        }
        return code.replace(
          original,
          'new URL("cpr.wasm" /* resolved next to this chunk */, import.meta.url)',
        );
      }
      return undefined;
    },
  };
}

console.log('benchmark: bundling source entry (src/cpr/index.ts) for Node');
const { build } = await import('vite');
await build({
  configFile: false,
  root: rootDir,
  logLevel: 'error',
  mode: 'production',
  plugins: [repackageCprUrls()],
  build: {
    outDir: cacheDir,
    emptyOutDir: true,
    target: 'esnext',
    minify: false,
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('src/cpr/index.ts', rootUrl)),
      formats: ['es'],
    },
    rollupOptions: {
      external: [/^node:/],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
});

let wasmLoaderFile;
for (const name of readdirSync(cacheDir).filter((file) => file.endsWith('.js'))) {
  const source = readFileSync(new URL(name, pathToFileURL(cacheDir)), 'utf8');
  if (source.includes('"cpr.wasm"') && source.includes('import.meta.url')) {
    wasmLoaderFile = name;
  }
}
if (!wasmLoaderFile) {
  console.error('benchmark: no bundled chunk resolves cpr.wasm relative to itself');
  process.exit(1);
}
cpSync(generatedWasmPath, new URL('cpr.wasm', pathToFileURL(cacheDir)));

const entry = await import(new URL('index.js', pathToFileURL(cacheDir)).href);
if (typeof entry.createCprEngine !== 'function') {
  console.error('benchmark: bundled entry does not export createCprEngine');
  process.exit(1);
}

const SEED = 0x2f6e2b1;
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIMENSIONS = [256, 256, 256];
const SPACING = [0.3, 0.3, 0.3];

function makeVolume() {
  const [dx, dy, dz] = DIMENSIONS;
  const data = new Int16Array(dx * dy * dz);
  const prng = mulberry32(SEED);
  const waveX = new Float64Array(dx);
  const waveY = new Float64Array(dy);
  const waveZ = new Float64Array(dz);
  for (let x = 0; x < dx; x++) waveX[x] = Math.sin(x * 0.049);
  for (let y = 0; y < dy; y++) waveY[y] = Math.cos(y * 0.041);
  for (let z = 0; z < dz; z++) waveZ[z] = Math.sin(z * 0.037 + 0.6);

  let index = 0;
  for (let z = 0; z < dz; z++) {
    for (let y = 0; y < dy; y++) {
      const rowBase = 9000 * waveY[y];
      const depthBase = 4500 * waveZ[z];
      for (let x = 0; x < dx; x++) {
        const value = Math.round(rowBase * waveX[x] + depthBase + (prng() * 2 - 1) * 6000);
        data[index++] = Math.max(-32768, Math.min(32767, value));
      }
    }
  }
  return { data, dimensions: DIMENSIONS, spacing: SPACING };
}

function makeArchCurve(pointCount) {
  const sample = (t) => {
    const clamped = Math.min(1, Math.max(0, t));
    const theta = Math.PI * clamped;
    return {
      x: 128 + 92 * Math.cos(theta),
      y: 158 - 88 * Math.sin(theta),
      z: 0,
    };
  };
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    points.push(sample(i / (pointCount - 1)));
  }
  return { points, sample };
}

const extractOptions = {
  thickness: 15,
  pixelSize: 0.3,
  mode: 'mean',
  depthRangeMm: [0, DIMENSIONS[2] * SPACING[2]],
};

const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;
const PARITY_MAX_ABS_DELTA = 1e-3;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function benchmarkBackend(backend, volume, curve) {
  const engine = await entry.createCprEngine({ backend });
  if (engine.backend !== backend) {
    throw new Error(`expected backend '${backend}' but engine selected '${engine.backend}'`);
  }
  await engine.setVolume(volume);

  for (let i = 0; i < WARMUP_RUNS; i++) {
    await engine.extract(curve, extractOptions);
  }

  const wallSamples = [];
  const engineSamples = [];
  let result;
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const startedAt = performance.now();
    result = await engine.extract(curve, extractOptions);
    wallSamples.push(performance.now() - startedAt);
    engineSamples.push(result.elapsedMs);
    if (result.backend !== backend) {
      throw new Error(`result reports backend '${result.backend}', expected '${backend}'`);
    }
  }
  engine.dispose();
  return { wallSamples, engineSamples, result };
}

function checksum(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum;
}

console.log('benchmark: generating deterministic fixture');
const volume = makeVolume();
const curve = makeArchCurve(12);
let volumeChecksum = 0;
for (let i = 0; i < volume.data.length; i++) volumeChecksum += volume.data[i];

const cpus = os.cpus();
console.log('');
console.log('cpr backend benchmark');
console.log(`  env: node ${process.version}, ${process.platform} ${process.arch}, `
  + `${os.availableParallelism()} logical cores, ${cpus[0] ? cpus[0].model.trim() : 'unknown cpu'}`);
console.log(`  volume: ${DIMENSIONS.join('x')} int16, spacing ${SPACING.join('/')} mm, `
  + `seed 0x${SEED.toString(16)}, volume checksum ${volumeChecksum}`);
console.log(`  curve: 12-point arch (ellipse a=92, b=88 voxels)`);
console.log(`  extract: thickness=${extractOptions.thickness}mm pixelSize=${extractOptions.pixelSize}mm `
  + `mode=${extractOptions.mode} depthRange=[${extractOptions.depthRangeMm}]mm, `
  + `${WARMUP_RUNS} warmup + ${MEASURED_RUNS} measured runs`);

const failures = [];

console.log('');
console.log('  running cpu backend...');
const cpu = await benchmarkBackend('cpu', volume, curve);
console.log('  running wasm backend...');
const wasm = await benchmarkBackend('wasm', { ...volume, data: volume.data.slice() }, curve);

const cpuMedian = median(cpu.wallSamples);
const wasmMedian = median(wasm.wallSamples);

console.log('');
console.log('  backend  median(ms)  min(ms)  max(ms)  engine-median(ms)  output');
for (const [name, run] of [['cpu', cpu], ['wasm', wasm]]) {
  const med = median(run.wallSamples);
  console.log(
    `  ${name.padEnd(7)}  ${med.toFixed(2).padStart(8)}  `
    + `${Math.min(...run.wallSamples).toFixed(2).padStart(7)}  `
    + `${Math.max(...run.wallSamples).toFixed(2).padStart(7)}  `
    + `${median(run.engineSamples).toFixed(2).padStart(16)}  `
    + `${run.result.width}x${run.result.height}`,
  );
}

if (cpu.result.width !== wasm.result.width || cpu.result.height !== wasm.result.height) {
  failures.push(
    `output dimensions differ: cpu ${cpu.result.width}x${cpu.result.height} vs wasm ${wasm.result.width}x${wasm.result.height}`,
  );
}

let maxAbsDelta = 0;
for (let i = 0; i < cpu.result.data.length; i++) {
  maxAbsDelta = Math.max(maxAbsDelta, Math.abs(wasm.result.data[i] - cpu.result.data[i]));
}
const cpuChecksum = checksum(cpu.result.data);
const wasmChecksum = checksum(wasm.result.data);
const checksumRelDiff = Math.abs(cpuChecksum - wasmChecksum) / Math.max(1, Math.abs(cpuChecksum));

console.log('');
console.log(`  checksum cpu=${cpuChecksum.toFixed(3)} wasm=${wasmChecksum.toFixed(3)} `
  + `relDiff=${checksumRelDiff.toExponential(3)}`);
console.log(`  max abs delta: ${maxAbsDelta.toExponential(3)} (tolerance ${PARITY_MAX_ABS_DELTA})`);

if (maxAbsDelta > PARITY_MAX_ABS_DELTA) {
  failures.push(`wasm output deviates from cpu beyond ${PARITY_MAX_ABS_DELTA} (max abs delta ${maxAbsDelta})`);
}

const speedup = cpuMedian / wasmMedian;
console.log(`  speedup: ${speedup.toFixed(2)}x (median cpu / median wasm)`);
console.log('');

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`  FAIL  ${failure}`);
  }
  console.error(`\nbenchmark FAILED: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('benchmark PASSED (parity within tolerance)');
