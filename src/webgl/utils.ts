import type { GPUInfo } from '../shared/types/rendering';
import { WebGLUnsupportedError, ContextLostError } from '../shared/errors/rendering';

/** WebGL 2.0 컨텍스트 생성 */
export function createGLContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: true,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });

  if (!gl) {
    throw new WebGLUnsupportedError();
  }

  gl.getExtension('EXT_color_buffer_float');

  return gl;
}

/** WebGL 2.0 지원 여부 확인 */
export function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

/** GPU 정보 조회 */
export function getGPUInfo(gl: WebGL2RenderingContext): GPUInfo {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

  return {
    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    max3DTextureSize: gl.getParameter(gl.MAX_3D_TEXTURE_SIZE),
  };
}

/** GL 에러 검사 */
export function checkGLError(gl: WebGL2RenderingContext, context?: string): void {
  const error = gl.getError();
  if (error !== gl.NO_ERROR) {
    const label = context ? ` (${context})` : '';
    throw new Error(`WebGL error${label}: ${glEnumToString(gl, error)}`);
  }
}

/** GL 에러 코드를 문자열로 변환 */
export function glEnumToString(gl: WebGL2RenderingContext, value: number): string {
  const enums: Record<number, string> = {
    [gl.NO_ERROR]: 'NO_ERROR',
    [gl.INVALID_ENUM]: 'INVALID_ENUM',
    [gl.INVALID_VALUE]: 'INVALID_VALUE',
    [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
    [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
    [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL',
  };
  return enums[value] ?? `UNKNOWN(0x${value.toString(16)})`;
}

/** 컨텍스트 손실 복구 처리 */
export function handleContextLost(canvas: HTMLCanvasElement): Promise<WebGL2RenderingContext> {
  return new Promise((resolve) => {
    const onRestore = () => {
      canvas.removeEventListener('webglcontextrestored', onRestore);
      const gl = canvas.getContext('webgl2');
      if (gl) {
        resolve(gl);
      } else {
        throw new ContextLostError();
      }
    };
    canvas.addEventListener('webglcontextrestored', onRestore);
  });
}

/** 3D 텍스처 크기가 GPU 제한 내인지 검증 */
export function validate3DTextureSize(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  depth: number,
): boolean {
  const maxSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  return width <= maxSize && height <= maxSize && depth <= maxSize;
}
