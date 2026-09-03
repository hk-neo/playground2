# WASM CPR Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable browser ESM library that generates ArchPresser-compatible CBCT CPR images through AssemblyScript WebAssembly with a TypeScript CPU fallback and optional Worker execution.

**Architecture:** A DOM-free `src/cpr` package exposes one asynchronous engine API. Curve preprocessing stays in TypeScript; projection runs through either the existing CPU implementation or a resident-volume WASM kernel. The viewer consumes this API as an ordinary client, while a Vite library build emits JavaScript, declarations, Worker code, and a stable WASM asset.

**Tech Stack:** TypeScript 5, AssemblyScript, WebAssembly, Web Workers, Vite 8 library mode, Vitest 4

**Spec:** `docs/superpowers/specs/2026-09-03-wasm-cpr-library-design.md`

## Global Constraints

- The public package must not import DOM, Canvas, Three.js, `src/visualize`, or UI classes.
- Browser ESM is the supported runtime; Node.js/WASI and threaded WASM are out of scope.
- `backend: 'auto'` falls back to CPU; `backend: 'wasm'` surfaces initialization errors.
- Volume data is copied into WASM once per `setVolume`, never once per extraction.
- Worker execution requires an explicit `copy` or `transfer` volume policy.
- Existing CPU ArchPresser output defines compatibility, including dimensions, z inversion, boundary behavior, and projection modes.
- Production behavior is introduced only after its test has failed for the expected reason.

---

### Task 1: Public API And Validation

**Files:**
- Create: `src/cpr/types.ts`
- Create: `src/cpr/validation.ts`
- Create: `src/cpr/__tests__/validation.test.ts`
- Create: `src/cpr/index.ts`

**Interfaces:**
- Produces: `CprVolume`, `CprCurve`, `CprExtractOptions`, `CprResult`, `CprEngineOptions`, `CprEngine`, `validateVolume`, `validateCurve`, and `normalizeExtractOptions`.
- Consumers: all later engine and backend tasks.

- [ ] **Step 1: Write failing validation tests**

Cover a valid signed volume, a valid unsigned volume, dimensions/data-length mismatch, non-positive spacing, fewer than two curve points, invalid pixel size, negative thickness, and reversed depth range. Assert stable error messages so host applications can diagnose bad input.

```ts
expect(() => validateVolume({
  data: new Int16Array(7),
  dimensions: [2, 2, 2],
  spacing: [0.3, 0.3, 0.3],
})).toThrow('Volume data length must equal dimensions product');
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/cpr/__tests__/validation.test.ts`

Expected: FAIL because `src/cpr/validation.ts` does not exist.

- [ ] **Step 3: Implement public types and validation**

Use readonly tuples at the public boundary and normalize defaults to `thickness=20`, `pixelSize=0.3`, `mode='mean'`, and full-volume depth. Keep `CprResult.data` as `Float32Array` and include `backend` and `elapsedMs` diagnostics.

```ts
export interface CprEngine {
  readonly backend: 'wasm' | 'cpu';
  readonly fallbackReason?: string;
  setVolume(volume: CprVolume, options?: SetVolumeOptions): Promise<void>;
  extract(curve: CprCurve, options?: CprExtractOptions): Promise<CprResult>;
  dispose(): void;
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/cpr/__tests__/validation.test.ts && npm run typecheck`

Expected: validation tests and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add src/cpr
git commit -m "feat(cpr): define reusable library API"
```

### Task 2: Curve Preprocessing And CPU Backend

**Files:**
- Create: `src/cpr/curve-samples.ts`
- Create: `src/cpr/cpu-backend.ts`
- Create: `src/cpr/__tests__/curve-samples.test.ts`
- Create: `src/cpr/__tests__/cpu-backend.test.ts`
- Modify: `src/pano/arch-presser.ts`

**Interfaces:**
- Consumes: Task 1 public types and the existing `ArchPresser` implementation.
- Produces: `prepareCurveSamples(curve, volume, sampleCount)` and `CpuCprBackend` implementing the internal backend contract.

- [ ] **Step 1: Write failing curve preprocessing tests**

Verify 512 samples, cumulative physical arc length using x/y spacing, zero at index 0, and monotonic segment indices. Include anisotropic spacing `[0.2, 0.4, 1]` so a voxel-distance implementation fails.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/cpr/__tests__/curve-samples.test.ts`

