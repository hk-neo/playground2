# Panoramic View + Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Panoramic (Curved Planar Reformation) viewport to the CBCT viewer with an interactive curve editor, plus a flexible workspace (resize handles + maximize controls) that lets the user rebalance the 3D / Pano / MPR viewports.

**Architecture:** New `src/pano/` module with `PanoramicCurve` (Catmull-Rom spline), `FocalTrough` (min/max IP), `CurveEditorController` (state machine + undo/redo), `CurveEditorView` (MPR projection overlay using existing `OverlayRenderer`), `PanoView`/`PanoRenderer` (2D canvas, no WebGL). New `ViewLayoutManager` extends the existing `LayoutManager` for resize handles + maximize. UI split into top (3D, 50%) / bottom-left (Pano, 30%) / bottom-right (MPR 3-plane, 20%) + collapsible right Curve Editor panel (350px). All in TypeScript, no new npm dependencies.

**Tech Stack:** TypeScript 5.4, Vite 8, Vitest 4, existing `OverlayRenderer`/`MPRView`/`WLWWApplier`/`Camera` modules.

**Spec:** `docs/superpowers/specs/2026-08-28-panoramic-view-design.md`

## Global Constraints

- TypeScript strict mode (`tsconfig.json` has `strict: true`)
- Test runner: Vitest. All new code MUST ship with co-located `__tests__/*.test.ts`
- No new npm dependencies (everything in pure TS)
- Dark theme + cyan accent (`#00e5c3`) preserved everywhere
- Reuse existing `OverlayRenderer`, `WLWWApplier`, `MPRView`, `Input` modules — do not duplicate
- All public APIs exported from `src/pano/index.ts` (barrel) and from `src/app/index.ts` (for new layout manager)
- No DOM access in pure-data modules (Pano/Curve/FocalTrough). DOM/Canvas only in *-view.ts and *-renderer.ts

---

## File Structure (this plan creates/modifies)

**New files (`src/pano/`):**
- `panoramic-curve.ts` — curve data + Catmull-Rom + presets
- `focal-trough.ts` — min/max IP along normal
- `curve-editor-controller.ts` — state machine + undo/redo
- `curve-editor-view.ts` — MPR projection overlay
- `pano-view.ts` — Pano viewport state
- `pano-renderer.ts` — Pano 2D canvas drawing
- `index.ts` — barrel
- `__tests__/{panoramic-curve,focal-trough,curve-editor-controller,pano-renderer,view-layout-manager}.test.ts`

**New files (`src/app/`):**
- `view-layout-manager.ts` — resize handles + maximize
- `__tests__/view-layout-manager.test.ts`

**New files (`src/shared/interfaces/`):**
- `pano.ts` — `IPanoramicCurve`, `IFocalTrough`, `ICurveEditorController`, `ICurveEditorView`, `IPanoView`, `IPanoRenderer`
- `layout.ts` — `IViewLayoutManager`, `LayoutRegion`, `LayoutSnapshot`

**New files (`src/shared/types/`):**
- (extend `rendering.ts` with `CurveSnapshot` if not already there)

**Modified files:**
- `src/app/index.ts` — re-export `ViewLayoutManager`
- `src/app/layout-manager.ts` — possibly add snapshot passthrough (or leave alone if `ViewLayoutManager` is standalone)
- `src/visualize/main.ts` — wire up new modules, replace 4-grid glue code
- `index.html` — new layout structure, handle elements, maximize buttons, curve editor panel
- `docs/Intended_Use.md` — add 1-line note about Pano view

---

## Task 1 — Types & Interfaces

**Files:**
- Create `src/shared/interfaces/pano.ts`
- Create `src/shared/interfaces/layout.ts`
- Edit `src/shared/types/rendering.ts` (add `CurveSnapshot` type if absent)

**Steps:**
- [ ] Read `src/shared/interfaces/mpr.ts` to mirror its shape
- [ ] Write `src/shared/interfaces/pano.ts` with interfaces from spec §3 (IPanoramicCurve, IFocalTrough, ICurveEditorController, ICurveEditorView, IPanoView, IPanoRenderer) and `CurveSnapshot`, `CurvePreset` types
- [ ] Write `src/shared/interfaces/layout.ts` with `IViewLayoutManager`, `LayoutRegion` (`'top' | 'bottom-left' | 'bottom-right'`), `LayoutSnapshot` (`{ ratios: { top: number; bottomLeft: number; bottomRight: number }; maximized: LayoutRegion | null }`)
- [ ] `npm run typecheck` passes
- [ ] Commit: `feat(pano): add types and interfaces for panoramic view and layout`

---

## Task 2 — `PanoramicCurve` (TDD)

**Files:** `src/pano/panoramic-curve.ts`, `src/pano/__tests__/panoramic-curve.test.ts`

