import type { Vec3, Dimensions } from '../shared/types/core';
import type { CurveSnapshot, CurvePreset } from '../shared/types/rendering';
import type { IPanoramicCurve, IPanoramicCurveConstructor } from '../shared/interfaces/pano';

const MIN_POINTS_FOR_SAMPLING = 2;
const EPSILON = 1e-9;

class EmptyCurveError extends Error {
  constructor(method: string) {
    super(`PanoramicCurve.${method}() requires at least ${MIN_POINTS_FOR_SAMPLING} points`);
    this.name = 'EmptyCurveError';
  }
}

class IndexOutOfRangeError extends Error {
  constructor(index: number, length: number) {
    super(`PanoramicCurve: index ${index} out of range (length=${length})`);
    this.name = 'IndexOutOfRangeError';
  }
}

// ─────────────── Natural cubic spline (open curve, C² 연속) ───────────────
// 원본 ArchPresser가 쓰는 보간. Catmull-Rom(C¹)보다 부드러워 CPR 표면 꺾임 제거.
// points를 통과하는 natural cubic spline (2차 도함수 경계=0, uniform parameter).

interface CubicSegment1D {
  a: number;
  b: number;
  c: number;
  d: number; // a + b·u + c·u² + d·u³
}

/** natural cubic spline의 각 점 2차 도함수 M[i] (tri-diagonal solve) */
function solveNaturalCubicSecondDeriv(vals: number[], n: number): number[] {
  if (n <= 1) return new Array(n + 1).fill(0);
  const h = 1 / n;
  const M = new Array<number>(n + 1).fill(0); // M[0]=M[n]=0 (natural 경계)
  const d = new Array<number>(n + 1).fill(4); // 대각
  const rhs = new Array<number>(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    rhs[i] = (6 / (h * h)) * (vals[i + 1] - 2 * vals[i] + vals[i - 1]);
  }
  // forward elimination (부대각 = 1)
  for (let i = 1; i < n; i++) {
    const w = 1 / d[i - 1];
    d[i] -= w;            // d[i] - 1·1
    rhs[i] -= w * rhs[i - 1];
  }
  // back substitution
  M[n - 1] = rhs[n - 1] / d[n - 1];
  for (let i = n - 2; i >= 1; i--) {
    M[i] = (rhs[i] - M[i + 1]) / d[i];
  }
  return M;
}

function buildNaturalCubicSegments(vals: number[], n: number): CubicSegment1D[] {
  const M = solveNaturalCubicSecondDeriv(vals, n);
  const h = 1 / n;
  const h2 = h * h;
  // 계수는 "간격 내 u ∈ [0,1)" 스케일로 변환 저장.
  // t-스케일 계수(bt, ct, dt)에 대해 bh=h*h 단위로 환산.
  const segs: CubicSegment1D[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const bt = (vals[i + 1] - vals[i]) / h - (h * (2 * M[i] + M[i + 1])) / 6;
    const ct = M[i] / 2;
    const dt = (M[i + 1] - M[i]) / (6 * h);
    segs[i] = {
      a: vals[i],
      b: bt * h,
      c: ct * h2,
      d: dt * h2 * h,
    };
  }
  return segs;
}

function evalCubic1D(seg: CubicSegment1D, u: number): number {
  return seg.a + seg.b * u + seg.c * u * u + seg.d * u * u * u;
}

function evalCubic1DDeriv(seg: CubicSegment1D, u: number): number {
  return seg.b + 2 * seg.c * u + 3 * seg.d * u * u;
}

/** open curve의 natural cubic spline (x/y/z 각 축 계수) */
interface NaturalCubic3D {
  segsX: CubicSegment1D[];
  segsY: CubicSegment1D[];
  segsZ: CubicSegment1D[];
  n: number;
}

function fitNaturalCubic3D(points: Vec3[]): NaturalCubic3D {
  const n = points.length - 1;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const zs = points.map((p) => p.z);
  return {
    segsX: buildNaturalCubicSegments(xs, n),
    segsY: buildNaturalCubicSegments(ys, n),
    segsZ: buildNaturalCubicSegments(zs, n),
    n,
  };
}

function evalNaturalCubic3D(s: NaturalCubic3D, t: number): Vec3 {
  const scaled = t * s.n;
  const idx = Math.min(Math.floor(scaled), s.n - 1);
  const u = scaled - idx;
  return {
    x: evalCubic1D(s.segsX[idx], u),
    y: evalCubic1D(s.segsY[idx], u),
    z: evalCubic1D(s.segsZ[idx], u),
  };
}

