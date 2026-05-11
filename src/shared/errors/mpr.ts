/** 단면 위치 범위 초과 에러 */
export class InvalidSlicePositionError extends Error {
  constructor(plane: string, position: number, max: number) {
    super(`Slice position ${position} out of range for ${plane} plane (max: ${max})`);
    this.name = 'InvalidSlicePositionError';
  }
}

/** 볼륨 미로드 에러 */
export class VolumeNotLoadedError extends Error {
  constructor(message = 'Volume data is not loaded') {
    super(message);
    this.name = 'VolumeNotLoadedError';
  }
}

/** 방향 불일치 에러 */
export class OrientationMismatchError extends Error {
  constructor(message = 'DICOM Image Orientation does not match expected plane direction') {
    super(message);
    this.name = 'OrientationMismatchError';
  }
}
