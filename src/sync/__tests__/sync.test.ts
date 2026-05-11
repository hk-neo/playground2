import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../event-bus';
import { CoordinateTransformer } from '../coordinate-transformer';
import { SyncController } from '../sync-controller';
import { SyncErrorHandler } from '../sync-error-handler';
import { MPRPlane } from '../../shared/types/rendering';
import type { IViewport } from '../../shared/interfaces/sync';
import type { Vec3 } from '../../shared/types/core';

function createMockViewport(plane: MPRPlane): IViewport {
  let pos: Vec3 = { x: 0, y: 0, z: 0 };
  return {
    getPosition: () => pos,
    setPosition: (p: Vec3) => { pos = { ...p }; },
    getPlane: () => plane,
  };
}

describe('EventBus', () => {
  it('should subscribe and publish events', () => {
    const bus = new EventBus();
    const cb = vi.fn();
    bus.subscribe('sync', cb);
    bus.publish('sync', { position: { x: 1, y: 2, z: 3 }, source: 'test' });
    expect(bus.getQueueLength()).toBe(1);

    bus.processQueue();
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].position.x).toBe(1);
  });

  it('should unsubscribe', () => {
    const bus = new EventBus();
    const cb = vi.fn();
    bus.subscribe('sync', cb);
    bus.unsubscribe('sync', cb);
    bus.publish('sync', { position: { x: 0, y: 0, z: 0 }, source: 'test' });
    bus.processQueue();
    expect(cb).not.toHaveBeenCalled();
  });

  it('should handle multiple subscribers', () => {
    const bus = new EventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.subscribe('sync', cb1);
    bus.subscribe('sync', cb2);
    bus.publish('sync', { position: { x: 0, y: 0, z: 0 }, source: 'test' });
    bus.processQueue();
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it('should clear all', () => {
    const bus = new EventBus();
    bus.subscribe('sync', () => {});
    bus.publish('sync', { position: { x: 0, y: 0, z: 0 }, source: 'test' });
    bus.clear();
    expect(bus.getSubscriberCount('sync')).toBe(0);
    expect(bus.getQueueLength()).toBe(0);
  });
});

describe('CoordinateTransformer', () => {
  it('should convert MPR to 3D (axial)', () => {
    const ct = new CoordinateTransformer();
    ct.setDimensions({ x: 512, y: 512, z: 200 });
    const result = ct.mprTo3D({ x: 256, y: 256, z: 100 }, MPRPlane.Axial);
    expect(result.x).toBe(256);
    expect(result.y).toBe(256);
    expect(result.z).toBeCloseTo(0.5, 3);
  });

  it('should convert 3D to MPR position', () => {
    const ct = new CoordinateTransformer();
    ct.setDimensions({ x: 512, y: 512, z: 200 });
    const pos = ct.threeDToMPR({ x: 0.5, y: 0.5, z: 0.5 });
    expect(pos.axial).toBe(100);
    expect(pos.coronal).toBe(256);
    expect(pos.sagittal).toBe(256);
  });

  it('should compute transform matrix', () => {
    const ct = new CoordinateTransformer();
    ct.setDimensions({ x: 100, y: 200, z: 300 });
    const m = ct.computeTransformMatrix();
    expect(m[0]).toBeCloseTo(0.01, 3);
    expect(m[5]).toBeCloseTo(0.005, 3);
  });

  it('should validate transform', () => {
    const ct = new CoordinateTransformer();
    ct.setDimensions({ x: 100, y: 200, z: 300 });
    expect(ct.validateTransform()).toBe(true);
    ct.setDimensions({ x: 0, y: 200, z: 300 });
    expect(ct.validateTransform()).toBe(false);
  });
});

describe('SyncErrorHandler', () => {
  it('should handle and log errors', () => {
    const handler = new SyncErrorHandler();
    handler.handleError({ type: 'timeout', message: 'test', source: 'vp1' });
    expect(handler.getErrors()).toHaveLength(1);
    expect(handler.getLastError()?.type).toBe('timeout');
  });

  it('should clear errors', () => {
    const handler = new SyncErrorHandler();
    handler.handleError({ type: 'conflict', message: 'test', source: 'vp1' });
    handler.clearErrors();
    expect(handler.getErrors()).toHaveLength(0);
  });
});

describe('SyncController', () => {
  it('should register viewports', () => {
    const ctrl = new SyncController();
    ctrl.registerViewport('axial', createMockViewport(MPRPlane.Axial));
    ctrl.registerViewport('coronal', createMockViewport(MPRPlane.Coronal));
    expect(ctrl.getViewportCount()).toBe(2);
  });

  it('should sync position from source to others', () => {
    const ctrl = new SyncController();
    const axial = createMockViewport(MPRPlane.Axial);
    const coronal = createMockViewport(MPRPlane.Coronal);
    const sagittal = createMockViewport(MPRPlane.Sagittal);
    ctrl.registerViewport('axial', axial);
    ctrl.registerViewport('coronal', coronal);
    ctrl.registerViewport('sagittal', sagittal);

    ctrl.syncFrom('axial', { x: 10, y: 20, z: 30 });

    expect(coronal.getPosition()).toEqual({ x: 10, y: 20, z: 30 });
    expect(sagittal.getPosition()).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('should not update source viewport', () => {
    const ctrl = new SyncController();
    const axial = createMockViewport(MPRPlane.Axial);
    const coronal = createMockViewport(MPRPlane.Coronal);
    ctrl.registerViewport('axial', axial);
    ctrl.registerViewport('coronal', coronal);

    ctrl.syncFrom('axial', { x: 99, y: 99, z: 99 });
    expect(axial.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('should update sync state', () => {
    const ctrl = new SyncController();
    ctrl.registerViewport('axial', createMockViewport(MPRPlane.Axial));
    ctrl.syncFrom('axial', { x: 1, y: 2, z: 3 });
    const state = ctrl.getSyncState();
    expect(state.lastSource).toBe('axial');
    expect(state.lastTimestamp).toBeGreaterThan(0);
  });

  it('should enable/disable sync', () => {
    const ctrl = new SyncController();
    ctrl.registerViewport('axial', createMockViewport(MPRPlane.Axial));
    ctrl.registerViewport('coronal', createMockViewport(MPRPlane.Coronal));

    ctrl.disableSync();
    ctrl.syncFrom('axial', { x: 99, y: 99, z: 99 });
    expect(ctrl.getViewport('coronal')!.getPosition()).toEqual({ x: 0, y: 0, z: 0 });

    ctrl.enableSync();
    ctrl.syncFrom('axial', { x: 50, y: 50, z: 50 });
    expect(ctrl.getViewport('coronal')!.getPosition()).toEqual({ x: 50, y: 50, z: 50 });
  });

  it('should resolve conflict using last source', () => {
    const ctrl = new SyncController();
    ctrl.registerViewport('a', createMockViewport(MPRPlane.Axial));
    ctrl.syncFrom('a', { x: 0, y: 0, z: 0 });
    expect(ctrl.resolveConflict('a', 'b')).toBe('a');
  });

  it('should unregister viewport', () => {
    const ctrl = new SyncController();
    ctrl.registerViewport('axial', createMockViewport(MPRPlane.Axial));
    ctrl.unregisterViewport('axial');
    expect(ctrl.getViewportCount()).toBe(0);
  });
});
