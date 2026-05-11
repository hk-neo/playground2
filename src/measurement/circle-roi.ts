import type { Vec2 } from '../shared/types/core';
import type { VolumeBounds } from '../shared/types/measurement';
import type { IROIShape } from '../shared/interfaces/measurement';

export class CircleROI implements IROIShape {
  center: Vec2 = { x: 0, y: 0 };
  radius = 0;

  setCenter(point: Vec2): void {
    this.center = { ...point };
  }

  setRadius(r: number): void {
    this.radius = Math.max(0, r);
  }

  contains(point: Vec2): boolean {
    const dx = point.x - this.center.x;
    const dy = point.y - this.center.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  getArea(): number {
    return Math.PI * this.radius * this.radius;
  }

  getVolumeBounds(): VolumeBounds {
    return {
      min: { x: this.center.x - this.radius, y: this.center.y - this.radius, z: 0 },
      max: { x: this.center.x + this.radius, y: this.center.y + this.radius, z: 0 },
    };
  }
}
