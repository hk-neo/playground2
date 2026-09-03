import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildVolumeTexture, disposeVolumeTexture, float32ToHalf16 } from '../volume-texture';
import type { VolumeData } from '../../../shared/types/volume';

function makeTestVolume(
  dims: [number, number, number],
  fill?: (x: number, y: number, z: number) => number,
): VolumeData {
  const [dx, dy, dz] = dims;
  const buf = new ArrayBuffer(dx * dy * dz * 2);
  const view = new Int16Array(buf);
  for (let z = 0; z < dz; z++) {
    for (let y = 0; y < dy; y++) {
      for (let x = 0; x < dx; x++) {
        view[z * dx * dy + y * dx + x] = fill
          ? fill(x, y, z)
          : Math.round(-1000 + 4000 * Math.random());
      }
    }
  }
  return {
    buffer: buf,
    dimensions: dims,
    spacing: [0.5, 0.5, 0.5],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

describe('volume-texture', () => {
  it('uploads small volume as Float32 3D texture (no downsample)', () => {
    const vol = makeTestVolume([4, 4, 4]);
    const r = buildVolumeTexture(vol);
    expect(r.format).toBe('float32');
    expect(r.downsampleFactor).toBe(1);
    expect(r.dimensions).toEqual([4, 4, 4]);
    expect(r.sourceDimensions).toEqual([4, 4, 4]);
    expect(r.texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(r.texture.format).toBe(THREE.RedFormat);
    expect(r.texture.type).toBe(THREE.FloatType);
    disposeVolumeTexture(r);
  });

  it('returns texture dims and source dims', () => {
    const vol = makeTestVolume([10, 10, 10]);
    const r = buildVolumeTexture(vol);
    expect(r.sourceDimensions).toEqual([10, 10, 10]);
    expect(r.dimensions).toEqual([10, 10, 10]);
    disposeVolumeTexture(r);
  });

  it('handles Uint16 volume type (dataType="uint16")', () => {
    const dims: [number, number, number] = [4, 4, 4];
    const buf = new ArrayBuffer(4 * 4 * 4 * 2);
    const view = new Uint16Array(buf);
    view.fill(1000);
    const vol: VolumeData = {
      buffer: buf,
      dimensions: dims,
      spacing: [1, 1, 1],
      origin: [0, 0, 0],
      dataType: 'uint16',
    };
    const r = buildVolumeTexture(vol);
    const data = r.texture.image.data as Float32Array;
    // For Float32 path, value IS HU.
    expect(data[0]).toBe(1000);
    disposeVolumeTexture(r);
  });
});

describe('volume-texture (downsample)', () => {
  it('downsamples a 128³ volume to fit 1MB budget, returns Float32 if possible', () => {
    const vol = makeTestVolume([128, 128, 128]);
    const r = buildVolumeTexture(vol, { budgetBytes: 1 * 1024 * 1024 });
    // 128³*4 = 8MB → must downsample. factor 2 → 64³*4 = 1MB ≈ fits.
    expect(r.format).toBe('float32');
    expect(r.downsampleFactor).toBeGreaterThanOrEqual(2);
    expect(r.sourceDimensions).toEqual([128, 128, 128]);
    // Texture dims smaller
    expect(r.dimensions[0]).toBeLessThan(128);
    disposeVolumeTexture(r);
  });

  it('falls back to Uint8 when Float32 cannot fit even at min axis size', () => {
    // Tiny budget forces fallback.
    const vol = makeTestVolume([128, 128, 128]);
    const r = buildVolumeTexture(vol, { budgetBytes: 64 * 1024 }); // 64 KB — too small for float32 even downsampled
    expect(r.format).toBe('uint8');
    expect(r.downsampleFactor).toBe(1);
    // Even in Uint8 path, texture has original dims.
    expect(r.dimensions).toEqual([128, 128, 128]);
    // data is Uint8Array of 128³ bytes.
    const data = r.texture.image.data as Uint8Array;
    expect(data.length).toBe(128 * 128 * 128);
    disposeVolumeTexture(r);
  });
});

describe('volume-texture (half-float)', () => {
  it('uses half-float when float32 is over budget but half-float fits', () => {
    // 16³ voxels: float32 = 16 KB, half = 8 KB.
    const vol = makeTestVolume([16, 16, 16]);
    const r = buildVolumeTexture(vol, { budgetBytes: 12 * 1024 });
    expect(r.format).toBe('half-float');
    expect(r.downsampleFactor).toBe(1);
    expect(r.dimensions).toEqual([16, 16, 16]);
    expect(r.texture.type).toBe(THREE.HalfFloatType);
    const data = r.texture.image.data as Uint16Array;
    expect(data.length).toBe(16 * 16 * 16);
    disposeVolumeTexture(r);
  });

  it('converts float32 to half precision correctly', () => {
    expect(float32ToHalf16(0)).toBe(0x0000);
    expect(float32ToHalf16(1.0)).toBe(0x3c00);
    expect(float32ToHalf16(-1.0)).toBe(0xbc00);
    expect(float32ToHalf16(1000.0)).toBe(0x63d0);
    expect(float32ToHalf16(-1000.0)).toBe(0xe3d0);
  });
});
