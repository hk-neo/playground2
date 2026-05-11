import type { Dimensions } from '../shared/types/core';
import type { Mat4 } from '../shared/types/core';
import { TransferFunctionManager } from './transfer-function-manager';
import { RayMarchingShader } from './ray-marching-shader';
import { BoundingBoxRenderer, BackFaceRenderer } from './bounding-box-renderer';
import { VolumeNotLoadedError } from '../shared/errors/mpr';

/** Ray Casting 3D 볼륨 렌더링 메인 클래스 */
export class VolumeRayCaster {
  private gl: WebGL2RenderingContext;
  private volumeTexture: WebGLTexture | null = null;
  private transferFunctionTexture: WebGLTexture | null = null;
  private backFaceProgram: WebGLProgram | null = null;
  private rayMarchProgram: WebGLProgram | null = null;
  private volumeDims: Dimensions | null = null;
  private canvasWidth = 0;
  private canvasHeight = 0;

  readonly transferFunction: TransferFunctionManager;
  readonly shader: RayMarchingShader;
  readonly boundingBox: BoundingBoxRenderer;
  readonly backFaceRenderer: BackFaceRenderer;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.transferFunction = new TransferFunctionManager();
    this.shader = new RayMarchingShader();
    this.boundingBox = new BoundingBoxRenderer();
    this.backFaceRenderer = new BackFaceRenderer();
  }

  init(): void {
    const gl = this.gl;

    this.backFaceProgram = this.compileShader(
      this.shader.getBackFaceVertexShader(),
      this.shader.getBackFaceFragmentShader(),
    );

    this.rayMarchProgram = this.compileShader(
      this.shader.getVertexShader(),
      this.shader.getFragmentShader(),
    );

    this.transferFunctionTexture = this.transferFunction.createTexture(gl);
  }

  setVolume(texture: WebGLTexture, dims: Dimensions): void {
    this.volumeTexture = texture;
    this.volumeDims = dims;
    this.boundingBox.createBox(this.gl, dims);
  }

  render(mvpMatrix: Mat4): void {
    if (!this.volumeTexture || !this.volumeDims || !this.backFaceProgram || !this.rayMarchProgram) {
      throw new VolumeNotLoadedError();
    }

    const gl = this.gl;

    // Pass 1: Render back faces to FBO
    this.backFaceRenderer.ensureResources(gl, this.canvasWidth, this.canvasHeight);
    this.backFaceRenderer.bind(gl);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.backFaceProgram);
    gl.cullFace(gl.FRONT); // render back faces only
    gl.enable(gl.CULL_FACE);

    const backMVP = gl.getUniformLocation(this.backFaceProgram, 'uMVP');
    gl.uniformMatrix4fv(backMVP, false, mvpMatrix);

    this.boundingBox.render(gl);

    // Pass 2: Ray march
    this.backFaceRenderer.unbind(gl, this.canvasWidth, this.canvasHeight);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.rayMarchProgram);
    gl.cullFace(gl.BACK);

    // Set uniforms
    gl.uniformMatrix4fv(gl.getUniformLocation(this.rayMarchProgram, 'uMVP'), false, mvpMatrix);
    gl.uniform2f(gl.getUniformLocation(this.rayMarchProgram, 'uScreenSize'), this.canvasWidth, this.canvasHeight);
    gl.uniform1f(gl.getUniformLocation(this.rayMarchProgram, 'uStepSize'), this.shader.stepSizeValue);
    gl.uniform1f(gl.getUniformLocation(this.rayMarchProgram, 'uEarlyRayTermination'), this.shader.earlyRayTerminationValue);

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.backFaceRenderer.getTexture());
    gl.uniform1i(gl.getUniformLocation(this.rayMarchProgram, 'uBackFace'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.volumeTexture);
    gl.uniform1i(gl.getUniformLocation(this.rayMarchProgram, 'uVolume'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.transferFunctionTexture);
    gl.uniform1i(gl.getUniformLocation(this.rayMarchProgram, 'uTransferFunction'), 2);

    this.boundingBox.render(gl);

    gl.disable(gl.CULL_FACE);
  }

  resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  getRenderResult(): ImageData {
    const gl = this.gl;
    const pixels = new Uint8Array(this.canvasWidth * this.canvasHeight * 4);
    gl.readPixels(0, 0, this.canvasWidth, this.canvasHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return new ImageData(new Uint8ClampedArray(pixels), this.canvasWidth, this.canvasHeight);
  }

  private compileShader(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error(`Vertex shader: ${gl.getShaderInfoLog(vs)}`);
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error(`Fragment shader: ${gl.getShaderInfoLog(fs)}`);
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link: ${gl.getProgramInfoLog(program)}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
  }

  dispose(): void {
    const gl = this.gl;
    if (this.backFaceProgram) gl.deleteProgram(this.backFaceProgram);
    if (this.rayMarchProgram) gl.deleteProgram(this.rayMarchProgram);
    if (this.transferFunctionTexture) gl.deleteTexture(this.transferFunctionTexture);
    this.boundingBox.dispose(gl);
    this.backFaceRenderer.dispose(gl);
  }
}
