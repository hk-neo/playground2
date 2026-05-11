import type { GPUInfo } from '../shared/types/rendering';
import { WebGLUnsupportedError } from '../shared/errors/rendering';
import { getGPUInfo as getGPUInfoUtil, isWebGL2Supported as isSupported } from '../webgl/utils';

/** WebGL 2.0 컨텍스트 생성 및 기능 검증 */
export class WebGLContextFactory {
  /** WebGL 2.0 지원 여부 확인 */
  static isWebGL2Supported(): boolean {
    return isSupported();
  }

  /** WebGL 2.0 컨텍스트 생성 */
  static create(canvas: HTMLCanvasElement): WebGL2RenderingContext {
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

  /** GPU 정보 조회 */
  static getGPUInfo(gl: WebGL2RenderingContext): GPUInfo {
    return getGPUInfoUtil(gl);
  }
}
