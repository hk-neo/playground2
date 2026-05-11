import type { Vec2 } from '../shared/types/core';
import type { FillStyle, Rect } from './overlay-types';
import { DEFAULT_FILL_STYLE } from './overlay-types';

export class ROIRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  renderRectangle(bounds: Rect, style: FillStyle = DEFAULT_FILL_STYLE): void {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = style.fillColor;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    ctx.restore();
  }

  renderCircle(center: Vec2, radius: number, style: FillStyle = DEFAULT_FILL_STYLE): void {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = style.fillColor;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  renderFreehand(points: Vec2[], style: FillStyle = DEFAULT_FILL_STYLE): void {
    if (points.length < 2) return;

    const ctx = this.ctx;
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = style.fillColor;
    ctx.fill();

    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth;
    ctx.stroke();

    ctx.restore();
  }
}
