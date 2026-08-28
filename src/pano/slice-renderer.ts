/**
 * Slice Renderer — Draws an MPR (axial/coronal/sagittal) slice from a VolumeData
 * to a 2D canvas, with WL/WW windowing applied.
 *
 * Used by both main.ts (regular viewport) and pano-wiring.ts (curve editor modal).
 */
import type { VolumeData } from '../shared/types/volume';
import { MPRPlane } from '../shared/types/rendering';
import { SliceExtractor } from '../mpr/slice-extractor';
import type { SliceExtractor as _SE } from '../mpr/slice-extractor';
import { WLWWApplier } from '../mpr/wlww-applier';

/** Default shared extractor + WLWW applier instances (cheap to construct). */
const _extractor = new SliceExtractor();
const _wlww = new WLWWApplier();

/** Get/set the shared WLWW applier so callers can keep window/level in sync. */
export function getWlwwApplier(): WLWWApplier {
  return _wlww;
}

export function setSharedWlww(windowLevel: number, windowWidth: number): void {
  _wlww.setWindowLevel(windowLevel);
  _wlww.setWindowWidth(Math.max(1, windowWidth));
}

/**
 * Subscribe shared WL/WW to the 'wlww-changed' window event so callers that
 * dispatch main.ts's wlww-changed event see consistent windowing in the modal
 * and main viewports.
 */
export function installWlwwSync(): void {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { __wlwwSyncInstalled?: boolean }).__wlwwSyncInstalled) return;
  (window as unknown as { __wlwwSyncInstalled?: boolean }).__wlwwSyncInstalled = true;
  window.addEventListener('wlww-changed', (e: Event) => {
    const ev = e as CustomEvent<{ wl: number; ww: number }>;
    const wl = ev.detail?.wl ?? 0;
    const ww = ev.detail?.ww ?? 400;
    _wlww.setWindowLevel(wl);
    _wlww.setWindowWidth(Math.max(1, ww));
  });
}

export interface RenderSliceOptions {
  /** Override the extractor (useful for testing). */
  extractor?: SliceExtractor;
  /** Override the WLWW applier. */
  wlww?: WLWWApplier;
}

/**
 * Render an MPR slice to a 2D canvas. The canvas is sized to match the slice's
 * native voxel dimensions. Y-axis is flipped so anatomical orientation is correct.
 */
export function renderMprSlice(
  canvas: HTMLCanvasElement,
  plane: MPRPlane,
  position: number,
  volume: VolumeData | null,
  opts: RenderSliceOptions = {},
): void {
  if (!volume) return;
  const [dx, dy, dz] = volume.dimensions;
  let sliceW: number;
  let sliceH: number;
  switch (plane) {
    case MPRPlane.Axial:   sliceW = dx; sliceH = dy; break;
    case MPRPlane.Coronal: sliceW = dx; sliceH = dz; break;
    case MPRPlane.Sagittal:sliceW = dy; sliceH = dz; break;
    default: return;
  }
  const extractor = opts.extractor ?? _extractor;
  const wlww = opts.wlww ?? _wlww;
  const sliceData = extractor.extract(plane, position, volume);
  const grayscale = wlww.applyCurrent(sliceData);

  // Set canvas size to match slice. Use CSS to scale if viewport is smaller.
  canvas.width = sliceW;
  canvas.height = sliceH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.createImageData(sliceW, sliceH);
  // Flip Y-axis (source rows bottom-to-top → display top-to-bottom).
  for (let y = 0; y < sliceH; y++) {
    const srcRow = (sliceH - 1 - y) * sliceW;
    const dstRow = y * sliceW * 4;
    for (let x = 0; x < sliceW; x++) {
      const dst = dstRow + x * 4;
      const v = grayscale[srcRow + x];
      imageData.data[dst] = v;
      imageData.data[dst + 1] = v;
      imageData.data[dst + 2] = v;
      imageData.data[dst + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// Re-export types for convenience.
export type { SliceExtractor };
