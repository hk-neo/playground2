/** 버텍스 버퍼 생성 */
export function createVertexBuffer(
  gl: WebGL2RenderingContext,
  data: Float32Array,
  usage: GLenum = gl.STATIC_DRAW,
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Failed to create vertex buffer');

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return buffer;
}

/** 인덱스 버퍼 생성 */
export function createIndexBuffer(
  gl: WebGL2RenderingContext,
  data: Uint16Array | Uint32Array,
  usage: GLenum = gl.STATIC_DRAW,
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Failed to create index buffer');

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, usage);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return buffer;
}

/** VAO 생성 및 설정 */
export function createVertexArray(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('Failed to create vertex array object');
  return vao;
}

/** 프레임버퍼 생성 */
export function createFramebuffer(gl: WebGL2RenderingContext): WebGLFramebuffer {
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('Failed to create framebuffer');
  return fbo;
}

/** 렌더버퍼 생성 */
export function createRenderbuffer(gl: WebGL2RenderingContext): WebGLRenderbuffer {
  const rb = gl.createRenderbuffer();
  if (!rb) throw new Error('Failed to create renderbuffer');
  return rb;
}

/** 버퍼 해제 */
export function disposeBuffer(
  gl: WebGL2RenderingContext,
  buffer: WebGLBuffer | null,
): void {
  if (buffer) gl.deleteBuffer(buffer);
}

/** VAO 해제 */
export function disposeVertexArray(
  gl: WebGL2RenderingContext,
  vao: WebGLVertexArrayObject | null,
): void {
  if (vao) gl.deleteVertexArray(vao);
}

/** 프레임버퍼 해제 */
export function disposeFramebuffer(
  gl: WebGL2RenderingContext,
  fbo: WebGLFramebuffer | null,
): void {
  if (fbo) gl.deleteFramebuffer(fbo);
}

/** 모든 GPU 버퍼 리소스 일괄 해제 */
export function disposeAllBuffers(
  gl: WebGL2RenderingContext,
  resources: {
    buffers?: WebGLBuffer[];
    vaos?: WebGLVertexArrayObject[];
    fbos?: WebGLFramebuffer[];
    renderbuffers?: WebGLRenderbuffer[];
  },
): void {
  resources.buffers?.forEach((b) => gl.deleteBuffer(b));
  resources.vaos?.forEach((v) => gl.deleteVertexArray(v));
  resources.fbos?.forEach((f) => gl.deleteFramebuffer(f));
  resources.renderbuffers?.forEach((r) => gl.deleteRenderbuffer(r));
}
