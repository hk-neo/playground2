/** WebGL 2.0 미지원 에러 */
export class WebGLUnsupportedError extends Error {
  constructor(message = 'WebGL 2.0 is not supported by this browser') {
    super(message);
    this.name = 'WebGLUnsupportedError';
  }
}

/** 셰이더 컴파일 에러 */
export class ShaderCompileError extends Error {
  constructor(shaderType: string, log: string) {
    super(`Shader compilation failed (${shaderType}): ${log}`);
    this.name = 'ShaderCompileError';
  }
}

/** 텍스처 업로드 에러 */
export class TextureUploadError extends Error {
  constructor(message = 'GPU texture upload failed, falling back to lower resolution') {
    super(message);
    this.name = 'TextureUploadError';
  }
}

/** WebGL 컨텍스트 손실 에러 */
export class ContextLostError extends Error {
  constructor(message = 'WebGL context was lost, attempting recovery') {
    super(message);
    this.name = 'ContextLostError';
  }
}
