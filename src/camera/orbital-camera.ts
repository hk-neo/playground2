import type { Vec3, Mat4 } from '../shared/types/core';
import type { ICamera } from '../shared/interfaces/camera';
import { QuaternionOps } from './quaternion-ops';
import { MatrixComposer } from './matrix-composer';

const DEFAULT_MIN_DISTANCE = 0.1;
const DEFAULT_MAX_DISTANCE = 100;
const DEFAULT_FOV = Math.PI / 4;

export class OrbitalCamera implements ICamera {
  target: Vec3;
  distance: number;
  quaternion: QuaternionOps;
  minDistance: number;
  maxDistance: number;
  fov: number;

  private matrixComposer: MatrixComposer;

  constructor() {
    this.target = { x: 0, y: 0, z: 0 };
    this.distance = 2.5;
    this.quaternion = QuaternionOps.identity();
    this.minDistance = DEFAULT_MIN_DISTANCE;
    this.maxDistance = DEFAULT_MAX_DISTANCE;
    this.fov = DEFAULT_FOV;
    this.matrixComposer = new MatrixComposer();
  }

  rotate(deltaTheta: number, deltaPhi: number): void {
    if (Math.abs(deltaTheta) < 1e-10 && Math.abs(deltaPhi) < 1e-10) return;

    // Screen-space trackball: rotate around camera's local axes
    const right = this.quaternion.rotateVector({ x: 1, y: 0, z: 0 });
    const up = this.quaternion.rotateVector({ x: 0, y: 1, z: 0 });

    const pitchQ = new QuaternionOps().fromAxisAngle(right, deltaPhi);
    const yawQ = new QuaternionOps().fromAxisAngle(up, deltaTheta);

    this.quaternion = yawQ.multiply(pitchQ).multiply(this.quaternion).normalize();
  }

  zoom(delta: number): void {
    this.distance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.distance + delta),
    );
  }

  pan(deltaX: number, deltaY: number): void {
    const right = this.quaternion.rotateVector({ x: 1, y: 0, z: 0 });
    const up = this.quaternion.rotateVector({ x: 0, y: 1, z: 0 });

    this.target = {
      x: this.target.x + right.x * deltaX + up.x * deltaY,
      y: this.target.y + right.y * deltaX + up.y * deltaY,
      z: this.target.z + right.z * deltaX + up.z * deltaY,
    };
  }

  reset(): void {
    this.target = { x: 0, y: 0, z: 0 };
    this.distance = 2.5;
    this.quaternion = QuaternionOps.identity();
    this.fov = DEFAULT_FOV;
  }

  getPosition(): Vec3 {
    const offset = this.quaternion.rotateVector({ x: 0, y: 0, z: -1 });
    return {
      x: this.target.x + offset.x * this.distance,
      y: this.target.y + offset.y * this.distance,
      z: this.target.z + offset.z * this.distance,
    };
  }

  getViewMatrix(): Mat4 {
    const position = this.getPosition();
    return this.matrixComposer.composeViewMatrix(
      position, this.quaternion, this.target,
    );
  }

  getProjectionMatrix(aspect: number): Mat4 {
    return this.matrixComposer.composeProjectionMatrix(
      this.fov, aspect, 0.01, 1000,
    );
  }

  setTarget(target: Vec3): void {
    this.target = { ...target };
  }

  setDistance(distance: number): void {
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
  }

  setFov(fov: number): void {
    this.fov = Math.max(0.01, Math.min(Math.PI * 0.99, fov));
  }

  setDistanceLimits(min: number, max: number): void {
    this.minDistance = min;
    this.maxDistance = max;
    this.distance = Math.max(min, Math.min(max, this.distance));
  }
}
