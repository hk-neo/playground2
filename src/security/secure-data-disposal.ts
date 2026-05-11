import { DataDisposalError } from '../shared/errors/security';

export class SecureDataDisposal {
  private scheduledBuffers: ArrayBuffer[] = [];
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  secureDelete(buffer: ArrayBuffer): void {
    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i++) {
      view[i] = 0;
    }
  }

  clearMemoryRegion(buffer: ArrayBuffer, start: number, length: number): void {
    const view = new Uint8Array(buffer);
    const end = Math.min(start + length, view.length);
    for (let i = start; i < end; i++) {
      view[i] = 0;
    }
  }

  wipeSessionData(sessionId: string): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(sessionId);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(sessionId);
      }
    } catch {
      throw new DataDisposalError(`Failed to wipe session data for ${sessionId}`);
    }
  }

  scheduleDisposal(buffer: ArrayBuffer): void {
    this.scheduledBuffers.push(buffer);
    if (!this.cleanupTimer) {
      this.scheduleAutoCleanup();
    }
  }

  scheduleAutoCleanup(): void {
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);

    this.cleanupTimer = setTimeout(() => {
      this.flushScheduled();
    }, 5000);
  }

  flushScheduled(): void {
    for (const buf of this.scheduledBuffers) {
      try {
        this.secureDelete(buf);
      } catch {
        // Buffer may have been detached
      }
    }
    this.scheduledBuffers = [];
    this.cleanupTimer = null;
  }

  getScheduledCount(): number {
    return this.scheduledBuffers.length;
  }
}
