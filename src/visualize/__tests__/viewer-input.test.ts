import { describe, expect, it } from 'vitest';
import { getVolumeCameraTarget, getVolumeModelScale, resolveViewerCameraAction } from '../viewer-input';
import type { VolumeData } from '../../shared/types/volume';

describe('viewer input', () => {
  const volume: VolumeData = {
    buffer: new ArrayBuffer(24),
    dimensions: [1, 2, 3],
    spacing: [2, 3, 4],
    origin: [0, 0, 0],
    dataType: 'int16',
  };

  it('maps controls to the OrbitControls convention', () => {
    expect(resolveViewerCameraAction(0, false)).toEqual({ type: 'rotate' });
    expect(resolveViewerCameraAction(1, false)).toEqual({ type: 'zoom' });
    expect(resolveViewerCameraAction(2, false)).toEqual({ type: 'pan' });
  });

  it('keeps the orbit target at the normalized volume-box center', () => {
    expect(getVolumeCameraTarget()).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('uses the voxel-grid ratio for the 3D box scale', () => {
    expect(getVolumeModelScale(volume)).toEqual([1 / 3, 2 / 3, 1]);
  });
});
