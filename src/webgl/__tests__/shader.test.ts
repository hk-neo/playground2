import { describe, it, expect } from 'vitest';
import { createMockGL } from './helpers';
import { compileShader, linkProgram, createShaderProgram, UniformCache, AttributeCache } from '../shader';
import { ShaderCompileError } from '../../shared/errors/rendering';

describe('Shader Module', () => {
  describe('compileShader', () => {
    it('should compile vertex shader successfully', () => {
      const { gl } = createMockGL();
      const shader = compileShader(gl, 'void main() {}', gl.VERTEX_SHADER);
      expect(shader).toBeDefined();
    });

    it('should compile fragment shader successfully', () => {
      const { gl } = createMockGL();
      const shader = compileShader(gl, 'void main() {}', gl.FRAGMENT_SHADER);
      expect(shader).toBeDefined();
    });

    it('should throw ShaderCompileError on compile failure', () => {
      const { gl, spies } = createMockGL();
      spies.getShaderParameter.mockReturnValue(false);
      spies.getShaderInfoLog.mockReturnValue('compile error log');

      expect(() => compileShader(gl, 'bad shader', gl.VERTEX_SHADER)).toThrow(ShaderCompileError);
    });

    it('should delete shader on compile failure', () => {
      const { gl, spies } = createMockGL();
      spies.getShaderParameter.mockReturnValue(false);
      spies.getShaderInfoLog.mockReturnValue('error');

      expect(() => compileShader(gl, 'bad', gl.VERTEX_SHADER)).toThrow();
      expect(spies.deleteShader).toHaveBeenCalled();
    });
  });

  describe('linkProgram', () => {
    it('should link program successfully', () => {
      const { gl } = createMockGL();
      const vs = {} as WebGLShader;
      const fs = {} as WebGLShader;
      const program = linkProgram(gl, vs, fs);
      expect(program).toBeDefined();
    });

    it('should throw ShaderCompileError on link failure', () => {
      const { gl, spies } = createMockGL();
      spies.getProgramParameter.mockReturnValue(false);
      spies.getProgramInfoLog.mockReturnValue('link error');

      expect(() => linkProgram(gl, {} as WebGLShader, {} as WebGLShader)).toThrow(ShaderCompileError);
    });

    it('should delete program on link failure', () => {
      const { gl, spies } = createMockGL();
      spies.getProgramParameter.mockReturnValue(false);
      spies.getProgramInfoLog.mockReturnValue('error');

      expect(() => linkProgram(gl, {} as WebGLShader, {} as WebGLShader)).toThrow();
      expect(spies.deleteProgram).toHaveBeenCalled();
    });
  });

  describe('createShaderProgram', () => {
    it('should create complete shader program from ShaderSource', () => {
      const { gl } = createMockGL();
      const program = createShaderProgram(gl, {
        vertex: 'void main() {}',
        fragment: 'void main() {}',
      });
      expect(program).toBeDefined();
    });

    it('should clean up shaders after linking', () => {
      const { gl, spies } = createMockGL();
      createShaderProgram(gl, {
        vertex: 'void main() {}',
        fragment: 'void main() {}',
      });
      expect(spies.deleteShader).toHaveBeenCalledTimes(2);
    });
  });

  describe('UniformCache', () => {
    it('should cache uniform locations', () => {
      const { gl, spies } = createMockGL();
      const program = {} as WebGLProgram;
      const cache = new UniformCache(gl, program);

      cache.get('u_test');
      cache.get('u_test');
      expect(spies.getUniformLocation).toHaveBeenCalledTimes(1);
    });

    it('should set float uniform', () => {
      const { gl, spies } = createMockGL();
      const cache = new UniformCache(gl, {} as WebGLProgram);
      cache.setFloat('u_val', 1.5);
      expect(spies.uniform1f).toHaveBeenCalled();
    });

    it('should set int uniform', () => {
      const { gl, spies } = createMockGL();
      const cache = new UniformCache(gl, {} as WebGLProgram);
      cache.setInt('u_val', 2);
      expect(spies.uniform1i).toHaveBeenCalled();
    });

    it('should set vec3 uniform', () => {
      const { gl, spies } = createMockGL();
      const cache = new UniformCache(gl, {} as WebGLProgram);
      cache.setVec3('u_val', 1, 2, 3);
      expect(spies.uniform3f).toHaveBeenCalledWith(expect.anything(), 1, 2, 3);
    });

    it('should set mat4 uniform', () => {
      const { gl, spies } = createMockGL();
      const cache = new UniformCache(gl, {} as WebGLProgram);
      const mat = new Float32Array(16);
      cache.setMat4('u_mat', mat);
      expect(spies.uniformMatrix4fv).toHaveBeenCalledWith(expect.anything(), false, mat);
    });

    it('should not set uniform if location is null', () => {
      const { gl, spies } = createMockGL();
      spies.getUniformLocation.mockReturnValue(null);
      const cache = new UniformCache(gl, {} as WebGLProgram);
      cache.setFloat('u_missing', 1.0);
      expect(spies.uniform1f).not.toHaveBeenCalled();
    });

    it('should clear cache', () => {
      const { gl, spies } = createMockGL();
      const cache = new UniformCache(gl, {} as WebGLProgram);
      cache.get('u_a');
      cache.clear();
      cache.get('u_a');
      expect(spies.getUniformLocation).toHaveBeenCalledTimes(2);
    });
  });

  describe('AttributeCache', () => {
    it('should cache attribute locations', () => {
      const { gl, spies } = createMockGL();
      const cache = new AttributeCache(gl, {} as WebGLProgram);

      cache.get('a_pos');
      cache.get('a_pos');
      expect(spies.getAttribLocation).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', () => {
      const { gl, spies } = createMockGL();
      const cache = new AttributeCache(gl, {} as WebGLProgram);
      cache.get('a_pos');
      cache.clear();
      cache.get('a_pos');
      expect(spies.getAttribLocation).toHaveBeenCalledTimes(2);
    });
  });
});
