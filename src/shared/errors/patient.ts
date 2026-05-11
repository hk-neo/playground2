/** 환자 정보 누락 에러 */
export class MissingPatientInfoError extends Error {
  constructor(field: string) {
    super(`Required patient info missing: ${field}, displaying 'Unknown'`);
    this.name = 'MissingPatientInfoError';
  }
}

/** 날짜 파싱 에러 */
export class DateParseError extends Error {
  constructor(rawValue: string) {
    super(`Failed to parse DICOM date: ${rawValue}, displaying raw value`);
    this.name = 'DateParseError';
  }
}

/** 세션 충돌 에러 */
export class SessionConflictError extends Error {
  constructor(message = 'Session conflict detected, using latest session') {
    super(message);
    this.name = 'SessionConflictError';
  }
}

/** 문자 인코딩 에러 */
export class EncodingError extends Error {
  constructor(message = 'Character encoding error, falling back to UTF-8') {
    super(message);
    this.name = 'EncodingError';
  }
}
