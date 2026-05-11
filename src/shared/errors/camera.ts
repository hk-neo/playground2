/** 줌 범위 초과 에러 */
export class InvalidZoomError extends Error {
  constructor(distance: number, min: number, max: number) {
    super(`Zoom distance ${distance} out of range [${min}, ${max}]`);
    this.name = 'InvalidZoomError';
  }
}

/** 쿼터니언 정규화 불가 에러 */
export class DegenerateQuaternionError extends Error {
  constructor(message = 'Degenerate quaternion detected, resetting to identity') {
    super(message);
    this.name = 'DegenerateQuaternionError';
  }
}

/** 특이 행렬 에러 */
export class SingularMatrixError extends Error {
  constructor(message = 'Singular matrix encountered, using last valid matrix') {
    super(message);
    this.name = 'SingularMatrixError';
  }
}
