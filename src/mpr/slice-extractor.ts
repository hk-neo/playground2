import type { VolumeData } from '../shared/types/volume';
import type { MPRPlane } from '../shared/types/rendering';
import type { Vec3 } from '../shared/types/core';
import type { ISliceExtractor } from '../shared/interfaces/mpr';
import { InvalidSlicePositionError } from '../shared/errors/mpr';

/** 볼륨 데이터에서 특정 단면의 픽셀 데이터 추출 */
export class SliceExtractor implements ISliceExtractor {
  extract(plane: MPRPlane, position: number, volume: VolumeData): Float32Array {
    const [dx, dy, dz] = volume.dimensions;
    this.validatePosition(plane, position, dx, dy, dz);
    const view = this.getView(volume);

    switch (plane) {
      case 'Axial':
        return this.doExtractAxial(position, view, dx, dy);
      case 'Coronal':
        return this.doExtractCoronal(position, view, dx, dy, dz);
      case 'Sagittal':
      default:
        return this.doExtractSagittal(position, view, dx, dy, dz);
    }
  }

  extractAxial(z: number, volume: VolumeData): Float32Array {
    const [dx, dy, dz] = volume.dimensions;
    this.validatePosition('Axial' as MPRPlane, z, dx, dy, dz);
    return this.doExtractAxial(z, this.getView(volume), dx, dy);
  }

  extractCoronal(y: number, volume: VolumeData): Float32Array {
    const [dx, dy, dz] = volume.dimensions;
    this.validatePosition('Coronal' as MPRPlane, y, dx, dy, dz);
    return this.doExtractCoronal(y, this.getView(volume), dx, dy, dz);
  }

  extractSagittal(x: number, volume: VolumeData): Float32Array {
    const [dx, dy, dz] = volume.dimensions;
    this.validatePosition('Sagittal' as MPRPlane, x, dx, dy, dz);
    return this.doExtractSagittal(x, this.getView(volume), dx, dy, dz);
  }

  extractOblique(normal: Vec3, offset: number, volume: VolumeData): Float32Array {
    const [dx, dy, dz] = volume.dimensions;
    const view = this.getView(volume);
    const outW = dx;
    const outH = dy;
    const result = new Float32Array(outW * outH);

    const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    const nx = normal.x / len;
    const ny = normal.y / len;
    const nz = normal.z / len;

    let ux: number, uy: number, uz: number;
    if (Math.abs(ny) < 0.9) {
      const cross = this.cross(nx, ny, nz, 0, 1, 0);
      ux = cross.x; uy = cross.y; uz = cross.z;
    } else {
      const cross = this.cross(nx, ny, nz, 1, 0, 0);
      ux = cross.x; uy = cross.y; uz = cross.z;
    }
    const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz);
    ux /= uLen; uy /= uLen; uz /= uLen;

    const v = this.cross(nx, ny, nz, ux, uy, uz);
    const vLen = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const vx = v.x / vLen, vy = v.y / vLen, vz = v.z / vLen;

    for (let row = 0; row < outH; row++) {
      for (let col = 0; col < outW; col++) {
        const px = offset * nx + (col - outW / 2) * ux + (row - outH / 2) * vx;
        const py = offset * ny + (col - outW / 2) * uy + (row - outH / 2) * vy;
        const pz = offset * nz + (col - outW / 2) * uz + (row - outH / 2) * vz;

        const ix = Math.round(px);
        const iy = Math.round(py);
        const iz = Math.round(pz);

        if (ix >= 0 && ix < dx && iy >= 0 && iy < dy && iz >= 0 && iz < dz) {
          result[row * outW + col] = view[iz * dx * dy + iy * dx + ix];
        }
      }
    }

    return result;
  }

  private doExtractAxial(z: number, view: Int16Array | Uint16Array, dx: number, dy: number): Float32Array {
    const result = new Float32Array(dx * dy);
    const zOffset = z * dx * dy;
    for (let i = 0; i < dx * dy; i++) {
      result[i] = view[zOffset + i];
    }
    return result;
  }

  private doExtractCoronal(y: number, view: Int16Array | Uint16Array, dx: number, _dy: number, dz: number): Float32Array {
    const result = new Float32Array(dx * dz);
    for (let z = 0; z < dz; z++) {
      const yOffset = z * dx * _dy + y * dx;
      for (let x = 0; x < dx; x++) {
        result[z * dx + x] = view[yOffset + x];
      }
    }
    return result;
  }

  private doExtractSagittal(x: number, view: Int16Array | Uint16Array, dx: number, dy: number, dz: number): Float32Array {
    const result = new Float32Array(dy * dz);
    for (let z = 0; z < dz; z++) {
      for (let y = 0; y < dy; y++) {
        result[z * dy + y] = view[z * dx * dy + y * dx + x];
      }
    }
    return result;
  }

  private getView(volume: VolumeData): Int16Array | Uint16Array {
    if (volume.dataType === 'int16') {
      return new Int16Array(volume.buffer);
    }
    return new Uint16Array(volume.buffer);
  }

  private validatePosition(plane: string, pos: number, dx: number, dy: number, dz: number): void {
    let max: number;
    switch (plane) {
      case 'Axial': max = dz; break;
      case 'Coronal': max = dy; break;
      case 'Sagittal': max = dx; break;
      default: return;
    }
    if (pos < 0 || pos >= max) {
      throw new InvalidSlicePositionError(plane, pos, max);
    }
  }

  private cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number): Vec3 {
    return {
      x: ay * bz - az * by,
      y: az * bx - ax * bz,
      z: ax * by - ay * bx,
    };
  }
}
