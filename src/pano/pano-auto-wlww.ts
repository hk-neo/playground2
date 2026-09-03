/**
 * Auto WL/WW computation for panorama intensity data.
 *
 * After ArchPresser mean integration over ~15mm thickness, the data distribution
 * differs significantly from raw CBCT voxels (compressed dynamic range).
 * This utility computes WL/WW from the actual data percentiles so the full
 * 0–255 display range is used, ensuring optimal contrast.
 */

export interface AutoWLWWResult {
  /** Window Level (center of the display range) */
  wl: number;
  /** Window Width (width of the display range) */
  ww: number;
  /** Lower percentile value (default: p2) */
  pLow: number;
  /** Upper percentile value (default: p98) */
  pHigh: number;
}

export interface AutoWLWWOptions {
  /** Lower percentile (0–100). Default: 2 */
  lowerPercentile?: number;
  /** Upper percentile (0–100). Default: 98 */
  upperPercentile?: number;
  /** Minimum window width to prevent degenerate cases. Default: 1 */
  minWindowWidth?: number;
}

const SAFE_DEFAULT_WL = 400;
const SAFE_DEFAULT_WW = 1500;

/**
 * Compute optimal WL/WW from panorama intensity data using percentiles.
 *
 * Scans the data for finite values, sorts them, and picks the lower/upper
 * percentile values. WL = (pLow + pHigh) / 2, WW = pHigh - pLow.
 *
 * The input array is NOT mutated.
 */
export function computeAutoWLWW(
  data: Float32Array,
  opts?: AutoWLWWOptions,
): AutoWLWWResult {
  const lowerP = opts?.lowerPercentile ?? 2;
  const upperP = opts?.upperPercentile ?? 98;
  const minWW = opts?.minWindowWidth ?? 1;

  if (data.length === 0) {
    return { wl: SAFE_DEFAULT_WL, ww: SAFE_DEFAULT_WW, pLow: 0, pHigh: 0 };
  }

  // Collect finite values (this copies — sort mutates in-place)
  const valid: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (Number.isFinite(data[i])) valid.push(data[i]);
  }
  if (valid.length === 0) {
    return { wl: SAFE_DEFAULT_WL, ww: SAFE_DEFAULT_WW, pLow: 0, pHigh: 0 };
  }

  // Sort ascending — V8's TimSort is highly optimized
  valid.sort((a, b) => a - b);

  const loIdx = Math.min(Math.floor(valid.length * lowerP / 100), valid.length - 1);
  const hiIdx = Math.min(Math.floor(valid.length * upperP / 100), valid.length - 1);

  const pLow = valid[loIdx];
  const pHigh = valid[hiIdx];
  const ww = Math.max(pHigh - pLow, minWW);
  const wl = (pLow + pHigh) / 2;

  return { wl, ww, pLow, pHigh };
}
