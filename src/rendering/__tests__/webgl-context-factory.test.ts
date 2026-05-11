import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebGLContextFactory } from '../webgl-context-factory';

describe('WebGLContextFactory', () => {
  describe('isWebGL2Supported', () => {
    it('should return boolean', () => {
      const result = WebGLContextFactory.isWebGL2Supported();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('create', () => {
    let mockCanvas: HTMLCanvasElement;

    beforeEach(() => {
      mockCanvas = {
        getContext: vi.fn(),
      } as unknown as HTMLCanvasElement;
    });

    it('should create WebGL2 context with high-performance preference', () => {
      const mockGL = { getExtension: vi.fn() } as unknown as WebGL2RenderingContext;
      (mockCanvas.getContext as ReturnType<typeof vi.fn>).mockReturnValue(mockGL);

      const result = WebGLContextFactory.create(mockCanvas);

      expect(result).toBe(mockGL);
      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({
        powerPreference: 'high-performance',
      }));
    });

    it('should throw when WebGL2 is not supported', () => {
      (mockCanvas.getContext as ReturnType<typeof vi.fn>).mockReturnValue(null);

      expect(() => WebGLContextFactory.create(mockCanvas)).toThrow(/WebGL/);
    });

    it('should request EXT_color_buffer_float extension', () => {
      const mockGL = {
        getExtension: vi.fn().mockReturnValue({}),
      } as unknown as WebGL2RenderingContext;
      (mockCanvas.getContext as ReturnType<typeof vi.fn>).mockReturnValue(mockGL);

      WebGLContextFactory.create(mockCanvas);

      expect(mockGL.getExtension).toHaveBeenCalledWith('EXT_color_buffer_float');
    });
  });

  describe('getGPUInfo', () => {
    it('should return GPU info from context', () => {
      const { gl } = createMockGLForFactory();
      const info = WebGLContextFactory.getGPUInfo(gl);

      expect(info).toHaveProperty('vendor');
      expect(info).toHaveProperty('renderer');
    });
  });
});

function createMockGLForFactory(): { gl: WebGL2RenderingContext } {
  return {
    gl: {
      getParameter: vi.fn().mockImplementation((pname: number) => {
        if (pname === 0x1F00) return 'Mock Vendor';
        if (pname === 0x1F01) return 'Mock Renderer';
        if (pname === 0x9245) return 'Mock GPU';
        if (pname === 0x9246) return 'Mock GPU Renderer';
        return null;
      }),
      getExtension: vi.fn().mockReturnValue({
        UNMASKED_VENDOR_WEBGL: 0x9245,
        UNMASKED_RENDERER_WEBGL: 0x9246,
      }),
    } as unknown as WebGL2RenderingContext,
  };
}
