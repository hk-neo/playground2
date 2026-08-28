import type { VolumeData } from '../shared/types/volume';
import type { Vec3 } from '../shared/types/core';
import type { TroughMode } from '../shared/types/rendering';
import type { IPanoramicCurve, IFocalTrough, FocalTroughExtractOptions, FocalTroughExtractResult } from '../shared/interfaces/pano';

const DEFAULT_SAMPLE_COUNT = 256; // 곡선을 따라 균등 샘플링할 개수 (= panorama의 가로 픽셀 수)
// 기본 focal trough in-plane 두께 (mm). 5~15mm 범위가 dental 표준 — full 머리 깊이
// (~200mm) 적분은 noise/artifact를 만들므로 curve 중심에서 좁게만 적분한다.
const DEFAULT_THICKNESS = 15.0;
const MAX_RAY_SAMPLES = 128; // normal 방향 IP ray sample cap (성능/품질 균형)
const EPSILON = 1e-9;

class InsufficientCurveError extends Error {
  constructor() {
    super('FocalTrough.extract: curve must have at least 2 points');
    this.name = 'InsufficientCurveError';
  }
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function normalize3(v: Vec3): Vec3 {
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m < EPSILON) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function getVoxelView(volume: VolumeData): Int16Array | Uint16Array {
  return volume.dataType === 'int16'
    ? new Int16Array(volume.buffer)
    : new Uint16Array(volume.buffer);
}

/** 두 직교 단위벡터의 정규화된 cross. degenerate면 zero */
function crossNormalized(a: Vec3, b: Vec3): Vec3 {
  const cx = a.y * b.z - a.z * b.y;
  const cy = a.z * b.x - a.x * b.z;
  const cz = a.x * b.y - a.y * b.x;
  const m = Math.sqrt(cx * cx + cy * cy + cz * cz);
  if (m < EPSILON) return { x: 0, y: 0, z: 0 };
  return { x: cx / m, y: cy / m, z: cz / m };
}

export interface FocalTroughOptions {
  thickness?: number;
  mode?: TroughMode;
  sampleCount?: number;
  /** voxel z range to integrate (default: full CBCT z) */
  zMin?: number;
  zMax?: number;
}

export class FocalTrough implements IFocalTrough {
  private _thickness: number;
  private _mode: TroughMode;
  private _sampleCount: number;
  private _zMin: number;  // voxel
  private _zMax: number;  // voxel (Infinity = full)
  // detectBestDepthRange 캐시: volume 객체 identity 기준으로 결과 보관.
  // 같은 volume에 대해 여러 번 호출되어도 variance 계산은 한 번만.
  private _cachedDepthRange: { volume: VolumeData; result: { zMin: number; zMax: number } } | null = null;

  constructor(opts: FocalTroughOptions = {}) {
    this._thickness = Math.max(0, opts.thickness ?? DEFAULT_THICKNESS);
    this._mode = opts.mode ?? 'min';
    this._sampleCount = Math.max(8, opts.sampleCount ?? DEFAULT_SAMPLE_COUNT);
    this._zMin = 0;
    this._zMax = Infinity;
  }

  setDepthRangeVox(min: number, max: number): void {
    this._zMin = Math.max(0, min);
    this._zMax = max;
  }

  get thickness(): number {
    return this._thickness;
  }

  get mode(): TroughMode {
    return this._mode;
  }

  setThickness(t: number): void {
    this._thickness = Math.max(0, t);
  }

  setMode(m: TroughMode): void {
    this._mode = m;
  }

