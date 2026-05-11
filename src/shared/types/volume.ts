import type { Dimensions, Vec3 } from './core';

/** 볼륨 데이터 타입 */
export type VolumeDataType = 'int16' | 'uint16';

/** 3D 볼륨 데이터 */
export interface VolumeData {
  buffer: ArrayBuffer;
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  dataType: VolumeDataType;
}

/** 개별 슬라이스 데이터 */
export interface SliceData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  sliceIndex: number;
  position: number;
}

/** 볼륨 빌드 설정 */
export interface VolumeConfig {
  targetDimensions?: Dimensions;
  interpolationMode?: 'nearest' | 'trilinear';
}

/** 메모리 사용량 */
export interface MemoryUsage {
  totalAllocated: number;
  totalReleased: number;
  activeBuffers: number;
}

/** 진행률 콜백 */
export type ProgressCallback = (progress: number) => void;
