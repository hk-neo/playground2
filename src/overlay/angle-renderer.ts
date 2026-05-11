import type { Vec2 } from '../shared/types/core';
import type { LineStyle } from './overlay-types';
import { DEFAULT_LINE_STYLE } from './overlay-types';

export class AngleRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  renderAngleLines(p1: Vec2, vertex: Vec2, p3: Vec2, style: LineStyle = DEFAULT_LINE_STYLE): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.setLineDash(style.dashPattern);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(vertex.x, vertex.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();

    ctx.restore();
  }

  renderArc(vertex: Vec2, p1: Vec2, p3: Vec2, radius = 30): void {
    const ctx = this.ctx;
    const startAngle = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const endAngle = Math.atan2(p3.y - vertex.y, p3.x - vertex.x);

    ctx.save();
    ctx.strokeStyle = DEFAULT_LINE_STYLE.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(vertex.x, vertex.y, radius, startAngle, endAngle);
    ctx.stroke();

    ctx.restore();
  }

  renderAngleLabel(vertex: Vec2, angle: string, offset = 40): void {
    const ctx = this.ctx;
    const labelPos = { x: vertex.x + offset * 0.5, y: vertex.y - offset };

    ctx.save();
    ctx.font = '12px monospace';
    const metrics = ctx.measureText(angle);
    const padding = 3;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      labelPos.x - padding,
      labelPos.y - 12 - padding,
      metrics.width + padding * 2,
      12 + padding * 2,
    );

    ctx.fillStyle = '#ffffff';
    ctx.fillText(angle, labelPos.x, labelPos.y);

    ctx.restore();
  }
}
