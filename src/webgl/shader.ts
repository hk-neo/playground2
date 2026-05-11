import type { ShaderSource } from '../shared/types/rendering';
import { ShaderCompileError } from '../shared/errors/rendering';

/** 셰이더 소스 컴파일 */
export function compileShader(
  gl: WebGL2RenderingContext,
  source: string,
  type: GLenum,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new ShaderCompileError(type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT', 'Failed to create shader object');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown error';
    gl.deleteShader(shader);
    throw new ShaderCompileError(
      type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT',
      log,
    );
  }

  return shader;
}

/** 버텍스 + 프래그먼트 셰이더를 프로그램으로 링크 */
export function linkProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new ShaderCompileError('PROGRAM', 'Failed to create program object');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown error';
    gl.deleteProgram(program);
    throw new ShaderCompileError('PROGRAM', log);
  }

  return program;
}

/** ShaderSource로부터 완전한 셰이더 프로그램 생성 */
export function createShaderProgram(
  gl: WebGL2RenderingContext,
  source: ShaderSource,
): WebGLProgram {
  const vs = compileShader(gl, source.vertex, gl.VERTEX_SHADER);
  const fs = compileShader(gl, source.fragment, gl.FRAGMENT_SHADER);
  const program = linkProgram(gl, vs, fs);

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  return program;
}

/** 유니폼 위치 캐싱과 함께 조회 */
export class UniformCache {
  private cache = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private gl: WebGL2RenderingContext,
    private program: WebGLProgram,
  ) {}

  get(name: string): WebGLUniformLocation | null {
    if (!this.cache.has(name)) {
      this.cache.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.cache.get(name)!;
  }

  setFloat(name: string, value: number): void {
    const loc = this.get(name);
    if (loc) this.gl.uniform1f(loc, value);
  }

  setInt(name: string, value: number): void {
    const loc = this.get(name);
    if (loc) this.gl.uniform1i(loc, value);
  }

  setVec2(name: string, x: number, y: number): void {
    const loc = this.get(name);
    if (loc) this.gl.uniform2f(loc, x, y);
  }

  setVec3(name: string, x: number, y: number, z: number): void {
    const loc = this.get(name);
    if (loc) this.gl.uniform3f(loc, x, y, z);
  }

  setVec4(name: string, x: number, y: number, z: number, w: number): void {
    const loc = this.get(name);
    if (loc) this.gl.uniform4f(loc, x, y, z, w);
  }

  setMat4(name: string, value: Float32Array): void {
    const loc = this.get(name);
    if (loc) this.gl.uniformMatrix4fv(loc, false, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

/** 어트리뷰트 위치 캐싱과 함께 조회 */
export class AttributeCache {
  private cache = new Map<string, number>();

  constructor(
    private gl: WebGL2RenderingContext,
    private program: WebGLProgram,
  ) {}

  get(name: string): number {
    if (!this.cache.has(name)) {
      this.cache.set(name, this.gl.getAttribLocation(this.program, name));
    }
    return this.cache.get(name)!;
  }

  clear(): void {
    this.cache.clear();
  }
}
