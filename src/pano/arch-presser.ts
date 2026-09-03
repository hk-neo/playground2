/**
 * ArchPresser-style panoramic X-ray reconstruction
 * (whnbaek/ArchPresser 알고리즘, single-curve 입력에 맞게 developable surface로 단순화)
 *
 * 핵심 알고리즘 (paper의 ours):
 *   1) developable surface: arch curve (x,y) + z extrusion
 *      surface(u, v) = (x_curve(u), y_curve(u), v * pixelSize)
 *   2) surface normal: developable surface의 normal = (∂y/∂u, -∂x/∂u, 0)
 *      → in-plane perpendicular, 즉 (x,y) 평면에서 curve에 수직
 *   3) thickness-aware ray-sum: normal 방향으로 ±thickness만큼 ray를 쏘고
 *      각 step에서 dominant axis-aligned marching + 2D bilinear interpolation
 *
 * Paper 대비 단순화:
 *   - B-spline surface 생략 (single-curve 입력이라 developable로 충분)
 *   - 4 boundary curves 불필요
 *   - parabolic arch fitting 생략 (사용자 curve가 곧 arch)
 *
 * 출력 형식: (height=hp, width=wp) where
 *   hp = dz * spacing[2] / pixelSize  (depth direction, z)
 *   wp = arcLength / pixelSize        (arc length direction, curve length)
 *   data[v * wp + u] = ray-summed intensity at (arc length u, depth v)
 */
import type { VolumeData } from '../shared/types/volume';
import type { Vec3 } from '../shared/types/core';

const DEFAULT_SAMPLE_COUNT = 512; // arc length 계산용 curve resample 수
const DEFAULT_THICKNESS = 20.0;   // mm
const DEFAULT_PIXEL_SIZE = 0.3;   // mm
const MAX_RAY_STEPS = 512;        // 안전 cap

export type ArchPresserMode = 'sum' | 'mean' | 'min' | 'max';

export interface ArchPresserOptions {
  thickness?: number;   // mm (integration range along surface normal — front-to-back of arch)
  pixelSize?: number;   // mm per pixel in panorama
  mode?: ArchPresserMode;  // IP mode (default 'mean' — panoramic standard)
  /** depth (Z) range to display, in mm. Default: full volume depth */
  depthMinMm?: number;
  depthMaxMm?: number;
}

export interface ArchPresserResult {
  data: Float32Array;
  width: number;   // arc length 방향 (panorama 가로)
  height: number;  // depth 방향 (panorama 세로)
}

interface CurveSampler {
  sample(t: number): Vec3;
}

interface VolumeDataView extends VolumeData {
  byteOffset?: number;
  dataLength?: number;
}

