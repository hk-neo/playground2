import { vi } from 'vitest';

/** 테스트용 WebGL2 컨텍스트 모킹 */
export function createMockGL(): {
  gl: WebGL2RenderingContext;
  spies: {
    createShader: ReturnType<typeof vi.fn>;
    shaderSource: ReturnType<typeof vi.fn>;
    compileShader: ReturnType<typeof vi.fn>;
    getShaderParameter: ReturnType<typeof vi.fn>;
    getShaderInfoLog: ReturnType<typeof vi.fn>;
    deleteShader: ReturnType<typeof vi.fn>;
    createProgram: ReturnType<typeof vi.fn>;
    attachShader: ReturnType<typeof vi.fn>;
    linkProgram: ReturnType<typeof vi.fn>;
    getProgramParameter: ReturnType<typeof vi.fn>;
    getProgramInfoLog: ReturnType<typeof vi.fn>;
    deleteProgram: ReturnType<typeof vi.fn>;
    createTexture: ReturnType<typeof vi.fn>;
    bindTexture: ReturnType<typeof vi.fn>;
    texImage3D: ReturnType<typeof vi.fn>;
    texImage2D: ReturnType<typeof vi.fn>;
    texSubImage3D: ReturnType<typeof vi.fn>;
    texParameteri: ReturnType<typeof vi.fn>;
    deleteTexture: ReturnType<typeof vi.fn>;
    activeTexture: ReturnType<typeof vi.fn>;
    createBuffer: ReturnType<typeof vi.fn>;
    bindBuffer: ReturnType<typeof vi.fn>;
    bufferData: ReturnType<typeof vi.fn>;
    deleteBuffer: ReturnType<typeof vi.fn>;
    createVertexArray: ReturnType<typeof vi.fn>;
    deleteVertexArray: ReturnType<typeof vi.fn>;
    createFramebuffer: ReturnType<typeof vi.fn>;
    deleteFramebuffer: ReturnType<typeof vi.fn>;
    createRenderbuffer: ReturnType<typeof vi.fn>;
    deleteRenderbuffer: ReturnType<typeof vi.fn>;
    getError: ReturnType<typeof vi.fn>;
    getParameter: ReturnType<typeof vi.fn>;
    getExtension: ReturnType<typeof vi.fn>;
    getUniformLocation: ReturnType<typeof vi.fn>;
    getAttribLocation: ReturnType<typeof vi.fn>;
    uniform1f: ReturnType<typeof vi.fn>;
    uniform1i: ReturnType<typeof vi.fn>;
    uniform2f: ReturnType<typeof vi.fn>;
    uniform3f: ReturnType<typeof vi.fn>;
    uniform4f: ReturnType<typeof vi.fn>;
    uniformMatrix4fv: ReturnType<typeof vi.fn>;
  };
} {
  const shaderObj = { constructor: { name: 'WebGLShader' } };
  const programObj = { constructor: { name: 'WebGLProgram' } };
  const textureObj = { constructor: { name: 'WebGLTexture' } };
  const bufferObj = { constructor: { name: 'WebGLBuffer' } };
  const vaoObj = { constructor: { name: 'WebGLVertexArrayObject' } };
  const fboObj = { constructor: { name: 'WebGLFramebuffer' } };
  const rbObj = { constructor: { name: 'WebGLRenderbuffer' } };

  const spies = {
    createShader: vi.fn().mockReturnValue(shaderObj),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    getShaderInfoLog: vi.fn().mockReturnValue(''),
    deleteShader: vi.fn(),
    createProgram: vi.fn().mockReturnValue(programObj),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn().mockReturnValue(true),
    getProgramInfoLog: vi.fn().mockReturnValue(''),
    deleteProgram: vi.fn(),
    createTexture: vi.fn().mockReturnValue(textureObj),
    bindTexture: vi.fn(),
    texImage3D: vi.fn(),
    texImage2D: vi.fn(),
    texSubImage3D: vi.fn(),
    texParameteri: vi.fn(),
    deleteTexture: vi.fn(),
    activeTexture: vi.fn(),
    createBuffer: vi.fn().mockReturnValue(bufferObj),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    createVertexArray: vi.fn().mockReturnValue(vaoObj),
    deleteVertexArray: vi.fn(),
    createFramebuffer: vi.fn().mockReturnValue(fboObj),
    deleteFramebuffer: vi.fn(),
    createRenderbuffer: vi.fn().mockReturnValue(rbObj),
    deleteRenderbuffer: vi.fn(),
    getError: vi.fn().mockReturnValue(0),
    getParameter: vi.fn().mockImplementation((pname: number) => {
      if (pname === 0x0D33) return 4096; // MAX_TEXTURE_SIZE
      if (pname === 0x8073) return 2048; // MAX_3D_TEXTURE_SIZE
      if (pname === 0x1F00) return 'Mock Vendor'; // VENDOR
      if (pname === 0x1F01) return 'Mock Renderer'; // RENDERER
      if (pname === 0x9245) return 'Mock GPU Vendor'; // UNMASKED_VENDOR_WEBGL
      if (pname === 0x9246) return 'Mock GPU Renderer'; // UNMASKED_RENDERER_WEBGL
      return null;
    }),
    getExtension: vi.fn().mockReturnValue({
      UNMASKED_VENDOR_WEBGL: 0x9245,
      UNMASKED_RENDERER_WEBGL: 0x9246,
    }),
    getUniformLocation: vi.fn().mockReturnValue({}),
    getAttribLocation: vi.fn().mockReturnValue(0),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniformMatrix4fv: vi.fn(),
  };

  const gl = {
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    NO_ERROR: 0,
    INVALID_ENUM: 0x0500,
    INVALID_VALUE: 0x0501,
    INVALID_OPERATION: 0x0502,
    OUT_OF_MEMORY: 0x0505,
    CONTEXT_LOST_WEBGL: 0x9242,
    TEXTURE_3D: 0x806F,
    TEXTURE_2D: 0x0DE1,
    TEXTURE0: 0x84C0,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    TEXTURE_WRAP_R: 0x8072,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812F,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88E4,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    R16I: 0x8233,
    RED_INTEGER: 0x8D94,
    SHORT: 0x1402,
    MAX_TEXTURE_SIZE: 0x0D33,
    MAX_3D_TEXTURE_SIZE: 0x8073,
    VENDOR: 0x1F00,
    RENDERER: 0x1F01,
    ...spies,
  } as unknown as WebGL2RenderingContext;

  return { gl, spies };
}