Expected: FAIL because `prepareCurveSamples` is missing.

- [ ] **Step 3: Implement curve preprocessing**

Return packed `Float32Array` values rather than object arrays:

```ts
interface PreparedCurve {
  x: Float32Array;
  y: Float32Array;
  arcLengthMm: Float32Array;
  totalArcLengthMm: number;
}
```

- [ ] **Step 4: Write failing CPU backend parity tests**

For constant, z-gradient, and radial-gradient fixtures, compare the backend's dimensions and every output pixel against a direct `ArchPresser.extract` call. Test all four modes.

- [ ] **Step 5: Verify RED**

Run: `npx vitest run src/cpr/__tests__/cpu-backend.test.ts`

Expected: FAIL because `CpuCprBackend` is missing.

- [ ] **Step 6: Implement the CPU adapter and monotonic segment lookup**

The adapter converts `CprVolume` to `VolumeData` without copying and configures one `ArchPresser`. In `ArchPresser.extract`, precompute the curve position and normal for every output column once, replacing the per-pixel `segIdx=0` scan.

- [ ] **Step 7: Verify GREEN**

Run: `npx vitest run src/cpr/__tests__/curve-samples.test.ts src/cpr/__tests__/cpu-backend.test.ts src/pano/__tests__/arch-presser.test.ts`

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/cpr src/pano/arch-presser.ts
git commit -m "feat(cpr): add CPU backend and curve preprocessing"
```

### Task 3: AssemblyScript CPR Kernel

**Files:**
- Create: `assembly/cpr.ts`
- Create: `ascconfig.json`
- Create: `scripts/build-cpr-wasm.mjs`
- Create: `src/cpr/wasm-bindings.ts`
- Create: `src/cpr/__tests__/wasm-parity.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `PreparedCurve` and normalized options from Tasks 1-2.
- Produces: `createWasmBindings(wasmUrl?)`, `setVolume`, `extract`, and `dispose` with a volume resident in WASM memory.

- [ ] **Step 1: Add AssemblyScript build dependency and scripts**

Install `assemblyscript` as a development dependency. Add `build:wasm` that invokes `scripts/build-cpr-wasm.mjs`. The script calls `assemblyscript/asc` with `--optimize`, `--bindings esm`, `--exportRuntime`, and outputs adjacent `cpr.js`, `cpr.d.ts`, and `cpr.wasm` files under `src/cpr/generated`.

- [ ] **Step 2: Write failing WASM parity tests**

Build the module in a test setup command, instantiate it from the generated binary, load the fixture volume once, and compare constant, z-gradient, radial-gradient, boundary, thickness-zero, and all projection modes against `CpuCprBackend`. Use `toBeCloseTo(expected, 4)` for accumulated values.

- [ ] **Step 3: Verify RED**

Run: `npm run build:wasm && npx vitest run src/cpr/__tests__/wasm-parity.test.ts`

Expected: FAIL because the CPR exports are absent or return no output.

- [ ] **Step 4: Implement scalar AssemblyScript kernel**

Port the dominant-axis marching and XY/XZ/YZ bilinear samplers exactly. Store signedness, dimensions, spacing, and volume in module globals. Expose output pointer, width, and height so the TypeScript binding copies the result into an owned `Float32Array` before the next call.

Projection codes are fixed as `0=sum`, `1=mean`, `2=min`, and `3=max`.

- [ ] **Step 5: Verify GREEN**

Run: `npm run build:wasm && npx vitest run src/cpr/__tests__/wasm-parity.test.ts`

Expected: all WASM parity cases pass.

- [ ] **Step 6: Add SIMD only where parity remains stable**

Vectorize independent output columns in groups of four when `ASC_FEATURE_SIMD` is true. Keep the scalar tail and scalar fallback. Re-run parity before retaining each SIMD block.

- [ ] **Step 7: Commit**

```bash
git add assembly ascconfig.json scripts/build-cpr-wasm.mjs src/cpr package.json package-lock.json .gitignore
git commit -m "feat(cpr): add AssemblyScript WASM projection kernel"
```

