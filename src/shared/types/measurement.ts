import type { Vec2, Vec3 } from './core';
import type { MPRPlane } from './rendering';

/** 측정 결과 */
export interface MeasureResult {
  type: 'distance' | 'angle' | 'roi';
  value: number;
  unit: 'mm' | 'degree' | 'px²';
  points: Vec2[];
  formatted: string;
}

/** 픽셀 간격 */
export interface PixelSpacing {
  row: number;
  col: number;
  slice?: number;
  isAvailable: boolean;
}

/** 볼륨 범위 */
export interface VolumeBounds {
  min: Vec3;
  max: Vec3;
}
