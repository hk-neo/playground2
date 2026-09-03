/**
 * Volume Texture — Pack a VolumeData (DICOM HU) into a GPU 3D texture.
 *
 * Auto-fits the upload to a memory budget (default 128 MB) to avoid
 * "Texture total allocation size is too large" on WebGL2 when uploading
 * raw CBCT (e.g. 666^3 Int16 = 295 MB → Float32 = 590 MB).
 *
 * Strategies (in order):
 *   1. Float32 (R32F) at original resolution (lossless HU).
 *   2. Half-float (R16F) at original resolution (int16 HU, 2x less memory,
 *      ~1 HU precision for the CBCT range) — preferred fallback.
 *   3. Float32 with uniform mean-pool downsampling.
 *   4. Uint8 at original resolution (normalised 0..255, lossy).
 *
 * The downsampled extent is reported so the shader can re-scale UVs. We keep
 * the original volume dims for accurate world coordinates.
 */
import * as THREE from 'three';
import type { VolumeData } from '../../shared/types/volume';

const DEFAULT_BUDGET_BYTES = 128 * 1024 * 1024; // 128 MB conservative
const MIN_AXIS = 32;

export interface VolumeTextureOptions {
  /** GPU memory budget in bytes (default 128 MB). */
  budgetBytes?: number;
}

export interface VolumeTextureResult {
  texture: THREE.Data3DTexture;
  /** Logical (downsampled) dims actually uploaded. */
  dimensions: [number, number, number];
  /** Original voxel dims from VolumeData (used for world coords). */
  sourceDimensions: [number, number, number];
  /** 'float32' preserves raw HU; 'half-float' preserves HU (~1 precision); 'uint8' stores normalised 0..255. */
  format: 'float32' | 'half-float' | 'uint8';
  /** Voxel block size used for downsampling (1 = no downsample). */
  downsampleFactor: number;
}

function getVoxelView(volume: VolumeData): Int16Array | Uint16Array {
  return volume.dataType === 'int16'
    ? new Int16Array(volume.buffer)
    : new Uint16Array(volume.buffer);
}

/** float32 → binary16(half-float) bit pattern (rtne). */
export function float32ToHalf16(f: number): number {
  const buf = new ArrayBuffer(4);
  new Float32Array(buf)[0] = f;
  const x = new Uint32Array(buf)[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = ((x >>> 23) & 0xff) - 127 + 15;
  let mant = x & 0x7fffff;
  if (((x >>> 23) & 0xff) === 0xff) {
    return sign | 0x7c00 | (mant ? 0x0200 : 0); // Inf/NaN (int16 입력엔 무관)
  }
  if (((x >>> 23) & 0xff) === 0) return sign; // zero/denormal → 0
  if (exp >= 31) return sign | 0x7c00;         // overflow → Inf
  if (exp <= 0) return sign;                    // underflow → 0
  mant += 0x1000; // round bit
  if (mant & 0x800000) {
    mant = 0;
    exp++;
    if (exp >= 31) return sign | 0x7c00;
  }
  return (sign | (exp << 10) | (mant >>> 13)) >>> 0;
}

/** int16/uint16 voxel values → half-float bit patterns (Uint16Array). */
function toHalfArray(view: Int16Array | Uint16Array): Uint16Array {
  const out = new Uint16Array(view.length);
  for (let i = 0; i < view.length; i++) out[i] = float32ToHalf16(view[i]);
  return out;
}

/** Downsample a 1D voxel buffer by an integer factor using mean pooling. */
function downsampleMean(
  src: Float32Array,
  sx: number, sy: number, sz: number,
  factor: number,
): { data: Float32Array; dx: number; dy: number; dz: number } {
  const dx = Math.max(1, Math.floor(sx / factor));
  const dy = Math.max(1, Math.floor(sy / factor));
  const dz = Math.max(1, Math.floor(sz / factor));
  const out = new Float32Array(dx * dy * dz);
  for (let bz = 0; bz < dz; bz++) {
    const zStart = bz * factor;
    const zEnd = Math.min(sz, zStart + factor);
    for (let by = 0; by < dy; by++) {
      const yStart = by * factor;
      const yEnd = Math.min(sy, yStart + factor);
      for (let bx = 0; bx < dx; bx++) {
        const xStart = bx * factor;
        const xEnd = Math.min(sx, xStart + factor);
        let sum = 0;
        let count = 0;
        for (let z = zStart; z < zEnd; z++) {
          for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
              sum += src[z * sx * sy + y * sx + x];
              count++;
            }
          }
        }
        out[bz * dx * dy + by * dx + bx] = count > 0 ? sum / count : 0;
      }
    }
  }
  return { data: out, dx, dy, dz };
}

