import type { Vec2, Vec3 } from '../types/core';
import type { MPRPlane } from '../types/rendering';
import type { MeasureResult, PixelSpacing, VolumeBounds } from '../types/measurement';
import type { ApplicationInput } from '../types/input';

/** 측정 도구 추상화 */
export interface IMeasurementTool {
  activate(): void;
  deactivate(): void;
  handleInput(input: ApplicationInput): void;
  getResult(): MeasureResult;
}

/** ROI 형태 추상화 */
export interface IROIShape {
  contains(point: Vec2): boolean;
  getArea(): number;
  getVolumeBounds(): VolumeBounds;
}

/** 좌표 변환 추상화 */
export interface ICoordinateMapper {
  screenToVolume(screen: Vec2, sliceIndex: number, plane: MPRPlane): Vec3;
  volumeToScreen(volume: Vec3, plane: MPRPlane): Vec2;
  setPixelSpacing(spacing: PixelSpacing): void;
}
