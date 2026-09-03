import type { CprBackendResult } from './cpu-backend';
import { prepareCurveSamples, type PreparedCurve } from './curve-samples';
import type { CprBackendImpl } from './engine';
import type {
  CprBackend,
  CprCurve,
  CprVolume,
  CprVolumePolicy,
  CprWorkerFactory,
  CprWorkerTransport,
  NormalizedCprExtractOptions,
  SetVolumeOptions,
} from './types';
import type {
  CprWorkerInitPayload,
  CprWorkerRequest,
  CprWorkerResponse,
  CprWorkerResultMessage,
} from './worker-protocol';

const workerCurveSampleCount = 512;

export class CprRequestSupersededError extends Error {
  constructor(readonly requestId: number) {
    super(`CPR request ${requestId} was superseded by a newer request`);
    this.name = 'CprRequestSupersededError';
  }
}

export interface WorkerCprBackendOptions {
  readonly backend: CprBackend;
  readonly volumePolicy: CprVolumePolicy;
  readonly wasmUrl?: string | URL;
  readonly workerFactory?: CprWorkerFactory;
}

export interface WorkerCprBackendHandle {
  readonly impl: CprBackendImpl;
  readonly backend: 'wasm' | 'cpu';
  readonly fallbackReason?: string;
}

interface PendingRequest {
  resolve(message: CprWorkerResultMessage): void;
  reject(error: Error): void;
}

function createDefaultCprWorker(): CprWorkerTransport {
  const worker = new Worker(new URL('./cpr-worker.ts', import.meta.url), { type: 'module' });
  return {
    postMessage(message, transfer) {
      if (transfer) {
        worker.postMessage(message, transfer);
      } else {
        worker.postMessage(message);
      }
    },
    set onmessage(handler) {
      worker.onmessage = handler;
    },
    get onmessage() {
      return worker.onmessage;
    },
    set onerror(handler) {
      worker.onerror = handler;
    },
    get onerror() {
      return worker.onerror;
    },
    terminate() {
      worker.terminate();
    },
  };
}

class WorkerCprBackendSession implements CprBackendImpl {
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private pendingExtractId?: number;
  private volume?: CprVolume;
  private disposed = false;
  private errored = false;

  constructor(
    private readonly worker: CprWorkerTransport,
    private readonly volumePolicy: CprVolumePolicy,
  ) {
    this.worker.onmessage = (event) => {
      this.handleResponse(event.data as CprWorkerResponse);
    };
    this.worker.onerror = (event) => {
      this.handleWorkerFailure(event);
    };
  }

  init(backend: CprBackend, wasmUrl?: string | URL): Promise<CprWorkerInitPayload> {
    const id = this.nextRequestId++;
    const promise = new Promise<CprWorkerInitPayload>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (message) => {
          if (!message.init) {
            reject(new Error('CPR worker init returned no backend selection'));
            return;
          }
          resolve(message.init);
        },
        reject,
      });
    });
    this.post(id, { type: 'init', id, backend, wasmUrl });
    return promise;
  }

  async setVolume(volume: CprVolume, setVolumeOptions?: SetVolumeOptions): Promise<void> {
    if (this.disposed) {
      throw new Error('CPR worker backend is disposed');
    }
    if (this.errored) {
      throw new Error('CPR worker backend is unusable after a worker failure');
    }
    const policy = setVolumeOptions?.volumePolicy ?? this.volumePolicy;
    const id = this.nextRequestId++;
    const payloadVolume = policy === 'transfer'
      ? volume
      : { ...volume, data: volume.data.slice() };
    const transfer = policy === 'transfer'
      ? [volume.data.buffer as ArrayBuffer]
      : undefined;

    const promise = new Promise<void>((resolve, reject) => {
      this.pending.set(id, { resolve: () => resolve(), reject });
    });
    this.post(id, { type: 'set-volume', id, volume: payloadVolume }, transfer);
    this.volume = volume;
    return promise;
  }

  async extract(
    curve: CprCurve,
    options: NormalizedCprExtractOptions,
  ): Promise<CprBackendResult> {
    if (this.disposed) {
      throw new Error('CPR worker backend is disposed');
    }
    if (this.errored) {
      throw new Error('CPR worker backend is unusable after a worker failure');
    }
    if (!this.volume) {
      throw new Error('CPR worker backend requires a volume before extraction');
    }
    const prepared = prepareCurveSamples(curve, this.volume, workerCurveSampleCount);
    const id = this.nextRequestId++;
    this.supersedePendingExtract();

    const promise = new Promise<CprBackendResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (message) => {
          if (!message.extract) {
            reject(new Error('CPR worker extract returned no result payload'));
            return;
          }
          resolve(message.extract);
        },
        reject,
      });
    });
    this.pendingExtractId = id;
    try {
      this.worker.postMessage(
        { type: 'extract', id, curve: prepared, options },
        [
          prepared.x.buffer as ArrayBuffer,
          prepared.y.buffer as ArrayBuffer,
          prepared.arcLengthMm.buffer as ArrayBuffer,
        ],
      );
    } catch (error) {
      this.pending.delete(id);
      if (this.pendingExtractId === id) {
        this.pendingExtractId = undefined;
      }
      throw error;
    }
    return promise;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    try {
      this.worker.postMessage({ type: 'dispose', id: this.nextRequestId++ });
    } catch {
      // The worker may already be unreachable; termination below still frees it.
    }
    for (const request of this.pending.values()) {
      request.reject(new Error('CPR engine is disposed'));
    }
    this.pending.clear();
    this.pendingExtractId = undefined;
    this.volume = undefined;
    this.worker.terminate();
  }

  private post(id: number, message: CprWorkerRequest, transfer?: Transferable[]): void {
    try {
      this.worker.postMessage(message, transfer);
    } catch (error) {
      this.pending.delete(id);
      throw error;
    }
  }

  private supersedePendingExtract(): void {
    if (this.pendingExtractId === undefined) {
      return;
    }
    const supersededId = this.pendingExtractId;
    this.pendingExtractId = undefined;
    const prior = this.pending.get(supersededId);
    if (prior) {
      this.pending.delete(supersededId);
      prior.reject(new CprRequestSupersededError(supersededId));
    }
  }

  private handleResponse(message: CprWorkerResponse): void {
    if (this.disposed) {
      return;
    }
    const request = this.pending.get(message.id);
    if (!request) {
      return;
    }
    this.pending.delete(message.id);
    if (this.pendingExtractId === message.id) {
      this.pendingExtractId = undefined;
    }
    if (message.type === 'error') {
      request.reject(new Error(message.message));
      return;
    }
    request.resolve(message);
  }

  private handleWorkerFailure(event: ErrorEvent): void {
    if (this.disposed) {
      return;
    }
    this.errored = true;
    const detail = typeof event?.message === 'string' && event.message.length > 0
      ? event.message
      : 'worker script failed to load or crashed';
    const error = new Error(`CPR worker error: ${detail}`);
    for (const request of this.pending.values()) {
      request.reject(error);
    }
    this.pending.clear();
    this.pendingExtractId = undefined;
  }
}

export async function createWorkerCprBackend(
  options: WorkerCprBackendOptions,
): Promise<WorkerCprBackendHandle> {
  const worker = (options.workerFactory ?? createDefaultCprWorker)();
  const session = new WorkerCprBackendSession(worker, options.volumePolicy);
  try {
    const init = await session.init(options.backend, options.wasmUrl);
    return { impl: session, backend: init.backend, fallbackReason: init.fallbackReason };
  } catch (error) {
    session.dispose();
    throw error;
  }
}
