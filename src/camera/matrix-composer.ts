import type { Vec3, Mat4, Quaternion } from '../shared/types/core';
import type { DecomposedView } from '../shared/types/camera';
import { QuaternionOps } from './quaternion-ops';
import { SingularMatrixError } from '../shared/errors/camera';

export class MatrixComposer {
  private lastValidView: Mat4 | null = null;

  composeViewMatrix(position: Vec3, quaternion: Quaternion, target: Vec3): Mat4 {
    const up = new QuaternionOps(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
      .rotateVector({ x: 0, y: 1, z: 0 });

    const result = lookAt(position, target, up);

    if (isSingular(result)) {
      if (this.lastValidView) {
        throw new SingularMatrixError();
      }
      this.lastValidView = result;
      return result;
    }

    this.lastValidView = result;
    return result;
  }

  composeProjectionMatrix(fov: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1.0 / Math.tan(fov * 0.5);
    const rangeInv = 1.0 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0,
    ]);
  }

  decomposeViewMatrix(matrix: Mat4): DecomposedView {
    // View matrix: V = [R | -R*eye], so eye = -R^T * t
    const tx = matrix[12], ty = matrix[13], tz = matrix[14];
    const position: Vec3 = {
      x: -(matrix[0] * tx + matrix[1] * ty + matrix[2] * tz),
      y: -(matrix[4] * tx + matrix[5] * ty + matrix[6] * tz),
      z: -(matrix[8] * tx + matrix[9] * ty + matrix[10] * tz),
    };

    const forward: Vec3 = { x: -matrix[2], y: -matrix[6], z: -matrix[10] };

    const target: Vec3 = {
      x: position.x + forward.x,
      y: position.y + forward.y,
      z: position.z + forward.z,
    };

    const up: Vec3 = { x: matrix[1], y: matrix[5], z: matrix[9] };

    return { position, target, up };
  }
}

function lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  let fx = center.x - eye.x;
  let fy = center.y - eye.y;
  let fz = center.z - eye.z;
  let len = Math.sqrt(fx * fx + fy * fy + fz * fz);
  if (len < 1e-10) {
    fx = 0; fy = 0; fz = -1;
  } else {
    fx /= len; fy /= len; fz /= len;
  }

  let rx = fy * up.z - fz * up.y;
  let ry = fz * up.x - fx * up.z;
  let rz = fx * up.y - fy * up.x;
  len = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (len < 1e-10) {
    rx = 1; ry = 0; rz = 0;
  } else {
    rx /= len; ry /= len; rz /= len;
  }

  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  return new Float32Array([
    rx, ux, -fx, 0,
    ry, uy, -fy, 0,
    rz, uz, -fz, 0,
    -(rx * eye.x + ry * eye.y + rz * eye.z),
    -(ux * eye.x + uy * eye.y + uz * eye.z),
    fx * eye.x + fy * eye.y + fz * eye.z,
    1,
  ]);
}

function isSingular(m: Mat4): boolean {
  const det = m[0] * (m[5] * m[10] - m[6] * m[9])
    - m[1] * (m[4] * m[10] - m[6] * m[8])
    + m[2] * (m[4] * m[9] - m[5] * m[8]);
  return Math.abs(det) < 1e-10;
}
