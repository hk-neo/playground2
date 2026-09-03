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

function getErrorMessage(action: () => void): string {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  throw new Error('Expected action to throw');
}

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
    const message = getErrorMessage(() => validateVolume({
      data: new Int16Array(7),
      dimensions: [2, 2, 2],
      spacing: [0.3, 0.3, 0.3],
    }));

    expect(message).toBe('Volume data length must equal dimensions product');
  });

  it.each([
    { dimensions: [0, 2, 2] as const, dataLength: 0 },
    { dimensions: [-2, -2, 2] as const, dataLength: 8 },
    { dimensions: [1.5, 2, 2] as const, dataLength: 6 },
    { dimensions: [Number.NaN, 2, 2] as const, dataLength: 0 },
    { dimensions: [Number.POSITIVE_INFINITY, 2, 2] as const, dataLength: 0 },
  ])('rejects invalid dimensions $dimensions', ({ dimensions, dataLength }) => {
    const message = getErrorMessage(() => validateVolume({
      data: new Int16Array(dataLength),
      dimensions,
      spacing: [0.3, 0.3, 0.5],
    }));

    expect(message).toBe('Volume dimensions must be positive finite integers');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-positive or non-finite spacing %s',
    (spacing) => {
      const message = getErrorMessage(() => validateVolume({
        ...signedVolume,
        spacing: [0.3, spacing, 0.5],
      }));

      expect(message).toBe('Volume spacing values must be positive finite numbers');
    },
  );
});

describe('validateCurve', () => {
  it('accepts a curve with two points', () => {
    expect(() => validateCurve(curve)).not.toThrow();
  });

  it('rejects a curve with fewer than two points', () => {
    const message = getErrorMessage(() => validateCurve({
      points: [{ x: 0, y: 0, z: 0 }],
      sample: () => ({ x: 0, y: 0, z: 0 }),
    }));

    expect(message).toBe('Curve must contain at least two points');
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

  it.each([0.04, 0.01, 0.001])(
    'clamps pixel size %s below the 0.05 mm backend-parity floor',
    (pixelSize) => {
      expect(normalizeExtractOptions(signedVolume, { pixelSize }).pixelSize).toBe(0.05);
    },
  );

  it('keeps pixel sizes at or above the 0.05 mm floor unchanged', () => {
    expect(normalizeExtractOptions(signedVolume, { pixelSize: 0.05 }).pixelSize).toBe(0.05);
    expect(normalizeExtractOptions(signedVolume, { pixelSize: 0.3 }).pixelSize).toBe(0.3);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-positive or non-finite pixel size %s',
    (pixelSize) => {
      const message = getErrorMessage(() => normalizeExtractOptions(signedVolume, { pixelSize }));

      expect(message).toBe('Pixel size must be a positive finite number');
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects negative or non-finite thickness %s',
    (thickness) => {
      const message = getErrorMessage(() => normalizeExtractOptions(signedVolume, { thickness }));

      expect(message).toBe('Thickness must be a non-negative finite number');
    },
  );

  it.each([
    [Number.NaN, 1],
    [0, Number.NaN],
    [Number.NEGATIVE_INFINITY, 1],
    [0, Number.POSITIVE_INFINITY],
  ] as const)('rejects non-finite depth range [%s, %s]', (minimum, maximum) => {
    const message = getErrorMessage(() => normalizeExtractOptions(signedVolume, {
      depthRangeMm: [minimum, maximum],
    }));

    expect(message).toBe('Depth range endpoints must be finite numbers');
  });

  it('rejects a reversed depth range', () => {
    const message = getErrorMessage(() => normalizeExtractOptions(
      signedVolume,
      { depthRangeMm: [1, 0] },
    ));

    expect(message).toBe('Depth range minimum must not exceed maximum');
  });
});
