/** 렌더링 컨텍스트 추상화 */
export interface IRenderContext {
  getGL(): WebGL2RenderingContext;
  createTexture(data: unknown): WebGLTexture;
}

/** 셰이더 컴파일 추상화 */
export interface IShaderCompiler {
  compile(vs: string, fs: string): WebGLProgram;
  getUniformLocation(program: string, name: string): WebGLUniformLocation | null;
  getAttributeLocation(program: string, name: string): number;
}
