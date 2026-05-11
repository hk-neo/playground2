import { describe, it, expect, vi } from 'vitest';
import { createMockGL } from './helpers';
import { uploadVolume3D, uploadTexture2D, updateTexture3D, disposeTexture } from '../texture';
import { TextureUploadError } from '../../shared/errors/rendering';

// jsdom doesn't provide ImageData
class MockImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}
vi.stubGlobal('ImageData', MockImageData);

describe('Texture Module', () => {
  describe('uploadVolume3D', () => {
    it('should upload 3D volume texture', () => {
      const { gl, spies } = createMockGL();
      const data = new Int16Array(8 * 8 * 8);
      const texture = uploadVolume3D(gl, data, { x: 8, y: 8, z: 8 });

      expect(texture).toBeDefined();
      expect(spies.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_3D, texture);
      expect(spies.texImage3D).toHaveBeenCalledWith(
        gl.TEXTURE_3D, 0, gl.R16I, 8, 8, 8, 0, gl.RED_INTEGER, gl.SHORT, data,
      );
    });

    it('should set volume texture parameters', () => {
      const { gl, spies } = createMockGL();
      uploadVolume3D(gl, new Int16Array(8), { x: 2, y: 2, z: 2 });

      expect(spies.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      expect(spies.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      expect(spies.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    });

    it('should unbind texture after upload', () => {
      const { gl, spies } = createMockGL();
      uploadVolume3D(gl, new Int16Array(8), { x: 2, y: 2, z: 2 });
      expect(spies.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_3D, null);
    });

    it('should throw TextureUploadError when createTexture fails', () => {
      const { gl, spies } = createMockGL();
      spies.createTexture.mockReturnValue(null);
      expect(() => uploadVolume3D(gl, new Int16Array(8), { x: 2, y: 2, z: 2 })).toThrow(TextureUploadError);
    });
  });

  describe('uploadTexture2D', () => {
    it('should upload ImageData as 2D texture', () => {
      const { gl, spies } = createMockGL();
      const imgData = { width: 100, height: 100, data: new Uint8ClampedArray(40000) } as ImageData;
      const texture = uploadTexture2D(gl, imgData, 100, 100);

      expect(texture).toBeDefined();
      expect(spies.texImage2D).toHaveBeenCalled();
    });

    it('should upload raw data as 2D texture', () => {
      const { gl, spies } = createMockGL();
      const data = new Uint8Array(40000);
      const texture = uploadTexture2D(gl, data, 100, 100, 2);

      expect(texture).toBeDefined();
      expect(spies.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0 + 2);
    });
  });

  describe('updateTexture3D', () => {
    it('should update a region of 3D texture', () => {
      const { gl, spies } = createMockGL();
      const texture = {} as WebGLTexture;
      const data = new Int16Array(64);

      updateTexture3D(gl, texture, data, { x: 0, y: 0, z: 0 }, { x: 4, y: 4, z: 4 });

      expect(spies.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_3D, texture);
      expect(spies.texSubImage3D).toHaveBeenCalledWith(
        gl.TEXTURE_3D, 0, 0, 0, 0, 4, 4, 4, gl.RED_INTEGER, gl.SHORT, data,
      );
    });

    it('should unbind after update', () => {
      const { gl, spies } = createMockGL();
      updateTexture3D(gl, {} as WebGLTexture, new Int16Array(8), { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
      expect(spies.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_3D, null);
    });
  });

  describe('disposeTexture', () => {
    it('should delete texture', () => {
      const { gl, spies } = createMockGL();
      const tex = {} as WebGLTexture;
      disposeTexture(gl, tex);
      expect(spies.deleteTexture).toHaveBeenCalledWith(tex);
    });

    it('should not throw on null texture', () => {
      const { gl, spies } = createMockGL();
      disposeTexture(gl, null);
      expect(spies.deleteTexture).not.toHaveBeenCalled();
    });
  });
});
