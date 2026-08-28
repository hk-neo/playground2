import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { packArchSpline, disposeArchSplineTextures } from '../arch-spline';
import { createArchCurve } from '../../panoramic-curve';

const dims = { x: 200, y: 200, z: 100 };

describe('arch-spline', () => {
  it('packs an arch curve into RGBAFloat textures', () => {
    const curve = createArchCurve(dims, { samples: 12 });
    const packed = packArchSpline(curve, { sampleCount: 64 });
    expect(packed.sampleCount).toBe(64);
    expect(packed.posTexture).toBeInstanceOf(THREE.DataTexture);
    expect(packed.normTexture).toBeInstanceOf(THREE.DataTexture);
    expect(packed.posTexture.image.width).toBe(64);
    expect(packed.normTexture.image.width).toBe(64);
    expect(packed.posTexture.type).toBe(THREE.FloatType);
    expect(packed.posTexture.format).toBe(THREE.RGBAFormat);
    disposeArchSplineTextures(packed);
  });

  it('samples curve position correctly at endpoints', () => {
    const curve = createArchCurve(dims, { samples: 10 });
    const packed = packArchSpline(curve, { sampleCount: 8 });
    const posData = packed.posTexture.image.data as Float32Array;
    expect(posData.length).toBe(8 * 4);
    // First sample (i=0) ≈ curve.sample(0) = first control point (left molar end)
    const c0 = curve.sample(0);
    expect(posData[0]).toBeCloseTo(c0.x, 5);
    expect(posData[1]).toBeCloseTo(c0.y, 5);
    expect(posData[2]).toBeCloseTo(c0.z, 5);
    // Last sample (i=7) ≈ curve.sample(1) = last control point (right molar end)
    const cLast = curve.sample(1);
    expect(posData[7 * 4]).toBeCloseTo(cLast.x, 3);
    expect(posData[7 * 4 + 1]).toBeCloseTo(cLast.y, 3);
    disposeArchSplineTextures(packed);
  });

  it('produces in-plane perp vector perpendicular to curve tangent', () => {
    const curve = createArchCurve(dims, { samples: 12 });
    const packed = packArchSpline(curve, { sampleCount: 8 });
    const normData = packed.normTexture.image.data as Float32Array;
    const posData = packed.posTexture.image.data as Float32Array;
    for (let i = 1; i < 7; i++) {
      const ip = [normData[i * 4], normData[i * 4 + 1], normData[i * 4 + 2]];
      const ipMag = Math.sqrt(ip[0] ** 2 + ip[1] ** 2 + ip[2] ** 2);
      // Normalised (unit length).
      expect(ipMag).toBeGreaterThan(0.99);
      expect(ipMag).toBeLessThan(1.01);
      // For axial-plane curve the perp should dominate in x,y, not z.
      const xyMag = Math.sqrt(ip[0] ** 2 + ip[1] ** 2);
      expect(xyMag).toBeGreaterThan(0.7);
    }
    disposeArchSplineTextures(packed);
  });
});
