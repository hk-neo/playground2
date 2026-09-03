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
import { createWorkerCprBackend } from './worker-engine';

export interface CprBackendImpl {
  setVolume(volume: CprVolume, options?: SetVolumeOptions): void | Promise<void>;
  extract(
    curve: CprCurve,
    options: NormalizedCprExtractOptions,
  ): CprBackendResult | Promise<CprBackendResult>;
  dispose(): void;
}

export interface CprBackendFactories {
  createCpuBackend(): CprBackendImpl;
  createWasmBackend(wasmUrl?: string | URL): Promise<CprBackendImpl>;
}

type EngineState = 'ready' | 'volume-set' | 'disposed';

export const defaultBackendFactories: CprBackendFactories = {
  createCpuBackend: () => new CpuCprBackend(),
  createWasmBackend: (wasmUrl) => createWasmCprBackend(wasmUrl),
};

export async function selectBackend(
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

function createEngineFacade(
  backend: CprBackendImpl,
  name: 'wasm' | 'cpu',
  fallbackReason?: string,
): CprEngine {
  let state: EngineState = 'ready';
  let volume: CprVolume | undefined;

  return {
    backend: name,
    fallbackReason,

    async setVolume(nextVolume: CprVolume, setVolumeOptions?: SetVolumeOptions): Promise<void> {
      assertNotDisposed(state);
      validateVolume(nextVolume);
      await backend.setVolume(nextVolume, setVolumeOptions);
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
      const extracted = await backend.extract(curve, normalized);
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

export async function createCprEngine(
  options: CprEngineOptions = {},
  factories: CprBackendFactories = defaultBackendFactories,
): Promise<CprEngine> {
  const execution = options.execution ?? 'main';

  if (execution === 'worker') {
    if (!options.volumePolicy) {
      throw new Error(
        "CPR engine execution 'worker' requires volumePolicy 'copy' or 'transfer'",
      );
    }
    const handle = await createWorkerCprBackend({
      backend: options.backend ?? 'auto',
      volumePolicy: options.volumePolicy,
      wasmUrl: options.wasmUrl,
      workerFactory: options.workerFactory,
    });
    return createEngineFacade(handle.impl, handle.backend, handle.fallbackReason);
  }

  const selected = await selectBackend(options, factories);
  return createEngineFacade(selected.backend, selected.name, selected.fallbackReason);
}
