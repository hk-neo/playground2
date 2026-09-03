# CPR Library (`@neobiotech/cbct-cpr`)

Curved Planar Reconstruction (CPR) for browser ESM applications. Extracts a
2D panoramic image from a 3D CBCT volume along an arbitrary curve, with a
WebAssembly backend (AssemblyScript) and a TypeScript CPU fallback behind one
async API.

The library is DOM-free: it does not use Canvas, Three.js, or any viewer code.
It ships as browser ESM plus an optional module Worker.

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Volume layout and coordinate system](#volume-layout-and-coordinate-system)
- [API reference](#api-reference)
- [Backend selection and fallback diagnostics](#backend-selection-and-fallback-diagnostics)
- [Custom `wasmUrl`](#custom-wasmurl)
- [Bundler integration (Vite, webpack, plain ESM)](#bundler-integration)
- [Worker execution and memory trade-offs](#worker-execution-and-memory-trade-offs)
- [Engine lifecycle](#engine-lifecycle)
- [Performance guide](#performance-guide)
- [Migration from `ArchPresser`](#migration-from-archpresser)
- [Building the library (fresh clone)](#building-the-library-fresh-clone)
- [Troubleshooting](#troubleshooting)

## Installation

The package is not published to a public registry. Install it from a built
checkout, a tarball, or the git branch, then make sure `dist/` is built:

```bash
# From a local checkout (already built)
npm install /path/to/playground2

# From a tarball produced by `npm pack` in the library repo
npm pack                     # in the library repo -> neobiotech-cbct-cpr-0.1.0.tgz
npm install ./neobiotech-cbct-cpr-0.1.0.tgz   # in your app

# From git (requires a build step afterwards, see below)
npm install github:NeobiotechLabs/playground2#feat/wasm-cpr-library
```

When installing from git, `dist/` is not in the repository (it is
git-ignored), so run the library build once inside the dependency or vendor a
built tarball instead. See [Building the library](#building-the-library-fresh-clone).

The package has **no runtime dependencies**. AssemblyScript is a dev-time
compiler only; `three`, the DICOM parser, and the JPEG decoder belong to the
demo viewer, not to the library.

## Quick start

```ts
import { createCprEngine, type CprCurve, type CprVolume } from '@neobiotech/cbct-cpr';

const engine = await createCprEngine();          // backend: 'auto' by default
await engine.setVolume(volume);                  // CprVolume, see below

const result = await engine.extract(curve, {
  thickness: 15,                                 // mm along the curve normal
  pixelSize: 0.3,                                // mm per output pixel
  mode: 'mean',                                  // 'sum' | 'mean' | 'min' | 'max'
  depthRangeMm: [0, volume.dimensions[2] * volume.spacing[2]],
});

// result.data: Float32Array of width * height raw intensities
// result.width: pixels along the curve (arc length)
// result.height: pixels along the depth (z) range
// result.backend: 'wasm' | 'cpu'
// result.elapsedMs: extraction time

engine.dispose();
```

`createCprEngine`, `setVolume`, and `extract` are async on every backend so
main-thread and Worker execution are interchangeable at the call site.

## Volume layout and coordinate system

```ts
interface CprVolume {
  data: Int16Array | Uint16Array;         // voxel intensities (raw, no HU conversion)
  dimensions: readonly [number, number, number]; // [dx, dy, dz] voxel counts
  spacing: readonly [number, number, number];    // [sx, sy, sz] mm per voxel
}
```

- `data` is stored **x-fastest**: `index = z * dx * dy + y * dx + x`.
  A stack of axial slices where each slice is row-major (x within a row)
  already has this layout.
- `dimensions` and `spacing` are `[x, y, z]` triples. `spacing` is in
  millimeters (DICOM Pixel Spacing is `[rowSpacing, colSpacing]` =
  `[sy, sx]`; Slice Thickness / reconstruction interval is `sz`).
- Curve coordinates are expressed in **voxel units** for `x` and `y`
  (0..dx-1, 0..dy-1); arc length and all extraction options are in
  millimeters. The engine converts internally using `spacing`.
- `z` is a slice index. The extracted band is controlled in millimeters via
  `depthRangeMm`, measured from the first slice (z = 0) along +z.
- Output rows run along the depth range (z), output columns run along the
  curve arc length: `data[v * width + u]`.

## API reference

### `createCprEngine(options?: CprEngineOptions): Promise<CprEngine>`

```ts
interface CprEngineOptions {
  backend?: 'auto' | 'wasm' | 'cpu';   // default 'auto'
  execution?: 'main' | 'worker';       // default 'main'
  volumePolicy?: 'copy' | 'transfer';  // required when execution is 'worker'
  wasmUrl?: string | URL;              // default: packaged dist/cpr.wasm
  workerFactory?: () => CprWorkerTransport; // custom worker instantiation
}
```

### `engine.setVolume(volume, options?): Promise<void>`

Copies the volume into the backend. For the WASM backend the data is copied
into WASM linear memory once per call; repeated `extract` calls reuse it.
With `execution: 'worker'` the per-call `{ volumePolicy }` option overrides
the engine-level policy.

### `engine.extract(curve, options?): Promise<CprResult>`

```ts
interface CprCurve {
  readonly points: ReadonlyArray<CprPoint>; // at least 2 points
  sample(t: number): CprPoint;              // t in [0, 1], voxel coordinates
}

interface CprExtractOptions {
  thickness?: number;      // mm, default 20; 0 collapses to a single plane
  pixelSize?: number;      // mm, default 0.3; floored at 0.05 (see below)
  mode?: 'sum' | 'mean' | 'min' | 'max'; // default 'mean'
  depthRangeMm?: readonly [number, number]; // default [0, dz * sz]
}

interface CprResult {
  data: Float32Array;      // width * height
  width: number;           // columns, arc length direction
  height: number;          // rows, depth direction
  backend: 'wasm' | 'cpu';
  elapsedMs: number;
}
```

Only `sample(t)` is used by the engine; `points` must exist and contain at
least two points but does not need to be the exact resampling used
internally (the engine resamples the curve to 512 arc-length samples).

`pixelSize` has a hard floor of **0.05 mm**. Positive values below the floor
are clamped to 0.05 (not rejected), so the CPU and WASM backends always agree
on output `width`/`height`. This mirrors the legacy `ArchPresser.setPixelSize`
behavior; without the shared floor the CPU path (which clamps internally) and
the WASM kernel (which does not) would silently produce differently sized
images for the same request. The normalized value is what reaches every
backend, including Worker execution. Exported as `MIN_PIXEL_SIZE_MM`.

### `engine.dispose(): void`

Releases backend resources (WASM allocations, Worker termination). The
engine cannot be used afterwards.

### Errors

All validation happens before any backend work:

| Condition | Error message |
| --- | --- |
| Non-positive/non-integer dimensions | `Volume dimensions must be positive finite integers` |
| `data.length !== dx*dy*dz` | `Volume data length must equal dimensions product` |
| Non-positive spacing | `Volume spacing values must be positive finite numbers` |
| Fewer than 2 curve points | `Curve must contain at least two points` |
| `pixelSize <= 0` or not finite | `Pixel size must be a positive finite number` |
| `thickness < 0` or not finite | `Thickness must be a non-negative finite number` |
| Non-finite depth range | `Depth range endpoints must be finite numbers` |
| `depthRangeMm[0] > depthRangeMm[1]` | `Depth range minimum must not exceed maximum` |
| `extract` before `setVolume` | `CPR engine requires a volume before extraction` |
| Any call after `dispose()` | `CPR engine is disposed` |
| Worker execution without policy | `CPR engine execution 'worker' requires volumePolicy 'copy' or 'transfer'` |

`pixelSize` values that are positive but below the 0.05 mm floor are **not**
errors; they are clamped to 0.05 (see `engine.extract` above).

Worker-only: a superseded extraction rejects with `CprRequestSupersededError`
(exported), carrying the superseded `requestId`.

## Backend selection and fallback diagnostics

- `backend: 'auto'` (default) tries WASM and falls back to CPU **only** when
  WebAssembly compilation/instantiation fails. Check `engine.fallbackReason`
  to report why.
- `backend: 'wasm'` fails explicitly (rejected `createCprEngine`) instead of
  silently degrading. Use this in benchmarks or when parity matters.
- `backend: 'cpu'` always uses the TypeScript implementation.

```ts
const engine = await createCprEngine();
if (engine.backend === 'cpu' && engine.fallbackReason) {
  console.warn(`CPR running on CPU fallback: ${engine.fallbackReason}`);
}
```

`result.backend` also reports which backend produced each extraction.

## Custom `wasmUrl`

By default the packaged ESM wrapper resolves `cpr.wasm` next to the loaded
chunk (`new URL('cpr.wasm', import.meta.url)`), so no configuration is needed
when the package `dist/` directory is served as-is (plain ESM). Bundler
builds have extra requirements — see
[Bundler integration](#bundler-integration). Provide `wasmUrl` when the
binary lives elsewhere (CDN, asset pipeline with hashed names, data URL in
tests):

```ts
const engine = await createCprEngine({
  wasmUrl: new URL('/assets/cpr-abc123.wasm', location.origin),
});
```

`wasmUrl` is forwarded to the Worker when `execution: 'worker'`.

## Bundler integration

### Vite

> **Design note:** the library build (`vite.lib.config.ts`) deliberately
> disables Vite's static `new Worker(new URL(...))` and
> `new URL('literal', import.meta.url)` detection so that `dist/cpr.wasm`
> and `dist/cpr-worker.js` stay standalone files instead of being inlined
> or hashed into the library bundle. As a consequence this package does not
> rely on bundler static asset detection; the host application must make
> sure the two files are reachable at runtime (details below).

**Dev server — `optimizeDeps.exclude` is required.** When the package is
installed from a package manager, Vite prebundles dependencies into
`node_modules/.vite/deps/`. The prebundled chunk's `import.meta.url` no
longer points at the package's `dist/`, so the relative `cpr.wasm` and
`cpr-worker.js` resolution breaks (404 in the dev server):

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: { exclude: ['@neobiotech/cbct-cpr'] }, // required, not optional
});
```

**Production build (`vite build`)** — the two assets behave differently:

- `cpr.wasm`: the shipped `dist/cpr.js` contains a plain
  `new URL("cpr.wasm", import.meta.url)`. Vite's asset pipeline detects it,
  emits the binary into your output, and rewrites the reference. No action
  needed in a standard setup.
- `cpr-worker.js`: the packaged worker URL is produced through a helper
  function (intentionally, to evade the library build's worker bundling),
  so Vite does **not** detect it and does not emit the file. With the
  default `workerFactory`, `execution: 'worker'` 404s on the production
  build.

So for production use with `execution: 'worker'`, copy
`node_modules/@neobiotech/cbct-cpr/dist/cpr-worker.js` into your served
output and pass an explicit factory:

```ts
// vite.config.ts (production): copy the worker next to the output
import { copyFileSync, mkdirSync } from 'node:fs';

export default defineConfig({
  optimizeDeps: { exclude: ['@neobiotech/cbct-cpr'] },
  plugins: [
    {
      name: 'copy-cpr-worker',
      closeBundle() {
        mkdirSync('dist/vendor', { recursive: true });
        copyFileSync(
          'node_modules/@neobiotech/cbct-cpr/dist/cpr-worker.js',
          'dist/vendor/cpr-worker.js',
        );
      },
    },
  ],
});
```

```ts
// app code
const engine = await createCprEngine({
  execution: 'worker',
  volumePolicy: 'copy',
  workerFactory: () => new Worker('/vendor/cpr-worker.js', { type: 'module' }),
});
```

Alternatively, if your deployment serves the package `dist/` directory as a
static path (e.g. `/vendor/cbct-cpr/`), point both assets there explicitly:

```ts
const engine = await createCprEngine({
  wasmUrl: '/vendor/cbct-cpr/cpr.wasm',
  workerFactory: () =>
    new Worker(new URL('/vendor/cbct-cpr/cpr-worker.js', location.origin), { type: 'module' }),
});
```

### webpack 5

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      { test: /\.wasm$/, type: 'asset/resource' },
    ],
  },
};
```

webpack does not rewrite the library's runtime `new URL(...)` references, so
the simplest setup is to copy `node_modules/@neobiotech/cbct-cpr/dist/cpr.wasm`
and `cpr-worker.js` into your output directory (e.g. `copy-webpack-plugin`)
and keep the default resolution. Alternatively, point both explicitly:

```ts
const engine = await createCprEngine({
  wasmUrl: '/static/cpr.wasm',
  workerFactory: () => {
    const worker = new Worker(new URL('./cpr-worker.js', location.href), { type: 'module' });
    return worker; // Worker implements the CprWorkerTransport shape
  },
});
```

### Plain ESM (no bundler)

Serve the `dist/` directory and import `index.js` directly; see
[`examples/cpr-library/browser.html`](../examples/cpr-library/browser.html).

```html
<script type="module">
  import { createCprEngine } from './node_modules/@neobiotech/cbct-cpr/dist/index.js';
</script>
```

All four files (`index.js`, `engine.js`/`cpr.js` chunks, `cpr.wasm`,
`cpr-worker.js`) must be served from the same directory.

## Worker execution and memory trade-offs

`execution: 'worker'` moves extraction off the main thread. A Worker cannot
see the caller's `ArrayBuffer` without copying or detaching it, so a volume
policy is mandatory:

- `volumePolicy: 'copy'` — keeps the caller buffer usable and sends a one-time
  structured-clone to the Worker. Cost: ~2 bytes/voxel extra RAM (a 512³
  volume ≈ 268 MB duplicated) plus one copy latency on `setVolume`.
- `volumePolicy: 'transfer'` — transfers ownership; the caller buffer is
  **detached** (zero-length) after `setVolume`. Use only when the app no
  longer needs CPU access to the volume (e.g. rendering already moved it to
  the GPU). Zero copy cost.

`SharedArrayBuffer` is intentionally out of scope (requires cross-origin
isolation headers).

The main-thread backend is the default because copying a several-hundred-MB
CBCT volume can cost more than the extraction itself. Prefer Worker execution
for interactive curve dragging with `transfer`, or with `copy` when the UI
thread visibly stalls.

Worker requests carry increasing IDs; a newer `extract` supersedes a pending
one (the older promise rejects with `CprRequestSupersededError`), so dragging
a curve never applies stale results. `dispose()` rejects all pending requests
and terminates the Worker.

## Engine lifecycle

1. `await createCprEngine(options)` — selects the backend (WASM init happens here).
2. `await engine.setVolume(volume)` — required before extraction; call again
   to swap in a different series (WASM memory is re-allocated per call).
3. `await engine.extract(curve, options)` — repeatable; reuses the volume.
   Results are independent `Float32Array`s; the engine retains no output buffers.
4. `engine.dispose()` — frees WASM allocations / terminates the Worker.
   Extracting after dispose throws; create a new engine instead.

One engine per loaded series is the intended shape (see
`src/visualize/pano-wiring.ts` in the demo viewer for coalescing interactive
requests to one per animation frame).

## Performance guide

Measured by the reproducible benchmark (`npm run benchmark:cpr`: deterministic
seeded 256³ Int16 volume, 12-point arch curve, `thickness=15`, `pixelSize=0.3`,
`mode='mean'`, 282×256 output, 1 warmup + 5 measured runs per backend, median
reported):

| Backend | Median extraction time |
| --- | --- |
| CPU (TypeScript) | 82.9 ms |
| WASM (AssemblyScript) | 70.6 ms |

Measured on Apple M3 Max, 16 logical cores, Node v24.14.0, darwin arm64.
Speedup ≈ **1.17×** (repeat runs landed between 1.15× and 1.17×); both
backends produced bit-identical output for this fixture (max abs delta 0,
checked against a 1e-3 tolerance). Timings are machine-dependent — rerun the
benchmark on your own hardware.

### Why the WASM backend is only marginally faster

- The kernel is **bound by scattered 2-byte volume reads**. Every output
  pixel marches a ray through the volume and bilinearly samples at arbitrary
  offsets, so memory access, not arithmetic, dominates runtime.
- Bilinear sampling stays scalar: current wasm SIMD has no gather/scatter
  loads, so a vectorized march would still issue each 2-byte load
  individually plus lane-shuffle overhead.
- A SIMD-friendly rewrite (fixed-step marching) would sample different
  positions and change the output relative to the CPU backend. Existing CPU
  output is the compatibility definition, so that trade-off is rejected.
- Choose WASM for the moderate speedup and for Worker offloading, not for an
  order-of-magnitude win.

### Practical levers (largest effect first)

- Output resolution dominates cost: output pixels scale with
  `1/pixelSize²`. Use `pixelSize` 0.6–1.0 mm while dragging the curve
  (roughly 4× cheaper than 0.3 mm) and re-extract once at 0.3 mm after
  pointer release.
- `setVolume` dominates WASM cost for large volumes (one memcpy into linear
  memory per call). Set the volume once, extract many times.
- Keep `thickness` as small as the task allows: ray marching steps scale with
  thickness in both backends.
- `execution: 'worker'` + `volumePolicy: 'transfer'` does not change the
  backend speedup, but extraction stops blocking the UI thread — the main
  benefit for interactive use on large volumes.
- The curve is resampled to 512 arc-length samples regardless of the input
  point count; extra input points are essentially free.

## Migration from `ArchPresser`

Before (direct internal class, viewer-coupled `VolumeData`):

```ts
import { ArchPresser } from './pano/arch-presser';

const presser = new ArchPresser({ thickness: 15, pixelSize: 0.3, mode: 'mean' });
presser.setDepthRangeMm(0, dz * sz);
const result = presser.extract(curve, {
  buffer,                       // ArrayBuffer
  dimensions: [dx, dy, dz],
  spacing: [sx, sy, sz],
  origin: [0, 0, 0],
  dataType: 'int16',
});
canvas2d.draw(result.data, result.width, result.height);
```

After (public engine):

```ts
import { createCprEngine } from '@neobiotech/cbct-cpr';

const engine = await createCprEngine();   // once per loaded series
await engine.setVolume({
  data: new Int16Array(buffer),           // typed array view of the same buffer
  dimensions: [dx, dy, dz],
  spacing: [sx, sy, sz],
});

const result = await engine.extract(curve, {
  thickness: 15,
  pixelSize: 0.3,
  mode: 'mean',
  depthRangeMm: [0, dz * sz],
});
canvas2d.draw(result.data, result.width, result.height);
// ...later: engine.dispose();
```

Differences to note:

- Construction is async and backend-aware; add `await` and handle
  `fallbackReason` if you log performance.
- `extract` is async on all backends; call sites gain `await` but stop
  blocking the main thread when Worker execution is enabled.
- `depthMinMm`/`depthMaxMm` constructor/setter options become the
  `depthRangeMm` extract option.
- The volume is described by a typed array plus dimensions/spacing instead of
  `VolumeData` (`origin`/`dataType` are gone; signedness is inferred from
  `Int16Array` vs `Uint16Array`).
- Options that used to live on the presser instance are passed per
  `extract`, so one engine serves all parameter combinations.
- Output shape is unchanged: `{ data: Float32Array, width, height }` with the
  same WL/WW-friendly raw intensities.

## Building the library (fresh clone)

`src/cpr/generated/` (the AssemblyScript compilation output) is **git-ignored**,
so a fresh clone must compile the WASM kernel before anything that imports it
(typecheck, tests, library build):

```bash
npm install
npm run build:wasm   # AssemblyScript -> src/cpr/generated/cpr.{js,d.ts,wasm}
npm run build        # full package build (runs build:wasm + build:lib)
npm run smoke:cpr    # sanity-check the built dist/
```

Why `build:wasm` must run first:

- `src/cpr/wasm-bindings.ts` dynamically imports `./generated/cpr.js`, and
  TypeScript resolves its types via `generated/cpr.d.ts`. Without the
  generated files, `npm run typecheck` and the library declaration build fail.
- `npm test` WASM parity suites read `generated/cpr.wasm`.
- The library build copies `generated/cpr.wasm` to `dist/cpr.wasm`.

`npm run build:wasm` is deterministic given the `assemblyscript` dev
dependency version; consumers installing a prebuilt tarball never need it.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Failed to load CPR WebAssembly module: 404` | Custom `wasmUrl` is wrong or the file is not served. Check the network tab; default resolution requires `cpr.wasm` next to the served JS chunks. |
| Worker 404 on a Vite/webpack production build | The packaged worker URL evades static detection by design, so bundlers do not emit `cpr-worker.js`. Copy it into your output and pass `workerFactory` (see [Bundler integration](#bundler-integration)). |
| Library 404s only in Vite dev, works in build | Prebundling moved the chunk; add `optimizeDeps: { exclude: ['@neobiotech/cbct-cpr'] }`. |
| WASM MIME warnings in the console | Serve `.wasm` with `Content-Type: application/wasm` (required by `WebAssembly.compileStreaming`). |
| `engine.backend === 'cpu'` unexpectedly | Read `engine.fallbackReason`. Common causes: WASM blocked by CSP, `file://` pages without fetch, very old browsers. |
| Output dimensions ignore a `pixelSize` below 0.05 | `pixelSize` is floored at 0.05 mm on every backend (CPU/WASM/Worker) so all backends agree on `width`/`height`. Values under the floor are clamped, not rejected. |
| `backend: 'wasm'` rejects at startup | WebAssembly unavailable or the binary failed to fetch. The error message is the fetch/compile failure itself. |
| Worker execution throws `requires volumePolicy` | Pass `volumePolicy: 'copy'` or `'transfer'` to `createCprEngine`. |
| Volume buffer becomes zero-length | You chose `volumePolicy: 'transfer'`; the buffer was detached by design. Use `'copy'` if you still need it. |
| `CprRequestSupersededError` | Expected for superseded interactive requests; catch and ignore it for preview flows, or await only the latest promise. |
| Blank output with all-zero data | The curve lies outside the volume or `depthRangeMm` misses the anatomy. Coordinates are voxel units for x/y; depth is mm from z = 0. |
| `Cannot find module '../generated/cpr.js'` in typecheck | Run `npm run build:wasm` (see [fresh clone](#building-the-library-fresh-clone)). |
| Bundler tries to parse `.wasm` as JS | Exclude it from loaders (webpack `module.noParse: /\.wasm$/` or asset rules) or rely on the packaged runtime resolution. |
| Extraction slower than expected | You may be on the CPU fallback (`engine.backend`), calling `setVolume` per extract, or using a very large `thickness`. |
