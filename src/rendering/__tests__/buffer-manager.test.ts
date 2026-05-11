import { describe, it, expect } from 'vitest';
import { createMockGL } from './helpers';
import { BufferManager } from '../buffer-manager';

describe('BufferManager', () => {
  it('should create and track vertex buffer', () => {
    const { gl, spies } = createMockGL();
    const manager = new BufferManager(gl);
    const data = new Float32Array([0, 1, 0]);
    const buffer = manager.createVertexBuffer(data);

    expect(buffer).toBeDefined();
    expect(spies.bindBuffer).toHaveBeenCalledWith(gl.ARRAY_BUFFER, buffer);
    expect(spies.bufferData).toHaveBeenCalledWith(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  });

  it('should create and track index buffer', () => {
    const { gl, spies } = createMockGL();
    const manager = new BufferManager(gl);
    const data = new Uint16Array([0, 1, 2]);
    const buffer = manager.createIndexBuffer(data);

    expect(buffer).toBeDefined();
    expect(spies.bindBuffer).toHaveBeenCalledWith(gl.ELEMENT_ARRAY_BUFFER, buffer);
  });

  it('should create and track Uint32 index buffer', () => {
    const { gl } = createMockGL();
    const manager = new BufferManager(gl);
    const data = new Uint32Array([0, 1, 2, 3]);
    const buffer = manager.createIndexBuffer(data);
    expect(buffer).toBeDefined();
  });

  it('should create and track VAO', () => {
    const { gl } = createMockGL();
    const manager = new BufferManager(gl);
    const vao = manager.createVertexArray();
    expect(vao).toBeDefined();
  });

  it('should create and track framebuffer', () => {
    const { gl } = createMockGL();
    const manager = new BufferManager(gl);
    const fbo = manager.createFramebuffer();
    expect(fbo).toBeDefined();
  });

  it('should create and track renderbuffer', () => {
    const { gl } = createMockGL();
    const manager = new BufferManager(gl);
    const rb = manager.createRenderbuffer();
    expect(rb).toBeDefined();
  });

  it('should dispose all resources', () => {
    const { gl, spies } = createMockGL();
    const manager = new BufferManager(gl);

    manager.createVertexBuffer(new Float32Array([0]));
    manager.createIndexBuffer(new Uint16Array([0]));
    manager.createVertexArray();
    manager.createFramebuffer();
    manager.createRenderbuffer();

    manager.disposeAll();

    expect(spies.deleteBuffer).toHaveBeenCalledTimes(2);
    expect(spies.deleteVertexArray).toHaveBeenCalledTimes(1);
    expect(spies.deleteFramebuffer).toHaveBeenCalledTimes(1);
    expect(spies.deleteRenderbuffer).toHaveBeenCalledTimes(1);
  });

  it('should allow reuse after disposeAll', () => {
    const { gl } = createMockGL();
    const manager = new BufferManager(gl);

    manager.createVertexBuffer(new Float32Array([0]));
    manager.disposeAll();

    const buffer = manager.createVertexBuffer(new Float32Array([1]));
    expect(buffer).toBeDefined();
  });

  it('disposeAll on empty manager should not throw', () => {
    const { gl } = createMockGL();
    const manager = new BufferManager(gl);
    expect(() => manager.disposeAll()).not.toThrow();
  });
});
