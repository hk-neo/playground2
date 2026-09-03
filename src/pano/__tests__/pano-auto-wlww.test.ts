import { describe, it, expect } from 'vitest';
import { computeAutoWLWW } from '../pano-auto-wlww';

describe('computeAutoWLWW', () => {
  it('returns safe defaults for empty data', () => {
    const result = computeAutoWLWW(new Float32Array(0));
    expect(result.wl).toBe(400);
    expect(result.ww).toBe(1500);
    expect(result.pLow).toBe(0);
    expect(result.pHigh).toBe(0);
  });

  it('handles uniform data — wl = value, ww = minWindowWidth', () => {
    const data = new Float32Array(1000);
    data.fill(500);
    const result = computeAutoWLWW(data);
    expect(result.wl).toBe(500);
    expect(result.ww).toBe(1); // minWindowWidth default
  });

  it('computes correct percentiles for linear ramp [0..999]', () => {
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = i;
    const result = computeAutoWLWW(data);
    // p2 = value at index floor(1000 * 2 / 100) = 20
    expect(result.pLow).toBe(20);
    // p98 = value at index floor(1000 * 98 / 100) = 980
    expect(result.pHigh).toBe(980);
    expect(result.wl).toBe((20 + 980) / 2); // 500
    expect(result.ww).toBe(980 - 20); // 960
  });

  it('handles bimodal distribution (bone + air)', () => {
    const data = new Float32Array(1000);
    for (let i = 0; i < 500; i++) data[i] = -1000; // air
    for (let i = 500; i < 1000; i++) data[i] = 800; // bone
    const result = computeAutoWLWW(data);
    // p2 at index 20 → -1000 (in the air half)
    expect(result.pLow).toBe(-1000);
    // p98 at index 980 → 800 (in the bone half)
    expect(result.pHigh).toBe(800);
    expect(result.wl).toBe((-1000 + 800) / 2); // -100
    expect(result.ww).toBe(800 - (-1000)); // 1800
  });

  it('ignores outliers via percentile', () => {
    const data = new Float32Array(1000);
    for (let i = 0; i < 999; i++) data[i] = 500;
    data[999] = 50000; // single extreme outlier
    const result = computeAutoWLWW(data);
    // p2 at index 20 → 500, p98 at index 980 → 500
    expect(result.pLow).toBe(500);
    expect(result.pHigh).toBe(500);
    expect(result.wl).toBe(500);
    expect(result.ww).toBe(1); // clamped to minWindowWidth
  });

  it('filters out NaN and Infinity', () => {
    const data = new Float32Array([100, NaN, 200, Infinity, 300, -Infinity, 400]);
    const result = computeAutoWLWW(data);
    // Valid: [100, 200, 300, 400] → 4 elements
    // p2 at index floor(4*2/100)=0 → 100
    // p98 at index floor(4*98/100)=3 → 400
    expect(result.pLow).toBe(100);
    expect(result.pHigh).toBe(400);
    expect(result.wl).toBe((100 + 400) / 2); // 250
    expect(result.ww).toBe(300);
  });

  it('respects custom percentile options', () => {
    const data = new Float32Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;
    const result = computeAutoWLWW(data, { lowerPercentile: 10, upperPercentile: 90 });
    // p10 at index 10 → 10
    expect(result.pLow).toBe(10);
    // p90 at index 90 → 90
    expect(result.pHigh).toBe(90);
    expect(result.wl).toBe(50);
    expect(result.ww).toBe(80);
  });

  it('handles negative HU values (air)', () => {
    const data = new Float32Array([-1000, -500, 0, 500, 1000]);
    const result = computeAutoWLWW(data);
    // 5 elements: p2 at index floor(5*2/100)=0 → -1000
    // p98 at index floor(5*98/100)=4 → 1000
    expect(result.pLow).toBe(-1000);
    expect(result.pHigh).toBe(1000);
    expect(result.wl).toBe(0);
    expect(result.ww).toBe(2000);
  });

  it('performs well on large arrays (100K elements)', () => {
    const data = new Float32Array(100_000);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 3000 - 1000;
    const start = performance.now();
    const result = computeAutoWLWW(data);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(result.ww).toBeGreaterThan(0);
    expect(result.wl).toBeGreaterThan(-1500);
    expect(result.wl).toBeLessThan(2500);
  });

  it('does not mutate the input array', () => {
    const data = new Float32Array([300, 100, 500, 200, 400]);
    const copy = new Float32Array(data);
    computeAutoWLWW(data);
    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(copy[i]);
    }
  });
});
