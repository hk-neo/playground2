import type { CprBackendResult } from './cpu-backend';
import { prepareCurveSamples } from './curve-samples';
import type { CprBackendImpl } from './engine';
import type {
  CprCurve,
  CprVolume,
  NormalizedCprExtractOptions,
} from './types';
import { createWasmBindings, type WasmBindings } from './wasm-bindings';

const curveSampleCount = 512;

export class WasmCprBackend implements CprBackendImpl {
  private volume?: CprVolume;

  constructor(private readonly bindings: WasmBindings) {}

  setVolume(volume: CprVolume): void {
    this.bindings.setVolume(volume);
    this.volume = volume;
  }

  extract(curve: CprCurve, options: NormalizedCprExtractOptions): CprBackendResult {
    if (!this.volume) {
      throw new Error('WASM backend requires a volume before extraction');
    }

    const preparedCurve = prepareCurveSamples(curve, this.volume, curveSampleCount);
    return this.bindings.extract(preparedCurve, options);
  }

  dispose(): void {
    this.volume = undefined;
    this.bindings.dispose();
  }
}

export async function createWasmCprBackend(wasmUrl?: string | URL): Promise<WasmCprBackend> {
  return new WasmCprBackend(await createWasmBindings(wasmUrl));
}
