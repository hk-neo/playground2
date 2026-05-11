/** 측정 포인트 부족 에러 */
export class InsufficientPointsError extends Error {
  constructor(tool: string, required: number, provided: number) {
    super(`${tool} requires ${required} points, but only ${provided} provided`);
    this.name = 'InsufficientPointsError';
  }
}

/** 유효하지 않은 ROI 에러 */
export class InvalidROIError extends Error {
  constructor(message = 'ROI size is below minimum threshold') {
    super(message);
    this.name = 'InvalidROIError';
  }
}

/** 좌표 변환 에러 */
export class CoordinateMappingError extends Error {
  constructor(message = 'Coordinate mapping failed, returning original coordinates') {
    super(message);
    this.name = 'CoordinateMappingError';
  }
}
