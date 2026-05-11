import type { CameraState } from '../shared/types/camera';
import type { OrbitalCamera } from './orbital-camera';

export class CameraStateStore {
  private store = new Map<string, CameraState>();

  saveState(name: string, camera: OrbitalCamera): void {
    this.store.set(name, {
      target: { ...camera.target },
      distance: camera.distance,
      quaternion: camera.quaternion.clone(),
      fov: camera.fov,
    });
  }

  restoreState(name: string): CameraState | null {
    const state = this.store.get(name);
    if (!state) return null;
    return {
      target: { ...state.target },
      distance: state.distance,
      quaternion: { ...state.quaternion },
      fov: state.fov,
    };
  }

  hasState(name: string): boolean {
    return this.store.has(name);
  }

  deleteState(name: string): boolean {
    return this.store.delete(name);
  }

  clear(): void {
    this.store.clear();
  }
}
