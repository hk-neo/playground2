import type { CprCurve, CprVolume } from './types';

export interface PreparedCurve {
  x: Float32Array;
  y: Float32Array;
  arcLengthMm: Float32Array;
  totalArcLengthMm: number;
}

export function advanceCurveSegment(
  arcLengthMm: Float32Array,
  targetArcLengthMm: number,
  segmentIndex: number,
): number {
  const finalSegmentIndex = arcLengthMm.length - 2;
  while (
    segmentIndex < finalSegmentIndex
    && arcLengthMm[segmentIndex + 1] < targetArcLengthMm
  ) {
    segmentIndex++;
  }
  return segmentIndex;
}

export function prepareCurveSamples(
  curve: CprCurve,
  volume: CprVolume,
  sampleCount: number,
): PreparedCurve {
  if (!Number.isFinite(sampleCount) || !Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new Error('Sample count must be a finite integer of at least 2');
  }

  const x = new Float32Array(sampleCount);
  const y = new Float32Array(sampleCount);
  const arcLengthMm = new Float32Array(sampleCount);
  const [spacingX, spacingY] = volume.spacing;

  for (let index = 0; index < sampleCount; index++) {
    const point = curve.sample(index / (sampleCount - 1));
    x[index] = point.x;
    y[index] = point.y;

    if (index > 0) {
      const deltaX = (x[index] - x[index - 1]) * spacingX;
      const deltaY = (y[index] - y[index - 1]) * spacingY;
      arcLengthMm[index] = arcLengthMm[index - 1] + Math.sqrt(deltaX ** 2 + deltaY ** 2);
    }
  }

  return {
    x,
    y,
    arcLengthMm,
    totalArcLengthMm: arcLengthMm[sampleCount - 1],
  };
}
