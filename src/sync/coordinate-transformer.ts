import type { Vec3, Mat4 } from '../shared/types/core';
import { MPRPlane } from '../shared/types/rendering';
import type { MPRPosition } from '../shared/types/sync';

export class CoordinateTransformer {
  private dimensions: Vec3 = { x: 1, y: 1, z: 1 };

  setDimensions(dims: Vec3): void {
    this.dimensions = { ...dims };
  }

  mprTo3D(point: Vec3, plane: MPRPlane): Vec3 {
    switch (plane) {
      case MPRPlane.Axial:
        return { x: point.x, y: point.y, z: point.z / this.dimensions.z };
      case MPRPlane.Coronal:
        return { x: point.x, y: point.y / this.dimensions.y, z: point.z };
      case MPRPlane.Sagittal:
        return { x: point.x / this.dimensions.x, y: point.y, z: point.z };
      default:
        return point;
    }
  }

  threeDToMPR(point: Vec3): MPRPosition {
    return {
      axial: Math.round(point.z * this.dimensions.z),
      coronal: Math.round(point.y * this.dimensions.y),
      sagittal: Math.round(point.x * this.dimensions.x),
    };
  }

  computeTransformMatrix(): Mat4 {
    return new Float32Array([
      1 / this.dimensions.x, 0, 0, 0,
      0, 1 / this.dimensions.y, 0, 0,
      0, 0, 1 / this.dimensions.z, 0,
      0, 0, 0, 1,
    ]);
  }

  validateTransform(): boolean {
    return this.dimensions.x > 0 && this.dimensions.y > 0 && this.dimensions.z > 0;
  }
}
