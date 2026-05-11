import { describe, it, expect } from 'vitest';
import { MPRView } from '../mpr-view';
import { MPRPlane } from '../../shared/types/rendering';
import type { Dimensions } from '../../shared/types/core';

describe('MPRView', () => {
  describe('constructor', () => {
    it('should create view with default size', () => {
      const view = new MPRView(MPRPlane.Axial);
      expect(view.plane).toBe(MPRPlane.Axial);
      expect(view.width).toBe(512);
      expect(view.height).toBe(512);
    });

    it('should create view with custom size', () => {
      const view = new MPRView(MPRPlane.Coronal, 256, 256);
      expect(view.width).toBe(256);
      expect(view.height).toBe(256);
    });

    it('should have default orientation', () => {
      const view = new MPRView(MPRPlane.Axial);
      expect(view.orientation.directionCosines).toEqual([1, 0, 0, 0, 1, 0]);
    });
  });

  describe('update', () => {
    it('should set slice position', () => {
      const view = new MPRView(MPRPlane.Axial);
      view.update(42);
      expect(view.slicePosition).toBe(42);
    });

    it('should round to integer', () => {
      const view = new MPRView(MPRPlane.Axial);
      view.update(3.7);
      expect(view.slicePosition).toBe(4);
    });

    it('should clamp negative to 0', () => {
      const view = new MPRView(MPRPlane.Axial);
      view.update(-5);
      expect(view.slicePosition).toBe(0);
    });
  });

  describe('setOrientation', () => {
    it('should update orientation', () => {
      const view = new MPRView(MPRPlane.Axial);
      const newOrientation = {
        directionCosines: [0, 1, 0, 1, 0, 0] as [number, number, number, number, number, number],
        position: [10, 20, 30] as [number, number, number],
      };
      view.setOrientation(newOrientation);
      expect(view.orientation).toEqual(newOrientation);
    });
  });

  describe('resize', () => {
    it('should update dimensions', () => {
      const view = new MPRView(MPRPlane.Axial);
      view.resize(800, 600);
      expect(view.width).toBe(800);
      expect(view.height).toBe(600);
    });

    it('should reject non-positive dimensions', () => {
      const view = new MPRView(MPRPlane.Axial);
      expect(() => view.resize(0, 100)).toThrow();
      expect(() => view.resize(100, -1)).toThrow();
    });
  });

  describe('getMaxSlice', () => {
    const dims: Dimensions = { x: 100, y: 200, z: 300 };

    it('should return z for Axial', () => {
      const view = new MPRView(MPRPlane.Axial);
      expect(view.getMaxSlice(dims)).toBe(300);
    });

    it('should return y for Coronal', () => {
      const view = new MPRView(MPRPlane.Coronal);
      expect(view.getMaxSlice(dims)).toBe(200);
    });

    it('should return x for Sagittal', () => {
      const view = new MPRView(MPRPlane.Sagittal);
      expect(view.getMaxSlice(dims)).toBe(100);
    });
  });

  describe('getSliceDimensions', () => {
    const dims: Dimensions = { x: 100, y: 200, z: 300 };

    it('should return (x, y) for Axial', () => {
      const view = new MPRView(MPRPlane.Axial);
      expect(view.getSliceDimensions(dims)).toEqual({ width: 100, height: 200 });
    });

    it('should return (x, z) for Coronal', () => {
      const view = new MPRView(MPRPlane.Coronal);
      expect(view.getSliceDimensions(dims)).toEqual({ width: 100, height: 300 });
    });

    it('should return (y, z) for Sagittal', () => {
      const view = new MPRView(MPRPlane.Sagittal);
      expect(view.getSliceDimensions(dims)).toEqual({ width: 200, height: 300 });
    });
  });
});
