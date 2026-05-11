import type { Dimensions } from '../shared/types/core';
import { TextureUploadError } from '../shared/errors/rendering';
import { uploadVolume3D, uploadTexture2D, updateTexture3D, disposeTexture } from '../webgl/texture';

/** 텍스처 리소스 관리자 */
export class TextureManager {
  private textures = new Map<string, WebGLTexture>();

  constructor(private gl: WebGL2RenderingContext) {}

  /** 3D 볼륨 텍스처 생성 및 등록 */
  createVolume3D(name: string, data: ArrayBufferView, dims: Dimensions): WebGLTexture {
    this.dispose(name);
    const texture = uploadVolume3D(this.gl, data, dims);
    this.textures.set(name, texture);
    return texture;
  }

  /** 2D 텍스처 생성 및 등록 */
  createTexture2D(name: string, data: ImageData | ArrayBufferView, width: number, height: number, unit?: number): WebGLTexture {
    this.dispose(name);
    const texture = uploadTexture2D(this.gl, data, width, height, unit);
    this.textures.set(name, texture);
    return texture;
  }

  /** 3D 텍스처 부분 업데이트 */
  updateVolume3D(name: string, data: ArrayBufferView, offset: { x: number; y: number; z: number }, size: Dimensions): void {
    const texture = this.textures.get(name);
    if (!texture) throw new TextureUploadError(`Texture '${name}' not found`);
    updateTexture3D(this.gl, texture, data, offset, size);
  }

  /** 텍스처 조회 */
  get(name: string): WebGLTexture | undefined {
    return this.textures.get(name);
  }

  /** 특정 텍스처 해제 */
  dispose(name: string): void {
    const texture = this.textures.get(name);
    if (texture) {
      disposeTexture(this.gl, texture);
      this.textures.delete(name);
    }
  }

  /** 모든 텍스처 해제 */
  disposeAll(): void {
    for (const texture of this.textures.values()) {
      disposeTexture(this.gl, texture);
    }
    this.textures.clear();
  }
}
