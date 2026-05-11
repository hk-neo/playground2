import { describe, it, expect } from 'vitest';
import { createMockGL } from './helpers';
import {
  createVertexBuffer,
  createIndexBuffer,
  createVertexArray,
  createFramebuffer,
  createRenderbuffer,
  disposeBuffer,
  disposeVertexArray,
  disposeFramebuffer,
  disposeAllBuffers,
} from '../buffer';

describe('Buffer Module', () => {
  describe('createVertexBuffer', () => {
    it('should create and fill vertex buffer', () => {
      const { gl, spies } = createMockGL();
      const data = new Float32Array([0, 1, 0, 1, 0, 0]);
      const buffer = createVertexBuffer(gl, data);

      expect(buffer).toBeDefined();
      expect(spies.bindBuffer).toHaveBeenCalledWith(gl.ARRAY_BUFFER, buffer);
      expect(spies.bufferData).toHaveBeenCalledWith(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    });

    it('should unbind after creation', () => {
      const { gl, spies } = createMockGL();
      createVertexBuffer(gl, new Float32Array([0]));
      expect(spies.bindBuffer).toHaveBeenCalledWith(gl.ARRAY_BUFFER, null);
    });

    it('should throw when createBuffer fails', () => {
      const { gl, spies } = createMockGL();
      spies.createBuffer.mockReturnValue(null);
      expect(() => createVertexBuffer(gl, new Float32Array([0]))).toThrow();
    });
  });

  describe('createIndexBuffer', () => {
    it('should create and fill index buffer', () => {
      const { gl, spies } = createMockGL();
      const data = new Uint16Array([0, 1, 2]);
      const buffer = createIndexBuffer(gl, data);

      expect(buffer).toBeDefined();
      expect(spies.bindBuffer).toHaveBeenCalledWith(gl.ELEMENT_ARRAY_BUFFER, buffer);
    });
  });

  describe('createVertexArray', () => {
    it('should create VAO', () => {
      const { gl } = createMockGL();
      const vao = createVertexArray(gl);
      expect(vao).toBeDefined();
    });
  });

  describe('createFramebuffer', () => {
    it('should create FBO', () => {
      const { gl } = createMockGL();
      const fbo = createFramebuffer(gl);
      expect(fbo).toBeDefined();
    });
  });

  describe('createRenderbuffer', () => {
    it('should create renderbuffer', () => {
      const { gl } = createMockGL();
      const rb = createRenderbuffer(gl);
      expect(rb).toBeDefined();
    });
  });

  describe('dispose functions', () => {
    it('disposeBuffer should delete buffer', () => {
      const { gl, spies } = createMockGL();
      const buf = {} as WebGLBuffer;
      disposeBuffer(gl, buf);
      expect(spies.deleteBuffer).toHaveBeenCalledWith(buf);
    });

    it('disposeBuffer should skip null', () => {
      const { gl, spies } = createMockGL();
      disposeBuffer(gl, null);
      expect(spies.deleteBuffer).not.toHaveBeenCalled();
    });

    it('disposeVertexArray should delete VAO', () => {
      const { gl, spies } = createMockGL();
      const vao = {} as WebGLVertexArrayObject;
      disposeVertexArray(gl, vao);
      expect(spies.deleteVertexArray).toHaveBeenCalledWith(vao);
    });

    it('disposeFramebuffer should delete FBO', () => {
      const { gl, spies } = createMockGL();
      const fbo = {} as WebGLFramebuffer;
      disposeFramebuffer(gl, fbo);
      expect(spies.deleteFramebuffer).toHaveBeenCalledWith(fbo);
    });
  });

  describe('disposeAllBuffers', () => {
    it('should dispose all resource types', () => {
      const { gl, spies } = createMockGL();
      const buf = {} as WebGLBuffer;
      const vao = {} as WebGLVertexArrayObject;
      const fbo = {} as WebGLFramebuffer;
      const rb = {} as WebGLRenderbuffer;

      disposeAllBuffers(gl, {
        buffers: [buf],
        vaos: [vao],
        fbos: [fbo],
        renderbuffers: [rb],
      });

      expect(spies.deleteBuffer).toHaveBeenCalledWith(buf);
      expect(spies.deleteVertexArray).toHaveBeenCalledWith(vao);
      expect(spies.deleteFramebuffer).toHaveBeenCalledWith(fbo);
      expect(spies.deleteRenderbuffer).toHaveBeenCalledWith(rb);
    });
  });
});