function tangentNaturalCubic3D(s: NaturalCubic3D, t: number): Vec3 {
  const scaled = t * s.n;
  const idx = Math.min(Math.floor(scaled), s.n - 1);
  const u = scaled - idx;
  const v = {
    x: evalCubic1DDeriv(s.segsX[idx], u),
    y: evalCubic1DDeriv(s.segsY[idx], u),
    z: evalCubic1DDeriv(s.segsZ[idx], u),
  };
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m < EPSILON) return { x: 1, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

/** 3D Catmull-Rom 스플라인 보간 (uniform) — closed curve 전용 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/** t (0..1) 위치의 인덱스 segment와 로컬 t 계산 (closed 여부 반영) */
function locateSegment(t: number, n: number, closed: boolean): { i: number; local: number; n: number } {
  if (closed) {
    const segCount = n;
    const idxF = t * segCount;
    const i = Math.floor(idxF) % segCount;
    const local = idxF - Math.floor(idxF);
    return { i, local, n: segCount };
  }
  // open: n points → n-1 segments
  const segCount = Math.max(1, n - 1);
  const idxF = t * segCount;
  const i = Math.min(Math.floor(idxF), segCount - 1);
  const local = idxF - Math.floor(idxF);
  return { i, local, n: segCount };
}

/** 인덱스에 해당하는 4개 컨트롤 포인트 wrap 처리 */
function get4Points(points: Vec3[], i: number, closed: boolean): [Vec3, Vec3, Vec3, Vec3] {
  const n = points.length;
  if (closed) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i % n];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    return [p0, p1, p2, p3];
  }
  // open: 가장자리는 mirror
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(n - 1, i + 2)];
  return [p0, p1, p2, p3];
}

/** 두 3D 점 사이의 유클리드 거리 */
function dist3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** 3D 점의 뺄셈 */
function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** 3D 벡터 정규화 */
function normalize3(v: Vec3): Vec3 {
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m < EPSILON) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export class PanoramicCurve implements IPanoramicCurve {
  private _points: Vec3[] = [];
  private _closed: boolean;
  /** open curve용 natural cubic spline 계수 캐시 (점 변경 시 무효화) */
  private _spline: NaturalCubic3D | null = null;

  constructor(snapshot?: CurveSnapshot) {
    if (snapshot) {
      // 깊은 복사 (외부 변경 방지)
      this._points = snapshot.points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      this._closed = snapshot.closed;
    } else {
      this._closed = false;
    }
  }

  get points(): ReadonlyArray<Vec3> {
    return this._points;
  }

  get closed(): boolean {
    return this._closed;
  }

  addPoint(p: Vec3, index?: number): void {
    const copy = { x: p.x, y: p.y, z: p.z };
    if (index === undefined || index >= this._points.length) {
      this._points.push(copy);
    } else if (index <= 0) {
      this._points.unshift(copy);
    } else {
      this._points.splice(index, 0, copy);
    }
    this._spline = null;
  }

  removePoint(index: number): void {
    if (index < 0 || index >= this._points.length) {
      throw new IndexOutOfRangeError(index, this._points.length);
    }
    this._points.splice(index, 1);
    this._spline = null;
  }

  movePoint(index: number, p: Vec3): void {
    if (index < 0 || index >= this._points.length) {
      throw new IndexOutOfRangeError(index, this._points.length);
    }
    this._points[index] = { x: p.x, y: p.y, z: p.z };
    this._spline = null;
  }

  sample(t: number): Vec3 {
    if (this._points.length < MIN_POINTS_FOR_SAMPLING) {
      throw new EmptyCurveError('sample');
    }
    if (t <= 0) {
      const p0 = this._points[0];
      return { x: p0.x, y: p0.y, z: p0.z };
    }
    if (t >= 1) {
      // closed curve: sample(1) wraps back to first point (one full loop)
      const last = this._closed ? this._points[0] : this._points[this._points.length - 1];
      return { x: last.x, y: last.y, z: last.z };
    }
    if (!this._closed) {
      if (!this._spline) this._spline = fitNaturalCubic3D(this._points);
      return evalNaturalCubic3D(this._spline, t);
    }
    const { i, local } = locateSegment(t, this._points.length, this._closed);
    const [p0, p1, p2, p3] = get4Points(this._points, i, this._closed);
    return {
      x: catmullRom(p0.x, p1.x, p2.x, p3.x, local),
      y: catmullRom(p0.y, p1.y, p2.y, p3.y, local),
      z: catmullRom(p0.z, p1.z, p2.z, p3.z, local),
    };
  }

  sampleN(n: number): Vec3[] {
    if (this._points.length < MIN_POINTS_FOR_SAMPLING) {
      throw new EmptyCurveError('sampleN');
    }
    if (n < 1) return [];
    const out: Vec3[] = new Array(n);
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0 : k / (n - 1);
      out[k] = this.sample(t);
    }
    return out;
  }

  tangent(t: number): Vec3 {
    // open curve: natural cubic의 해석적 도함수 (closed는 중앙 차분 유지)
    if (!this._closed) {
      if (this._points.length < MIN_POINTS_FOR_SAMPLING) {
        throw new EmptyCurveError('tangent');
      }
      if (!this._spline) this._spline = fitNaturalCubic3D(this._points);
      return tangentNaturalCubic3D(this._spline, Math.max(0, Math.min(1, t)));
    }
    // 중앙 차분으로 수치 미분 후 정규화
    const h = 1e-3;
    const tt = Math.max(0, Math.min(1, t));
    const a = this.sample(Math.max(0, tt - h));
    const b = this.sample(Math.min(1, tt + h));
    return normalize3(sub3(b, a));
  }

  length(): number {
    if (this._points.length < MIN_POINTS_FOR_SAMPLING) {
      throw new EmptyCurveError('length');
    }
    const samples = this.sampleN(100);
    let total = 0;
    for (let i = 1; i < samples.length; i++) {
      total += dist3(samples[i - 1], samples[i]);
    }
    if (this._closed) {
      total += dist3(samples[samples.length - 1], samples[0]);
    }
    return total;
  }

  toJSON(): CurveSnapshot {
    return {
      points: this._points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      closed: this._closed,
    };
  }

  static fromJSON(s: CurveSnapshot): PanoramicCurve {
    return new PanoramicCurve({
      points: s.points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      closed: s.closed,
    });
  }
}

