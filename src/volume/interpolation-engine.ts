import type { Vec3 } from '../shared/types/core';
import type { VolumeData } from '../shared/types/volume';
import { VolumeIndexer } from './volume-indexer';

/** 이중선형/삼중선형 보간 */
export class InterpolationEngine {
  /** 이중선형 보간 (2D) */
  static bilinearInterpolate(x: number, y: number, data: Float32Array, width: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const fx = x - x0;
    const fy = y - y0;

    const w = width;
    const height = data.length / width;

    const c00 = InterpolationEngine.sample2D(x0, y0, data, w, height);
    const c10 = InterpolationEngine.sample2D(x1, y0, data, w, height);
    const c01 = InterpolationEngine.sample2D(x0, y1, data, w, height);
    const c11 = InterpolationEngine.sample2D(x1, y1, data, w, height);

    return (1 - fx) * (1 - fy) * c00 +
           fx * (1 - fy) * c10 +
           (1 - fx) * fy * c01 +
           fx * fy * c11;
  }

  /** 삼중선형 보간 (3D) */
  static trilinearInterpolate(p: Vec3, volume: VolumeData): number {
    const dx = volume.dimensions[0];
    const dy = volume.dimensions[1];
    const dz = volume.dimensions[2];

    const x0 = Math.floor(p.x);
    const y0 = Math.floor(p.y);
    const z0 = Math.floor(p.z);

    const fx = p.x - x0;
    const fy = p.y - y0;
    const fz = p.z - z0;

    const c000 = VolumeIndexer.getVoxelClamped(x0, y0, z0, volume);
    const c100 = VolumeIndexer.getVoxelClamped(x0 + 1, y0, z0, volume);
    const c010 = VolumeIndexer.getVoxelClamped(x0, y0 + 1, z0, volume);
    const c110 = VolumeIndexer.getVoxelClamped(x0 + 1, y0 + 1, z0, volume);
    const c001 = VolumeIndexer.getVoxelClamped(x0, y0, z0 + 1, volume);
    const c101 = VolumeIndexer.getVoxelClamped(x0 + 1, y0, z0 + 1, volume);
    const c011 = VolumeIndexer.getVoxelClamped(x0, y0 + 1, z0 + 1, volume);
    const c111 = VolumeIndexer.getVoxelClamped(x0 + 1, y0 + 1, z0 + 1, volume);

    const c00 = c000 * (1 - fx) + c100 * fx;
    const c01 = c001 * (1 - fx) + c101 * fx;
    const c10 = c010 * (1 - fx) + c110 * fx;
    const c11 = c011 * (1 - fx) + c111 * fx;

    const c0 = c00 * (1 - fy) + c10 * fy;
    const c1 = c01 * (1 - fy) + c11 * fy;

    return c0 * (1 - fz) + c1 * fz;
  }

  /** 2D 경계 샘플링 (clamped) */
  private static sample2D(x: number, y: number, data: Float32Array, width: number, height: number): number {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    return data[cy * width + cx];
  }
}
