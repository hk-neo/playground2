import { describe, it, expect } from 'vitest';
import { PanoramicCurve, createEllipseCurve, createArchCurve } from '../panoramic-curve';
import type { Vec3 } from '../../shared/types/core';

describe('PanoramicCurve', () => {
  describe('construction', () => {
    it('creates an empty curve with no args', () => {
      const c = new PanoramicCurve();
      expect(c.points).toEqual([]);
      expect(c.closed).toBe(false);
    });

    it('reconstructs points from snapshot', () => {
      const points: Vec3[] = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ];
      const c = new PanoramicCurve({ points, closed: false });
      expect(c.points).toHaveLength(3);
      expect(c.points[1]).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('throws on less than 2 points for sampling methods', () => {
      const c = new PanoramicCurve();
      expect(() => c.sample(0.5)).toThrow();
      expect(() => c.sampleN(5)).toThrow();
      expect(() => c.tangent(0.5)).toThrow();
      expect(() => c.length()).toThrow();
    });
  });

  describe('point manipulation', () => {
    it('addPoint appends when no index', () => {
      const c = new PanoramicCurve();
      c.addPoint({ x: 0, y: 0, z: 0 });
      c.addPoint({ x: 1, y: 0, z: 0 });
      expect(c.points).toHaveLength(2);
      expect(c.points[1]).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('addPoint inserts at given index', () => {
      const c = new PanoramicCurve();
      c.addPoint({ x: 0, y: 0, z: 0 });
      c.addPoint({ x: 2, y: 0, z: 0 });
      c.addPoint({ x: 1, y: 0, z: 0 }, 1);
      expect(c.points).toHaveLength(3);
      expect(c.points[1]).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('removePoint removes at index', () => {
      const c = new PanoramicCurve();
      c.addPoint({ x: 0, y: 0, z: 0 });
      c.addPoint({ x: 1, y: 0, z: 0 });
      c.addPoint({ x: 2, y: 0, z: 0 });
      c.removePoint(1);
      expect(c.points).toHaveLength(2);
      expect(c.points[1]).toEqual({ x: 2, y: 0, z: 0 });
    });

    it('movePoint updates the point at index', () => {
      const c = new PanoramicCurve();
      c.addPoint({ x: 0, y: 0, z: 0 });
      c.addPoint({ x: 1, y: 0, z: 0 });
      c.movePoint(0, { x: 5, y: 5, z: 5 });
      expect(c.points[0]).toEqual({ x: 5, y: 5, z: 5 });
    });

    it('throws on out-of-range index', () => {
      const c = new PanoramicCurve();
      c.addPoint({ x: 0, y: 0, z: 0 });
      expect(() => c.removePoint(5)).toThrow();
      expect(() => c.movePoint(5, { x: 0, y: 0, z: 0 })).toThrow();
    });
  });

  describe('sampling (natural cubic spline)', () => {
    const linePoints: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ];

    it('passes exactly through every control point (interpolation)', () => {
      const pts: Vec3[] = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 2, z: 0 },
        { x: 3, y: 1, z: 0 },
        { x: 5, y: 3, z: 0 },
      ];
      const c = new PanoramicCurve({ points: pts, closed: false });
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const p = c.sample(i / (n - 1));
        expect(p.x).toBeCloseTo(pts[i].x, 5);
        expect(p.y).toBeCloseTo(pts[i].y, 5);
        expect(p.z).toBeCloseTo(pts[i].z, 5);
      }
    });

    it('sample(0) ≈ first point, sample(1) ≈ last point', () => {
      const c = new PanoramicCurve({ points: linePoints, closed: false });
      const p0 = c.sample(0);
      const p1 = c.sample(1);
      expect(p0.x).toBeCloseTo(0, 5);
      expect(p1.x).toBeCloseTo(3, 5);
    });

    it('sample is monotonically increasing for collinear points', () => {
      const c = new PanoramicCurve({ points: linePoints, closed: false });
      const samples = [0, 0.25, 0.5, 0.75, 1.0].map((t) => c.sample(t).x);
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] - 1e-6);
      }
    });

    it('sampleN returns exactly n points spanning [0,1]', () => {
      const c = new PanoramicCurve({ points: linePoints, closed: false });
      const pts = c.sampleN(10);
      expect(pts).toHaveLength(10);
      // first and last should be near the endpoints
      expect(pts[0].x).toBeCloseTo(0, 4);
      expect(pts[9].x).toBeCloseTo(3, 4);
    });

    it('tangent at t is roughly direction of travel', () => {
      const c = new PanoramicCurve({ points: linePoints, closed: false });
      const t = c.tangent(0.5);
      // Along +X axis
      expect(Math.abs(t.x)).toBeGreaterThan(0.5);
      expect(Math.abs(t.y)).toBeLessThan(1e-6);
      expect(Math.abs(t.z)).toBeLessThan(1e-6);
      // Should be unit length
      const mag = Math.sqrt(t.x * t.x + t.y * t.y + t.z * t.z);
      expect(mag).toBeCloseTo(1, 4);
    });

    it('length is positive and roughly equal to chord for straight line', () => {
      const c = new PanoramicCurve({ points: linePoints, closed: false });
      const len = c.length();
      // straight line from (0,0,0) to (3,0,0) is exactly 3
      expect(len).toBeGreaterThan(2.9);
      expect(len).toBeLessThan(3.1);
    });
  });

  describe('closed curve', () => {
    it('wraps around for closed=true', () => {
      const pts: Vec3[] = [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: -1, y: 0, z: 0 },
      ];
      const c = new PanoramicCurve({ points: pts, closed: true });
      const samples = c.sampleN(20);
      // Should produce points along a roughly circular arc
      // Endpoints of sample at t=0 and t=1 should be near each other
      const first = samples[0];
      const last = samples[19];
      const dist = Math.sqrt(
        (first.x - last.x) ** 2 + (first.y - last.y) ** 2 + (first.z - last.z) ** 2,
      );
      expect(dist).toBeLessThan(0.1);
    });
  });

  describe('serialization', () => {
    it('toJSON → fromJSON roundtrip', () => {
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 2, z: 3 });
      c.addPoint({ x: 4, y: 5, z: 6 });
      const snap = c.toJSON();
      const c2 = PanoramicCurve.fromJSON(snap);
      expect(c2.points).toHaveLength(2);
      expect(c2.points[0]).toEqual({ x: 1, y: 2, z: 3 });
      expect(c2.points[1]).toEqual({ x: 4, y: 5, z: 6 });
      expect(c2.closed).toBe(false);
    });
  });
});

