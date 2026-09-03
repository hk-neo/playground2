# playground2 — CBCT Viewer & CPR Library

Local CBCT web viewer (Three.js) and the reusable **CPR (Curved Planar
Reconstruction) library** published from `src/cpr/` as browser ESM with a
WebAssembly backend and a CPU fallback.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/cpr/` | Public CPR library (`createCprEngine` entry point) |
| `src/pano/`, `src/visualize/`, `src/dicom/` | Viewer application code |
| `assembly/` | AssemblyScript source of the WASM projection kernel |
| `dist/` | Built library package (git-ignored) |
| `docs/cpr-library.md` | Library consumer documentation |
| `examples/cpr-library/` | Vite / webpack / plain-ESM integration examples |

## Getting started (development)

```bash
npm install
npm run build:wasm   # required once after a fresh clone (see below)
npm run dev          # viewer dev server
npm test             # vitest suite
```

### Why `npm run build:wasm` must run first on a fresh clone

The WASM kernel is compiled from `assembly/cpr.ts` into
`src/cpr/generated/cpr.{js,d.ts,wasm}`, which is **git-ignored**. Typecheck,
tests, and the library build all resolve that module, so after cloning you
must run:

```bash
npm run build:wasm   # AssemblyScript -> src/cpr/generated/
```

`npm run build` chains `build:wasm` + `build:lib` automatically.

## Library build and smoke test

```bash
npm run build        # build:wasm + build:lib -> dist/
npm run smoke:cpr    # imports dist/index.js and runs CPU + WASM extractions
```

`dist/` contains the installable browser ESM package: `index.js` (entry),
`index.d.ts` (types), `cpr.wasm` (kernel), `cpr-worker.js` (optional module
worker), plus shared chunks and declaration files. See
[`docs/cpr-library.md`](docs/cpr-library.md) for installation, API reference,
bundler integration, Worker memory trade-offs, migration from `ArchPresser`,
and troubleshooting.

## Scripts

| Script | Action |
| --- | --- |
| `dev` | Vite dev server for the viewer |
| `build` | Full library build (`build:wasm` then `build:lib`) |
| `build:wasm` | Compile AssemblyScript kernel to `src/cpr/generated/` |
| `build:lib` | Bundle ESM + worker, emit declarations, copy wasm to `dist/` |
| `smoke:cpr` | Verify the built package end-to-end (Node) |
| `typecheck` | `tsc --noEmit` over the whole repository |
| `test` / `test:watch` | Vitest suite |

Integration tests that need a real DICOM sample are skipped automatically
when `DICOM_SAMPLE_FILE` (or the default local path) is unavailable.