/** Pack typed 16-bit HU into Float32 (full copy). */
function copyToFloat32(view: Int16Array | Uint16Array): Float32Array {
  const n = view.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view[i];
  return out;
}

export function buildVolumeTexture(
  volume: VolumeData,
  opts: VolumeTextureOptions = {},
): VolumeTextureResult {
  const [sx, sy, sz] = volume.dimensions;
  const view = getVoxelView(volume);
  const budget = opts.budgetBytes ?? DEFAULT_BUDGET_BYTES;
  const voxels = sx * sy * sz;

  // 형식/다운샘플 결정 (메모리 예산 기반).
  let chosenFormat: 'float32' | 'half-float' | 'uint8';
  let factor = 1;

  if (voxels * 4 <= budget) {
    chosenFormat = 'float32';
  } else if (voxels * 2 <= budget) {
    chosenFormat = 'half-float';
  } else {
    // 다운샘플 시도 (float32 유지). MIN_AXIS 보존.
    chosenFormat = 'float32';
    let nextFactor = 2;
    let valid = true;
    while (nextFactor * 4 * Math.floor(sx / nextFactor) * Math.floor(sy / nextFactor) * Math.floor(sz / nextFactor) > budget) {
      nextFactor *= 2;
      if (Math.floor(sx / nextFactor) < MIN_AXIS ||
          Math.floor(sy / nextFactor) < MIN_AXIS ||
          Math.floor(sz / nextFactor) < MIN_AXIS ||
          nextFactor > 32) {
        valid = false;
        break;
      }
    }
    if (valid) {
      factor = nextFactor;
    } else {
      chosenFormat = 'uint8';
    }
  }

  let data: Float32Array | Uint16Array | Uint8Array;
  let type: THREE.TextureDataType;
  const format: THREE.PixelFormat = THREE.RedFormat;
  let dx = sx, dy = sy, dz = sz;

  if (chosenFormat === 'float32') {
    if (factor === 1) {
      data = copyToFloat32(view);
    } else {
      const full = copyToFloat32(view);
      const ds = downsampleMean(full, sx, sy, sz, factor);
      data = ds.data;
      dx = ds.dx; dy = ds.dy; dz = ds.dz;
    }
    type = THREE.FloatType;
  } else if (chosenFormat === 'half-float') {
    data = toHalfArray(view);
    type = THREE.HalfFloatType;
    factor = 1;
  } else {
    // Uint8: 원해상도 유지, HU → 0..255 정규화.
    const f32 = copyToFloat32(view);
    const HU_MIN = -1000;
    const HU_MAX = 3000;
    const range = HU_MAX - HU_MIN;
    const u8 = new Uint8Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      let v = (f32[i] - HU_MIN) / range;
      if (v < 0) v = 0; else if (v > 1) v = 1;
      u8[i] = Math.round(v * 255);
    }
    data = u8;
    type = THREE.UnsignedByteType;
    factor = 1;
  }

  const texture = new THREE.Data3DTexture(data as unknown as BufferSource, dx, dy, dz);
  texture.format = format;
  texture.type = type;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  return {
    texture,
    dimensions: [dx, dy, dz],
    sourceDimensions: [sx, sy, sz],
    format: chosenFormat,
    downsampleFactor: factor,
  };
}

export function disposeVolumeTexture(r: VolumeTextureResult | null): void {
  if (!r) return;
  r.texture.dispose();
}