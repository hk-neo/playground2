/** 보안 위반 에러 */
export class SecurityViolationError extends Error {
  constructor(violationType: string, location: string) {
    super(`Security violation detected: ${violationType} at ${location}`);
    this.name = 'SecurityViolationError';
  }
}

/** 캐시 정책 에러 */
export class CachePolicyError extends Error {
  constructor(message = 'Cache policy application failed, applying fallback') {
    super(message);
    this.name = 'CachePolicyError';
  }
}

/** 감사 로그 에러 */
export class AuditLogError extends Error {
  constructor(message = 'Audit log write failed, falling back to local storage') {
    super(message);
    this.name = 'AuditLogError';
  }
}

/** 데이터 삭제 에러 */
export class DataDisposalError extends Error {
  constructor(message = 'Secure data disposal failed, retrying') {
    super(message);
    this.name = 'DataDisposalError';
  }
}
