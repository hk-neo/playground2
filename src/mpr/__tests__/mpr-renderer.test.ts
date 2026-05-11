import { describe, it, expect, beforeAll, vi } from 'vitest';
import { MPRRenderer } from '../mpr-renderer';
import { MPRPlane } from '../../shared/types/rendering';
import { VolumeNotLoadedError } from '../../shared/errors/mpr';

beforeAll(() => {
  if (typeof ImageData === 'undefined') {
    class MockImageData {
      readonly width: number;
      readonly height: number;
      readonly data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    vi.stubGlobal('ImageData', MockImageData);
  }
});

describe('MPRRenderer', () => {
  describe('setVolume', () => {
    it('should set volume dimensions and center slice positions', () => {
      const renderer = new MPRRenderer();
      renderer.setVolume({ x: 100, y: 200, z: 300 });

      expect(renderer.getSlicePosition(MPRPlane.Axial)).toBe(150);
      expect(renderer.getSlicePosition(MPRPlane.Coronal)).toBe(100);
      expect(renderer.getSlicePosition(MPRPlane.Sagittal)).toBe(50);
    });

    it('should return volume dimensions', () => {
      const renderer = new MPRRenderer();
      const dims = { x: 10, y: 20, z: 30 };
      renderer.setVolume(dims);
      expect(renderer.getVolumeDims()).toEqual(dims);
    });
  });

  describe('setSlicePosition', () => {
    it('should update slice position', () => {
      const renderer = new MPRRenderer();
      renderer.setVolume({ x: 100, y: 100, z: 100 });

      renderer.setSlicePosition(MPRPlane.Axial, 42);
      expect(renderer.getSlicePosition(MPRPlane.Axial)).toBe(42);
    });
  });

  describe('render', () => {
    it('should throw when volume not loaded', () => {
      const renderer = new MPRRenderer();
      expect(() => renderer.render(MPRPlane.Axial, 0)).toThrow(VolumeNotLoadedError);
    });
  });

  describe('renderAll', () => {
    it('should throw when volume not loaded', () => {
      const renderer = new MPRRenderer();
      expect(() => renderer.renderAll()).toThrow(VolumeNotLoadedError);
    });
  });

  describe('getSliceImage', () => {
    it('should throw when volume not loaded', () => {
      const renderer = new MPRRenderer();
      expect(() => renderer.getSliceImage(MPRPlane.Axial)).toThrow(VolumeNotLoadedError);
    });
  });

  describe('getView', () => {
    it('should return view for each plane', () => {
      const renderer = new MPRRenderer();

      expect(renderer.getView(MPRPlane.Axial)).toBeDefined();
      expect(renderer.getView(MPRPlane.Coronal)).toBeDefined();
      expect(renderer.getView(MPRPlane.Sagittal)).toBeDefined();
    });

    it('should return undefined for unknown plane', () => {
      const renderer = new MPRRenderer();
      expect(renderer.getView('Unknown' as MPRPlane)).toBeUndefined();
    });
  });

  describe('getWLWW', () => {
    it('should return WLWWApplier instance', () => {
      const renderer = new MPRRenderer();
      expect(renderer.getWLWW()).toBeDefined();
      renderer.getWLWW().setDefaultCBCT();
      expect(renderer.getWLWW().windowLevel).toBe(500);
    });
  });

  describe('getExtractor', () => {
    it('should return SliceExtractor instance', () => {
      const renderer = new MPRRenderer();
      expect(renderer.getExtractor()).toBeDefined();
    });
  });
});
