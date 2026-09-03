import { describe, it, expect } from 'vitest';
import { OrbitalCamera } from '../orbital-camera';

describe('OrbitalCamera', () => {
  describe('constructor', () => {
    it('should have default values', () => {
      const cam = new OrbitalCamera();
      expect(cam.distance).toBe(3.5);
      expect(cam.target.x).toBe(0);
      expect(cam.fov).toBeCloseTo(Math.PI / 4, 10);
    });
  });

  describe('rotate', () => {
    it('should change quaternion on rotation', () => {
      const cam = new OrbitalCamera();
      const qBefore = cam.quaternion.clone();
      cam.rotate(0.1, 0.2);
      expect(cam.quaternion.x).not.toBe(qBefore.x);
    });

    it('should keep quaternion normalized', () => {
      const cam = new OrbitalCamera();
      for (let i = 0; i < 50; i++) {
        cam.rotate(0.05, 0.03);
      }
      expect(cam.quaternion.length()).toBeCloseTo(1, 6);
    });
  });

  describe('zoom', () => {
    it('should clamp to min distance', () => {
      const cam = new OrbitalCamera();
      cam.minDistance = 0.5;
      cam.zoom(-100);
      expect(cam.distance).toBe(0.5);
    });

    it('should clamp to max distance', () => {
      const cam = new OrbitalCamera();
      cam.maxDistance = 10;
      cam.zoom(100);
      expect(cam.distance).toBe(10);
    });

    it('should change distance by delta', () => {
      const cam = new OrbitalCamera();
      const before = cam.distance;
      cam.zoom(-0.5);
      expect(cam.distance).toBe(before - 0.5);
    });
  });

  describe('pan', () => {
    it('should move target', () => {
      const cam = new OrbitalCamera();
      cam.pan(1, 0);
      expect(cam.target.x).not.toBe(0);
    });
  });

  describe('reset', () => {
    it('should restore defaults', () => {
      const cam = new OrbitalCamera();
      cam.rotate(1, 1);
      cam.zoom(-2);
      cam.pan(3, 3);
      cam.reset();
      expect(cam.distance).toBe(3.5);
      expect(cam.target.x).toBe(0);
      expect(cam.quaternion.w).toBeCloseTo(1, 10);
    });
  });

  describe('getPosition', () => {
    it('should be at distance along -Z for identity quaternion', () => {
      const cam = new OrbitalCamera();
      cam.distance = 5;
      const pos = cam.getPosition();
      expect(pos.z).toBeCloseTo(-5, 6);
      expect(pos.x).toBeCloseTo(0, 6);
      expect(pos.y).toBeCloseTo(0, 6);
    });

    it('should update after rotation', () => {
      const cam = new OrbitalCamera();
      cam.rotate(Math.PI / 2, 0);
      const pos = cam.getPosition();
      expect(pos.x).toBeCloseTo(-cam.distance, 4);
      expect(pos.z).toBeCloseTo(0, 4);
    });
  });

  describe('getViewMatrix', () => {
    it('should return 16-element Float32Array', () => {
      const cam = new OrbitalCamera();
      const m = cam.getViewMatrix();
      expect(m).toBeInstanceOf(Float32Array);
      expect(m.length).toBe(16);
    });
  });

  describe('getProjectionMatrix', () => {
    it('should return valid perspective matrix', () => {
      const cam = new OrbitalCamera();
      const m = cam.getProjectionMatrix(1);
      expect(m).toBeInstanceOf(Float32Array);
      expect(m.length).toBe(16);
      expect(m[11]).toBe(-1);
    });
  });

  describe('setters', () => {
    it('setDistance should clamp', () => {
      const cam = new OrbitalCamera();
      cam.minDistance = 1;
      cam.maxDistance = 10;
      cam.setDistance(0.5);
      expect(cam.distance).toBe(1);
      cam.setDistance(20);
      expect(cam.distance).toBe(10);
    });

    it('setFov should clamp', () => {
      const cam = new OrbitalCamera();
      cam.setFov(0);
      expect(cam.fov).toBe(0.01);
      cam.setFov(10);
      expect(cam.fov).toBeLessThan(Math.PI);
    });

    it('setDistanceLimits should update distance', () => {
      const cam = new OrbitalCamera();
      cam.setDistanceLimits(5, 10);
      expect(cam.distance).toBe(5); // clamped from 2.5 to 5
    });
  });
});
