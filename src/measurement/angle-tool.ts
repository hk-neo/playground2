import type { Vec2 } from '../shared/types/core';
import type { MeasureResult, PixelSpacing } from '../shared/types/measurement';
import type { IMeasurementTool } from '../shared/interfaces/measurement';
import type { ApplicationInput } from '../shared/types/input';
import { InputType } from '../shared/types/input';
import { InsufficientPointsError } from '../shared/errors/measurement';

export class AngleTool implements IMeasurementTool {
  points: Vec2[] = [];
  private spacing: PixelSpacing;
  private active = false;

  constructor(spacing?: PixelSpacing) {
    this.spacing = spacing ?? { row: 1, col: 1, isAvailable: false };
  }

  addPoint(point: Vec2): boolean {
    if (this.points.length >= 3) return false;
    this.points.push({ ...point });
    return true;
  }

  activate(): void { this.active = true; }
  deactivate(): void { this.active = false; this.points = []; }

  handleInput(input: ApplicationInput): void {
    if (!this.active) return;
    if (input.type === InputType.MouseDown) {
      this.addPoint(input.position);
    }
  }

  computeAngle(p1: Vec2, vertex: Vec2, p3: Vec2): number {
    const v1x = (p1.x - vertex.x) * this.spacing.col;
    const v1y = (p1.y - vertex.y) * this.spacing.row;
    const v2x = (p3.x - vertex.x) * this.spacing.col;
    const v2y = (p3.y - vertex.y) * this.spacing.row;

    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (mag1 < 1e-10 || mag2 < 1e-10) return 0;

    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle) * 180 / Math.PI;
  }

  calculate(): MeasureResult {
    if (this.points.length < 3) {
      throw new InsufficientPointsError('AngleTool', 3, this.points.length);
    }

    const [p1, vertex, p3] = this.points;
    const angle = this.computeAngle(p1, vertex, p3);

    return {
      type: 'angle',
      value: Math.round(angle * 100) / 100,
      unit: 'degree',
      points: [...this.points],
      formatted: `${(Math.round(angle * 100) / 100).toFixed(2)}°`,
    };
  }

  getResult(): MeasureResult {
    try {
      return this.calculate();
    } catch {
      return {
        type: 'angle',
        value: 0,
        unit: 'degree',
        points: [...this.points],
        formatted: `측정 불가 (${this.points.length}/3)`,
      };
    }
  }

  isComplete(): boolean {
    return this.points.length === 3;
  }
}