**Steps:**
- [ ] Write failing tests: add/remove/move point, sample/tangent at t, sampleN count, length > 0, presets `createEllipseCurve` and `createArchCurve` produce expected point counts, JSON round-trip
- [ ] `npx vitest run src/pano/__tests__/panoramic-curve.test.ts` — confirm FAIL
- [ ] Implement `PanoramicCurve` class with Catmull-Rom interpolation (use 4-neighbor cardinal spline; clamp at endpoints)
- [ ] Implement presets: `createEllipseCurve` (parametric ellipse in XY plane), `createArchCurve` (parabolic arch in XZ plane, fitting typical dental arch)
- [ ] Implement `toJSON`/`fromJSON` snapshot
- [ ] Tests pass
- [ ] Commit: `feat(pano): PanoramicCurve with Catmull-Rom and presets`

---

## Task 3 — `FocalTrough` (TDD)

**Files:** `src/pano/focal-trough.ts`, `src/pano/__tests__/focal-trough.test.ts`

**Steps:**
- [ ] Write failing tests: extract returns `width × sampledPoints` Float32Array, thickness=0 equals single-line sample, larger thickness produces darker/brighter min/max range, output dimensions match input
- [ ] Run test — confirm FAIL
- [ ] Implement `FocalTrough` with `extract(curve, volume, width)`: sample N points along curve, for each compute N=`width` rays along normal within ±thickness/2, take min and max IP, produce 2D intensity map (use min IP first; can add max IP later)
- [ ] Tests pass
- [ ] Commit: `feat(pano): FocalTrough min/max intensity integration`

---

## Task 4 — `CurveEditorController` (TDD)

**Files:** `src/pano/curve-editor-controller.ts`, `src/pano/__tests__/curve-editor-controller.test.ts`

**Steps:**
- [ ] Write failing tests: state transitions (Idle→Drawing→Editing→Applied), addPoint changes curve, removePoint decrements, movePoint updates coord, undo/redo restores previous state (within stack depth), `apply` sets state to Applied and emits, `cancel` resets curve
- [ ] Run test — confirm FAIL
- [ ] Implement `CurveEditorController` with `EventEmitter` (use the same pattern as existing `EventBus` from `src/sync/`)
- [ ] Implement undo/redo using snapshot stack (max 20)
- [ ] `addPointFromCanvasPoint(plane, canvasXY, volume)`: convert canvas 2D → world 3D using that plane's slice (reuse logic from `SliceExtractor`); for first point, append; otherwise insert in nearest order
- [ ] `movePointFromCanvasDrag`: same conversion but update existing point index
- [ ] `loadPreset(name, volume)`: instantiate preset curve, replace current
- [ ] Tests pass
- [ ] Commit: `feat(pano): CurveEditorController with state machine and undo/redo`

---

## Task 5 — `PanoView` + `PanoRenderer` (TDD, view module first)

**Files:** `src/pano/pano-view.ts`, `src/pano/pano-renderer.ts`, `src/pano/__tests__/pano-renderer.test.ts`

**Steps:**
- [ ] Write failing tests: `PanoView.setIntensityMap` stores data, `setWLWW` updates wl/ww, `setZoomPan` updates z/pan, `render()` calls `PanoRenderer.draw` with correct args; `PanoRenderer.draw` produces ImageData with correct dimensions and applies WL/WW
- [ ] Run test — confirm FAIL (use jsdom + mock canvas 2D context)
- [ ] Implement `PanoView` (state: data, wl, ww, zoom, pan, canvas, last-render-result)
- [ ] Implement `PanoRenderer.draw(ctx, data, w, h, wl, ww, zoom, pan)`: scale `data` by WL/WW, then apply zoom/pan transform, write to ctx via `putImageData` (or scaled `drawImage` from offscreen)
- [ ] Tests pass
- [ ] Commit: `feat(pano): PanoView and PanoRenderer (2D canvas, WLWW + zoom/pan)`

---

## Task 6 — `CurveEditorView` (DOM/canvas; TDD only the projection math)

**Files:** `src/pano/curve-editor-view.ts`, `src/pano/__tests__/curve-editor-view.test.ts`

**Steps:**
- [ ] Write failing tests for projection math (pure function, no DOM):
  - `projectCurveToAxial(curve, dims)` returns 2D point list
  - `projectCurveToCoronal(curve, dims)` returns 2D point list
  - `projectCurveToSagittal(curve, dims)` returns 2D point list
  - `hitTestPoint(curve, plane, mouseXY, threshold)` returns point index or -1
- [ ] Run test — confirm FAIL
- [ ] Implement projection helpers (extract appropriate coordinate pair per plane, scale to canvas coords)
- [ ] Implement `hitTestPoint` (Euclidean distance < threshold)
- [ ] Implement `CurveEditorView` class with `mount(canvases)`, `setCurve`, `setHover`, `setSelected`, `unmount` — uses helpers above + `OverlayRenderer` (or thin canvas 2D wrapper if OverlayRenderer is too coupled to its existing 2D context)
- [ ] Wire up event listeners via `InputHandler` (mouse) — click adds point, drag moves, hover sets hover
- [ ] Tests pass
- [ ] Commit: `feat(pano): CurveEditorView with MPR projection overlay`

