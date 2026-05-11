import type { Vec3 } from '../types/core';
import type { VolumeData, SliceData, MemoryUsage } from '../types/volume';

/** 볼륨 구성 추상화 */
export interface IVolumeBuilder {
  build(slices: SliceData[]): VolumeData;
}

/** 보간 추상화 */
export interface IInterpolator {
  interpolate(point: Vec3, volume: VolumeData): number;
}

/** 메모리 관리 추상화 */
export interface IMemoryPool {
  acquire(size: number): ArrayBuffer;
  release(buffer: ArrayBuffer): void;
  compact(): void;
  getUsage(): MemoryUsage;
}
