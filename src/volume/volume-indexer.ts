import type { Dimensions } from '../shared/types/core';
import type { VolumeData } from '../shared/types/volume';
import { InvalidVoxelAccessError } from '../shared/errors/volume';

/** 3D 볼륨 데이터의 효율적인 인덱싱 및 접근 */
export class VolumeIndexer {
  /** 선형 인덱스 계산 (z 우선) */
  static linearIndex(x: number, y: number, z: number, dims: Dimensions): number {
    return z * dims.x * dims.y + y * dims.x + x;
  }

  /** 복셀 값 읽기 */
  static getVoxel(x: number, y: number, z: number, volume: VolumeData): number {
    const dims: Dimensions = { x: volume.dimensions[0], y: volume.dimensions[1], z: volume.dimensions[2] };
    VolumeIndexer.validateBounds(x, y, z, dims);

    const idx = VolumeIndexer.linearIndex(x, y, z, dims);
    const view = VolumeIndexer.getView(volume);
    return view[idx];
  }

  /** 복셀 값 쓰기 */
  static setVoxel(x: number, y: number, z: number, value: number, volume: VolumeData): void {
    const dims: Dimensions = { x: volume.dimensions[0], y: volume.dimensions[1], z: volume.dimensions[2] };
    VolumeIndexer.validateBounds(x, y, z, dims);

    const idx = VolumeIndexer.linearIndex(x, y, z, dims);
    const view = VolumeIndexer.getView(volume);
    view[idx] = value;
  }

  /** 안전한 복셀 읽기 (범위 밖이면 경계값 반환) */
  static getVoxelClamped(x: number, y: number, z: number, volume: VolumeData): number {
    const dx = volume.dimensions[0];
    const dy = volume.dimensions[1];
    const dz = volume.dimensions[2];

    const cx = Math.max(0, Math.min(dx - 1, x));
    const cy = Math.max(0, Math.min(dy - 1, y));
    const cz = Math.max(0, Math.min(dz - 1, z));

    const idx = cz * dx * dy + cy * dx + cx;
    return VolumeIndexer.getView(volume)[idx];
  }

  /** 인덱스 범위 검증 */
  private static validateBounds(x: number, y: number, z: number, dims: Dimensions): void {
    if (x < 0 || x >= dims.x || y < 0 || y >= dims.y || z < 0 || z >= dims.z) {
      throw new InvalidVoxelAccessError(x, y, z);
    }
  }

  /** 볼륨 데이터 타입에 맞는 TypedArray 뷰 생성 */
  private static getView(volume: VolumeData): Int16Array | Uint16Array {
    if (volume.dataType === 'int16') {
      return new Int16Array(volume.buffer);
    }
    return new Uint16Array(volume.buffer);
  }
}
