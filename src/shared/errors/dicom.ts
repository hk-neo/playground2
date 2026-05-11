/** DICOM 파일 매직 바이트 불일치 에러 */
export class InvalidDicomError extends Error {
  constructor(message = "Invalid DICOM file: magic byte 'DICM' not found") {
    super(message);
    this.name = 'InvalidDicomError';
  }
}

/** 필수 DICOM 태그 누락 에러 */
export class MissingTagError extends Error {
  constructor(tagName: string) {
    super(`Required DICOM tag missing: ${tagName}`);
    this.name = 'MissingTagError';
  }
}

/** 지원하지 않는 전송 구문 에러 */
export class UnsupportedTransferSyntaxError extends Error {
  constructor(uid: string) {
    super(`Unsupported transfer syntax: ${uid}`);
    this.name = 'UnsupportedTransferSyntaxError';
  }
}

/** 파일 손상 에러 */
export class CorruptedFileError extends Error {
  constructor(message = 'DICOM file is corrupted or incomplete') {
    super(message);
    this.name = 'CorruptedFileError';
  }
}
