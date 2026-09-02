export type CprBackend = 'auto' | 'wasm' | 'cpu';
export type CprExecution = 'main' | 'worker';
export type CprMode = 'sum' | 'mean' | 'min' | 'max';
export type CprVolumePolicy = 'copy' | 'transfer';

export interface CprPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CprVolume {
  readonly data: Int16Array | Uint16Array;
  readonly dimensions: readonly [number, number, number];
  readonly spacing: readonly [number, number, number];
}

export interface CprCurve {
  readonly points: ReadonlyArray<CprPoint>;
  sample(t: number): CprPoint;
}

export interface CprExtractOptions {
  readonly thickness?: number;
  readonly pixelSize?: number;
  readonly mode?: CprMode;
  readonly depthRangeMm?: readonly [number, number];
}

export interface NormalizedCprExtractOptions {
  readonly thickness: number;
  readonly pixelSize: number;
  readonly mode: CprMode;
  readonly depthRangeMm: readonly [number, number];
}

export interface CprResult {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly backend: 'wasm' | 'cpu';
  readonly elapsedMs: number;
}

export interface CprEngineOptions {
  readonly backend?: CprBackend;
  readonly execution?: CprExecution;
}

export interface SetVolumeOptions {
  readonly volumePolicy?: CprVolumePolicy;
}

export interface CprEngine {
  readonly backend: 'wasm' | 'cpu';
  readonly fallbackReason?: string;
  setVolume(volume: CprVolume, options?: SetVolumeOptions): Promise<void>;
  extract(curve: CprCurve, options?: CprExtractOptions): Promise<CprResult>;
  dispose(): void;
}
