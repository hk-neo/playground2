import type { Dimensions } from '../shared/types/core';

/** 볼륨 바운딩 박스 메시 관리 */
export class BoundingBoxRenderer {
  private vertexBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private indexCount = 0;

  createBox(gl: WebGL2RenderingContext, dims: Dimensions): void {
    this.dispose(gl);

    const sx = dims.x, sy = dims.y, sz = dims.z;
    const maxDim = Math.max(sx, sy, sz);
    const nx = sx / maxDim, ny = sy / maxDim, nz = sz / maxDim;

    // unit cube [-1, 1] scaled by dimensions
    const vertices = new Float32Array([
      // front face
      -nx, -ny,  nz,  nx, -ny,  nz,  nx,  ny,  nz, -nx,  ny,  nz,
      // back face
      -nx, -ny, -nz, -nx,  ny, -nz,  nx,  ny, -nz,  nx, -ny, -nz,
      // top face
      -nx,  ny, -nz, -nx,  ny,  nz,  nx,  ny,  nz,  nx,  ny, -nz,
      // bottom face
      -nx, -ny, -nz,  nx, -ny, -nz,  nx, -ny,  nz, -nx, -ny,  nz,
      // right face
       nx, -ny, -nz,  nx,  ny, -nz,  nx,  ny,  nz,  nx, -ny,  nz,
      // left face
      -nx, -ny, -nz, -nx, -ny,  nz, -nx,  ny,  nz, -nx,  ny, -nz,
    ]);

    const indices = new Uint16Array([
      0,  1,  2,  0,  2,  3,   // front
      4,  5,  6,  4,  6,  7,   // back
      8,  9,  10, 8,  10, 11,  // top
      12, 13, 14, 12, 14, 15,  // bottom
      16, 17, 18, 16, 18, 19,  // right
      20, 21, 22, 20, 22, 23,  // left
    ]);

    this.indexCount = indices.length;

    this.vertexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    this.indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  }

  render(gl: WebGL2RenderingContext): void {
    if (!this.vertexBuffer || !this.indexBuffer) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  getIndexCount(): number { return this.indexCount; }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.vertexBuffer) { gl.deleteBuffer(this.vertexBuffer); this.vertexBuffer = null; }
    if (this.indexBuffer) { gl.deleteBuffer(this.indexBuffer); this.indexBuffer = null; }
  }
}

/** 3D 바운딩 박스 뒷면 렌더링으로 레이 진입점 계산 */
export class BackFaceRenderer {
  private fbo: WebGLFramebuffer | null = null;
  private texture: WebGLTexture | null = null;
  private width = 0;
  private height = 0;

  ensureResources(gl: WebGL2RenderingContext, width: number, height: number): void {
    if (this.width === width && this.height === height && this.fbo) return;
    this.dispose(gl);

    this.width = width;
    this.height = height;

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind(gl: WebGL2RenderingContext): void {
    if (!this.fbo) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
  }

  unbind(gl: WebGL2RenderingContext, width: number, height: number): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
  }

  getTexture(): WebGLTexture | null { return this.texture; }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.fbo) { gl.deleteFramebuffer(this.fbo); this.fbo = null; }
    if (this.texture) { gl.deleteTexture(this.texture); this.texture = null; }
    this.width = 0;
    this.height = 0;
  }
}