### Task 4: Backend-Neutral Engine And Fallback

**Files:**
- Create: `src/cpr/engine.ts`
- Create: `src/cpr/wasm-backend.ts`
- Create: `src/cpr/__tests__/engine.test.ts`
- Modify: `src/cpr/index.ts`

**Interfaces:**
- Consumes: `CpuCprBackend`, `createWasmBindings`, validation, normalized options.
- Produces: `createCprEngine(options?: CprEngineOptions): Promise<CprEngine>`.

- [ ] **Step 1: Write failing engine tests**

Test explicit CPU selection, explicit WASM selection, `auto` WASM success, `auto` fallback with a captured reason, explicit WASM initialization failure, extract-before-volume, setVolume-after-dispose, and result timing/backend metadata. Inject backend factories in tests rather than mocking WebAssembly globals.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/cpr/__tests__/engine.test.ts`

Expected: FAIL because `createCprEngine` is missing.

- [ ] **Step 3: Implement minimal engine state machine**

States are `ready`, `volume-set`, and `disposed`. Validate at the public boundary, delegate to exactly one backend, and copy no volume in the engine itself.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/cpr/__tests__/engine.test.ts src/cpr/__tests__/wasm-parity.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/cpr
git commit -m "feat(cpr): add backend-neutral CPR engine"
```

### Task 5: Optional Worker Execution

**Files:**
- Create: `src/cpr/cpr-worker.ts`
- Create: `src/cpr/worker-engine.ts`
- Create: `src/cpr/worker-protocol.ts`
- Create: `src/cpr/__tests__/worker-engine.test.ts`
- Modify: `src/cpr/engine.ts`
- Modify: `src/cpr/types.ts`

**Interfaces:**
- Consumes: the same backend factory and public types.
- Produces: `execution: 'worker'`, `volumePolicy: 'copy' | 'transfer'`, request cancellation by supersession, and deterministic disposal.

- [ ] **Step 1: Write failing Worker protocol tests**

Use an in-memory Worker-compatible test double. Assert that no Worker starts without `volumePolicy`, `copy` preserves the caller buffer, `transfer` includes the caller buffer in the transfer list, request IDs increase, stale results do not resolve as the latest result, errors preserve request IDs, and disposal rejects pending promises.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/cpr/__tests__/worker-engine.test.ts`

Expected: FAIL because Worker execution is missing.

- [ ] **Step 3: Implement Worker protocol and engine**

Use discriminated messages named `init`, `set-volume`, `extract`, `result`, `error`, and `dispose`. Transfer output buffers back to the main thread. Reject superseded extractions with `CprRequestSupersededError` so hosts can intentionally ignore them.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/cpr/__tests__/worker-engine.test.ts src/cpr/__tests__/engine.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/cpr
git commit -m "feat(cpr): add optional Worker execution"
```

### Task 6: Viewer Integration And Request Coalescing

**Files:**
- Create: `src/visualize/__tests__/cpr-request-controller.test.ts`
- Create: `src/visualize/cpr-request-controller.ts`
- Modify: `src/visualize/pano-wiring.ts`
- Modify: `src/pano/index.ts`

**Interfaces:**
- Consumes: public `createCprEngine` API.
- Produces: the viewer's latest-result-wins async render flow without direct `ArchPresser` construction.

- [ ] **Step 1: Write failing request-controller tests**

