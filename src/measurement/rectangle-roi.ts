import type { Vec2 } from '../shared/types/core';
import type { VolumeBounds } from '../shared/types/measurement';
import type { IROIShape } from '../shared/interfaces/measurement';
import { InvalidROIError } from '../shared/errors/measurement';

export class RectangleROI implements IROIShape {
  origin: Vec2 = { x: 0, y: 0 };
  width = 0;
  height = 0;

  setOrigin(point: Vec2): void {
    this.origin = { ...point };
  }

  setSize(width: number, height: number): void {
    if (width < 1 || height < 1) {
      throw new InvalidROIError(`Rectangle size ${width}x${height} is below minimum`);
    }
    this.width = width;
    this.height = height;
  }

  contains(point: Vec2): boolean {
    const minX = Math.min(this.origin.x, this.origin.x + this.width);
    const maxX = Math.max(this.origin.x, this.origin.x + this.width);
    const minY = Math.min(this.origin.y, this.origin.y + this.height);
    const maxY = Math.max(this.origin.y, this.origin.y + this.height);
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }

  getArea(): number {
    return Math.abs(this.width * this.height);
  }

  getVolumeBounds(): VolumeBounds {
    return {
      min: { x: Math.min(this.origin.x, this.origin.x + this.width), y: Math.min(this.origin.y, this.origin.y + this.height), z: 0 },
      max: { x: Math.max(this.origin.x, this.origin.x + this.width), y: Math.max(this.origin.y, this.origin.y + this.height), z: 0 },
    };
  }
}