// ────────────── 프리셋 ──────────────

export interface EllipsePresetOptions {
  /** X축 반지름 비율 (0~1 of dims.x) */
  axisXRatio?: number;
  /** Y축 반지름 비율 (0~1 of dims.y) */
  axisYRatio?: number;
  /** 중심 z 위치 (0~1 of dims.z) */
  centerZ?: number;
  /** 컨트롤 포인트 수 */
  samples?: number;
}

export interface ArchPresetOptions {
  /** 호의 깊이 (앞뒤 길이, 0~1 of dims.y) */
  depth?: number;
  /** 호의 높이 (위로 솟은 정도, 0~1 of dims.z) */
  height?: number;
  /** 중심 위치 (0~1, x/y/z 각 축) */
  center?: { x?: number; y?: number; z?: number };
  /** 컨트롤 포인트 수 */
  samples?: number;
}

/** XY 평면의 타원형 폐곡선 프리셋 (치아 단면 윤곽용) */
export function createEllipseCurve(dims: Dimensions, opts: EllipsePresetOptions = {}): PanoramicCurve {
  const axisX = (opts.axisXRatio ?? 0.8) * dims.x * 0.5;
  const axisY = (opts.axisYRatio ?? 0.5) * dims.y * 0.5;
  const cz = (opts.centerZ ?? 0.5) * dims.z;
  const cx = dims.x * 0.5;
  const cy = dims.y * 0.5;
  const samples = Math.max(8, opts.samples ?? 12);
  const c = new PanoramicCurve();
  // closed=true로 만들기 위해 _points에 직접 push
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const p: Vec3 = {
      x: cx + Math.cos(a) * axisX,
      y: cy + Math.sin(a) * axisY,
      z: cz,
    };
    c.addPoint(p);
  }
  // closed 강제 설정
  (c as unknown as { _closed: boolean })._closed = true;
  return c;
}

/**
 * U자형 치아궁 호 프리셋 (Axial plane, XY 평면, z=const)
 * 치과 CBCT 표준: arch는 axial slice (xy plane)에 그려지며, z는 두께 방향.
 *   - x는 좌우 (depth 방향): -depth/2 ~ +depth/2
 *   - y는 전후 (앞뒤, parabolic): concave 아래로 (1 - t²)
 *   - z는 일정 (axial 평면)
 */
export function createArchCurve(dims: Dimensions, opts: ArchPresetOptions = {}): PanoramicCurve {
  const depth = (opts.depth ?? 0.7) * dims.x;  // x 방향 너비
  const height = (opts.height ?? 0.3) * dims.y; // y 방향 전후 깊이
  const center: Vec3 = {
    x: (opts.center?.x ?? 0.5) * dims.x,
    y: (opts.center?.y ?? 0.5) * dims.y,
    z: (opts.center?.z ?? 0.5) * dims.z,  // axial 평면의 z
  };
  const samples = Math.max(8, opts.samples ?? 10);
  const c = new PanoramicCurve();
  for (let i = 0; i < samples; i++) {
    // t를 -1..1로 매핑, parabolic shape
    const t = (i / (samples - 1)) * 2 - 1; // -1..1
    const x = center.x + t * depth * 0.5;
    // concave U: y = center.y - height * (1 - t²)
    // t=0에서 가장 아래(볼록한 부분), t=±1에서 가장 위(양 끝)
    const y = center.y - height * (1 - t * t) + height; // y = center.y + height*t²  (위로 볼록)
    c.addPoint({ x, y, z: center.z });
  }
  return c;
}

// Cast: interface의 static method 표현을 위해 IPanoramicCurveConstructor 충족
export const _ctor: IPanoramicCurveConstructor = PanoramicCurve as unknown as IPanoramicCurveConstructor;
void _ctor; // 미사용 심볼 (타입 체크용)
