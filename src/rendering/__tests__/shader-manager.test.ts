import { describe, it, expect } from 'vitest';
import { createMockGL } from './helpers';
import { ShaderManager } from '../shader-manager';

const MOCK_SOURCE = {
  vertex: 'void main() {}',
  fragment: 'void main() {}',
};

describe('ShaderManager', () => {
  it('should create and register shader program', () => {
    const { gl } = createMockGL();
    const manager = new ShaderManager(gl);

    const program = manager.createProgram('main', MOCK_SOURCE);

    expect(program).toBeDefined();
    expect(manager.getProgram('main')).toBe(program);
  });

  it('should create uniform and attribute caches', () => {
    const { gl } = createMockGL();
    const manager = new ShaderManager(gl);

    manager.createProgram('main', MOCK_SOURCE);

    expect(manager.getUniformCache('main')).toBeDefined();
    expect(manager.getAttributeCache('main')).toBeDefined();
  });

  it('should use program', () => {
    const { gl, spies } = createMockGL();
    const manager = new ShaderManager(gl);

    manager.createProgram('main', MOCK_SOURCE);
    const result = manager.useProgram('main');

    expect(result).toBe(true);
    expect(spies.useProgram).toHaveBeenCalled();
  });

  it('should return false when using non-existent program', () => {
    const { gl, spies } = createMockGL();
    const manager = new ShaderManager(gl);

    const result = manager.useProgram('missing');

    expect(result).toBe(false);
    expect(spies.useProgram).not.toHaveBeenCalled();
  });

  it('should replace program when creating with same name', () => {
    const { gl, spies } = createMockGL();
    const manager = new ShaderManager(gl);

    manager.createProgram('main', MOCK_SOURCE);
    manager.createProgram('main', MOCK_SOURCE);

    expect(spies.deleteProgram).toHaveBeenCalledTimes(1);
    expect(manager.getProgram('main')).toBeDefined();
  });

  it('should dispose specific program', () => {
    const { gl, spies } = createMockGL();
    const manager = new ShaderManager(gl);

    manager.createProgram('prog1', MOCK_SOURCE);
    manager.createProgram('prog2', MOCK_SOURCE);

    manager.disposeProgram('prog1');

    expect(spies.deleteProgram).toHaveBeenCalledTimes(1);
    expect(manager.getProgram('prog1')).toBeUndefined();
    expect(manager.getProgram('prog2')).toBeDefined();
    expect(manager.getUniformCache('prog1')).toBeUndefined();
    expect(manager.getAttributeCache('prog1')).toBeUndefined();
  });

  it('should dispose all programs', () => {
    const { gl, spies } = createMockGL();
    const manager = new ShaderManager(gl);

    manager.createProgram('prog1', MOCK_SOURCE);
    manager.createProgram('prog2', MOCK_SOURCE);

    manager.disposeAll();

    expect(spies.deleteProgram).toHaveBeenCalledTimes(2);
    expect(manager.getProgram('prog1')).toBeUndefined();
    expect(manager.getProgram('prog2')).toBeUndefined();
    expect(manager.getUniformCache('prog1')).toBeUndefined();
    expect(manager.getAttributeCache('prog2')).toBeUndefined();
  });

  it('disposeProgram with unknown name should not throw', () => {
    const { gl } = createMockGL();
    const manager = new ShaderManager(gl);
    expect(() => manager.disposeProgram('unknown')).not.toThrow();
  });

  it('getProgram should return undefined for unknown name', () => {
    const { gl } = createMockGL();
    const manager = new ShaderManager(gl);
    expect(manager.getProgram('unknown')).toBeUndefined();
  });
});
