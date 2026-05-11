import type { AppState, StateSubscriber } from '../shared/types/app';
import type { CameraState } from '../shared/types/camera';
import type { PatientInfo } from '../shared/types/patient';

function createInitialState(): AppState {
  return {
    volumeLoaded: false,
    activeTool: null,
    wlww: { level: 500, width: 2500 },
    slicePositions: { axial: 0, coronal: 0, sagittal: 0 },
    cameraState: { target: { x: 0, y: 0, z: 0 }, distance: 2.5, quaternion: { x: 0, y: 0, z: 0, w: 1 }, fov: Math.PI / 4 } as CameraState,
    patientInfo: null as unknown as PatientInfo,
    syncEnabled: true,
    uiLayout: { viewports: [], panels: [], totalWidth: 0, totalHeight: 0 },
  };
}

export class StateManager {
  private state: AppState;
  private subscribers = new Map<string, StateSubscriber[]>();
  private history: AppState[] = [];
  private maxHistory = 50;

  constructor() {
    this.state = createInitialState();
  }

  getState(): AppState {
    return this.state;
  }

  setState(partial: Partial<AppState>): void {
    const prev = { ...this.state };
    this.history.push(prev);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    this.state = { ...this.state, ...partial };

    // Notify subscribers for changed keys
    const changedKeys = Object.keys(partial);
    for (const key of changedKeys) {
      const subs = this.subscribers.get(key);
      if (subs) {
        for (const cb of subs) {
          cb(this.state, key);
        }
      }
    }

    // Also notify wildcard subscribers
    const wildcardSubs = this.subscribers.get('*');
    if (wildcardSubs) {
      for (const cb of wildcardSubs) {
        cb(this.state, '*');
      }
    }
  }

  subscribe(key: string, callback: StateSubscriber): void {
    const list = this.subscribers.get(key) || [];
    list.push(callback);
    this.subscribers.set(key, list);
  }

  unsubscribe(key: string, callback: StateSubscriber): void {
    const list = this.subscribers.get(key);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx >= 0) list.splice(idx, 1);
  }

  resetState(): void {
    this.state = createInitialState();
    const allSubs = this.subscribers.get('*');
    if (allSubs) {
      for (const cb of allSubs) {
        cb(this.state, '*');
      }
    }
  }

  getHistoryLength(): number {
    return this.history.length;
  }

  getSubscriberCount(key: string): number {
    return this.subscribers.get(key)?.length ?? 0;
  }
}
