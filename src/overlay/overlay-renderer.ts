import type { Vec2 } from '../shared/types/core';
import { MPRPlane } from '../shared/types/rendering';
import type { OverlayItem } from './overlay-types';
import { DEFAULT_LINE_STYLE, DEFAULT_FILL_STYLE } from './overlay-types';
import { LineRenderer } from './line-renderer';
import { AngleRenderer } from './angle-renderer';
import { ROIRenderer } from './roi-renderer';
import { TextStyleManager } from './text-style-manager';

export class OverlayRenderer {
  private overlays = new Map<string, OverlayItem>();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lineRenderer: LineRenderer;
  private angleRenderer: AngleRenderer;
  private roiRenderer: ROIRenderer;
  textStyleManager = new TextStyleManager();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.lineRenderer = new LineRenderer(ctx);
    this.angleRenderer = new AngleRenderer(ctx);
    this.roiRenderer = new ROIRenderer(ctx);
  }

  addOverlay(id: string, item: OverlayItem): void {
    this.overlays.set(id, item);
  }

  removeOverlay(id: string): boolean {
    return this.overlays.delete(id);
  }

  getOverlay(id: string): OverlayItem | undefined {
    return this.overlays.get(id);
  }

  getOverlayCount(): number {
    return this.overlays.size;
  }

  clearAll(): void {
    this.overlays.clear();
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(sliceIndex: number, plane: MPRPlane): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const [, item] of this.overlays) {
      if (!item.visible) continue;
      if (item.sliceIndex !== sliceIndex || item.plane !== plane) continue;

      switch (item.type) {
        case 'line':
          this.renderLineOverlay(item);
          break;
        case 'angle':
          this.renderAngleOverlay(item);
          break;
        case 'roi':
          this.renderROIOverlay(item);
          break;
      }
    }
  }

  private renderLineOverlay(item: OverlayItem): void {
    if (item.points.length < 2) return;
    const [start, end] = item.points;
    const style = { ...DEFAULT_LINE_STYLE, ...(item.style as Partial<typeof DEFAULT_LINE_STYLE>) };

    this.lineRenderer.renderLine(start, end, style);
    this.lineRenderer.renderEndpoints(start, end);

    if (item.label) {
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 10 };
      this.lineRenderer.renderLabel(mid, item.label);
    }
  }

  private renderAngleOverlay(item: OverlayItem): void {
    if (item.points.length < 3) return;
    const [p1, vertex, p3] = item.points;
    const style = { ...DEFAULT_LINE_STYLE, ...(item.style as Partial<typeof DEFAULT_LINE_STYLE>) };

    this.angleRenderer.renderAngleLines(p1, vertex, p3, style);
    this.angleRenderer.renderArc(vertex, p1, p3);

    if (item.label) {
      this.angleRenderer.renderAngleLabel(vertex, item.label);
    }
  }

  private renderROIOverlay(item: OverlayItem): void {
    const style = { ...DEFAULT_FILL_STYLE, ...(item.style as Partial<typeof DEFAULT_FILL_STYLE>) };

    if (item.points.length === 2) {
      // Rectangle: origin + width/height encoded as second point
      const [origin, size] = item.points;
      this.roiRenderer.renderRectangle(
        { x: origin.x, y: origin.y, width: size.x, height: size.y },
        style,
      );
    } else if (item.points.length === 2 && item.points[0].x === item.points[1].x) {
      // Circle (won't match, handled below)
    }

    // Circle: center + edge point
    if (item.points.length === 2) {
      const [center, edge] = item.points;
      const radius = Math.sqrt((edge.x - center.x) ** 2 + (edge.y - center.y) ** 2);
      if (radius > 0) {
        this.roiRenderer.renderCircle(center, radius, style);
      }
    }

    // Freehand: multiple points
    if (item.points.length >= 3) {
      this.roiRenderer.renderFreehand(item.points, style);
    }
  }
}
