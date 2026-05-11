/** 최소 슬라이스 수 미달 에러 */
export class InsufficientSlicesError extends Error {
  constructor(provided: number, minimum: number) {
    super(`Insufficient slices: ${provided} provided, ${minimum} minimum required`);
    this.name = 'InsufficientSlicesError';
  }
}

/** 슬라이스 간 해상도 불일치 에러 */
export class DimensionMismatchError extends Error {
  constructor(message = 'Slice dimensions do not match') {
    super(message);
    this.name = 'DimensionMismatchError';
  }
}

/** 메모리 한계 초과 에러 */
export class MemoryLimitError extends Error {
  constructor(required: number, available: number) {
    super(`Volume size (${required} bytes) exceeds available memory (${available} bytes)`);
    this.name = 'MemoryLimitError';
  }
}

/** 볼륨 범위 밖 복셀 접근 에러 */
export class InvalidVoxelAccessError extends Error {
  constructor(x: number, y: number, z: number) {
    super(`Voxel access out of bounds: (${x}, ${y}, ${z})`);
    this.name = 'InvalidVoxelAccessError';
  }
}
