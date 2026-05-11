import type { ShaderSource } from '../shared/types/rendering';
import { ShaderCompileError } from '../shared/errors/rendering';
import { UniformCache, AttributeCache } from '../webgl/shader';
import { createShaderProgram } from '../webgl/shader';

/** 셰이더 프로그램 관리자 */
export class ShaderManager {
  private programs = new Map<string, WebGLProgram>();
  private uniformCaches = new Map<string, UniformCache>();
  private attributeCaches = new Map<string, AttributeCache>();

  constructor(private gl: WebGL2RenderingContext) {}

  /** 셰이더 소스로부터 프로그램 생성 및 등록 */
  createProgram(name: string, source: ShaderSource): WebGLProgram {
    if (this.programs.has(name)) {
      this.disposeProgram(name);
    }

    const program = createShaderProgram(this.gl, source);
    this.programs.set(name, program);
    this.uniformCaches.set(name, new UniformCache(this.gl, program));
    this.attributeCaches.set(name, new AttributeCache(this.gl, program));
    return program;
  }

  /** 등록된 프로그램 조회 */
  getProgram(name: string): WebGLProgram | undefined {
    return this.programs.get(name);
  }

  /** 유니폼 캐시 조회 */
  getUniformCache(name: string): UniformCache | undefined {
    return this.uniformCaches.get(name);
  }

  /** 어트리뷰트 캐시 조회 */
  getAttributeCache(name: string): AttributeCache | undefined {
    return this.attributeCaches.get(name);
  }

  /** 프로그램을 GL에서 사용하도록 설정 */
  useProgram(name: string): boolean {
    const program = this.programs.get(name);
    if (!program) return false;
    this.gl.useProgram(program);
    return true;
  }

  /** 특정 프로그램 해제 */
  disposeProgram(name: string): void {
    const program = this.programs.get(name);
    if (program) {
      this.gl.deleteProgram(program);
      this.programs.delete(name);
      this.uniformCaches.delete(name);
      this.attributeCaches.delete(name);
    }
  }

  /** 모든 프로그램 해제 */
  disposeAll(): void {
    for (const program of this.programs.values()) {
      this.gl.deleteProgram(program);
    }
    this.programs.clear();
    this.uniformCaches.clear();
    this.attributeCaches.clear();
  }
}
