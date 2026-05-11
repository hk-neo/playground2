import {
  createVertexBuffer,
  createIndexBuffer,
  createVertexArray,
  createFramebuffer,
  createRenderbuffer,
} from '../webgl/buffer';

/** 버퍼 리소스 관리자 */
export class BufferManager {
  private buffers: WebGLBuffer[] = [];
  private vaos: WebGLVertexArrayObject[] = [];
  private fbos: WebGLFramebuffer[] = [];
  private renderbuffers: WebGLRenderbuffer[] = [];

  constructor(private gl: WebGL2RenderingContext) {}

  createVertexBuffer(data: Float32Array): WebGLBuffer {
    const buffer = createVertexBuffer(this.gl, data);
    this.buffers.push(buffer);
    return buffer;
  }

  createIndexBuffer(data: Uint16Array | Uint32Array): WebGLBuffer {
    const buffer = createIndexBuffer(this.gl, data);
    this.buffers.push(buffer);
    return buffer;
  }

  createVertexArray(): WebGLVertexArrayObject {
    const vao = createVertexArray(this.gl);
    this.vaos.push(vao);
    return vao;
  }

  createFramebuffer(): WebGLFramebuffer {
    const fbo = createFramebuffer(this.gl);
    this.fbos.push(fbo);
    return fbo;
  }

  createRenderbuffer(): WebGLRenderbuffer {
    const rb = createRenderbuffer(this.gl);
    this.renderbuffers.push(rb);
    return rb;
  }

  /** 모든 GPU 리소스 일괄 해제 */
  disposeAll(): void {
    for (const b of this.buffers) this.gl.deleteBuffer(b);
    for (const v of this.vaos) this.gl.deleteVertexArray(v);
    for (const f of this.fbos) this.gl.deleteFramebuffer(f);
    for (const r of this.renderbuffers) this.gl.deleteRenderbuffer(r);
    this.buffers = [];
    this.vaos = [];
    this.fbos = [];
    this.renderbuffers = [];
  }
}
