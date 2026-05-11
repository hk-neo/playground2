import { describe, it, expect } from 'vitest';
import { RayMarchingShader } from '../ray-marching-shader';

describe('RayMarchingShader', () => {
  describe('vertex/fragment shaders', () => {
    it('should return valid vertex shader string', () => {
      const shader = new RayMarchingShader();
      const vs = shader.getVertexShader();
      expect(vs).toContain('aPosition');
      expect(vs).toContain('uMVP');
    });

    it('should return valid fragment shader string', () => {
      const shader = new RayMarchingShader();
      const fs = shader.getFragmentShader();
      expect(fs).toContain('uVolume');
      expect(fs).toContain('uTransferFunction');
      expect(fs).toContain('uBackFace');
    });

    it('should return back face shaders', () => {
      const shader = new RayMarchingShader();
      const bvs = shader.getBackFaceVertexShader();
      const bfs = shader.getBackFaceFragmentShader();
      expect(bvs).toContain('aPosition');
      expect(bfs).toContain('vPosition');
    });

    it('should return ShaderSource object', () => {
      const shader = new RayMarchingShader();
      const source = shader.getShaderSource();
      expect(source.vertex).toBeTruthy();
      expect(source.fragment).toBeTruthy();
    });
  });

  describe('stepSize', () => {
    it('should have default step size', () => {
      const shader = new RayMarchingShader();
      expect(shader.stepSizeValue).toBe(0.005);
    });

    it('should update step size', () => {
      const shader = new RayMarchingShader();
      shader.setStepSize(0.01);
      expect(shader.stepSizeValue).toBe(0.01);
    });

    it('should reject invalid step size', () => {
      const shader = new RayMarchingShader();
      expect(() => shader.setStepSize(0)).toThrow();
      expect(() => shader.setStepSize(2)).toThrow();
    });
  });

  describe('earlyRayTermination', () => {
    it('should have default value', () => {
      const shader = new RayMarchingShader();
      expect(shader.earlyRayTerminationValue).toBe(0.95);
    });

    it('should update early ray termination', () => {
      const shader = new RayMarchingShader();
      shader.setEarlyRayTermination(0.99);
      expect(shader.earlyRayTerminationValue).toBe(0.99);
    });

    it('should reject invalid values', () => {
      const shader = new RayMarchingShader();
      expect(() => shader.setEarlyRayTermination(0)).toThrow();
      expect(() => shader.setEarlyRayTermination(1.5)).toThrow();
    });
  });
});
