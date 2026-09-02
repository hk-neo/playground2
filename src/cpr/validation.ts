import type {
  CprCurve,
  CprExtractOptions,
  CprVolume,
  NormalizedCprExtractOptions,
} from './types';

export function validateVolume(volume: CprVolume): void {
  if (volume.dimensions.some((value) => !Number.isFinite(value)
    || !Number.isInteger(value)
    || value <= 0)) {
    throw new Error('Volume dimensions must be positive finite integers');
  }

  const expectedLength = volume.dimensions[0] * volume.dimensions[1] * volume.dimensions[2];
  if (volume.data.length !== expectedLength) {
    throw new Error('Volume data length must equal dimensions product');
  }

  if (volume.spacing.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Volume spacing values must be positive finite numbers');
  }
}

export function validateCurve(curve: CprCurve): void {
  if (curve.points.length < 2) {
    throw new Error('Curve must contain at least two points');
  }
}

export function normalizeExtractOptions(
  volume: CprVolume,
  options: CprExtractOptions = {},
): NormalizedCprExtractOptions {
  const thickness = options.thickness ?? 20;
  const pixelSize = options.pixelSize ?? 0.3;
  const depthRangeMm = options.depthRangeMm
    ?? [0, volume.dimensions[2] * volume.spacing[2]] as const;

  if (!Number.isFinite(pixelSize) || pixelSize <= 0) {
    throw new Error('Pixel size must be a positive finite number');
  }
  if (!Number.isFinite(thickness) || thickness < 0) {
    throw new Error('Thickness must be a non-negative finite number');
  }
  if (depthRangeMm.some((value) => !Number.isFinite(value))) {
    throw new Error('Depth range endpoints must be finite numbers');
  }
  if (depthRangeMm[0] > depthRangeMm[1]) {
    throw new Error('Depth range minimum must not exceed maximum');
  }

  return {
    thickness,
    pixelSize,
    mode: options.mode ?? 'mean',
    depthRangeMm,
  };
}
