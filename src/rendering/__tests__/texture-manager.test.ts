import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createMockGL } from './helpers';
import { TextureManager } from '../texture-manager';

beforeAll(() => {
  if (typeof ImageData === 'undefined') {
    class MockImageData {
      readonly width: number;
      readonly height: number;
      readonly data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    vi.stubGlobal('ImageData', MockImageData);
  }
});

describe('TextureManager', () => {
  it('should create and register 3D volume texture', () => {
    const { gl, spies } = createMockGL();
    const manager = new TextureManager(gl);
    const data = new Int16Array(8);
    const dims = { x: 2, y: 2, z: 2 };

    const texture = manager.createVolume3D('volume', data, dims);

    expect(texture).toBeDefined();
    expect(spies.texImage3D).toHaveBeenCalled();
    expect(manager.get('volume')).toBe(texture);
  });

  it('should create and register 2D texture', () => {
    const { gl, spies } = createMockGL();
    const manager = new TextureManager(gl);
    const data = new Uint8Array(4);

    const texture = manager.createTexture2D('tex2d', data, 1, 1);

    expect(texture).toBeDefined();
    expect(spies.texImage2D).toHaveBeenCalled();
    expect(manager.get('tex2d')).toBe(texture);
  });

  it('should replace texture when creating with same name', () => {
    const { gl, spies } = createMockGL();
    const manager = new TextureManager(gl);
    const data = new Int16Array(8);

    manager.createVolume3D('vol', data, { x: 2, y: 2, z: 2 });
    manager.createVolume3D('vol', data, { x: 2, y: 2, z: 2 });

    expect(spies.deleteTexture).toHaveBeenCalledTimes(1);
    expect(manager.get('vol')).toBeDefined();
  });

  it('should update 3D volume texture', () => {
    const { gl, spies } = createMockGL();
    const manager = new TextureManager(gl);

    manager.createVolume3D('volume', new Int16Array(8), { x: 2, y: 2, z: 2 });
    spies.texSubImage3D.mockClear();

    manager.updateVolume3D('volume', new Int16Array(4), { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });

    expect(spies.texSubImage3D).toHaveBeenCalled();
  });

  it('should throw when updating non-existent texture', () => {
    const { gl } = createMockGL();
    const manager = new TextureManager(gl);

    expect(() =>
      manager.updateVolume3D('missing', new Int16Array(1), { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })
    ).toThrow(/not found/);
  });

  it('should dispose specific texture', () => {
    const { gl, spies } = createMockGL();
    const manager = new TextureManager(gl);

    manager.createVolume3D('vol1', new Int16Array(8), { x: 2, y: 2, z: 2 });
    manager.createVolume3D('vol2', new Int16Array(8), { x: 2, y: 2, z: 2 });

    manager.dispose('vol1');

    expect(spies.deleteTexture).toHaveBeenCalled();
    expect(manager.get('vol1')).toBeUndefined();
    expect(manager.get('vol2')).toBeDefined();
  });

  it('should dispose all textures', () => {
    const { gl, spies } = createMockGL();
    const manager = new TextureManager(gl);

    manager.createVolume3D('vol1', new Int16Array(8), { x: 2, y: 2, z: 2 });
    manager.createVolume3D('vol2', new Int16Array(8), { x: 2, y: 2, z: 2 });

    manager.disposeAll();

    expect(spies.deleteTexture).toHaveBeenCalledTimes(2);
    expect(manager.get('vol1')).toBeUndefined();
    expect(manager.get('vol2')).toBeUndefined();
  });

  it('should return undefined for unknown texture', () => {
    const { gl } = createMockGL();
    const manager = new TextureManager(gl);
    expect(manager.get('unknown')).toBeUndefined();
  });

  it('dispose unknown name should not throw', () => {
    const { gl } = createMockGL();
    const manager = new TextureManager(gl);
    expect(() => manager.dispose('unknown')).not.toThrow();
  });
});
