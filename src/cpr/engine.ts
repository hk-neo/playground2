import { CpuCprBackend, type CprBackendResult } from './cpu-backend';
import type {
  CprCurve,
  CprEngine,
  CprEngineOptions,
  CprExtractOptions,
  CprResult,
  CprVolume,
  NormalizedCprExtractOptions,
  SetVolumeOptions,
} from './types';
import {
  normalizeExtractOptions,
  validateCurve,
  validateVolume,
} from './validation';
import { createWasmCprBackend } from './wasm-backend';

export interface CprBackendImpl {
  setVolume(volume: CprVolume): void;
  extract(curve: CprCurve, options: NormalizedCprExtractOptions): CprBackendResult;
  dispose(): void;
}

export interface CprBackendFactories {
  createCpuBackend(): CprBackendImpl;
  createWasmBackend(wasmUrl?: string | URL): Promise<CprBackendImpl>;
}

type EngineState = 'ready' | 'volume-set' | 'disposed';

const defaultBackendFactories: CprBackendFactories = {
  createCpuBackend: () => new CpuCprBackend(),
  createWasmBackend: (wasmUrl) => createWasmCprBackend(wasmUrl),
};

async function selectBackend(
  options: CprEngineOptions,
  factories: CprBackendFactories,
): Promise<{ backend: CprBackendImpl; name: 'wasm' | 'cpu'; fallbackReason?: string }> {
  const selection = options.backend ?? 'auto';

  if (selection === 'cpu') {
    return { backend: factories.createCpuBackend(), name: 'cpu' };
  }

  try {
    return { backend: await factories.createWasmBackend(options.wasmUrl), name: 'wasm' };
  } catch (error) {
    if (selection === 'wasm') {
      throw error;
    }
    return {
      backend: factories.createCpuBackend(),
      name: 'cpu',
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function assertNotDisposed(state: EngineState): void {
  if (state === 'disposed') {
    throw new Error('CPR engine is disposed');
  }
}

export async function createCprEngine(
  options: CprEngineOptions = {},
  factories: CprBackendFactories = defaultBackendFactories,
): Promise<CprEngine> {
  const selected = await selectBackend(options, factories);
  const { backend, name } = selected;

  let state: EngineState = 'ready';
  let volume: CprVolume | undefined;

  return {
    backend: name,
    fallbackReason: selected.fallbackReason,

    async setVolume(nextVolume: CprVolume, _setVolumeOptions?: SetVolumeOptions): Promise<void> {
      assertNotDisposed(state);
      validateVolume(nextVolume);
      backend.setVolume(nextVolume);
      volume = nextVolume;
      state = 'volume-set';
    },

    async extract(curve: CprCurve, extractOptions?: CprExtractOptions): Promise<CprResult> {
      assertNotDisposed(state);
      if (state !== 'volume-set' || !volume) {
        throw new Error('CPR engine requires a volume before extraction');
      }
      validateCurve(curve);
      const normalized = normalizeExtractOptions(volume, extractOptions);

      const startedAt = performance.now();
      const extracted = backend.extract(curve, normalized);
      const elapsedMs = performance.now() - startedAt;

      return { ...extracted, backend: name, elapsedMs };
    },

    dispose(): void {
      assertNotDisposed(state);
      backend.dispose();
      volume = undefined;
      state = 'disposed';
    },
  };
}
