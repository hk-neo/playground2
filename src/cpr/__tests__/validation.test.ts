import { describe, expect, it } from 'vitest';
import { normalizeExtractOptions, validateCurve, validateVolume } from '../validation';
import type { CprCurve, CprVolume } from '../types';

const signedVolume: CprVolume = {
  data: new Int16Array(8),
  dimensions: [2, 2, 2],
  spacing: [0.3, 0.3, 0.5],
};

const curve: CprCurve = {
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
  ],
  sample: (t) => ({ x: t, y: t, z: t }),
};

describe('validateVolume', () => {
  it('accepts a signed 16-bit volume', () => {
    expect(() => validateVolume(signedVolume)).not.toThrow();
  });

  it('accepts an unsigned 16-bit volume', () => {
    expect(() => validateVolume({
      ...signedVolume,
      data: new Uint16Array(8),
    })).not.toThrow();
  });

  it('rejects data whose length differs from the dimensions product', () => {
    expect(() => validateVolume({
      data: new Int16Array(7),
      dimensions: [2, 2, 2],
      spacing: [0.3, 0.3, 0.3],
    })).toThrow('Volume data length must equal dimensions product');
  });

  it('rejects non-positive spacing', () => {
    expect(() => validateVolume({
      ...signedVolume,
      spacing: [0.3, 0, 0.5],
    })).toThrow('Volume spacing values must be greater than zero');
  });
});

describe('validateCurve', () => {
  it('accepts a curve with two points', () => {
    expect(() => validateCurve(curve)).not.toThrow();
  });

  it('rejects a curve with fewer than two points', () => {
    expect(() => validateCurve({
      points: [{ x: 0, y: 0, z: 0 }],
      sample: () => ({ x: 0, y: 0, z: 0 }),
    })).toThrow('Curve must contain at least two points');
  });
});

describe('normalizeExtractOptions', () => {
  it('applies defaults including the full-volume depth range', () => {
    expect(normalizeExtractOptions(signedVolume)).toEqual({
      thickness: 20,
      pixelSize: 0.3,
      mode: 'mean',
      depthRangeMm: [0, 1],
    });
  });

  it('preserves valid explicit options', () => {
    expect(normalizeExtractOptions(signedVolume, {
      thickness: 15,
      pixelSize: 0.2,
      mode: 'max',
      depthRangeMm: [0.1, 0.9],
    })).toEqual({
      thickness: 15,
      pixelSize: 0.2,
      mode: 'max',
      depthRangeMm: [0.1, 0.9],
    });
  });

  it('rejects a non-positive pixel size', () => {
    expect(() => normalizeExtractOptions(signedVolume, { pixelSize: 0 }))
      .toThrow('Pixel size must be greater than zero');
  });

  it('rejects a negative thickness', () => {
    expect(() => normalizeExtractOptions(signedVolume, { thickness: -1 }))
      .toThrow('Thickness must be non-negative');
  });

  it('rejects a reversed depth range', () => {
    expect(() => normalizeExtractOptions(signedVolume, { depthRangeMm: [1, 0] }))
      .toThrow('Depth range minimum must not exceed maximum');
  });
});