describe('preset curves', () => {
  const dims = { x: 100, y: 100, z: 100 };

  it('createEllipseCurve produces closed curve with positive count', () => {
    const c = createEllipseCurve(dims, { axisXRatio: 0.8, axisYRatio: 0.5, centerZ: 0.5, samples: 12 });
    expect(c.closed).toBe(true);
    expect(c.points.length).toBeGreaterThanOrEqual(8);
    // All points should be within volume
    for (const p of c.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(dims.x);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(dims.y);
    }
  });

  it('createArchCurve produces U-shaped arch (XY plane, z=const)', () => {
    const c = createArchCurve(dims, { depth: 0.7, height: 0.3, samples: 10 });
    expect(c.closed).toBe(false);
    expect(c.points.length).toBeGreaterThanOrEqual(8);
    // 모든 점이 axial 평면 (z=const)에 있어야 함
    for (const p of c.points) {
      expect(p.z).toBeCloseTo(dims.z * 0.5, 5);
    }
    // 중앙 (t=0)에서 y가 가장 작고, 양 끝에서 y가 가장 큼 (위로 볼록한 U)
    const midY = c.points[Math.floor(c.points.length / 2)].y;
    expect(midY).toBeLessThan(c.points[0].y);
    expect(midY).toBeLessThan(c.points[c.points.length - 1].y);
  });
});
