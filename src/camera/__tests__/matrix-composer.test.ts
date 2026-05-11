import { describe, it, expect } from 'vitest';
import { MatrixComposer } from '../matrix-composer';
import { QuaternionOps } from '../quaternion-ops';

describe('MatrixComposer', () => {
  describe('composeViewMatrix', () => {
    it('should produce valid lookAt matrix', () => {
      const composer = new MatrixComposer();
      const q = QuaternionOps.identity();
      const position = { x: 0, y: 0, z: 5 };
      const target = { x: 0, y: 0, z: 0 };
      const view = composer.composeViewMatrix(position, q, target);

      // Position at (0,0,5) looking at origin
      // View matrix should translate by -position in view space
      expect(view[14]).toBeCloseTo(-5, 4);
    });

    it('should handle camera at origin looking forward', () => {
      const composer = new MatrixComposer();
      const q = QuaternionOps.identity();
      const position = { x: 0, y: 0, z: 0 };
      const target = { x: 0, y: 0, z: -1 };
      const view = composer.composeViewMatrix(position, q, target);
      expect(view.length).toBe(16);
    });
  });

  describe('composeProjectionMatrix', () => {
    it('should produce valid perspective matrix', () => {
      const composer = new MatrixComposer();
      const proj = composer.composeProjectionMatrix(Math.PI / 4, 1, 0.1, 100);

      // Perspective matrix should have -1 at [11]
      expect(proj[11]).toBe(-1);
      // And 0 at [15]
      expect(proj[15]).toBe(0);
    });

    it('should handle different aspect ratios', () => {
      const composer = new MatrixComposer();
      const proj1 = composer.composeProjectionMatrix(Math.PI / 4, 1, 0.1, 100);
      const proj2 = composer.composeProjectionMatrix(Math.PI / 4, 2, 0.1, 100);

      // Wider aspect should have smaller first element
      expect(Math.abs(proj2[0])).toBeLessThan(Math.abs(proj1[0]));
    });
  });

  describe('decomposeViewMatrix', () => {
    it('should round-trip position', () => {
      const composer = new MatrixComposer();
      const q = QuaternionOps.identity();
      const position = { x: 0, y: 0, z: 5 };
      const target = { x: 0, y: 0, z: 0 };
      const view = composer.composeViewMatrix(position, q, target);
      const decomposed = composer.decomposeViewMatrix(view);

      // Decomposed position should match original (view matrix inverts it)
      // The position in decomposed is the camera position in world space
      expect(decomposed.position.x).toBeCloseTo(position.x, 4);
      expect(decomposed.position.y).toBeCloseTo(position.y, 4);
      expect(decomposed.position.z).toBeCloseTo(position.z, 4);
    });

    it('should return valid up vector', () => {
      const composer = new MatrixComposer();
      const q = QuaternionOps.identity();
      const view = composer.composeViewMatrix(
        { x: 0, y: 0, z: 5 }, q, { x: 0, y: 0, z: 0 },
      );
      const decomposed = composer.decomposeViewMatrix(view);
      const upLen = Math.sqrt(
        decomposed.up.x ** 2 + decomposed.up.y ** 2 + decomposed.up.z ** 2,
      );
      expect(upLen).toBeCloseTo(1, 4);
    });
  });
});
