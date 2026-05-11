import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from '../tool-registry';
import { DistanceTool } from '../distance-tool';
import { AngleTool } from '../angle-tool';
import { CoordinateMapper } from '../coordinate-mapper';
import { MPRPlane } from '../../shared/types/rendering';

describe('ToolRegistry', () => {
  it('should register and list tools', () => {
    const registry = new ToolRegistry();
    registry.register('distance', new DistanceTool());
    registry.register('angle', new AngleTool());
    expect(registry.listTools()).toEqual(['distance', 'angle']);
  });

  it('should set active tool', () => {
    const registry = new ToolRegistry();
    const tool = new DistanceTool();
    registry.register('distance', tool);
    registry.setActive('distance');
    expect(registry.getActive()).toBe(tool);
    expect(registry.getActiveName()).toBe('distance');
  });

  it('should deactivate previous tool on switch', () => {
    const registry = new ToolRegistry();
    const d = new DistanceTool();
    const a = new AngleTool();
    registry.register('distance', d);
    registry.register('angle', a);

    registry.setActive('distance');
    registry.setActive('angle');

    expect(registry.getActive()).toBe(a);
  });

  it('should return null when no active tool', () => {
    const registry = new ToolRegistry();
    expect(registry.getActive()).toBeNull();
  });

  it('should clear active tool', () => {
    const registry = new ToolRegistry();
    registry.register('distance', new DistanceTool());
    registry.setActive('distance');
    registry.clearActive();
    expect(registry.getActive()).toBeNull();
  });

  it('should unregister tool', () => {
    const registry = new ToolRegistry();
    registry.register('distance', new DistanceTool());
    registry.setActive('distance');
    registry.unregister('distance');
    expect(registry.getActive()).toBeNull();
    expect(registry.listTools()).toEqual([]);
  });
});

describe('CoordinateMapper', () => {
  it('should convert screen to volume (axial)', () => {
    const mapper = new CoordinateMapper();
    mapper.setPixelSpacing({ row: 0.2, col: 0.2, slice: 0.3, isAvailable: true });
    const vol = mapper.screenToVolume({ x: 100, y: 200 }, 5, MPRPlane.Axial);
    expect(vol.x).toBeCloseTo(20, 2);
    expect(vol.y).toBeCloseTo(40, 2);
    expect(vol.z).toBeCloseTo(1.5, 2);
  });

  it('should convert volume to screen (axial)', () => {
    const mapper = new CoordinateMapper();
    mapper.setPixelSpacing({ row: 0.2, col: 0.2, slice: 0.3, isAvailable: true });
    const screen = mapper.volumeToScreen({ x: 20, y: 40, z: 1.5 }, MPRPlane.Axial);
    expect(screen.x).toBeCloseTo(100, 1);
    expect(screen.y).toBeCloseTo(200, 1);
  });

  it('should round-trip screen to volume to screen', () => {
    const mapper = new CoordinateMapper();
    mapper.setPixelSpacing({ row: 0.2, col: 0.2, isAvailable: true });
    const original = { x: 150, y: 250 };
    const vol = mapper.screenToVolume(original, 10, MPRPlane.Axial);
    const screen = mapper.volumeToScreen(vol, MPRPlane.Axial);
    expect(screen.x).toBeCloseTo(original.x, 5);
    expect(screen.y).toBeCloseTo(original.y, 5);
  });

  it('should handle coronal plane', () => {
    const mapper = new CoordinateMapper();
    mapper.setPixelSpacing({ row: 0.2, col: 0.2, slice: 0.3, isAvailable: true });
    const vol = mapper.screenToVolume({ x: 100, y: 50 }, 10, MPRPlane.Coronal);
    expect(vol.x).toBeCloseTo(20, 2);
    expect(vol.y).toBeCloseTo(2, 2);
    expect(vol.z).toBeCloseTo(15, 2);
  });

  it('should handle sagittal plane', () => {
    const mapper = new CoordinateMapper();
    mapper.setPixelSpacing({ row: 0.2, col: 0.2, slice: 0.3, isAvailable: true });
    const vol = mapper.screenToVolume({ x: 100, y: 50 }, 10, MPRPlane.Sagittal);
    expect(vol.x).toBeCloseTo(2, 2);
    expect(vol.y).toBeCloseTo(20, 2);
    expect(vol.z).toBeCloseTo(15, 2);
  });

  it('should use 1:1 when spacing unavailable', () => {
    const mapper = new CoordinateMapper();
    mapper.setPixelSpacing({ row: 1, col: 1, isAvailable: false });
    const vol = mapper.screenToVolume({ x: 100, y: 200 }, 5, MPRPlane.Axial);
    expect(vol.x).toBe(100);
    expect(vol.y).toBe(200);
  });
});
