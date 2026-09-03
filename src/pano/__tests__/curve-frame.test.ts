import { describe, it, expect } from 'vitest';
import { CurveFrameSampler, computeFrameAxes } from '../curve-frame';
import { PanoramicCurve } from '../panoramic-curve';
import type { Vec3 } from '../../shared/types/core';

function makeCurve(points: Vec3[], closed = false): PanoramicCurve {
  return new PanoramicCurve({ points, closed });
}

describe('computeFrameAxes', () => {
  it('computes in-plane normal + upward binormal for a +X tangent', () => {
    const { normal, binormal } = computeFrameAxes({ x: 1, y: 0, z: 0 });
    // cross((1,0,0),(0,0,1)) = (0,-1,0)
    expect(normal.y).toBeCloseTo(-1, 5);
    expect(Math.abs(normal.x)).toBeLessThan(1e-6);
    // binormal = N×T = (0,0,1)
    expect(binormal.z).toBeCloseTo(1, 5);
  });

  it('handles vertical tangent degenerate case without NaN', () => {
    const { normal, binormal } = computeFrameAxes({ x: 0, y: 0, z: 1 });
    for (const v of [normal, binormal]) {
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.y)).toBe(true);
      expect(Number.isFinite(v.z)).toBe(true);
    }
    // binormal is orthogonal to tangent
    const dot = binormal.x * 0 + binormal.y * 0 + binormal.z * 1;
    expect(Math.abs(dot)).toBeLessThan(1e-6);
  });
});

describe('CurveFrameSampler', () => {
  it('total arc length matches straight line length', () => {
    const c = makeCurve([
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ]);
    const s = new CurveFrameSampler(c, 64);
    expect(s.totalArcLength).toBeCloseTo(3, 3);
  });

  it('samples arc-length uniformly along a straight line', () => {
    const c = makeCurve([
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ]);
    const s = new CurveFrameSampler(c, 16);
    const step = s.totalArcLength / (s.frameCount - 1);
    for (let i = 0; i < s.frameCount; i++) {
      expect(s.frameAt(i).arcLength).toBeCloseTo(i * step, 5);
    }
  });

  it('frameAtU endpoints map to curve endpoints', () => {
    const c = makeCurve([
      { x: 1, y: 2, z: 0 },
      { x: 5, y: 7, z: 0 },
    ]);
    const s = new CurveFrameSampler(c, 32);
    const f0 = s.frameAtU(0);
    const f1 = s.frameAtU(1);
    expect(f0.position.x).toBeCloseTo(1, 4);
    expect(f0.position.y).toBeCloseTo(2, 4);
    expect(f1.position.x).toBeCloseTo(5, 4);
    expect(f1.position.y).toBeCloseTo(7, 4);
  });

  it('normal (협설) stays in-plane and tangent is unit for a curved arch', () => {
    const c = makeCurve([
      { x: 0, y: 0, z: 5 },
      { x: 2, y: 3, z: 5 },
      { x: 5, y: 4, z: 5 },
      { x: 8, y: 2, z: 5 },
    ]);
    const s = new CurveFrameSampler(c, 64);
    for (const f of s.frames) {
      const tmag = Math.hypot(f.tangent.x, f.tangent.y, f.tangent.z);
      expect(tmag).toBeCloseTo(1, 4);
      // axial curve → binormal ≈ Z
      expect(f.binormal.z).toBeGreaterThan(0.9);
      // normal ⊥ tangent
      const dot = f.normal.x * f.tangent.x + f.normal.y * f.tangent.y + f.normal.z * f.tangent.z;
      expect(Math.abs(dot)).toBeLessThan(1e-4);
    }
  });
});