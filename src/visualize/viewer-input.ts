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
  // 모델 좌표를 mm 기준으로 표시. 각 축 모델 박스 반폭(mm) = dimensions[i]*spacing[i]/2.
  const [dx, dy, dz] = volume.dimensions;
  const sp = volume.spacing;
  return [
    (dx * (sp[0] || 1)) / 2,
    (dy * (sp[1] || 1)) / 2,
    (dz * (sp[2] || 1)) / 2,
  ];
}
