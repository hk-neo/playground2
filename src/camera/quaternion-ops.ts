import type { Vec3, Mat4, Quaternion } from '../shared/types/core';
import type { IQuaternionOps } from '../shared/interfaces/camera';
import { DegenerateQuaternionError } from '../shared/errors/camera';

export class QuaternionOps implements Quaternion, IQuaternionOps {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  static identity(): QuaternionOps {
    return new QuaternionOps(0, 0, 0, 1);
  }

  static fromQuaternion(q: Quaternion): QuaternionOps {
    return new QuaternionOps(q.x, q.y, q.z, q.w);
  }

  multiply(q: Quaternion): QuaternionOps {
    return new QuaternionOps(
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
    );
  }

  normalize(): QuaternionOps {
    const len = Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w,
    );
    if (len < 1e-10) {
      throw new DegenerateQuaternionError();
    }
    const inv = 1 / len;
    return new QuaternionOps(
      this.x * inv,
      this.y * inv,
      this.z * inv,
      this.w * inv,
    );
  }

  conjugate(): QuaternionOps {
    return new QuaternionOps(-this.x, -this.y, -this.z, this.w);
  }

  toMatrix(): Mat4 {
    const { x, y, z, w } = this;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    return new Float32Array([
      1 - 2 * (yy + zz), 2 * (xy + wz),       2 * (xz - wy),       0,
      2 * (xy - wz),      1 - 2 * (xx + zz),   2 * (yz + wx),       0,
      2 * (xz + wy),      2 * (yz - wx),        1 - 2 * (xx + yy),  0,
      0,                  0,                    0,                    1,
    ]);
  }

  fromAxisAngle(axis: Vec3, angle: number): QuaternionOps {
    const halfAngle = angle * 0.5;
    const s = Math.sin(halfAngle);
    const c = Math.cos(halfAngle);
    return new QuaternionOps(
      axis.x * s,
      axis.y * s,
      axis.z * s,
      c,
    );
  }

  slerp(q: Quaternion, t: number): QuaternionOps {
    let dot = this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;

    let qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    if (dot < 0) {
      dot = -dot;
      qx = -qx; qy = -qy; qz = -qz; qw = -qw;
    }

    if (dot > 0.9995) {
      return new QuaternionOps(
        this.x + t * (qx - this.x),
        this.y + t * (qy - this.y),
        this.z + t * (qz - this.z),
        this.w + t * (qw - this.w),
      ).normalize();
    }

    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
    const s1 = sinTheta / sinTheta0;

    return new QuaternionOps(
      s0 * this.x + s1 * qx,
      s0 * this.y + s1 * qy,
      s0 * this.z + s1 * qz,
      s0 * this.w + s1 * qw,
    );
  }

  clone(): QuaternionOps {
    return new QuaternionOps(this.x, this.y, this.z, this.w);
  }

  length(): number {
    return Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w,
    );
  }

  rotateVector(v: Vec3): Vec3 {
    const qv = new QuaternionOps(v.x, v.y, v.z, 0);
    const result = this.multiply(qv).multiply(this.conjugate());
    return { x: result.x, y: result.y, z: result.z };
  }
}
