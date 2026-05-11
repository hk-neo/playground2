import { describe, it, expect } from 'vitest';
import { SliceExtractor } from '../slice-extractor';
import { MPRPlane } from '../../shared/types/rendering';
import type { VolumeData } from '../../shared/types/volume';
import { InvalidSlicePositionError } from '../../shared/errors/mpr';

function createTestVolume(dx: number, dy: number, dz: number): VolumeData {
  const size = dx * dy * dz;
  const buffer = new ArrayBuffer(size * 2);
  const view = new Int16Array(buffer);

  for (let z = 0; z < dz; z++) {
    for (let y = 0; y < dy; y++) {
      for (let x = 0; x < dx; x++) {
        view[z * dx * dy + y * dx + x] = x + y * 10 + z * 100;
      }
    }
  }

  return {
    buffer,
    dimensions: [dx, dy, dz],
    spacing: [0.2, 0.2, 0.2],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

describe('SliceExtractor', () => {
  describe('extract (via interface)', () => {
    it('should extract axial slice', () => {
      const volume = createTestVolume(4, 4, 4);
      const extractor = new SliceExtractor();
      const slice = extractor.extract(MPRPlane.Axial, 1, volume);

      expect(slice.length).toBe(16);
      expect(slice[0]).toBe(100);
      expect(slice[1]).toBe(101);
    });

    it('should extract coronal slice', () => {
      const volume = createTestVolume(4, 4, 4);
      const extractor = new SliceExtractor();
      const slice = extractor.extract(MPRPlane.Coronal, 2, volume);

      expect(slice.length).toBe(16);
      expect(slice[0]).toBe(20);
    });

    it('should extract sagittal slice', () => {
      const volume = createTestVolume(4, 4, 4);
      const extractor = new SliceExtractor();
      const slice = extractor.extract(MPRPlane.Sagittal, 3, volume);

      expect(slice.length).toBe(16);
      expect(slice[0]).toBe(3);
    });
  });

  describe('extractAxial', () => {
    it('should extract correct 2D slice from z position', () => {
      const volume = createTestVolume(4, 3, 2);
      const extractor = new SliceExtractor();
      const slice = extractor.extractAxial(0, volume);

      expect(slice.length).toBe(12);
      expect(slice[0]).toBe(0);
      expect(slice[1]).toBe(1);
      expect(slice[4]).toBe(10);
    });
  });

  describe('extractCoronal', () => {
    it('should extract correct 2D slice from y position', () => {
      const volume = createTestVolume(4, 3, 2);
      const extractor = new SliceExtractor();
      const slice = extractor.extractCoronal(1, volume);

      expect(slice.length).toBe(8);
      expect(slice[0]).toBe(10);
      expect(slice[4]).toBe(110);
    });
  });

  describe('extractSagittal', () => {
    it('should extract correct 2D slice from x position', () => {
      const volume = createTestVolume(4, 3, 2);
      const extractor = new SliceExtractor();
      const slice = extractor.extractSagittal(2, volume);

      expect(slice.length).toBe(6);
      expect(slice[0]).toBe(2);
      expect(slice[1]).toBe(12);
      expect(slice[3]).toBe(102);
    });
  });

  describe('extractOblique', () => {
    it('should extract oblique slice without crashing', () => {
      const volume = createTestVolume(4, 4, 4);
      const extractor = new SliceExtractor();
      const slice = extractor.extractOblique({ x: 0, y: 0, z: 1 }, 2, volume);

      expect(slice.length).toBe(16);
    });
  });

  describe('validation', () => {
    it('should throw for out-of-range axial position', () => {
      const volume = createTestVolume(4, 4, 4);
      const extractor = new SliceExtractor();

      expect(() => extractor.extractAxial(10, volume)).toThrow(InvalidSlicePositionError);
    });

    it('should throw for negative position', () => {
      const volume = createTestVolume(4, 4, 4);
      const extractor = new SliceExtractor();

      expect(() => extractor.extractCoronal(-1, volume)).toThrow(InvalidSlicePositionError);
    });

    it('should throw for position equal to dimension', () => {
      const volume = createTestVolume(4, 4, 4);
      const extractor = new SliceExtractor();

      expect(() => extractor.extractSagittal(4, volume)).toThrow(InvalidSlicePositionError);
    });
  });

  describe('uint16 volume', () => {
    it('should handle uint16 volume data', () => {
      const buffer = new ArrayBuffer(8);
      new Uint16Array(buffer).set([100, 200, 300, 400]);
      const volume: VolumeData = {
        buffer,
        dimensions: [2, 2, 1],
        spacing: [1, 1, 1],
        origin: [0, 0, 0],
        dataType: 'uint16',
      };

      const extractor = new SliceExtractor();
      const slice = extractor.extractAxial(0, volume);

      expect(slice[0]).toBe(100);
      expect(slice[3]).toBe(400);
    });
  });
});