// ── vector helpers ──
function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function length3(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
function getVoxelView(volume: VolumeDataView): Int16Array | Uint16Array {
  const byteOffset = volume.byteOffset ?? 0;
  return volume.dataType === 'int16'
    ? new Int16Array(volume.buffer, byteOffset, volume.dataLength)
    : new Uint16Array(volume.buffer, byteOffset, volume.dataLength);
}

/** Full 3D trilinear interpolation (mm 단위 입력은 voxel 좌표로 변환됨) */
function sampleTrilinear(
  view: Int16Array | Uint16Array,
  dx: number, dy: number, dz: number,
  x: number, y: number, z: number,
): number {
  const x0 = Math.floor(x), x1 = x0 + 1;
  const y0 = Math.floor(y), y1 = y0 + 1;
  const z0 = Math.floor(z), z1 = z0 + 1;
  if (x0 < 0 || x0 >= dx || y0 < 0 || y0 >= dy || z0 < 0 || z0 >= dz) return 0;
  const tx = x - x0, ty = y - y0, tz = z - z0;
  const dxy = dx * dy;
  const v000 = view[z0 * dxy + y0 * dx + x0];
  const v100 = view[z0 * dxy + y0 * dx + x1];
  const v010 = view[z0 * dxy + y1 * dx + x0];
  const v110 = view[z0 * dxy + y1 * dx + x1];
  const v001 = view[z1 * dxy + y0 * dx + x0];
  const v101 = view[z1 * dxy + y0 * dx + x1];
  const v011 = view[z1 * dxy + y1 * dx + x0];
  const v111 = view[z1 * dxy + y1 * dx + x1];
  return (1 - tx) * (1 - ty) * (1 - tz) * v000
       +      tx  * (1 - ty) * (1 - tz) * v100
       + (1 - tx) *      ty  * (1 - tz) * v010
       +      tx  *      ty  * (1 - tz) * v110
       + (1 - tx) * (1 - ty) *      tz  * v001
       +      tx  * (1 - ty) *      tz  * v101
       + (1 - tx) *      ty  *      tz  * v011
       +      tx  *      ty  *      tz  * v111;
}

/**
 * 2D partial bilinear: 4 코너 중 bounds 안인 것만 weighted sum (ray_sum.cpp 동작 그대로).
 * boundary에서 v1 = v0+1 이 dims 초과여도 wrap-around 안 하고 해당 term skip.
 */
function sampleBilinearYZ(
  view: Int16Array | Uint16Array,
  dx: number, dy: number, dz: number,
  xt: number, yt: number, zt: number,
): number {
  const y0 = Math.floor(yt), y1 = y0 + 1;
  const z0 = Math.floor(zt), z1 = z0 + 1;
  if (xt < 0 || xt >= dx || y0 < 0 || y1 >= dy || z0 < 0 || z1 >= dz) return 0;
  const wy = yt - y0, wz = zt - z0;
  const cwy = 1 - wy, cwz = 1 - wz;
  const dxy = dx * dy;
  let res = view[z0 * dxy + y0 * dx + xt] * cwz * cwy;
  if (z1 < dz) res += view[z1 * dxy + y0 * dx + xt] * wz * cwy;
  if (y1 < dy) res += view[z0 * dxy + y1 * dx + xt] * cwz * wy;
  if (z1 < dz && y1 < dy) res += view[z1 * dxy + y1 * dx + xt] * wz * wy;
  return res;
}
function sampleBilinearXZ(
  view: Int16Array | Uint16Array,
  dx: number, dy: number, dz: number,
  xt: number, yt: number, zt: number,
): number {
  const x0 = Math.floor(xt), x1 = x0 + 1;
  const z0 = Math.floor(zt), z1 = z0 + 1;
  if (x0 < 0 || x0 >= dx || yt < 0 || yt >= dy || z0 < 0 || z0 >= dz) return 0;
  const wx = xt - x0, wz = zt - z0;
  const cwx = 1 - wx, cwz = 1 - wz;
  const dxy = dx * dy;
  let res = view[z0 * dxy + yt * dx + x0] * cwz * cwx;
  if (z1 < dz) res += view[z1 * dxy + yt * dx + x0] * wz * cwx;
  if (x1 < dx) res += view[z0 * dxy + yt * dx + x1] * cwz * wx;
  if (z1 < dz && x1 < dx) res += view[z1 * dxy + yt * dx + x1] * wz * wx;
  return res;
}
function sampleBilinearXY(
  view: Int16Array | Uint16Array,
  dx: number, dy: number, dz: number,
  xt: number, yt: number, zt: number,
): number {
  const x0 = Math.floor(xt), x1 = x0 + 1;
  const y0 = Math.floor(yt), y1 = y0 + 1;
  if (x0 < 0 || x0 >= dx || y0 < 0 || y0 >= dy || zt < 0 || zt >= dz) return 0;
  const wx = xt - x0, wy = yt - y0;
  const cwx = 1 - wx, cwy = 1 - wy;
  const dxy = dx * dy;
  let res = view[zt * dxy + y0 * dx + x0] * cwy * cwx;
  if (y1 < dy) res += view[zt * dxy + y1 * dx + x0] * wy * cwx;
  if (x1 < dx) res += view[zt * dxy + y0 * dx + x1] * cwy * wx;
  if (y1 < dy && x1 < dx) res += view[zt * dxy + y1 * dx + x1] * wy * wx;
  return res;
}

/**
 * Axis-aligned ray marching (ArchPresser ray_sum.cpp port).
 * Normal (nx, ny, nz)는 정규화되어 있어야 함.
 * 각 step에서 dominant axis를 ±1 step, 나머지 두 축은 line equation으로 계산 후 2D bilinear.
 * 두 방향(+/-) 모두 진행, thickness 초과 또는 volume 밖이면 stop.
 */
function rayMarchAxisAligned(
  view: Int16Array | Uint16Array,
  dx: number, dy: number, dz: number,
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  thickness: number,
  mode: ArchPresserMode,
): number {
  const dxy = dx * dy;
  const absNx = Math.abs(nx);
  const absNy = Math.abs(ny);
  const absNz = Math.abs(nz);
  let acc = mode === 'min' ? Number.POSITIVE_INFINITY
          : mode === 'max' ? Number.NEGATIVE_INFINITY
          : 0;
  let count = 0;

  if (absNx >= absNy && absNx >= absNz) {
    // x dominant
    const xFloor = Math.floor(x);
    // forward (t=1,2,...)
    for (let t = 1; t < MAX_RAY_STEPS; t++) {
      const xt = xFloor + t;
      if (xt >= dx) break;
      const yt = y + t * (ny / nx);
      const zt = z + t * (nz / nx);
      const dx_ = xt - x, dy_ = yt - y, dz_ = zt - z;
      if (dx_ * dx_ + dy_ * dy_ + dz_ * dz_ > thickness * thickness) break;
      if (yt < 0 || yt >= dy || zt < 0 || zt >= dz) break;
      const v = sampleBilinearYZ(view, dx, dy, dz, xt, yt, zt);
      if (mode === 'min') { if (v < acc) acc = v; }
      else if (mode === 'max') { if (v > acc) acc = v; }
      else acc += v;
      count++;
    }
    // backward (t=0,-1,-2,...) — t=0 include start point voxel
    for (let t = 0; t >= -MAX_RAY_STEPS; t--) {
      const xt = xFloor + t;
      if (xt < 0) break;
      const yt = y + t * (ny / nx);
      const zt = z + t * (nz / nx);
      const dx_ = xt - x, dy_ = yt - y, dz_ = zt - z;
      if (dx_ * dx_ + dy_ * dy_ + dz_ * dz_ > thickness * thickness) break;
      if (yt < 0 || yt >= dy || zt < 0 || zt >= dz) break;
      const v = sampleBilinearYZ(view, dx, dy, dz, xt, yt, zt);
      if (mode === 'min') { if (v < acc) acc = v; }
      else if (mode === 'max') { if (v > acc) acc = v; }
      else acc += v;
      count++;
    }
  } else if (absNy >= absNx && absNy >= absNz) {
    // y dominant
    const yFloor = Math.floor(y);
    for (let t = 1; t < MAX_RAY_STEPS; t++) {
      const yt = yFloor + t;
      if (yt >= dy) break;
      const xt = x + t * (nx / ny);
      const zt = z + t * (nz / ny);
      const dx_ = xt - x, dy_ = yt - y, dz_ = zt - z;
      if (dx_ * dx_ + dy_ * dy_ + dz_ * dz_ > thickness * thickness) break;
      if (xt < 0 || xt >= dx || zt < 0 || zt >= dz) break;
      const v = sampleBilinearXZ(view, dx, dy, dz, xt, yt, zt);
      if (mode === 'min') { if (v < acc) acc = v; }
      else if (mode === 'max') { if (v > acc) acc = v; }
      else acc += v;
      count++;
    }
    for (let t = 0; t >= -MAX_RAY_STEPS; t--) {
      const yt = yFloor + t;
      if (yt < 0) break;
      const xt = x + t * (nx / ny);
      const zt = z + t * (nz / ny);
      const dx_ = xt - x, dy_ = yt - y, dz_ = zt - z;
      if (dx_ * dx_ + dy_ * dy_ + dz_ * dz_ > thickness * thickness) break;
      if (xt < 0 || xt >= dx || zt < 0 || zt >= dz) break;
      const v = sampleBilinearXZ(view, dx, dy, dz, xt, yt, zt);
      if (mode === 'min') { if (v < acc) acc = v; }
      else if (mode === 'max') { if (v > acc) acc = v; }
      else acc += v;
      count++;
    }
  } else {
    // z dominant
    const zFloor = Math.floor(z);
    for (let t = 1; t < MAX_RAY_STEPS; t++) {
      const zt = zFloor + t;
      if (zt >= dz) break;
      const xt = x + t * (nx / nz);
      const yt = y + t * (ny / nz);
      const dx_ = xt - x, dy_ = yt - y, dz_ = zt - z;
      if (dx_ * dx_ + dy_ * dy_ + dz_ * dz_ > thickness * thickness) break;
      if (xt < 0 || xt >= dx || yt < 0 || yt >= dy) break;
      const v = sampleBilinearXY(view, dx, dy, dz, xt, yt, zt);
      if (mode === 'min') { if (v < acc) acc = v; }
      else if (mode === 'max') { if (v > acc) acc = v; }
      else acc += v;
      count++;
    }
    for (let t = 0; t >= -MAX_RAY_STEPS; t--) {
      const zt = zFloor + t;
      if (zt < 0) break;
      const xt = x + t * (nx / nz);
      const yt = y + t * (ny / nz);
      const dx_ = xt - x, dy_ = yt - y, dz_ = zt - z;
      if (dx_ * dx_ + dy_ * dy_ + dz_ * dz_ > thickness * thickness) break;
      if (xt < 0 || xt >= dx || yt < 0 || yt >= dy) break;
      const v = sampleBilinearXY(view, dx, dy, dz, xt, yt, zt);
      if (mode === 'min') { if (v < acc) acc = v; }
      else if (mode === 'max') { if (v > acc) acc = v; }
      else acc += v;
      count++;
    }
  }
  if (mode === 'mean' && count > 0) acc = acc / count;
  return acc;
}

export class ArchPresser {
  private _thickness: number;
  private _pixelSize: number;
  private _mode: ArchPresserMode;
  private _depthMinMm: number;
  private _depthMaxMm: number;

  constructor(opts: ArchPresserOptions = {}) {
    this._thickness = Math.max(0, opts.thickness ?? DEFAULT_THICKNESS);
    this._pixelSize = Math.max(0.05, opts.pixelSize ?? DEFAULT_PIXEL_SIZE);
    this._mode = opts.mode ?? 'mean';
    this._depthMinMm = opts.depthMinMm ?? -Infinity;
    this._depthMaxMm = opts.depthMaxMm ?? Infinity;
  }

  setThickness(t: number): void {
    this._thickness = Math.max(0, t);
  }
  setPixelSize(p: number): void {
    this._pixelSize = Math.max(0.05, p);
  }
  setMode(m: ArchPresserMode): void {
    this._mode = m;
  }
  get thickness(): number { return this._thickness; }
  get pixelSize(): number { return this._pixelSize; }
  get mode(): ArchPresserMode { return this._mode; }
  get depthMinMm(): number { return this._depthMinMm; }
  get depthMaxMm(): number { return this._depthMaxMm; }
  setDepthRangeMm(min: number, max: number): void {
    this._depthMinMm = min;
    this._depthMaxMm = max;
  }

  /**
   * ArchPresser-style panorama reconstruction.
   *
   * 입력: IPanoramicCurve + VolumeData
   * 출력: { data, width, height }
   *   - data: row-major Float32Array, length = width * height
   *   - width  = wp = arc length / pixelSize (panorama 가로)
   *   - height = hp = depth / pixelSize      (panorama 세로)
   *   - data[v * wp + u] = pixel at (arc length u, depth v)
   *
   * 알고리즘:
   *   1) curve를 N개 균등 샘플링 + arc length 계산
   *   2) developable surface: (u, v) → (x_curve(u), y_curve(u), v * pixelSize)
   *   3) surface normal = in-plane perpendicular (x,y 평면에서 curve 수직)
   *   4) 각 (u, v)에서 normal 방향으로 ray-sum (axis-aligned marching)
   */
  extract(curve: CurveSampler, volume: VolumeDataView): ArchPresserResult {
    const view = getVoxelView(volume);
    const dims = volume.dimensions;
    const spacing = volume.spacing;
    const [dx, dy, dz] = dims;
    const px = spacing[0] || this._pixelSize;
    const py = spacing[1] || this._pixelSize;
    const pz = spacing[2] || this._pixelSize;

    // 1) curve 균등 resample + arc length
    const N = DEFAULT_SAMPLE_COUNT;
    const xs = new Float32Array(N);
    const ys = new Float32Array(N);
    const arcLen = new Float32Array(N);
    arcLen[0] = 0;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const p = curve.sample(t);
      xs[i] = p.x;
      ys[i] = p.y;
      if (i > 0) {
        const dxs = xs[i] - xs[i - 1];
        const dys = ys[i] - ys[i - 1];
        // 3D arc length (mm 환산)
        arcLen[i] = arcLen[i - 1] + Math.sqrt(dxs * dxs * px * px + dys * dys * py * py);
      }
    }
    const totalArc = arcLen[N - 1];

    // 2) panorama 차원 (depth range로 clip)
    const depthStartMm = Math.max(this._depthMinMm, 0);
    const depthEndMm = Math.min(this._depthMaxMm, dz * pz);
    const hp = Math.max(1, Math.floor((depthEndMm - depthStartMm) / this._pixelSize));
    const wp = Math.max(1, Math.floor(totalArc / this._pixelSize));

    const out = new Float32Array(hp * wp);

    // Curve geometry depends only on the output column, not the depth row.
    const columnX = new Float64Array(wp);
    const columnY = new Float64Array(wp);
    const columnNormalX = new Float64Array(wp);
    const columnNormalY = new Float64Array(wp);
    let segIdx = 0;
    for (let u = 0; u < wp; u++) {
      const arcU = u * this._pixelSize;
      while (segIdx < N - 1 && arcLen[segIdx + 1] < arcU) segIdx++;

      const nextSegIdx = Math.min(segIdx + 1, N - 1);
      const segStart = arcLen[segIdx];
      const segEnd = segIdx < N - 1 ? arcLen[nextSegIdx] : segStart + this._pixelSize;
      const segLen = segEnd - segStart;
      const localT = segLen > 0 ? (arcU - segStart) / segLen : 0;
      columnX[u] = xs[segIdx] + (xs[nextSegIdx] - xs[segIdx]) * localT;
      columnY[u] = ys[segIdx] + (ys[nextSegIdx] - ys[segIdx]) * localT;

      const dx_ds = (xs[nextSegIdx] - xs[segIdx]) * (px / Math.max(segLen, 1e-9));
      const dy_ds = (ys[nextSegIdx] - ys[segIdx]) * (py / Math.max(segLen, 1e-9));
      const nx = -dy_ds / px;
      const ny = dx_ds / py;
      const nLen = Math.sqrt(nx * nx + ny * ny);
      columnNormalX[u] = nLen > 1e-9 ? nx / nLen : 0;
      columnNormalY[u] = nLen > 1e-9 ? ny / nLen : 0;
    }

    const avgSpacing = (px + py + pz) / 3;
    const thicknessVox = this._thickness / avgSpacing;

    // 3) 각 (u, v)마다 ray-sum
    // z 반전: CBCT z=0은 보통 하악(chin) 방향, z=dz-1은 머리 위쪽.
    // 파노라마 이미지의 v=0(상단)이 머리 위쪽, v=hp-1(하단)이 턱이 되도록 반전.
    for (let v = 0; v < hp; v++) {
      const zVox = (dz - 1) - (depthStartMm + v * this._pixelSize) / pz;  // depth(mm) → voxel z (inverted)

      for (let u = 0; u < wp; u++) {
        // surface position (developable: x,y from curve, z from v)
        const pxPos = columnX[u];
        const pyPos = columnY[u];
        const pzPos = zVox;

        const val = rayMarchAxisAligned(
          view,
          dx,
          dy,
          dz,
          pxPos,
          pyPos,
          pzPos,
          columnNormalX[u],
          columnNormalY[u],
          0,
          thicknessVox,
          this._mode,
        );
        out[v * wp + u] = val;
      }
    }

    return { data: out, width: wp, height: hp };
  }
}
