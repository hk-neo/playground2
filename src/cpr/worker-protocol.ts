import type { PreparedCurve } from './curve-samples';
import type {
  CprBackend,
  CprVolume,
  NormalizedCprExtractOptions,
} from './types';

export interface CprWorkerInitRequest {
  readonly type: 'init';
  readonly id: number;
  readonly backend: CprBackend;
  readonly wasmUrl?: string | URL;
}

export interface CprWorkerSetVolumeRequest {
  readonly type: 'set-volume';
  readonly id: number;
  readonly volume: CprVolume;
}

export interface CprWorkerExtractRequest {
  readonly type: 'extract';
  readonly id: number;
  readonly curve: PreparedCurve;
  readonly options: NormalizedCprExtractOptions;
}

export interface CprWorkerDisposeRequest {
  readonly type: 'dispose';
  readonly id: number;
}

export type CprWorkerRequest =
  | CprWorkerInitRequest
  | CprWorkerSetVolumeRequest
  | CprWorkerExtractRequest
  | CprWorkerDisposeRequest;

export interface CprWorkerInitPayload {
  readonly backend: 'wasm' | 'cpu';
  readonly fallbackReason?: string;
}

export interface CprWorkerExtractPayload {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
}

export interface CprWorkerResultMessage {
  readonly type: 'result';
  readonly id: number;
  readonly init?: CprWorkerInitPayload;
  readonly extract?: CprWorkerExtractPayload;
}

export interface CprWorkerErrorMessage {
  readonly type: 'error';
  readonly id: number;
  readonly message: string;
}

export type CprWorkerResponse = CprWorkerResultMessage | CprWorkerErrorMessage;

export interface CprWorkerScope {
  postMessage(message: CprWorkerResponse, transfer?: Transferable[]): void;
}
