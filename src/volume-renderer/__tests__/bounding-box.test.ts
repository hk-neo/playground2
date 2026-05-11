import { describe, it, expect } from 'vitest';
import { BoundingBoxRenderer, BackFaceRenderer } from '../bounding-box-renderer';

function createMockGL() {
  const buffers: WebGLBuffer[] = [];
  const textures: WebGLTexture[] = [];
  const fbos: WebGLFramebuffer[] = [];

  const gl = {
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88E4,
    TEXTURE_2D: 0x0DE1,
    TEXTURE_3D: 0x806F,
    FRAMEBUFFER: 0x8D40,
    COLOR_ATTACHMENT0: 0x8CE0,
    RGBA16F: 0x881A,
    RGBA: 0x1908,
    HALF_FLOAT: 0x140B,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    CLAMP_TO_EDGE: 0x812F,
    LINEAR: 0x2601,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    UNSIGNED_SHORT: 0x1403,
    createBuffer: () => { const b = {} as WebGLBuffer; buffers.push(b); return b; },
    createTexture: () => { const t = {} as WebGLTexture; textures.push(t); return t; },
    createFramebuffer: () => { const f = {} as WebGLFramebuffer; fbos.push(f); return f; },
    bindBuffer: () => {},
    bufferData: () => {},
    bindTexture: () => {},
    texImage2D: () => {},
    texImage3D: () => {},
    texParameteri: () => {},
    bindFramebuffer: () => {},
    framebufferTexture2D: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    drawElements: () => {},
    deleteBuffer: () => {},
    deleteTexture: () => {},
    deleteFramebuffer: () => {},
  } as unknown as WebGL2RenderingContext;

  return { gl, bufferCount: () => buffers.length, textureCount: () => textures.length, fboCount: () => fbos.length };
}

describe('BoundingBoxRenderer', () => {
  it('should create box buffers', () => {
    const { gl } = createMockGL();
    const box = new BoundingBoxRenderer();
    box.createBox(gl, { x: 512, y: 512, z: 512 });

    expect(box.getIndexCount()).toBe(36); // 6 faces * 2 triangles * 3 vertices
  });

  it('should clean up old buffers on recreate', () => {
    const { gl } = createMockGL();
    const box = new BoundingBoxRenderer();
    box.createBox(gl, { x: 100, y: 100, z: 100 });
    box.createBox(gl, { x: 200, y: 200, z: 200 });
    // Should not throw
  });

  it('should handle non-cubic dimensions', () => {
    const { gl } = createMockGL();
    const box = new BoundingBoxRenderer();
    box.createBox(gl, { x: 800, y: 800, z: 500 });
    expect(box.getIndexCount()).toBe(36);
  });
});

describe('BackFaceRenderer', () => {
  it('should create FBO and texture', () => {
    const { gl } = createMockGL();
    const backFace = new BackFaceRenderer();
    backFace.ensureResources(gl, 512, 512);

    expect(backFace.getTexture()).not.toBeNull();
  });

  it('should reuse resources when size matches', () => {
    const { gl, textureCount, fboCount } = createMockGL();
    const backFace = new BackFaceRenderer();

    backFace.ensureResources(gl, 256, 256);
    const texBefore = textureCount();
    const fboBefore = fboCount();

    backFace.ensureResources(gl, 256, 256);
    expect(textureCount()).toBe(texBefore);
    expect(fboCount()).toBe(fboBefore);
  });

  it('should recreate when size changes', () => {
    const { gl } = createMockGL();
    const backFace = new BackFaceRenderer();
    backFace.ensureResources(gl, 256, 256);
    backFace.ensureResources(gl, 512, 512);
    // Should not throw
  });

  it('should dispose resources', () => {
    const { gl } = createMockGL();
    const backFace = new BackFaceRenderer();
    backFace.ensureResources(gl, 512, 512);
    backFace.dispose(gl);
    expect(backFace.getTexture()).toBeNull();
  });
});