  /**
   * 자동으로 teeth/structure z 범위 검출.
   * 볼륨의 각 z 슬라이스에 대해 (x,y) 위치들의 variance가 가장 높은 z 구간을 반환.
   * (구조가 가장 많은 = 공기가 가장 적은 = teeth/bone 있는 구간)
   */
  detectBestDepthRange(volume: VolumeData, windowSize = 40): { zMin: number; zMax: number } {
    // 캐시 적중: 같은 volume 객체면 즉시 반환 (curve drag 중 매 프레임 호출되어도
    // variance 계산은 첫 호출 1회만 — 매번 CBCT 전체 z 스캔하던 비용 제거).
    const cached = this._cachedDepthRange;
    if (cached && cached.volume === volume) {
      return cached.result;
    }
    const view = getVoxelView(volume);
    const dims = volume.dimensions;
    const [dx, dy, dz] = dims;
    const dxy = dx * dy;
    const strideXY = 6;
    const strideZ = 4;
    let bestVar = -Infinity;
    let bestZ = 0;
    for (let z = 0; z + windowSize < dz; z += strideZ) {
      let sum = 0, sumSq = 0, count = 0;
      for (let zz = z; zz < z + windowSize; zz += strideZ) {
        for (let y = 0; y < dy; y += strideXY) {
          for (let x = 0; x < dx; x += strideXY) {
            const v = view[zz * dxy + y * dx + x];
            sum += v; sumSq += v * v; count++;
          }
        }
      }
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      if (variance > bestVar) { bestVar = variance; bestZ = z; }
    }
    const result = { zMin: bestZ, zMax: Math.min(dz - 1, bestZ + windowSize) };
    this._cachedDepthRange = { volume, result };
    return result;
  }

