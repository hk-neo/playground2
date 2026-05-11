import type { Vec2 } from '../shared/types/core';
import type { LineStyle } from './overlay-types';
import { DEFAULT_LINE_STYLE } from './overlay-types';

export class LineRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  renderLine(start: Vec2, end: Vec2, style: LineStyle = DEFAULT_LINE_STYLE): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.setLineDash(style.dashPattern);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.restore();
  }

  renderEndpoints(start: Vec2, end: Vec2, radius = 4): void {
    const ctx = this.ctx;
    ctx.fillStyle = DEFAULT_LINE_STYLE.color;

    ctx.beginPath();
    ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(end.x, end.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  renderLabel(position: Vec2, text: string, fontSize = 12): void {
    const ctx = this.ctx;
    ctx.save();

    ctx.font = `${fontSize}px monospace`;
    const metrics = ctx.measureText(text);
    const padding = 3;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      position.x - padding,
      position.y - fontSize - padding,
      metrics.width + padding * 2,
      fontSize + padding * 2,
    );

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, position.x, position.y);

    ctx.restore();
  }
}
