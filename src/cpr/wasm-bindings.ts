import type { CprBackendResult } from './cpu-backend';
import type { PreparedCurve } from './curve-samples';
import type { CprMode, CprVolume, NormalizedCprExtractOptions } from './types';

interface CprWasmExports extends WebAssembly.Exports {
  readonly memory: WebAssembly.Memory;
  setVolume(
    voxelCount: number,
    isSigned: number,
    dimensionX: number,
    dimensionY: number,
    dimensionZ: number,
    spacingX: number,
    spacingY: number,
    spacingZ: number,
  ): number;
  setCurve(sampleCount: number): void;
  getCurveXPointer(): number;
  getCurveYPointer(): number;
  getCurveArcLengthPointer(): number;
  extract(
    totalArcLength: number,
    thickness: number,
    pixelSize: number,
    depthMinimum: number,
    depthMaximum: number,
    mode: number,
  ): number;
  getOutputWidth(): number;
  getOutputHeight(): number;
  dispose(): void;
}

export interface WasmBindings {
  setVolume(volume: CprVolume): void;
  extract(curve: PreparedCurve, options: NormalizedCprExtractOptions): CprBackendResult;
  dispose(): void;
}

const projectionCodes: Record<CprMode, number> = {
  sum: 0,
  mean: 1,
  min: 2,
  max: 3,
};

async function loadWasmExports(wasmUrl?: string | URL): Promise<CprWasmExports> {
  if (!wasmUrl) {
    return await import('./generated/cpr.js') as unknown as CprWasmExports;
  }

  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to load CPR WebAssembly module: ${response.status} ${response.statusText}`);
  }
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {
    env: {
      abort(): never {
        throw new Error('AssemblyScript CPR kernel aborted');
      },
    },
  });
  return instance.exports as CprWasmExports;
}

export async function createWasmBindings(wasmUrl?: string | URL): Promise<WasmBindings> {
  const wasm = await loadWasmExports(wasmUrl);

  return {
    setVolume(volume): void {
      const [dimensionX, dimensionY, dimensionZ] = volume.dimensions;
      const [spacingX, spacingY, spacingZ] = volume.spacing;
      const pointer = wasm.setVolume(
        volume.data.length,
        volume.data instanceof Int16Array ? 1 : 0,
        dimensionX,
        dimensionY,
        dimensionZ,
        spacingX,
        spacingY,
        spacingZ,
      );
      const source = new Uint8Array(
        volume.data.buffer,
        volume.data.byteOffset,
        volume.data.byteLength,
      );
      new Uint8Array(wasm.memory.buffer, pointer, source.byteLength).set(source);
    },

    extract(curve, options): CprBackendResult {
      wasm.setCurve(curve.x.length);
      new Float32Array(wasm.memory.buffer, wasm.getCurveXPointer(), curve.x.length).set(curve.x);
      new Float32Array(wasm.memory.buffer, wasm.getCurveYPointer(), curve.y.length).set(curve.y);
      new Float32Array(
        wasm.memory.buffer,
        wasm.getCurveArcLengthPointer(),
        curve.arcLengthMm.length,
      ).set(curve.arcLengthMm);

      const outputPointer = wasm.extract(
        curve.totalArcLengthMm,
        options.thickness,
        options.pixelSize,
        options.depthRangeMm[0],
        options.depthRangeMm[1],
        projectionCodes[options.mode],
      );
      const width = wasm.getOutputWidth();
      const height = wasm.getOutputHeight();
      const data = new Float32Array(wasm.memory.buffer, outputPointer, width * height).slice();
      return { data, width, height };
    },

    dispose(): void {
      wasm.dispose();
    },
  };
}
