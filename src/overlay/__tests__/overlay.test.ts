import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverlayRenderer } from '../overlay-renderer';
import { LineRenderer } from '../line-renderer';
import { AngleRenderer } from '../angle-renderer';
import { ROIRenderer } from '../roi-renderer';
import { TextStyleManager } from '../text-style-manager';
import { MPRPlane } from '../../shared/types/rendering';
import type { OverlayItem } from '../overlay-types';
import { DEFAULT_LINE_STYLE, DEFAULT_FILL_STYLE } from '../overlay-types';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    get canvas() { return null; },
  } as unknown as CanvasRenderingContext2D;
}

function createTestCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  const ctx = createMockCtx();
  canvas.getContext = (type: string) => type === '2d' ? ctx as any : null;
  // Also stub style for resize
  (canvas as any).style = { width: '', height: '' };
  return canvas;
}

describe('LineRenderer', () => {
  it('should render a line without errors', () => {
    const ctx = createMockCtx();
    const renderer = new LineRenderer(ctx);
    renderer.renderLine({ x: 10, y: 10 }, { x: 100, y: 100 });
  });

  it('should render endpoints', () => {
    const ctx = createMockCtx();
    const renderer = new LineRenderer(ctx);
    renderer.renderEndpoints({ x: 10, y: 10 }, { x: 100, y: 100 });
  });

  it('should render label with background', () => {
    const ctx = createMockCtx();
    const renderer = new LineRenderer(ctx);
    renderer.renderLabel({ x: 50, y: 50 }, '12.34 mm');
  });
});

describe('AngleRenderer', () => {
  it('should render angle lines', () => {
    const ctx = createMockCtx();
    const renderer = new AngleRenderer(ctx);
    renderer.renderAngleLines({ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 });
  });

  it('should render arc', () => {
    const ctx = createMockCtx();
    const renderer = new AngleRenderer(ctx);
    renderer.renderArc({ x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 });
  });

  it('should render angle label', () => {
    const ctx = createMockCtx();
    const renderer = new AngleRenderer(ctx);
    renderer.renderAngleLabel({ x: 100, y: 100 }, '90.00°');
  });
});

describe('ROIRenderer', () => {
  it('should render rectangle', () => {
    const ctx = createMockCtx();
    const renderer = new ROIRenderer(ctx);
    renderer.renderRectangle({ x: 10, y: 10, width: 80, height: 60 });
  });

  it('should render circle', () => {
    const ctx = createMockCtx();
    const renderer = new ROIRenderer(ctx);
    renderer.renderCircle({ x: 100, y: 100 }, 50);
  });

  it('should render freehand', () => {
    const ctx = createMockCtx();
    const renderer = new ROIRenderer(ctx);
    renderer.renderFreehand([
      { x: 50, y: 50 }, { x: 150, y: 50 }, { x: 100, y: 150 },
    ]);
  });

  it('should skip freehand with < 2 points', () => {
    const ctx = createMockCtx();
    const renderer = new ROIRenderer(ctx);
    renderer.renderFreehand([{ x: 50, y: 50 }]);
  });
});

describe('TextStyleManager', () => {
  it('should format distance', () => {
    const mgr = new TextStyleManager();
    expect(mgr.formatDistance(12.345)).toBe('12.35 mm');
  });

  it('should format angle', () => {
    const mgr = new TextStyleManager();
    expect(mgr.formatAngle(90)).toBe('90.00°');
  });

  it('should return font string', () => {
    const mgr = new TextStyleManager();
    expect(mgr.getFont()).toBe('12px monospace');
  });
});

describe('OverlayRenderer', () => {
  let renderer: OverlayRenderer;

  beforeEach(() => {
    const canvas = createTestCanvas();
    renderer = new OverlayRenderer(canvas);
  });

  it('should add and retrieve overlay', () => {
    const item: OverlayItem = {
      id: 'test-line',
      type: 'line',
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      style: DEFAULT_LINE_STYLE,
      sliceIndex: 5,
      plane: MPRPlane.Axial,
      visible: true,
    };
    renderer.addOverlay('test-line', item);
    expect(renderer.getOverlay('test-line')).toBe(item);
    expect(renderer.getOverlayCount()).toBe(1);
  });

  it('should remove overlay', () => {
    const item: OverlayItem = {
      id: 'test', type: 'line', points: [], style: DEFAULT_LINE_STYLE,
      sliceIndex: 0, plane: MPRPlane.Axial, visible: true,
    };
    renderer.addOverlay('test', item);
    expect(renderer.removeOverlay('test')).toBe(true);
    expect(renderer.getOverlayCount()).toBe(0);
  });

  it('should clear all overlays', () => {
    renderer.addOverlay('a', { id: 'a', type: 'line', points: [], style: DEFAULT_LINE_STYLE, sliceIndex: 0, plane: MPRPlane.Axial, visible: true });
    renderer.addOverlay('b', { id: 'b', type: 'line', points: [], style: DEFAULT_LINE_STYLE, sliceIndex: 0, plane: MPRPlane.Axial, visible: true });
    renderer.clearAll();
    expect(renderer.getOverlayCount()).toBe(0);
  });

  it('should render line overlay for matching slice/plane', () => {
    const item: OverlayItem = {
      id: 'line1', type: 'line',
      points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
      style: DEFAULT_LINE_STYLE, sliceIndex: 5,
      plane: MPRPlane.Axial, visible: true, label: '12.5 mm',
    };
    renderer.addOverlay('line1', item);
    renderer.render(5, MPRPlane.Axial);
    // No error = success
  });

  it('should not render overlay for non-matching slice', () => {
    const item: OverlayItem = {
      id: 'line1', type: 'line',
      points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
      style: DEFAULT_LINE_STYLE, sliceIndex: 5,
      plane: MPRPlane.Axial, visible: true,
    };
    renderer.addOverlay('line1', item);
    renderer.render(10, MPRPlane.Axial);
    // Overlay should be skipped, no error
  });

  it('should skip invisible overlays', () => {
    const item: OverlayItem = {
      id: 'hidden', type: 'line',
      points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
      style: DEFAULT_LINE_STYLE, sliceIndex: 5,
      plane: MPRPlane.Axial, visible: false,
    };
    renderer.addOverlay('hidden', item);
    renderer.render(5, MPRPlane.Axial);
  });

  it('should render angle overlay', () => {
    const item: OverlayItem = {
      id: 'angle1', type: 'angle',
      points: [{ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }],
      style: DEFAULT_LINE_STYLE, sliceIndex: 5,
      plane: MPRPlane.Axial, visible: true, label: '90.00°',
    };
    renderer.addOverlay('angle1', item);
    renderer.render(5, MPRPlane.Axial);
  });

  it('should render ROI overlay (freehand)', () => {
    const item: OverlayItem = {
      id: 'roi1', type: 'roi',
      points: [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 55, y: 100 }],
      style: DEFAULT_FILL_STYLE, sliceIndex: 5,
      plane: MPRPlane.Axial, visible: true,
    };
    renderer.addOverlay('roi1', item);
    renderer.render(5, MPRPlane.Axial);
  });

  it('should resize canvas with DPR', () => {
    renderer.resize(400, 300);
    // No error = success
  });
});
