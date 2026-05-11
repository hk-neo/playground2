import type { Vec3, Quaternion } from './core';

/** 분해된 뷰 행렬 */
export interface DecomposedView {
  position: Vec3;
  target: Vec3;
  up: Vec3;
}

/** 카메라 상태 */
export interface CameraState {
  target: Vec3;
  distance: number;
  quaternion: Quaternion;
  fov: number;
}
