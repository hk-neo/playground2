import { describe, it, expect } from 'vitest';
import { CameraStateStore } from '../camera-state-store';
import { OrbitalCamera } from '../orbital-camera';

describe('CameraStateStore', () => {
  it('should save and restore state', () => {
    const store = new CameraStateStore();
    const cam = new OrbitalCamera();
    cam.rotate(0.5, 0.3);
    cam.zoom(-1);

    store.saveState('test', cam);
    expect(store.hasState('test')).toBe(true);

    const state = store.restoreState('test');
    expect(state).not.toBeNull();
    expect(state!.distance).toBe(cam.distance);
    expect(state!.target.x).toBe(cam.target.x);
    expect(state!.quaternion.x).toBeCloseTo(cam.quaternion.x, 10);
    expect(state!.fov).toBe(cam.fov);
  });

  it('should return null for unknown state', () => {
    const store = new CameraStateStore();
    expect(store.restoreState('unknown')).toBeNull();
    expect(store.hasState('unknown')).toBe(false);
  });

  it('should isolate saved state from camera changes', () => {
    const store = new CameraStateStore();
    const cam = new OrbitalCamera();
    store.saveState('initial', cam);

    cam.rotate(1, 1);
    cam.zoom(-2);

    const state = store.restoreState('initial');
    expect(state!.quaternion.w).toBeCloseTo(1, 10);
    expect(state!.distance).toBe(3.5);
  });

  it('should delete state', () => {
    const store = new CameraStateStore();
    const cam = new OrbitalCamera();
    store.saveState('temp', cam);
    expect(store.deleteState('temp')).toBe(true);
    expect(store.hasState('temp')).toBe(false);
  });

  it('should clear all states', () => {
    const store = new CameraStateStore();
    const cam = new OrbitalCamera();
    store.saveState('a', cam);
    store.saveState('b', cam);
    store.clear();
    expect(store.hasState('a')).toBe(false);
    expect(store.hasState('b')).toBe(false);
  });

  it('should overwrite existing state', () => {
    const store = new CameraStateStore();
    const cam = new OrbitalCamera();
    store.saveState('test', cam);
    cam.zoom(-1);
    store.saveState('test', cam);

    const state = store.restoreState('test');
    expect(state!.distance).toBe(2.5);
  });
});
