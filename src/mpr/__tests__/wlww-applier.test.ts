import { describe, it, expect } from 'vitest';
import { WLWWApplier } from '../wlww-applier';

describe('WLWWApplier', () => {
  describe('apply', () => {
    it('should map values within window to 0-255', () => {
      const applier = new WLWWApplier();
      const data = new Float32Array([0, 500, 1000, 1500, 2000]);

      const result = applier.apply(data, 1000, 2000);

      expect(result[0]).toBe(0);
      expect(result[2]).toBeCloseTo(127, -1);
      expect(result[4]).toBe(255);
    });

    it('should clamp values below window to 0', () => {
      const applier = new WLWWApplier();
      const data = new Float32Array([-500, -100, 0]);

      const result = applier.apply(data, 500, 1000);

      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
    });

    it('should clamp values above window to 255', () => {
      const applier = new WLWWApplier();
      const data = new Float32Array([2000, 3000]);

      const result = applier.apply(data, 500, 1000);

      expect(result[0]).toBe(255);
      expect(result[1]).toBe(255);
    });

    it('should produce grayscale output (integer values)', () => {
      const applier = new WLWWApplier();
      const data = new Float32Array([500]);

      const result = applier.apply(data, 500, 1000);

      expect(Number.isInteger(result[0])).toBe(true);
    });
  });

  describe('applyCurrent', () => {
    it('should use stored wl/ww values', () => {
      const applier = new WLWWApplier();
      applier.setWindowLevel(1000);
      applier.setWindowWidth(2000);

      const data = new Float32Array([1000]);
      const result = applier.applyCurrent(data);

      expect(result[0]).toBeCloseTo(127, -1);
    });
  });

  describe('setWindowLevel / setWindowWidth', () => {
    it('should update window level', () => {
      const applier = new WLWWApplier();
      applier.setWindowLevel(500);
      expect(applier.windowLevel).toBe(500);
    });

    it('should update window width', () => {
      const applier = new WLWWApplier();
      applier.setWindowWidth(2000);
      expect(applier.windowWidth).toBe(2000);
    });

    it('should reject non-positive window width', () => {
      const applier = new WLWWApplier();
      expect(() => applier.setWindowWidth(0)).toThrow();
      expect(() => applier.setWindowWidth(-100)).toThrow();
    });
  });

  describe('setDefaultCBCT', () => {
    it('should set CBCT default WL=500, WW=2500', () => {
      const applier = new WLWWApplier();
      applier.setDefaultCBCT();

      expect(applier.windowLevel).toBe(500);
      expect(applier.windowWidth).toBe(2500);
    });
  });

  describe('reset', () => {
    it('should reset to default values', () => {
      const applier = new WLWWApplier();
      applier.setDefaultCBCT();
      applier.reset();

      expect(applier.windowLevel).toBe(0);
      expect(applier.windowWidth).toBe(1);
    });
  });
});
