import { describe, expect, it } from 'vitest';
import { advanceCurveSegment, prepareCurveSamples } from '../curve-samples';
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

  it.each([1, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid sample count %s',
    (sampleCount) => {
      expect(() => prepareCurveSamples(curve, volume, sampleCount))
        .toThrow('Sample count must be a finite integer of at least 2');
    },
  );

  it('advances through expected segments and reaches the final segment', () => {
    const arcLengthMm = new Float32Array([0, 1, 3, 6]);
    let segmentIndex = 0;
    const progression = [0, 1.01, 3.01, 6].map((targetArcLengthMm) => {
      segmentIndex = advanceCurveSegment(arcLengthMm, targetArcLengthMm, segmentIndex);
      return segmentIndex;
    });

    expect(progression).toEqual([0, 1, 2, 2]);
    expect(advanceCurveSegment(arcLengthMm, 1, 2)).toBe(2);
  });
});
