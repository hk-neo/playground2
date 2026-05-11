import type { Vec2 } from '../shared/types/core';
import type { MeasureResult, PixelSpacing } from '../shared/types/measurement';
import type { IMeasurementTool } from '../shared/interfaces/measurement';
import type { ApplicationInput } from '../shared/types/input';
import { InputType } from '../shared/types/input';
import { InsufficientPointsError } from '../shared/errors/measurement';

export class DistanceTool implements IMeasurementTool {
  startPoint: Vec2 | null = null;
  endPoint: Vec2 | null = null;
  private spacing: PixelSpacing;
  private active = false;

  constructor(spacing?: PixelSpacing) {
    this.spacing = spacing ?? { row: 1, col: 1, isAvailable: false };
  }

  setPixelSpacing(spacing: PixelSpacing): void {
    this.spacing = spacing;
  }

  setStart(point: Vec2): void {
    this.startPoint = { ...point };
  }

  setEnd(point: Vec2): void {
    this.endPoint = { ...point };
  }

  activate(): void { this.active = true; }
  deactivate(): void { this.active = false; this.startPoint = null; this.endPoint = null; }

  handleInput(input: ApplicationInput): void {
    if (!this.active) return;
    if (input.type === InputType.MouseDown) {
      if (!this.startPoint) {
        this.startPoint = { ...input.position };
      } else {
        this.endPoint = { ...input.position };
      }
    }
  }

  calculate(): MeasureResult {
    if (!this.startPoint || !this.endPoint) {
      const provided = (this.startPoint ? 1 : 0) + (this.endPoint ? 1 : 0);
      throw new InsufficientPointsError('DistanceTool', 2, provided);
    }

    const dx = (this.endPoint.x - this.startPoint.x) * this.spacing.col;
    const dy = (this.endPoint.y - this.startPoint.y) * this.spacing.row;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return {
      type: 'distance',
      value: Math.round(distance * 100) / 100,
      unit: this.spacing.isAvailable ? 'mm' : 'px²',
      points: [this.startPoint, this.endPoint],
      formatted: `${(Math.round(distance * 100) / 100).toFixed(2)} ${this.spacing.isAvailable ? 'mm' : 'px'}`,
    };
  }

  getResult(): MeasureResult {
    try {
      return this.calculate();
    } catch {
      return {
        type: 'distance',
        value: 0,
        unit: 'mm',
        points: this.startPoint ? [this.startPoint] : [],
        formatted: '측정 불가',
      };
    }
  }

  isComplete(): boolean {
    return this.startPoint !== null && this.endPoint !== null;
  }
}
