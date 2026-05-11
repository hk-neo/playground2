import { describe, it, expect } from 'vitest';
import { VolumeRayCaster } from '../volume-ray-caster';
import { VolumeNotLoadedError } from '../../shared/errors/mpr';

describe('VolumeRayCaster', () => {
  describe('constructor', () => {
    it('should create instance with transfer function and shader', () => {
      const gl = createMinimalMockGL();
      const caster = new VolumeRayCaster(gl);

      expect(caster.transferFunction).toBeDefined();
      expect(caster.shader).toBeDefined();
      expect(caster.boundingBox).toBeDefined();
      expect(caster.backFaceRenderer).toBeDefined();
    });
  });

  describe('render without volume', () => {
    it('should throw VolumeNotLoadedError', () => {
      const gl = createMinimalMockGL();
      const caster = new VolumeRayCaster(gl);
      const mvp = new Float32Array(16);

      expect(() => caster.render(mvp)).toThrow(VolumeNotLoadedError);
    });
  });

  describe('resize', () => {
    it('should store canvas dimensions', () => {
      const gl = createMinimalMockGL();
      const caster = new VolumeRayCaster(gl);
      caster.resize(800, 600);
      // No error = success
    });
  });

  describe('transferFunction', () => {
    it('should have CBCT bone preset loaded', () => {
      const gl = createMinimalMockGL();
      const caster = new VolumeRayCaster(gl);
      expect(caster.transferFunction.preset).toBe('cbct_bone');
    });
  });

  describe('shader', () => {
    it('should have valid step size', () => {
      const gl = createMinimalMockGL();
      const caster = new VolumeRayCaster(gl);
      expect(caster.shader.stepSizeValue).toBeGreaterThan(0);
      expect(caster.shader.earlyRayTerminationValue).toBeGreaterThan(0);
      expect(caster.shader.earlyRayTerminationValue).toBeLessThanOrEqual(1);
    });
  });
});

function createMinimalMockGL(): WebGL2RenderingContext {
  return {
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    COLOR_BUFFER_BIT: 0x00004000,
    DEPTH_BUFFER_BIT: 0x00000100,
    COLOR_ATTACHMENT0: 0x8CE0,
    FRAMEBUFFER: 0x8D40,
    TEXTURE_2D: 0x0DE1,
    TEXTURE_3D: 0x806F,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    CLAMP_TO_EDGE: 0x812F,
    LINEAR: 0x2601,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88E4,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    HALF_FLOAT: 0x140B,
    RGBA16F: 0x881A,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    UNSIGNED_SHORT: 0x1403,
    FRONT: 0x0404,
    BACK: 0x0405,
    CULL_FACE: 0x0B44,
    TEXTURE0: 0x84C0,
    RGBA8: 0x8058,
    createShader: () => ({} as WebGLShader),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => ({} as WebGLProgram),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: () => {},
    getUniformLocation: () => ({} as WebGLUniformLocation),
    uniformMatrix4fv: () => {},
    uniform1f: () => {},
    uniform1i: () => {},
    uniform2f: () => {},
    activeTexture: () => {},
    bindTexture: () => {},
    texImage2D: () => {},
    texImage3D: () => {},
    texParameteri: () => {},
    createBuffer: () => ({} as WebGLBuffer),
    bindBuffer: () => {},
    bufferData: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    bindFramebuffer: () => {},
    framebufferTexture2D: () => {},
    createTexture: () => ({} as WebGLTexture),
    createFramebuffer: () => ({} as WebGLFramebuffer),
    deleteProgram: () => {},
    deleteTexture: () => {},
    deleteFramebuffer: () => {},
    deleteBuffer: () => {},
    clearColor: () => {},
    clear: () => {},
    enable: () => {},
    disable: () => {},
    cullFace: () => {},
    viewport: () => {},
    drawElements: () => {},
    bindVertexArray: () => {},
    readPixels: () => {},
  } as unknown as WebGL2RenderingContext;
}
