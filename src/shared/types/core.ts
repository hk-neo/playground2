/** 2D 벡터 */
export interface Vec2 {
  x: number;
  y: number;
}

/** 3D 벡터 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 4x4 행렬 (열 우선, 16개 요소) */
export type Mat4 = Float32Array;

/** 쿼터니언 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** 3차원 크기 */
export interface Dimensions {
  x: number;
  y: number;
  z: number;
}
