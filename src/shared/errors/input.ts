/** 입력 충돌 에러 */
export class InputConflictError extends Error {
  constructor(message = 'Conflicting input events detected, using latest input') {
    super(message);
    this.name = 'InputConflictError';
  }
}

/** 터치 검증 에러 */
export class TouchValidationError extends Error {
  constructor(message = 'Invalid touch point detected and ignored') {
    super(message);
    this.name = 'TouchValidationError';
  }
}

/** 제스처 인식 에러 */
export class GestureRecognitionError extends Error {
  constructor(message = 'Gesture recognition failed, performing default action') {
    super(message);
    this.name = 'GestureRecognitionError';
  }
}
