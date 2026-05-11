import { describe, it, expect } from 'vitest';
import { QuaternionOps } from '../quaternion-ops';
import { DegenerateQuaternionError } from '../../shared/errors/camera';

describe('QuaternionOps', () => {
  describe('constructor and identity', () => {
    it('should create identity quaternion by default', () => {
      const q = new QuaternionOps();
      expect(q.x).toBe(0);
      expect(q.y).toBe(0);
      expect(q.z).toBe(0);
      expect(q.w).toBe(1);
    });

    it('should create identity via static method', () => {
      const q = QuaternionOps.identity();
      expect(q.w).toBe(1);
      expect(q.x).toBe(0);
    });

    it('should create from plain quaternion', () => {
      const q = QuaternionOps.fromQuaternion({ x: 1, y: 2, z: 3, w: 4 });
      expect(q.x).toBe(1);
      expect(q.y).toBe(2);
      expect(q.z).toBe(3);
      expect(q.w).toBe(4);
    });
  });

  describe('normalize', () => {
    it('should normalize to unit length', () => {
      const q = new QuaternionOps(1, 1, 1, 1).normalize();
      expect(q.length()).toBeCloseTo(1, 10);
    });

    it('should throw DegenerateQuaternionError for zero quaternion', () => {
      const q = new QuaternionOps(0, 0, 0, 0);
      expect(() => q.normalize()).toThrow(DegenerateQuaternionError);
    });
  });

  describe('multiply', () => {
    it('identity multiplied by identity should be identity', () => {
      const a = QuaternionOps.identity();
      const b = QuaternionOps.identity();
      const result = a.multiply(b);
      expect(result.w).toBeCloseTo(1, 10);
      expect(result.x).toBeCloseTo(0, 10);
    });

    it('should be associative', () => {
      const a = new QuaternionOps(1, 0, 0, 0).normalize();
      const b = new QuaternionOps(0, 1, 0, 0).normalize();
      const c = new QuaternionOps(0, 0, 1, 0).normalize();
      const ab_c = a.multiply(b).multiply(c);
      const a_bc = a.multiply(b.multiply(c));
      expect(ab_c.x).toBeCloseTo(a_bc.x, 6);
      expect(ab_c.y).toBeCloseTo(a_bc.y, 6);
      expect(ab_c.z).toBeCloseTo(a_bc.z, 6);
      expect(ab_c.w).toBeCloseTo(a_bc.w, 6);
    });
  });

  describe('conjugate', () => {
    it('should negate imaginary parts', () => {
      const q = new QuaternionOps(1, 2, 3, 4);
      const conj = q.conjugate();
      expect(conj.x).toBe(-1);
      expect(conj.y).toBe(-2);
      expect(conj.z).toBe(-3);
      expect(conj.w).toBe(4);
    });
  });

  describe('fromAxisAngle', () => {
    it('should create identity for zero angle', () => {
      const q = new QuaternionOps().fromAxisAngle({ x: 0, y: 1, z: 0 }, 0);
      expect(q.w).toBeCloseTo(1, 10);
      expect(q.x).toBeCloseTo(0, 10);
    });

    it('should create 90-degree rotation around Y', () => {
      const q = new QuaternionOps().fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
      expect(q.w).toBeCloseTo(Math.cos(Math.PI / 4), 10);
      expect(q.y).toBeCloseTo(Math.sin(Math.PI / 4), 10);
    });
  });

  describe('toMatrix', () => {
    it('identity quaternion should produce identity matrix', () => {
      const q = QuaternionOps.identity();
      const m = q.toMatrix();
      expect(m[0]).toBeCloseTo(1, 6);
      expect(m[5]).toBeCloseTo(1, 6);
      expect(m[10]).toBeCloseTo(1, 6);
      expect(m[15]).toBeCloseTo(1, 6);
    });

    it('should produce orthogonal matrix', () => {
      const q = new QuaternionOps().fromAxisAngle(
        { x: 1, y: 0, z: 0 }, Math.PI / 3,
      ).normalize();
      const m = q.toMatrix();
      // Check column 0 dot column 1 ≈ 0
      const dot = m[0] * m[1] + m[4] * m[5] + m[8] * m[9];
      expect(Math.abs(dot)).toBeLessThan(1e-6);
    });
  });

  describe('slerp', () => {
    it('should return start at t=0', () => {
      const a = QuaternionOps.identity();
      const b = new QuaternionOps().fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
      const result = a.slerp(b, 0);
      expect(result.w).toBeCloseTo(1, 6);
      expect(result.x).toBeCloseTo(0, 6);
    });

    it('should return end at t=1', () => {
      const a = QuaternionOps.identity();
      const b = new QuaternionOps().fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
      const result = a.slerp(b, 1);
      expect(result.w).toBeCloseTo(b.w, 6);
      expect(result.y).toBeCloseTo(b.y, 6);
    });

    it('should interpolate at t=0.5', () => {
      const a = QuaternionOps.identity();
      const b = new QuaternionOps().fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI);
      const result = a.slerp(b, 0.5);
      expect(result.length()).toBeCloseTo(1, 6);
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const q = new QuaternionOps(1, 2, 3, 4);
      const c = q.clone();
      expect(c.x).toBe(q.x);
      c.x = 99;
      expect(q.x).toBe(1);
    });
  });

  describe('rotateVector', () => {
    it('identity should not change vector', () => {
      const q = QuaternionOps.identity();
      const v = q.rotateVector({ x: 1, y: 2, z: 3 });
      expect(v.x).toBeCloseTo(1, 6);
      expect(v.y).toBeCloseTo(2, 6);
      expect(v.z).toBeCloseTo(3, 6);
    });

    it('should rotate vector 90 degrees around Y', () => {
      const q = new QuaternionOps().fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
      const v = q.rotateVector({ x: 1, y: 0, z: 0 });
      expect(v.x).toBeCloseTo(0, 6);
      expect(v.z).toBeCloseTo(-1, 6);
    });
  });

  describe('numerical stability', () => {
    it('should remain stable after 1000 rotations', () => {
      let q = QuaternionOps.identity();
      const delta = new QuaternionOps().fromAxisAngle({ x: 0, y: 1, z: 0 }, 0.01);
      for (let i = 0; i < 1000; i++) {
        q = delta.multiply(q).normalize();
      }
      expect(q.length()).toBeCloseTo(1, 6);
    });
  });
});
