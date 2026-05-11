import { describe, it, expect, beforeEach } from 'vitest';
import { VolumeBuilder } from '../volume-builder';
import type { SliceData } from '../../shared/types/volume';
import { InsufficientSlicesError, DimensionMismatchError } from '../../shared/errors/volume';

function makeSlice(index: number, width: number, height: number, position: number, fill: number): SliceData {
  const buffer = new ArrayBuffer(width * height * 2);
  new Int16Array(buffer).fill(fill);
  return { buffer, width, height, sliceIndex: index, position };
}

describe('VolumeBuilder', () => {
  let builder: VolumeBuilder;

  beforeEach(() => {
    builder = new VolumeBuilder();
  });

  describe('addSlice', () => {
    it('should accept slices with matching dimensions', () => {
      builder.addSlice(makeSlice(0, 4, 4, 0, 0));
      builder.addSlice(makeSlice(1, 4, 4, 1, 0));
      expect(builder.validateVolume()).toBe(true);
    });

    it('should throw DimensionMismatchError for mismatched sizes', () => {
      builder.addSlice(makeSlice(0, 4, 4, 0, 0));
      expect(() => builder.addSlice(makeSlice(1, 8, 8, 1, 0))).toThrow(DimensionMismatchError);
    });
  });

  describe('build', () => {
    it('should throw InsufficientSlicesError with < 2 slices', () => {
      builder.addSlice(makeSlice(0, 4, 4, 0, 0));
      expect(() => builder.build()).toThrow(InsufficientSlicesError);
    });

    it('should build volume from slices', () => {
      builder.addSlice(makeSlice(0, 4, 4, 0.0, 10));
      builder.addSlice(makeSlice(1, 4, 4, 0.5, 20));
      builder.addSlice(makeSlice(2, 4, 4, 1.0, 30));

      const vol = builder.build();
      expect(vol.dimensions).toEqual([4, 4, 3]);
      expect(vol.dataType).toBe('int16');
      expect(vol.buffer.byteLength).toBe(4 * 4 * 3 * 2);
    });

    it('should sort slices by position', () => {
      builder.addSlice(makeSlice(2, 4, 4, 2.0, 30));
      builder.addSlice(makeSlice(0, 4, 4, 0.0, 10));
      builder.addSlice(makeSlice(1, 4, 4, 1.0, 20));

      const vol = builder.build();
      const view = new Int16Array(vol.buffer);

      // First slice (z=0) should have value 10
      expect(view[0]).toBe(10);
      // Second slice (z=1) at offset 16 should have value 20
      expect(view[16]).toBe(20);
      // Third slice (z=2) at offset 32 should have value 30
      expect(view[32]).toBe(30);
    });

    it('should calculate spacing from slice positions', () => {
      builder.addSlice(makeSlice(0, 2, 2, 0.0, 0));
      builder.addSlice(makeSlice(1, 2, 2, 0.3, 0));

      const vol = builder.build();
      expect(vol.spacing[2]).toBeCloseTo(0.3);
    });

    it('should set origin from first slice position', () => {
      builder.addSlice(makeSlice(0, 2, 2, 5.0, 0));
      builder.addSlice(makeSlice(1, 2, 2, 6.0, 0));

      const vol = builder.build();
      expect(vol.origin[2]).toBe(5.0);
    });
  });

  describe('buildProgressive', () => {
    it('should call progress callback', () => {
      let progressCalled = false;
      builder.addSlice(makeSlice(0, 2, 2, 0, 0));
      builder.addSlice(makeSlice(1, 2, 2, 1, 0));

      builder.buildProgressive((p) => {
        if (p === 1.0) progressCalled = true;
      });
      expect(progressCalled).toBe(true);
    });
  });

  describe('validateVolume', () => {
    it('should return false with no slices', () => {
      expect(builder.validateVolume()).toBe(false);
    });

    it('should return false with one slice', () => {
      builder.addSlice(makeSlice(0, 4, 4, 0, 0));
      expect(builder.validateVolume()).toBe(false);
    });

    it('should return true with valid slices', () => {
      builder.addSlice(makeSlice(0, 4, 4, 0, 0));
      builder.addSlice(makeSlice(1, 4, 4, 1, 0));
      expect(builder.validateVolume()).toBe(true);
    });
  });
});
