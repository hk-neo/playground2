/**
 * Curve frame sampler — panoramic curve를 arc-length로 균등 샘플링하고
 * 각 샘플에서 Frenet-like frame(T/N/B)을 계산한다.
 *
 *   T = tangent (arch 진행 방향)
 *   N = normalize(T × up)   → in-plane perpendicular (협설 방향)
 *   B = normalize(N × T)    → 상하 (axial-plane curve에서 ≈ Z)
 *
 * arc-length 균등 샘플링은 곡선 굴곡에서의 panorama 가로 압축/확장 왜곡을
 * 제거한다 (원본 ArchPresser의 호길이 재매개화와 동일 원리).
 *
 * 순수 데이터 계층 — DOM/Canvas 접근 없음.
 */
import type { Vec3 } from '../shared/types/core';
import type { IPanoramicCurve } from '../shared/interfaces/pano';

const EPSILON = 1e-9;
const DEFAULT_SAMPLE_COUNT = 256;

export interface CurveFrame {
  position: Vec3;
  tangent: Vec3;   // T
  normal: Vec3;    // N (협설)
  binormal: Vec3;  // B (상하)
  arcLength: number;
}

function normalize3(v: Vec3): Vec3 {
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m < EPSILON) return { x: 0, y: 0, z: 1 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** 접선으로부터 협설법선(N)과 상하(B)를 계산. up = (0,0,1) 기준. */
export function computeFrameAxes(
  tangent: Vec3,
  up: Vec3 = { x: 0, y: 0, z: 1 },
): { normal: Vec3; binormal: Vec3 } {
  const t = normalize3(tangent);
  const rawN = cross3(t, up);
  let normal = normalize3(rawN);
  // tangent가 up과 평행(수직 곡선)이면 다른 기준축 사용
  if (Math.hypot(rawN.x, rawN.y, rawN.z) < EPSILON) {
    normal = normalize3(cross3(t, { x: 0, y: 1, z: 0 }));
  }
  const binormal = normalize3(cross3(normal, t));
  return { normal, binormal };
}

/**
 * PanoramicCurve를 arc-length 균등 샘플링해 frame 배열을 만든다.
 * 호출부(arch-spline, cross-section, wiring)에서 일관된 프레임을 공유한다.
 */
export class CurveFrameSampler {
  private _frames: CurveFrame[] = [];
  private _arcTable: Float32Array = new Float32Array(0);
  private _total = 0;

  constructor(curve: IPanoramicCurve, sampleCount: number = DEFAULT_SAMPLE_COUNT) {
    const count = Math.max(8, Math.floor(sampleCount));
    this.build(curve, count);
  }

  private build(curve: IPanoramicCurve, count: number): void {
    const frames: CurveFrame[] = new Array(count);
    let acc = 0;
    let prev: Vec3 | null = null;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const pos = curve.sample(t);
      const tangent = curve.tangent(t);
      const { normal, binormal } = computeFrameAxes(tangent);
      if (prev) {
        const d = sub3(pos, prev);
        acc += Math.hypot(d.x, d.y, d.z);
      }
      frames[i] = { position: pos, tangent, normal, binormal, arcLength: acc };
      prev = pos;
    }

    const arcTable = new Float32Array(count);
    for (let i = 0; i < count; i++) arcTable[i] = frames[i].arcLength;
    this._frames = frames;
    this._arcTable = arcTable;
    this._total = frames[count - 1].arcLength;
  }

  get totalArcLength(): number {
    return this._total;
  }

  get frameCount(): number {
    return this._frames.length;
  }

  get frames(): readonly CurveFrame[] {
    return this._frames;
  }

  /** index(0..count-1) 접근 (GPU 텍스처 패킹 등에 비 프레임) */
  frameAt(index: number): CurveFrame {
    const i = Math.max(0, Math.min(this._frames.length - 1, Math.floor(index)));
    return this._frames[i];
  }

  /** 정규화 arc-length u∈[0,1] → 프레임. */
  frameAtU(u: number): CurveFrame {
    return this.frameAtArc(u * this._total);
  }

  /** arc-length(mm/voxel) → segment 탐색 + 선형 보간된 프레임. */
  frameAtArc(s: number): CurveFrame {
    const n = this._frames.length;
    if (n === 0) {
      return {
        position: { x: 0, y: 0, z: 0 },
        tangent: { x: 1, y: 0, z: 0 },
        normal: { x: 0, y: 1, z: 0 },
        binormal: { x: 0, y: 0, z: 1 },
        arcLength: 0,
      };
    }
    if (this._total < EPSILON) return this._frames[0];
    let clamped = s;
    if (clamped <= 0) return this._frames[0];
    if (clamped >= this._total) return this._frames[n - 1];

    // 이진 탐색: arcTable[seg] <= s < arcTable[seg+1]
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this._arcTable[mid] <= clamped) lo = mid;
      else hi = mid;
    }
    const s0 = this._arcTable[lo];
    const s1 = this._arcTable[hi];
    const segLen = s1 - s0;
    const f = segLen > EPSILON ? (clamped - s0) / segLen : 0;
    return this.lerpFrame(this._frames[lo], this._frames[hi], f);
  }

  private lerpFrame(a: CurveFrame, b: CurveFrame, f: number): CurveFrame {
    const lerp = (p: Vec3, q: Vec3): Vec3 => ({
      x: p.x + (q.x - p.x) * f,
      y: p.y + (q.y - p.y) * f,
      z: p.z + (q.z - p.z) * f,
    });
    return {
      position: lerp(a.position, b.position),
      tangent: normalize3(lerp(a.tangent, b.tangent)),
      normal: normalize3(lerp(a.normal, b.normal)),
      binormal: normalize3(lerp(a.binormal, b.binormal)),
      arcLength: a.arcLength + (b.arcLength - a.arcLength) * f,
    };
  }
}