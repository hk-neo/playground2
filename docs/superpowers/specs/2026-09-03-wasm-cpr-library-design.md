# WASM CPR Library Design

## Goal

Extract the existing ArchPresser curved planar reconstruction algorithm into a reusable browser library. The library must be independent of DOM, Canvas, Three.js, and the current viewer application while preserving the existing CPU output semantics.

The first release targets browser ESM consumers and includes an AssemblyScript WebAssembly backend, a TypeScript CPU fallback, optional Worker execution, generated type declarations, and integration documentation.

## Public API

The package exposes a single asynchronous factory and backend-neutral engine interface:

```ts
import { createCprEngine } from '@neobiotech/cbct-cpr';

const engine = await createCprEngine({ backend: 'auto' });
await engine.setVolume(volume);

const result = await engine.extract(curve, {
  thickness: 15,
  pixelSize: 0.3,
  mode: 'mean',
  depthRangeMm: [0, volume.dimensions[2] * volume.spacing[2]],
});

engine.dispose();
```

Public types:

```ts
type CprBackend = 'auto' | 'wasm' | 'cpu';
type CprExecution = 'main' | 'worker';
type CprMode = 'sum' | 'mean' | 'min' | 'max';

interface CprVolume {
  data: Int16Array | Uint16Array;
  dimensions: readonly [number, number, number];
  spacing: readonly [number, number, number];
}

interface CprCurve {
  sample(t: number): { x: number; y: number; z: number };
  readonly points: ReadonlyArray<{ x: number; y: number; z: number }>;
}

interface CprExtractOptions {
  thickness?: number;
  pixelSize?: number;
  mode?: CprMode;
  depthRangeMm?: readonly [number, number];
}

interface CprResult {
  data: Float32Array;
  width: number;
  height: number;
  backend: 'wasm' | 'cpu';
  elapsedMs: number;
}
```

`extract` remains asynchronous for every backend so applications can switch between main-thread and Worker execution without changing call sites.

## Package Boundary

The package entry point is `src/cpr/index.ts`. It may depend on shared type-only modules and the existing CPU algorithm, but it must not import from `visualize`, `app`, `pano` UI classes, Canvas APIs, or Three.js.

The current viewer imports the same public entry point rather than instantiating `ArchPresser` directly. This makes the viewer an integration consumer and prevents library-only behavior from drifting.

Published artifacts:

- `dist/index.js`: browser ESM entry
- `dist/index.d.ts`: public type declarations
- `dist/cpr.wasm`: optimized WebAssembly module
- `dist/cpr-worker.js`: optional module Worker
- `README.md`: installation, API, bundler, memory, and migration guide

## Backend Selection

`backend: 'auto'` attempts the WASM backend and falls back to CPU only when WebAssembly compilation or initialization fails. `backend: 'wasm'` fails explicitly instead of silently degrading. `backend: 'cpu'` always uses the TypeScript implementation.

The engine exposes `backend` and an optional fallback reason so applications can report diagnostics.

## WASM Data Flow

AssemblyScript is used because it is installed and built through npm, avoiding a machine-level Rust or Emscripten prerequisite. The compiler emits ESM bindings and an optimized `.wasm` binary.

The volume is copied into WASM linear memory once during `setVolume`. Repeated extracts copy only the resampled curve arrays into WASM and copy the result back. A 512-sample curve is small; the result is normally below 2 MB.

The WebAssembly core receives precomputed arrays:

- `x[N]`, `y[N]`: curve samples in source voxel coordinates
- `arcLength[N]`: cumulative physical distance in millimeters
- source volume dimensions and spacing
- thickness, pixel size, depth range, and projection mode

It performs output dimension calculation, monotonic segment lookup, normal calculation, dominant-axis ray marching, bilinear sampling, and projection accumulation.

The TypeScript wrapper performs curve resampling so custom curve implementations only need the documented `sample` method.

## Worker Execution

The main-thread backend is the default because a Worker cannot access an existing `ArrayBuffer` without either copying it or detaching it from the application. Copying a 500 MB CBCT volume can be more expensive than the extraction itself.

Worker execution is opt-in and requires a volume policy:

- `copy`: preserve the caller buffer and send a one-time copy to the Worker.
- `transfer`: transfer ownership and detach the caller buffer. This is only valid when the caller no longer needs CPU access.

`SharedArrayBuffer` is outside the initial scope because it requires cross-origin isolation headers and changes the host application's deployment contract.

Worker requests carry increasing IDs. Superseded extraction results are ignored, preventing stale curve-drag results from replacing newer output. Disposal rejects pending requests and terminates the Worker.

## CPU Fallback

The existing `ArchPresser` remains the reference implementation. A thin adapter converts `CprVolume` to the existing `VolumeData` shape and maps public options to the class setters.

The fallback is not duplicated or rewritten. Behavioral fixes must be covered by shared parity tests before being applied to either backend.

## Application Integration

`pano-wiring.ts` owns one engine instance for the loaded series. `setPanoVolume` updates the engine volume once. Final and modal preview extraction await the engine result.

Interactive requests use latest-result-wins semantics. Curve drags and thickness wheel events are coalesced to one request per animation frame. Full-resolution extraction runs after pointer release; drag preview continues to use a larger pixel size.

Rendering remains unchanged: `PanoView` receives the returned `Float32Array` and applies the existing WL/WW behavior.

## Error Handling

- Invalid dimensions, spacing, curve point count, depth range, and data length fail before entering WASM.
- WASM initialization errors fall back only in `auto` mode.
- WASM runtime errors include the selected backend and operation name.
- Out-of-memory errors are surfaced with the required volume byte count.
- An engine cannot extract before `setVolume` or after `dispose`.

## Build And Distribution

`npm run build:wasm` compiles the AssemblyScript source. `npm run build:lib` produces ESM JavaScript, declarations, Worker output, and the WASM asset. `npm run build` runs both.

The package exports only the documented entry point and explicitly includes `dist`. AssemblyScript is a development dependency and is not required by consumers.

Consumers can either let the packaged ESM wrapper resolve `cpr.wasm` through `new URL('./cpr.wasm', import.meta.url)` or provide `wasmUrl` when assets are hosted on a CDN. Vite, webpack, and plain browser ESM examples are documented.

## Testing

TDD is used for each public behavior.

- Public validation and backend selection tests run in Vitest.
- Existing ArchPresser fixtures cover constant, z-gradient, radial-gradient, thickness-zero, and output geometry.
- The same fixtures compare WASM and CPU results with a documented floating-point tolerance.
- Worker tests cover request ordering, disposal, and copy/transfer policy.
- A benchmark script reports warm extraction time, output size, and speedup for CPU and WASM.
- The existing external-DICOM integration test remains optional when its sample file is unavailable.

## Acceptance Criteria

- A standalone web application can install the package and generate CPR output without importing viewer code.
- `auto`, `wasm`, and `cpu` backends produce the same width and height and numerically equivalent output for all fixtures.
- The volume is copied into WASM at most once per `setVolume` call.
- Repeated `extract` calls do not retain previous output buffers.
- Main-thread WASM is measurably faster than the current CPU implementation on the benchmark fixture.
- Documentation includes installation, API reference, Vite/webpack/plain ESM examples, Worker memory trade-offs, fallback behavior, and troubleshooting.

## Out Of Scope

- DICOM parsing and JPEG decoding
- GPU CPR behavior changes
- SharedArrayBuffer and threaded WASM
- Node.js/WASI support
- Publishing to a registry or changing organization credentials
