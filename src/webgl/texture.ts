import type { Dimensions } from '../shared/types/core';
import { TextureUploadError } from '../shared/errors/rendering';

/** 3D 볼륨 텍스처 업로드 */
export function uploadVolume3D(
  gl: WebGL2RenderingContext,
  data: ArrayBufferView,
  dims: Dimensions,
  internalFormat: GLenum = gl.R16I,
  format: GLenum = gl.RED_INTEGER,
  type: GLenum = gl.SHORT,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new TextureUploadError('Failed to create 3D texture');
  }

  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    internalFormat,
    dims.x,
    dims.y,
    dims.z,
    0,
    format,
    type,
    data,
  );

  setVolumeTextureParams(gl);

  gl.bindTexture(gl.TEXTURE_3D, null);
  return texture;
}

/** 3D 텍스처 파라미터 설정 */
export function setVolumeTextureParams(gl: WebGL2RenderingContext): void {
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
}

/** 2D 텍스처 업로드 */
export function uploadTexture2D(
  gl: WebGL2RenderingContext,
  data: ImageData | ArrayBufferView,
  width: number,
  height: number,
  unit: number = 0,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new TextureUploadError('Failed to create 2D texture');
  }

  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  if (data instanceof ImageData) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

/** 3D 텍스처 부분 업데이트 */
export function updateTexture3D(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  data: ArrayBufferView,
  offset: { x: number; y: number; z: number },
  size: Dimensions,
): void {
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texSubImage3D(
    gl.TEXTURE_3D,
    0,
    offset.x,
    offset.y,
    offset.z,
    size.x,
    size.y,
    size.z,
    gl.RED_INTEGER,
    gl.SHORT,
    data,
  );
  gl.bindTexture(gl.TEXTURE_3D, null);
}

/** 텍스처 해제 */
export function disposeTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture | null,
): void {
  if (texture) {
    gl.deleteTexture(texture);
  }
}
