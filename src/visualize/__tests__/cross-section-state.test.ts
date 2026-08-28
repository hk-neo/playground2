import { describe, expect, it } from 'vitest';
import { getCrossSectionOverlayState } from '../cross-section-state';
import type { VolumeData } from '../../shared/types/volume';

const volume: VolumeData = {
  buffer: new ArrayBuffer(24),
  dimensions: [4, 8, 16],
  spacing: [1, 1, 1],
  origin: [0, 0, 0],
  dataType: 'int16',
};

describe('cross-section overlay state', () => {
  it('converts each current slice to normalized volume coordinates', () => {
    expect(getCrossSectionOverlayState(volume, { axial: 7, coronal: 3, tangential: 1 }, 500, 2500)).toEqual({
      axial: (7 + 0.5) / 16,
      coronal: (3 + 0.5) / 8,
      tangential: (1 + 0.5) / 4,
      windowLevel: 500,
      windowWidth: 2500,
    });
  });
});
