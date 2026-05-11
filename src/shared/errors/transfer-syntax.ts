/** 인코딩 감지 에러 */
export class EncodingDetectionError extends Error {
  constructor(message = 'Failed to detect character encoding, falling back to UTF-8') {
    super(message);
    this.name = 'EncodingDetectionError';
  }
}

/** 바이트 순서 변환 에러 */
export class ByteOrderError extends Error {
  constructor(message = 'Byte order conversion failed, returning original data') {
    super(message);
    this.name = 'ByteOrderError';
  }
}
