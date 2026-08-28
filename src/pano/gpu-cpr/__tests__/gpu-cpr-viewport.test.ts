import { describe, it, expect } from 'vitest';
import { GpuCprViewport, supportsGpuCpr } from '../gpu-cpr-viewport';

/**
 * Tests for the viewport *class shape*. The actual WebGL rendering is not
 * exercised here (jsdom has no WebGL2). These verify:
 *   - supportsGpuCpr() returns a boolean in jsdom (no crash)
 *   - GpuCprViewport constructor accepts options without touching WebGL
 *   - Setting methods (setWLWW/setProjection/setSliceU/setFocalThickness) don't crash pre-init
 */

function makeContainer(): HTMLElement {
  const div = document.createElement('div');
  div.style.width = '100px';
  div.style.height = '50px';
  document.body.appendChild(div);
  return div;
}

describe('GpuCprViewport (jsdom surface)', () => {
  it('supportsGpuCpr() returns boolean', () => {
    expect(typeof supportsGpuCpr()).toBe('boolean');
  });

  it('can construct without initialising', () => {
    const c = makeContainer();
    const v = new GpuCprViewport(c, { sampleCount: 64 });
    expect(v).toBeDefined();
    expect(v.enabled).toBe(false);
    c.remove();
  });

  it('accepts state changes without init()', () => {
    const c = makeContainer();
    const v = new GpuCprViewport(c);
    // Should be safe no-ops:
    v.setWLWW(50, 400);
    v.setProjection('mean');
    v.setSliceU(0.3);
    v.setFocalThickness(120);
    expect(v.enabled).toBe(false);
    c.remove();
  });

  it('init() returns false in jsdom (no WebGL2)', () => {
    const c = makeContainer();
    const v = new GpuCprViewport(c);
    const ok = v.init();
    expect(ok).toBe(false); // jsdom has no WebGL2
    expect(v.enabled).toBe(false);
    c.remove();
  });
});
