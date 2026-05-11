import { describe, it, expect } from 'vitest';
import { TransferFunctionManager } from '../transfer-function-manager';
import type { ControlPoint } from '../transfer-function-manager';

describe('TransferFunctionManager', () => {
  describe('loadPreset', () => {
    it('should load CBCT bone preset by default', () => {
      const tf = new TransferFunctionManager();
      expect(tf.preset).toBe('cbct_bone');
      expect(tf.getControlPoints().length).toBeGreaterThan(0);
    });
  });

  describe('setControlPoints', () => {
    it('should set and sort control points', () => {
      const tf = new TransferFunctionManager();
      const points: ControlPoint[] = [
        { density: 500, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 0.5 },
        { density: -500, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.0 },
      ];
      tf.setControlPoints(points);
      const result = tf.getControlPoints();
      expect(result[0].density).toBe(-500);
      expect(result[1].density).toBe(500);
    });

    it('should reject density out of range', () => {
      const tf = new TransferFunctionManager();
      expect(() => tf.setControlPoints([
        { density: -2000, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0 },
      ])).toThrow(/density/);
    });

    it('should reject opacity out of range', () => {
      const tf = new TransferFunctionManager();
      expect(() => tf.setControlPoints([
        { density: 0, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1.5 },
      ])).toThrow(/opacity/);
    });
  });

  describe('getColorAt / getOpacityAt', () => {
    it('should return interpolated values between control points', () => {
      const tf = new TransferFunctionManager();
      tf.setControlPoints([
        { density: -1000, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.0 },
        { density: 1000, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1.0 },
      ]);

      const midColor = tf.getColorAt(0);
      expect(midColor.r).toBeCloseTo(0.5, 2);

      const midOpacity = tf.getOpacityAt(0);
      expect(midOpacity).toBeCloseTo(0.5, 2);
    });

    it('should clamp values below range', () => {
      const tf = new TransferFunctionManager();
      tf.setControlPoints([
        { density: 0, color: { r: 0.5, g: 0, b: 0, a: 1 }, opacity: 0.2 },
        { density: 1000, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1.0 },
      ]);

      expect(tf.getOpacityAt(-500)).toBe(0.2);
      expect(tf.getColorAt(-500).r).toBeCloseTo(0.5, 2);
    });

    it('should clamp values above range', () => {
      const tf = new TransferFunctionManager();
      tf.setControlPoints([
        { density: 0, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.0 },
        { density: 1000, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1.0 },
      ]);

      expect(tf.getOpacityAt(2000)).toBe(1.0);
      expect(tf.getColorAt(2000).r).toBeCloseTo(1.0, 2);
    });
  });

  describe('getTextureData', () => {
    it('should return 256*4 byte array', () => {
      const tf = new TransferFunctionManager();
      const data = tf.getTextureData();
      expect(data.length).toBe(256 * 4);
    });

    it('should have valid RGBA values (0-255)', () => {
      const tf = new TransferFunctionManager();
      const data = tf.getTextureData();
      for (let i = 0; i < data.length; i++) {
        expect(data[i]).toBeGreaterThanOrEqual(0);
        expect(data[i]).toBeLessThanOrEqual(255);
      }
    });
  });
});
