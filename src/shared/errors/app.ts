/** 미지원 브라우저 에러 */
export class UnsupportedBrowserError extends Error {
  constructor(browser: string) {
    super(`Browser '${browser}' is not supported. Please use Chrome, Firefox, or Edge.`);
    this.name = 'UnsupportedBrowserError';
  }
}

/** WebGL 2.0 미지원 에러 (앱 레벨) */
export class WebGL2NotSupportedError extends Error {
  constructor(message = 'WebGL 2.0 is required but not available in this browser') {
    super(message);
    this.name = 'WebGL2NotSupportedError';
  }
}

/** 상태 불일치 에러 */
export class StateConsistencyError extends Error {
  constructor(key: string) {
    super(`State consistency error for key '${key}', restoring last valid state`);
    this.name = 'StateConsistencyError';
  }
}

/** 레이아웃 오버플로우 에러 */
export class LayoutOverflowError extends Error {
  constructor(message = 'Layout overflow detected, applying scroll or scale') {
    super(message);
    this.name = 'LayoutOverflowError';
  }
}

/** 컴포넌트 초기화 에러 */
export class ComponentInitError extends Error {
  constructor(componentId: string, reason: string) {
    super(`Component '${componentId}' initialization failed: ${reason}`);
    this.name = 'ComponentInitError';
  }
}
