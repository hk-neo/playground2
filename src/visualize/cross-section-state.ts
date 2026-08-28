import type { VolumeData } from '../shared/types/volume';

export interface CrossSectionPositions {
  axial: number;
  coronal: number;
  tangential: number;
}

export interface CrossSectionOverlayState extends CrossSectionPositions {
  windowLevel: number;
  windowWidth: number;
}

export function getCrossSectionOverlayState(
  volume: VolumeData,
  positions: CrossSectionPositions,
  windowLevel: number,
  windowWidth: number,
): CrossSectionOverlayState {
  const [dx, dy, dz] = volume.dimensions;
  return {
    axial: (positions.axial + 0.5) / dz,
    coronal: (positions.coronal + 0.5) / dy,
    tangential: (positions.tangential + 0.5) / dx,
    windowLevel,
    windowWidth,
  };
}
