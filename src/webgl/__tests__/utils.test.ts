import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGL } from './helpers';
import {
  isWebGL2Supported,
  getGPUInfo,
  checkGLError,
  glEnumToString,
  validate3DTextureSize,
} from '../utils';

describe('WebGL Utils', () => {
  describe('isWebGL2Supported', () => {
    it('should return true when webgl2 context is available', () => {
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({}),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLCanvasElement);
      expect(isWebGL2Supported()).toBe(true);
    });

    it('should return false when webgl2 context is null', () => {
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(null),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLCanvasElement);
      expect(isWebGL2Supported()).toBe(false);
    });

    it('should return false when getContext throws', () => {
      const mockCanvas = {
        getContext: vi.fn().mockImplementation(() => {
          throw new Error('Not supported');
        }),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLCanvasElement);
      expect(isWebGL2Supported()).toBe(false);
    });
  });

  describe('getGPUInfo', () => {
    it('should return GPU info with debug extension when available', () => {
      const { gl } = createMockGL();
      const info = getGPUInfo(gl);

      expect(info.maxTextureSize).toBe(4096);
      expect(info.max3DTextureSize).toBe(2048);
      expect(typeof info.vendor).toBe('string');
      expect(typeof info.renderer).toBe('string');
    });

    it('should fallback to basic params when debug extension unavailable', () => {
      const { gl, spies } = createMockGL();
      spies.getExtension.mockReturnValue(null);

      const info = getGPUInfo(gl);
      expect(info.maxTextureSize).toBe(4096);
    });
  });

  describe('checkGLError', () => {
    it('should not throw when no GL error', () => {
      const { gl } = createMockGL();
      expect(() => checkGLError(gl)).not.toThrow();
    });

    it('should throw on GL error with optional context', () => {
      const { gl, spies } = createMockGL();
      spies.getError.mockReturnValue(gl.INVALID_VALUE);

      expect(() => checkGLError(gl, 'test-context')).toThrow('test-context');
    });
  });

  describe('glEnumToString', () => {
    it('should convert known GL enums to strings', () => {
      const { gl } = createMockGL();
      expect(glEnumToString(gl, gl.NO_ERROR)).toBe('NO_ERROR');
      expect(glEnumToString(gl, gl.INVALID_ENUM)).toBe('INVALID_ENUM');
      expect(glEnumToString(gl, gl.INVALID_VALUE)).toBe('INVALID_VALUE');
      expect(glEnumToString(gl, gl.INVALID_OPERATION)).toBe('INVALID_OPERATION');
      expect(glEnumToString(gl, gl.OUT_OF_MEMORY)).toBe('OUT_OF_MEMORY');
    });

    it('should format unknown error codes as hex', () => {
      const { gl } = createMockGL();
      expect(glEnumToString(gl, 0x9999)).toContain('0x9999');
    });
  });

  describe('validate3DTextureSize', () => {
    it('should return true for valid sizes', () => {
      const { gl } = createMockGL(); // max3DTextureSize = 2048
      expect(validate3DTextureSize(gl, 512, 512, 512)).toBe(true);
    });

    it('should return false when exceeding max size', () => {
      const { gl } = createMockGL(); // max3DTextureSize = 2048
      expect(validate3DTextureSize(gl, 4096, 512, 512)).toBe(false);
    });
  });
});
