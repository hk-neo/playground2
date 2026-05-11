import type { Vec2 } from '../shared/types/core';
import type { VolumeBounds } from '../shared/types/measurement';
import type { IROIShape } from '../shared/interfaces/measurement';
import { InvalidROIError } from '../shared/errors/measurement';

export class FreehandROI implements IROIShape {
  points: Vec2[] = [];
  isClosed = false;

  addPoint(point: Vec2): void {
    this.points.push({ ...point });
  }

  close(): void {
    if (this.points.length < 3) {
      throw new InvalidROIError('Freehand ROI requires at least 3 points to close');
    }
    this.isClosed = true;
  }

  contains(point: Vec2): boolean {
    if (this.points.length < 3) return false;

    // Ray casting algorithm
    let inside = false;
    const n = this.points.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = this.points[i].x, yi = this.points[i].y;
      const xj = this.points[j].x, yj = this.points[j].y;

      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  getArea(): number {
    if (this.points.length < 3) return 0;

    // Shoelace formula
    let area = 0;
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += this.points[i].x * this.points[j].y;
      area -= this.points[j].x * this.points[i].y;
    }
    return Math.abs(area) / 2;
  }

  getVolumeBounds(): VolumeBounds {
    if (this.points.length === 0) {
      return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    return { min: { x: minX, y: minY, z: 0 }, max: { x: maxX, y: maxY, z: 0 } };
  }

  simplify(tolerance = 1.0): void {
    if (this.points.length <= 2) return;
    this.points = douglasPeucker(this.points, tolerance);
  }
}

function douglasPeucker(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(point: Vec2, lineStart: Vec2, lineEnd: Vec2): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1e-10) {
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }

  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / len;
}