  /**
   * 곡선과 볼륨으로부터 2D intensity 맵을 추출 (proper panoramic IP).
   *
   * 기하:
   *   - curve: 파노라믹 곡선 (치아궁)
   *   - planeNormal: curve가 놓인 평면의 법선
   *   - tangent(t): curve의 t에서의 접선
   *   - inPlanePerp(t) = normalize(tangent × planeNormal):
   *       curve 평면 안에서 curve에 수직인 방향 (= panorama의 **세로축** = 전후 깊이)
   *
   * 각 픽셀: out[inPlaneIdx * sampleCount + curveIdx]
   *   = IP(ray, mode)
   *   ray.origin = samples[curveIdx] + inPlanePerp[curveIdx] * inPlaneOffset
   *   ray.direction = planeNormal
   *   ray.range = full CBCT extent along planeNormal
   *
   * 성능: ray sample 수를 MAX_RAY_SAMPLES로 cap (128 ≈ 1~2mm stride).
   *
   * @returns Float32Array, 길이 = width * sampleCount, row-major
   *   row = in-plane sample (panorama의 세로), col = curve sample (panorama의 가로)
   */
  extract(curve: IPanoramicCurve, volume: VolumeData, opts?: FocalTroughExtractOptions): FocalTroughExtractResult {
    if (curve.points.length < 2) {
      throw new InsufficientCurveError();
    }
    // mm-based pixel counts (정사각형 픽셀이 아니라 curve 길이(mm)와 thickness(mm에 비례).
    // mmPerPixel 기본값 = volume.spacing[0] (CBCT 보통 0.3~0.5 mm).
    const mmPerPixel = (opts?.mmPerPixel && opts.mmPerPixel > 0)
      ? opts.mmPerPixel
      : (volume.spacing[0] > 0 ? volume.spacing[0] : 0.5);
    const curveWidth = (opts?.curveSamples && opts.curveSamples > 0)
      ? Math.floor(opts.curveSamples)
      : Math.max(8, Math.ceil(curve.length() / mmPerPixel));
    const inPlaneWidth = (opts?.inPlaneSamples && opts.inPlaneSamples > 0)
      ? Math.floor(opts.inPlaneSamples)
      : Math.max(8, Math.ceil(this._thickness / mmPerPixel));

    const view = getVoxelView(volume);
    const dims = volume.dimensions;
    const spacing = volume.spacing;
    const n = curveWidth;
    const width = inPlaneWidth;
    const out = new Float32Array(inPlaneWidth * curveWidth);

    // 1) Curve samples + tangents
    const samples: Vec3[] = new Array(n);
    const tangents: Vec3[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      samples[i] = curve.sample(t);
      tangents[i] = curve.tangent(t);
    }

    // 2) Plane normal (curve 평면 법선; degenerate면 (0,0,1))
    let planeNormal: Vec3 = { x: 0, y: 0, z: 1 };
    if (samples.length >= 3) {
      planeNormal = crossNormalized(sub3(samples[1], samples[0]), sub3(samples[2], samples[0]));
      if (planeNormal.x === 0 && planeNormal.y === 0 && planeNormal.z === 0) {
        planeNormal = { x: 0, y: 0, z: 1 };
      }
    }

    // 3) normal 방향 적분 범위는 dz 선언 *뒤* 에서 계산 (Hoisting 이슈 회피)

    // 4) curveIdx별 inPlanePerp pre-compute (per-curve, loop 밖)
    const inPlanePerps: Vec3[] = new Array(n);
    for (let i = 0; i < n; i++) {
      inPlanePerps[i] = crossNormalized(tangents[i], planeNormal);
    }

    // 5) 핫 루프 진입 — 모든 상수는 로컬 변수로 hoisting
    const halfThickness = this._thickness * 0.5;
    const mode = this._mode;
    const pnx = planeNormal.x;
    const pny = planeNormal.y;
    const pnz = planeNormal.z;
    const dx = dims[0];
    const dy = dims[1];
    const dz = dims[2];
    const dxy = dx * dy;
    const dxMax = dx - 1;

    // 3) normal 방향 적분 범위(voxel) — zMin~zMax (curve z와 독립)
    //    핵심 수정: 적분 z 범위를 curve z 기준 ±extent가 아니라
    //    독립적인 zMin~zMax(voxel) 범위로. curve z가 어디든 teeth z 범위 적분 가능.
    const zMaxEff = Math.min(this._zMax === Infinity ? dz - 1 : this._zMax, dz - 1);
    const zMinEff = Math.max(0, this._zMin);
    const extentZ = Math.max(1, zMaxEff - zMinEff + 1);
    const numRaySamples = Math.max(8, Math.min(MAX_RAY_SAMPLES, Math.ceil(extentZ)));
    const rayStride = numRaySamples > 1 ? extentZ / (numRaySamples - 1) : 0;
    // Ray origin z는 zMin부터 시작 (curve z와 무관)
    const rayStartZ = zMinEff;
    const dyMax = dy - 1;
    const dzMax = dz - 1;
    const thickness = this._thickness;
    const isMean = mode === 'mean';
    const isMax = mode === 'max';

    for (let inPlaneIdx = 0; inPlaneIdx < width; inPlaneIdx++) {
      const inPlaneOffset = width === 1 ? 0 : (inPlaneIdx / (width - 1)) * thickness - halfThickness;

      for (let curveIdx = 0; curveIdx < n; curveIdx++) {
        const center = samples[curveIdx];
        const ip = inPlanePerps[curveIdx];

        const ox = center.x + ip.x * inPlaneOffset;
        const oy = center.y + ip.y * inPlaneOffset;
        // z는 ray origin(zMin)에서 시작, in-plane은 (x,y) 평면 수직
        const oz = rayStartZ + ip.z * inPlaneOffset;

        let acc: number;
        if (isMean) {
          let sum = 0;
          for (let s = 0; s < numRaySamples; s++) {
            const off = s * rayStride;
            let x = Math.round(ox + pnx * off); if (x < 0) x = 0; else if (x > dxMax) x = dxMax;
            let y = Math.round(oy + pny * off); if (y < 0) y = 0; else if (y > dyMax) y = dyMax;
            let z = Math.round(oz + pnz * off); if (z < 0) z = 0; else if (z > dzMax) z = dzMax;
            sum += view[z * dxy + y * dx + x];
          }
          acc = sum / numRaySamples;
        } else if (isMax) {
          acc = -Infinity;
          for (let s = 0; s < numRaySamples; s++) {
            const off = s * rayStride;
            let x = Math.round(ox + pnx * off); if (x < 0) x = 0; else if (x > dxMax) x = dxMax;
            let y = Math.round(oy + pny * off); if (y < 0) y = 0; else if (y > dyMax) y = dyMax;
            let z = Math.round(oz + pnz * off); if (z < 0) z = 0; else if (z > dzMax) z = dzMax;
            const v = view[z * dxy + y * dx + x];
            if (v > acc) acc = v;
          }
        } else {
          // min
          acc = Infinity;
          for (let s = 0; s < numRaySamples; s++) {
            const off = s * rayStride;
            let x = Math.round(ox + pnx * off); if (x < 0) x = 0; else if (x > dxMax) x = dxMax;
            let y = Math.round(oy + pny * off); if (y < 0) y = 0; else if (y > dyMax) y = dyMax;
            let z = Math.round(oz + pnz * off); if (z < 0) z = 0; else if (z > dzMax) z = dzMax;
            const v = view[z * dxy + y * dx + x];
            if (v < acc) acc = v;
          }
        }

        out[inPlaneIdx * n + curveIdx] = acc;
      }
    }

    return { data: out, curveWidth, inPlaneWidth };
  }
}
