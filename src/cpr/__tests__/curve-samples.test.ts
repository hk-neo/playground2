import { describe, expect, it } from 'vitest';
import { prepareCurveSamples } from '../curve-samples';
import type { CprCurve, CprVolume } from '../types';

const volume: CprVolume = {
  data: new Int16Array(1),
  dimensions: [1, 1, 1],
  spacing: [0.2, 0.4, 1],
};

const curve: CprCurve = {
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 3, y: 4, z: 0 },
  ],
  sample: (t) => ({ x: 3 * t, y: 4 * t, z: 0 }),
};

describe('prepareCurveSamples', () => {
  it('packs the requested curve samples into Float32Arrays', () => {
    const prepared = prepareCurveSamples(curve, volume, 512);

    expect(prepared.x).toBeInstanceOf(Float32Array);
    expect(prepared.y).toBeInstanceOf(Float32Array);
    expect(prepared.arcLengthMm).toBeInstanceOf(Float32Array);
    expect(prepared.x).toHaveLength(512);
    expect(prepared.y).toHaveLength(512);
    expect(prepared.arcLengthMm).toHaveLength(512);
    expect(prepared.x[0]).toBe(0);
    expect(prepared.y[0]).toBe(0);
    expect(prepared.x[511]).toBe(3);
    expect(prepared.y[511]).toBe(4);
  });

  it('accumulates physical x/y distance from zero', () => {
    const prepared = prepareCurveSamples(curve, volume, 512);
    const expectedLengthMm = Math.sqrt((3 * 0.2) ** 2 + (4 * 0.4) ** 2);

    expect(prepared.arcLengthMm[0]).toBe(0);
    expect(prepared.arcLengthMm[256]).toBeCloseTo(expectedLengthMm * 256 / 511, 5);
    expect(prepared.arcLengthMm[511]).toBeCloseTo(expectedLengthMm, 5);
    expect(prepared.totalArcLengthMm).toBeCloseTo(expectedLengthMm, 5);
  });

  it('supports monotonically advancing segment lookup', () => {
    const prepared = prepareCurveSamples(curve, volume, 512);
    let segmentIndex = 0;
    let previousSegmentIndex = 0;

    for (let column = 0; column < 128; column++) {
      const arcLengthMm = column * prepared.totalArcLengthMm / 128;
      while (
        segmentIndex < prepared.arcLengthMm.length - 1
        && prepared.arcLengthMm[segmentIndex + 1] < arcLengthMm
      ) {
        segmentIndex++;
      }

      expect(segmentIndex).toBeGreaterThanOrEqual(previousSegmentIndex);
      previousSegmentIndex = segmentIndex;
    }
  });
});