---

## Task 7 — `ViewLayoutManager` (TDD)

**Files:** `src/app/view-layout-manager.ts`, `src/app/__tests__/view-layout-manager.test.ts`

**Steps:**
- [ ] Write failing tests: initial ratios `{ top: 0.5, bottomLeft: 0.3, bottomRight: 0.2 }` (sum = 1.0), `setRatio` clamps to [0.1, 0.8] and normalizes remainder, `maximize(region)` flips `snapshot.maximized`, `restore` clears it, `resetRatios` restores defaults, `onLayoutChange` fires on every change, localStorage save/load round-trip
- [ ] Run test — confirm FAIL
- [ ] Implement `ViewLayoutManager` (does NOT touch DOM — only manages ratios + emits events; DOM updates happen in `visualize/main.ts` via CSS `flex-basis` listeners)
- [ ] Use `localStorage` key `cbct-layout-v1` for persistence
- [ ] Tests pass
- [ ] Commit: `feat(app): ViewLayoutManager for resize handles and maximize`

---

## Task 8 — Pano barrel exports

**Files:** `src/pano/index.ts`, `src/app/index.ts`

**Steps:**
- [ ] Add `src/pano/index.ts` re-exporting all public symbols (see spec §3.6)
- [ ] Add `ViewLayoutManager` to `src/app/index.ts`
- [ ] `npm run typecheck` passes
- [ ] Commit: `feat(pano): barrel exports`

---

## Task 9 — `index.html` layout refactor

**Files:** `index.html`

**Steps:**
- [ ] Restructure layout per spec §4.1:
  - Header unchanged
  - Replace `.vp-grid` 2x2 with:
    - `.workspace` (vertical flex: 3D top + bottom-row)
    - `.bottom-row` (horizontal flex: Pano left + MPR right)
    - `.curve-editor-panel` (right, collapsible)
  - Add resize handle elements: `.resize-h` (between 3D and bottom), `.resize-v` (between Pano and MPR)
  - Add maximize buttons to each viewport (overlay, top-right of each)
  - Add curve editor panel content: state label, preset buttons, points list, thickness slider, undo/redo/apply/cancel buttons
- [ ] Keep all existing CSS variables; add new ones for handle hover color, panel collapsed width (0)
- [ ] No JS yet — DOM only
- [ ] `npm run dev` opens, layout visible (but non-functional until Task 10)
- [ ] Commit: `feat(ui): new workspace layout markup`

---

## Task 10 — Wire everything in `visualize/main.ts`

**Files:** `src/visualize/main.ts`

**Steps:**
- [ ] Replace the 4-grid glue with new module wiring:
  - Instantiate `ViewLayoutManager`
  - Subscribe to layout changes → update CSS `flex-basis` for each region
  - Wire resize handle `mousedown` → track drag → call `layout.setRatio(...)` on `mousemove` → release on `mouseup`
  - Wire maximize buttons → `layout.maximize(region)` / `layout.restore()`
  - Add Pano canvas + instantiate `PanoView` + `PanoRenderer`
  - When `controller.apply()` fires: compute `FocalTrough.extract(...)` → `panoView.setIntensityMap(...)` → `panoView.render()`
  - Instantiate `CurveEditorController` + `CurveEditorView`
  - Wire curve editor panel buttons (preset, undo, redo, apply, cancel) and thickness slider
  - Wire MPR canvases for click (add point) and drag (move point) via `InputHandler`
- [ ] Do NOT delete old DICOM load / patient / sync logic — keep working
- [ ] `npm run dev`, load DICOM folder, confirm:
  - 3D renders
  - MPR 3-plane renders
  - "Pano 그리기" → panel opens, clicking on Axial adds points
  - Apply → Pano viewport shows result
  - Resize handles drag correctly
  - Maximize works
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (existing 49 + new tests)
- [ ] Commit: `feat(visualize): wire Pano, curve editor, and layout manager`

---

## Task 11 — Intended Use note (regulatory hygiene)

**Files:** `docs/Intended_Use.md`

**Steps:**
- [ ] Add a one-line note under §1.1 (or wherever fits) about the Panoramic view being a diagnostic-aid display within the existing intended use
- [ ] Commit: `docs(intended-use): note panoramic view addition`

---

## Task 12 — End-to-end smoke + polish

**Files:** various small fixes

**Steps:**
- [ ] Run `npm test` — all pass
- [ ] Run `npm run typecheck` — clean
- [ ] Manual smoke (or Puppeteer test if `tests/` directory has infra):
  - Load DICOM folder
  - Verify all 5 viewports (3D, Pano, A/C/S) render something
  - "Pano 그리기" → add 5+ points → Apply → Pano updates
  - Resize handles drag both axes
  - Maximize Pano → ESC → restore
- [ ] Fix any visual polish (handle hover color, panel animation timing, font sizes)
- [ ] Final commit: `chore: polish panoramic view release`
