import type { Vec3 } from '../shared/types/core';
import type { IViewport } from '../shared/interfaces/sync';
import type { SyncState, SyncEvent } from '../shared/types/sync';
import { EventBus } from './event-bus';
import { SyncErrorHandler } from './sync-error-handler';

export class SyncController {
  private viewports = new Map<string, IViewport>();
  private syncState: SyncState = {
    enabled: true,
    lastSource: null,
    lastTimestamp: 0,
    pendingSync: null,
  };
  private isProcessing = false;
  private eventBus = new EventBus();
  private errorHandler = new SyncErrorHandler();

  registerViewport(id: string, viewport: IViewport): void {
    this.viewports.set(id, viewport);
  }

  unregisterViewport(id: string): void {
    this.viewports.delete(id);
  }

  getViewport(id: string): IViewport | undefined {
    return this.viewports.get(id);
  }

  syncFrom(source: string, position: Vec3): void {
    if (!this.syncState.enabled || this.isProcessing) return;

    this.isProcessing = true;
    this.syncState.lastSource = source;
    this.syncState.lastTimestamp = Date.now();

    try {
      for (const [id, viewport] of this.viewports) {
        if (id === source) continue;
        viewport.setPosition(position);
      }

      this.eventBus.publish('sync', {
        position,
        source,
      });

      this.eventBus.processQueue();
    } catch (e) {
      this.errorHandler.handleError({
        type: 'transform_failure',
        message: (e as Error).message,
        source,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  resolveConflict(sourceA: string, sourceB: string): string {
    return this.syncState.lastSource === sourceA ? sourceA : sourceB;
  }

  enableSync(): void {
    this.syncState.enabled = true;
  }

  disableSync(): void {
    this.syncState.enabled = false;
  }

  isSyncEnabled(): boolean {
    return this.syncState.enabled;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getErrorHandler(): SyncErrorHandler {
    return this.errorHandler;
  }

  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  getViewportCount(): number {
    return this.viewports.size;
  }
}
