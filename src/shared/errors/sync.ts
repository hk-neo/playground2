/** 동기화 타임아웃 에러 */
export class SyncTimeoutError extends Error {
  constructor(elapsed: number) {
    super(`Viewport synchronization timed out after ${elapsed}ms`);
    this.name = 'SyncTimeoutError';
  }
}

/** 좌표 변환 실패 에러 */
export class TransformFailureError extends Error {
  constructor(message = 'Coordinate transform failed, maintaining last valid position') {
    super(message);
    this.name = 'TransformFailureError';
  }
}

/** 동기화 충돌 에러 */
export class SyncConflictError extends Error {
  constructor(sources: string[]) {
    super(`Sync conflict from sources: ${sources.join(', ')}, using latest`);
    this.name = 'SyncConflictError';
  }
}

/** 뷰포트 미준비 에러 */
export class ViewportNotReadyError extends Error {
  constructor(viewportId: string) {
    super(`Viewport '${viewportId}' is not ready, event queued`);
    this.name = 'ViewportNotReadyError';
  }
}
