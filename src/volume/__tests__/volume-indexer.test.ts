import { describe, it, expect } from 'vitest';
import { VolumeIndexer } from '../volume-indexer';
import type { VolumeData } from '../../shared/types/volume';
import { InvalidVoxelAccessError } from '../../shared/errors/volume';

function makeVolume(dx: number, dy: number, dz: number, fill?: number): VolumeData {
  const size = dx * dy * dz;
  const buffer = new ArrayBuffer(size * 2);
  if (fill !== undefined) {
    const view = new Int16Array(buffer);
    view.fill(fill);
  }
  return {
    buffer,
    dimensions: [dx, dy, dz],
    spacing: [1, 1, 1],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

describe('VolumeIndexer', () => {
  describe('linearIndex', () => {
    it('should compute correct linear index', () => {
      expect(VolumeIndexer.linearIndex(0, 0, 0, { x: 4, y: 4, z: 4 })).toBe(0);
      expect(VolumeIndexer.linearIndex(1, 0, 0, { x: 4, y: 4, z: 4 })).toBe(1);
      expect(VolumeIndexer.linearIndex(0, 1, 0, { x: 4, y: 4, z: 4 })).toBe(4);
      expect(VolumeIndexer.linearIndex(0, 0, 1, { x: 4, y: 4, z: 4 })).toBe(16);
      expect(VolumeIndexer.linearIndex(2, 3, 1, { x: 4, y: 4, z: 4 })).toBe(16 + 12 + 2);
    });
  });

  describe('getVoxel / setVoxel', () => {
    it('should read and write voxel values', () => {
      const vol = makeVolume(4, 4, 4);
      VolumeIndexer.setVoxel(1, 2, 3, 42, vol);
      expect(VolumeIndexer.getVoxel(1, 2, 3, vol)).toBe(42);
    });

    it('should throw InvalidVoxelAccessError for out-of-bounds', () => {
      const vol = makeVolume(4, 4, 4);
      expect(() => VolumeIndexer.getVoxel(4, 0, 0, vol)).toThrow(InvalidVoxelAccessError);
      expect(() => VolumeIndexer.getVoxel(-1, 0, 0, vol)).toThrow(InvalidVoxelAccessError);
    });
  });

  describe('getVoxelClamped', () => {
    it('should return boundary value for out-of-bounds', () => {
      const vol = makeVolume(4, 4, 4, 99);
      expect(VolumeIndexer.getVoxelClamped(-1, 0, 0, vol)).toBe(99);
      expect(VolumeIndexer.getVoxelClamped(4, 0, 0, vol)).toBe(99);
    });

    it('should return actual value for in-bounds', () => {
      const vol = makeVolume(4, 4, 4);
      VolumeIndexer.setVoxel(2, 2, 2, 77, vol);
      expect(VolumeIndexer.getVoxelClamped(2, 2, 2, vol)).toBe(77);
    });
  });
});
