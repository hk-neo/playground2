import { describe, it, expect, beforeEach } from 'vitest';
import { PanoView } from '../pano-view';
import { PanoRenderer } from '../pano-renderer';

describe('PanoRenderer', () => {
  let renderer: PanoRenderer;
  beforeEach(() => {
    renderer = new PanoRenderer();
  });

  it('produces IntensityBytes of width*height', () => {
    const data = new Float32Array(10 * 5);
    data.fill(100);
    const out = renderer.toIntensityBytes(data, 10, 5, 0, 100);
    expect(out.width).toBe(10);
    expect(out.height).toBe(5);
    expect(out.data.length).toBe(10 * 5 * 4);
  });

  it('applies WL/WW windowing (constant input → uniform gray)', () => {
    // WL=100, WW=200: 100 HU → center of window → gray 128
    const data = new Float32Array(20);
    data.fill(100);
    const out = renderer.toIntensityBytes(data, 20, 1, 100, 200);
    for (let i = 0; i < 20; i++) {
      expect(out.data[i * 4]).toBe(128);
      expect(out.data[i * 4 + 1]).toBe(128);
      expect(out.data[i * 4 + 2]).toBe(128);
      expect(out.data[i * 4 + 3]).toBe(255);
    }
  });

  it('clamps low values to 0 and high values to 255', () => {
    const data = new Float32Array([0, 50, 100, 200, 500, 1000]);
    const out = renderer.toIntensityBytes(data, 6, 1, 100, 200);
    // WL=100, WW=200 → range [0, 200]
    // 0 → 0, 50 → 64 (1/4 of WW), 100 → 128 (center), 200 → 255, 500 → 255, 1000 → 255
    expect(out.data[0]).toBe(0);     // x=0
    expect(out.data[4]).toBe(64);    // x=50 (1/4 of WW=200 → 64)
    expect(out.data[8]).toBe(128);   // x=100
    expect(out.data[12]).toBe(255);  // x=200
    expect(out.data[16]).toBe(255);  // x=500
    expect(out.data[20]).toBe(255);  // x=1000
  });

  it('alpha is always 255', () => {
    const data = new Float32Array(5);
    data.fill(50);
    const out = renderer.toIntensityBytes(data, 5, 1, 100, 200);
    for (let i = 0; i < 5; i++) {
      expect(out.data[i * 4 + 3]).toBe(255);
    }
  });
});

describe('PanoView', () => {
  let view: PanoView;
  beforeEach(() => {
    view = new PanoView();
  });

  it('starts with default WL/WW (CBCT)', () => {
    const wlww = view.getWLWW();
    expect(wlww.wl).toBeGreaterThanOrEqual(-2000);
    expect(wlww.ww).toBeGreaterThan(0);
  });

  it('setWLWW updates WL/WW', () => {
    view.setWLWW(500, 2500);
    expect(view.getWLWW()).toEqual({ wl: 500, ww: 2500 });
  });

  it('setZoomPan updates zoom/pan', () => {
    view.setZoomPan(2, 10, 20);
    expect(view.getZoomPan()).toEqual({ zoom: 2, panX: 10, panY: 20 });
  });

  it('setIntensityMap stores data', () => {
    const data = new Float32Array(50);
    data.fill(100);
    view.setIntensityMap(data, 10, 5);
    expect(view.getDataSize()).toEqual({ width: 10, height: 5 });
  });

  it('resetView restores defaults', () => {
    view.setWLWW(0, 1);
    view.setZoomPan(5, 100, 100);
    view.resetView();
    expect(view.getZoomPan().zoom).toBe(1);
    expect(view.getZoomPan().panX).toBe(0);
    expect(view.getZoomPan().panY).toBe(0);
  });

  it('render() requires a 2D context (throws in jsdom without canvas)', () => {
    // jsdom에는 getContext('2d')가 null을 반환 → 정상적으로 throw.
    // 브라우저 환경에서는 canvas 패키지 또는 진짜 브라우저에서만 not.toThrow.
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 10;
    view.setIntensityMap(new Float32Array(20 * 10).fill(100), 20, 10);
    if (canvas.getContext('2d') === null) {
      expect(() => view.render(canvas)).toThrow(/context/);
    } else {
      expect(() => view.render(canvas)).not.toThrow();
    }
  });
});
