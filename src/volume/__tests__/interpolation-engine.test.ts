import { describe, it, expect } from 'vitest';
import { InterpolationEngine } from '../interpolation-engine';
import type { VolumeData } from '../../shared/types/volume';

function makeLinearVolume(dx: number, dy: number, dz: number): VolumeData {
  const size = dx * dy * dz;
  const buffer = new ArrayBuffer(size * 2);
  const view = new Int16Array(buffer);
  for (let i = 0; i < size; i++) view[i] = i;
  return {
    buffer,
    dimensions: [dx, dy, dz],
    spacing: [1, 1, 1],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

describe('InterpolationEngine', () => {
  describe('bilinearInterpolate', () => {
    it('should return exact value at integer coords', () => {
      const data = new Float32Array([10, 20, 30, 40]);
      expect(InterpolationEngine.bilinearInterpolate(0, 0, data, 2)).toBeCloseTo(10);
      expect(InterpolationEngine.bilinearInterpolate(1, 0, data, 2)).toBeCloseTo(20);
      expect(InterpolationEngine.bilinearInterpolate(0, 1, data, 2)).toBeCloseTo(30);
      expect(InterpolationEngine.bilinearInterpolate(1, 1, data, 2)).toBeCloseTo(40);
    });

    it('should interpolate at midpoints', () => {
      const data = new Float32Array([0, 100, 0, 100]);
      const result = InterpolationEngine.bilinearInterpolate(0.5, 0.5, data, 2);
      expect(result).toBeCloseTo(50);
    });

    it('should interpolate linearly along x', () => {
      const data = new Float32Array([0, 10]);
      const result = InterpolationEngine.bilinearInterpolate(0.5, 0, data, 2);
      expect(result).toBeCloseTo(5);
    });
  });

  describe('trilinearInterpolate', () => {
    it('should return exact value at integer coords', () => {
      const vol = makeLinearVolume(4, 4, 4);
      // (0,0,0) → index 0 → value 0
      expect(InterpolationEngine.trilinearInterpolate({ x: 0, y: 0, z: 0 }, vol)).toBeCloseTo(0);
    });

    it('should interpolate at midpoint of uniform volume', () => {
      const size = 4 * 4 * 4;
      const buffer = new ArrayBuffer(size * 2);
      new Int16Array(buffer).fill(100);
      const vol: VolumeData = {
        buffer, dimensions: [4, 4, 4], spacing: [1, 1, 1], origin: [0, 0, 0], dataType: 'int16',
      };
      expect(InterpolationEngine.trilinearInterpolate({ x: 1.5, y: 1.5, z: 1.5 }, vol)).toBeCloseTo(100);
    });

    it('should interpolate between different values', () => {
      // 2x2x2 volume with known values
      const buffer = new ArrayBuffer(8 * 2);
      const view = new Int16Array(buffer);
      // z=0 plane: [[0, 0], [0, 0]], z=1 plane: [[0, 0], [0, 100]]
      view[0] = 0; view[1] = 0; view[2] = 0; view[3] = 0;
      view[4] = 0; view[5] = 0; view[6] = 0; view[7] = 100;
      const vol: VolumeData = {
        buffer, dimensions: [2, 2, 2], spacing: [1, 1, 1], origin: [0, 0, 0], dataType: 'int16',
      };
      const result = InterpolationEngine.trilinearInterpolate({ x: 1, y: 1, z: 0.5 }, vol);
      expect(result).toBeCloseTo(50);
    });
  });
});