Test one request per animation frame, replacement of queued options, stale result suppression, full-resolution pointer-up extraction, and continued rendering after an auto-backend fallback.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/visualize/__tests__/cpr-request-controller.test.ts`

Expected: FAIL because the controller is missing.

- [ ] **Step 3: Implement request coalescing**

Keep scheduling independent of DOM by injecting `requestFrame`. Use a monotonically increasing generation number and invoke `onResult` only when the completed generation remains current.

- [ ] **Step 4: Integrate the public engine into pano wiring**

Create the engine once, call `setVolume` when the series changes, replace direct `archPresser.extract` calls with scheduled async requests, and dispose on page teardown. Keep existing pixel sizes and WL/WW behavior unchanged.

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run src/visualize/__tests__/cpr-request-controller.test.ts src/pano/__tests__/arch-presser.test.ts && npm run typecheck`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/visualize src/pano/index.ts
git commit -m "refactor(viewer): consume reusable CPR engine"
```

### Task 7: Library Build And Consumer Documentation

**Files:**
- Create: `vite.lib.config.ts`
- Create: `tsconfig.lib.json`
- Create: `docs/cpr-library.md`
- Create: `examples/cpr-library/vite.ts`
- Create: `examples/cpr-library/webpack.ts`
- Create: `examples/cpr-library/browser.html`
- Create: `scripts/smoke-cpr-package.mjs`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `src/dicom/__tests__/integration.test.ts`

**Interfaces:**
- Consumes: completed public library and Worker/WASM assets.
- Produces: installable `dist` package and host-application instructions.

- [ ] **Step 1: Write failing package smoke test**

Add a Vitest test or Node script that builds the package, dynamically imports `dist/index.js`, verifies `createCprEngine` exists, checks `dist/cpr.wasm` and `dist/cpr-worker.js`, and runs a CPU extraction from the built artifact.

- [ ] **Step 2: Verify RED**

Run: `npm run build && node scripts/smoke-cpr-package.mjs`

Expected: FAIL because library build configuration and artifacts are absent.

- [ ] **Step 3: Configure package output**

Set package metadata, `type: module`, `exports`, `types`, `files: ["dist"]`, and scripts for WASM, declarations, library, app, smoke, and benchmark builds. Mark no runtime dependency on AssemblyScript.

- [ ] **Step 4: Make external DICOM tests portable**

Change the three real-file tests to `describe.skipIf(!existsSync(SAMPLE_FILE))`, matching the existing CBCT ArchPresser test behavior. This preserves coverage when `DICOM_SAMPLE_FILE` is set and removes machine-specific baseline failure.

- [ ] **Step 5: Write consumer documentation and examples**

Document installation, volume layout, coordinates, all options and errors, backend selection, custom `wasmUrl`, Vite/webpack/plain ESM loading, Worker copy/transfer memory costs, fallback diagnostics, lifecycle, performance guidance, and troubleshooting. Include a migration example from direct `ArchPresser` use.

- [ ] **Step 6: Verify GREEN**

Run: `npm run build && npm run smoke:cpr && npm test && npm run typecheck`

Expected: build, smoke test, all tests, and typecheck pass without the external DICOM sample.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.lib.config.ts tsconfig.lib.json README.md docs/cpr-library.md examples scripts src/dicom/__tests__/integration.test.ts
git commit -m "docs(cpr): package and document browser library"
```

### Task 8: Benchmark, Review, And Final Verification

**Files:**
- Create: `scripts/benchmark-cpr.mjs`
- Modify: `package.json`
- Modify: `docs/cpr-library.md`

**Interfaces:**
- Consumes: built CPU and WASM engines.
- Produces: reproducible performance evidence and final release-readiness record.

- [ ] **Step 1: Add benchmark fixture and runner**

Generate a deterministic synthetic `256x256x256` signed volume and a 12-point arch. Warm each backend once, run five measured extractions with `thickness=15`, `pixelSize=0.3`, and `mode='mean'`, then print median milliseconds, dimensions, checksum, and WASM speedup.

- [ ] **Step 2: Run benchmark**

Run: `npm run benchmark:cpr`

Expected: CPU and WASM checksums match within parity tolerance and WASM timing is reported. Treat a speedup below 2x as a blocker requiring profiling before completion.

- [ ] **Step 3: Run complete verification**

Run: `npm run build && npm run smoke:cpr && npm run typecheck && npm test && git diff --check`

Expected: every command exits 0 and Vitest reports zero failed tests.

- [ ] **Step 4: Review public API and generated package**

Inspect `npm pack --dry-run`, ensure no source DICOM data or secrets are included, verify stable asset names, and review for stale-result races, detached-buffer misuse, leaked Workers, and retained WASM outputs.

- [ ] **Step 5: Commit final evidence**

```bash
git add package.json package-lock.json scripts/benchmark-cpr.mjs docs/cpr-library.md
git commit -m "perf(cpr): add reproducible backend benchmark"
```
