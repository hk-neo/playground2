import { describe, it, expect } from 'vitest';
import {
  getCurveDrawingSamples,
  projectCurveToAxial,
  projectCurveToCoronal,
  projectCurveToSagittal,
  hitTestPoint,
} from '../curve-editor-view';
import { PanoramicCurve } from '../panoramic-curve';
import type { Vec3 } from '../../shared/types/core';
import { MPRPlane } from '../../shared/types/rendering';

describe('curve projection helpers', () => {
  const curvePoints: Vec3[] = [
    { x: 1, y: 2, z: 3 },
    { x: 4, y: 5, z: 6 },
    { x: 7, y: 8, z: 9 },
  ];

  describe('projectCurveToAxial', () => {
    it('drops z, keeps x and y', () => {
      const out = projectCurveToAxial(curvePoints);
      expect(out).toEqual([{ x: 1, y: 2 }, { x: 4, y: 5 }, { x: 7, y: 8 }]);
    });
  });

  describe('projectCurveToCoronal', () => {
    it('drops y, keeps x and z', () => {
      const out = projectCurveToCoronal(curvePoints);
      expect(out).toEqual([{ x: 1, y: 3 }, { x: 4, y: 6 }, { x: 7, y: 9 }]);
    });
  });

  describe('projectCurveToSagittal', () => {
    it('drops x, keeps y and z', () => {
      const out = projectCurveToSagittal(curvePoints);
      expect(out).toEqual([{ x: 2, y: 3 }, { x: 5, y: 6 }, { x: 8, y: 9 }]);
    });
  });

  describe('hitTestPoint', () => {
    const c = new PanoramicCurve({ points: curvePoints, closed: false });

    it('returns point index when within threshold', () => {
      const hit = hitTestPoint(c, MPRPlane.Axial, { x: 4.5, y: 5.5 }, 2);
      expect(hit).toBe(1);
    });

    it('returns -1 when outside threshold', () => {
      const hit = hitTestPoint(c, MPRPlane.Axial, { x: 100, y: 100 }, 1);
      expect(hit).toBe(-1);
    });

    it('works on Coronal plane (xz)', () => {
      const hit = hitTestPoint(c, MPRPlane.Coronal, { x: 1.1, y: 3.1 }, 1);
      expect(hit).toBe(0);
    });

    it('works on Sagittal plane (yz)', () => {
      const hit = hitTestPoint(c, MPRPlane.Sagittal, { x: 8.1, y: 9.1 }, 1);
      expect(hit).toBe(2);
    });
  });
});

describe('curve drawing samples', () => {
  it('uses Catmull-Rom samples while preserving both endpoints', () => {
    const curve = new PanoramicCurve({
      points: [
        { x: 0, y: 0, z: 3 },
        { x: 3, y: 4, z: 3 },
        { x: 6, y: 0, z: 3 },
      ],
      closed: false,
    });

    const samples = getCurveDrawingSamples(curve, 8);

    expect(samples.length).toBe(17);
    expect(samples[0]).toEqual(curve.points[0]);
    expect(samples[samples.length - 1]).toEqual(curve.points[curve.points.length - 1]);
  });
});
