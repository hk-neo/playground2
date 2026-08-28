import type { Vec3 } from '../shared/types/core';
import type { VolumeData } from '../shared/types/volume';

export type ViewerCameraAction = 'rotate' | 'zoom' | 'pan';

export function resolveViewerCameraAction(
  button: number,
  _shiftKey = false,
): { type: ViewerCameraAction } | null {
  if (button === 0) return { type: 'rotate' };
  if (button === 1) return { type: 'zoom' };
  if (button === 2) return { type: 'pan' };
  return null;
}

export function getVolumeCameraTarget(): Vec3 {
  return { x: 0, y: 0, z: 0 };
}

export function getVolumeModelScale(volume: VolumeData): [number, number, number] {
  const [dx, dy, dz] = volume.dimensions;
  const maxDimension = Math.max(dx, dy, dz);
  return [dx / maxDimension, dy / maxDimension, dz / maxDimension];
}
