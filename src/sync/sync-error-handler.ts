import type { SyncError } from '../shared/types/sync';

export class SyncErrorHandler {
  private errors: SyncError[] = [];

  handleError(error: SyncError): void {
    this.errors.push(error);
    this.logError(error);
  }

  notifyUser(message: string): void {
    console.warn(`[Sync] ${message}`);
  }

  logError(error: SyncError): void {
    console.error(`[SyncError] ${error.type}: ${error.message} (source: ${error.source})`);
  }

  getErrors(): SyncError[] {
    return [...this.errors];
  }

  getLastError(): SyncError | null {
    return this.errors.length > 0 ? this.errors[this.errors.length - 1] : null;
  }

  clearErrors(): void {
    this.errors = [];
  }
}
