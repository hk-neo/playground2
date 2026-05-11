import type { Mat4, Quaternion, Vec3 } from '../types/core';
import type { DecomposedView } from '../types/camera';

/** 카메라 추상화 */
export interface ICamera {
  getViewMatrix(): Mat4;
  getProjectionMatrix(aspect: number): Mat4;
  getPosition(): Vec3;
  reset(): void;
}

/** 쿼터니언 연산 추상화 */
export interface IQuaternionOps {
  multiply(q: Quaternion): Quaternion;
  normalize(): Quaternion;
  conjugate(): Quaternion;
  toMatrix(): Mat4;
  fromAxisAngle(axis: Vec3, angle: number): Quaternion;
  slerp(q: Quaternion, t: number): Quaternion;
}
