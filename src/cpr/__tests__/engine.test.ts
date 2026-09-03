// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CpuCprBackend, type CprBackendResult } from '../cpu-backend';
import { prepareCurveSamples, type PreparedCurve } from '../curve-samples';
import {
  createCprEngine,
  type CprBackendFactories,
  type CprBackendImpl,
} from '../engine';
import type {
  CprCurve,
  CprExtractOptions,
  CprVolume,
  NormalizedCprExtractOptions,
} from '../types';
import { WasmCprBackend } from '../wasm-backend';
import type { WasmBindings } from '../wasm-bindings';

const dimensions = [4, 4, 3] as const;
const spacing = [1, 1, 1] as const;

const curve: CprCurve = {
  points: [
    { x: 0, y: 1.5, z: 0 },
    { x: 3, y: 1.5, z: 0 },
  ],
  sample: (t) => ({ x: 3 * t, y: 1.5, z: 0 }),
};

const normalizedOptions: NormalizedCprExtractOptions = {
  thickness: 2,
  pixelSize: 0.5,
  mode: 'mean',
  depthRangeMm: [0, 3],
};

function makeVolume(): CprVolume {
  const data = new Int16Array(dimensions[0] * dimensions[1] * dimensions[2]);
  for (let index = 0; index < data.length; index++) data[index] = index;
  return { data, dimensions, spacing };
}

interface FakeBackend extends CprBackendImpl {
  setVolumeCalls: CprVolume[];
  extractCalls: Array<{ curve: CprCurve; options: NormalizedCprExtractOptions }>;
  disposeCount: number;
  result: CprBackendResult;
  extractDelayMs: number;
}

function createFakeBackend(): FakeBackend {
  return {
    setVolumeCalls: [],
    extractCalls: [],
    disposeCount: 0,
    result: { data: Float32Array.from([1, 2, 3, 4]), width: 2, height: 2 },
    extractDelayMs: 0,
    setVolume(volume): void {
      this.setVolumeCalls.push(volume);
    },
    extract(extractCurve, options): CprBackendResult {
      const deadline = performance.now() + this.extractDelayMs;
      while (performance.now() < deadline) {
        // spin so elapsedMs has something to measure
      }
      this.extractCalls.push({ curve: extractCurve, options });
      return this.result;
    },
    dispose(): void {
      this.disposeCount++;
    },
  };
}

interface FactoryHarness {
  factories: CprBackendFactories;
  cpu: FakeBackend;
  wasm: FakeBackend;
  cpuFactoryCalls: number;
  wasmFactoryUrls: Array<string | URL | undefined>;
  wasmFactoryError: unknown;
}

function createFactoryHarness(): FactoryHarness {
  const harness: FactoryHarness = {
    factories: {
      createCpuBackend(): CprBackendImpl {
        harness.cpuFactoryCalls++;
        return harness.cpu;
      },
      async createWasmBackend(wasmUrl): Promise<CprBackendImpl> {
        harness.wasmFactoryUrls.push(wasmUrl);
        if (harness.wasmFactoryError !== undefined) throw harness.wasmFactoryError;
        return harness.wasm;
      },
    },
    cpu: createFakeBackend(),
    wasm: createFakeBackend(),
    cpuFactoryCalls: 0,
    wasmFactoryUrls: [],
    wasmFactoryError: undefined,
  };
  return harness;
}

describe('createCprEngine backend selection', () => {
  it('uses the CPU backend without touching WASM when explicitly selected', async () => {
    const harness = createFactoryHarness();

    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);

    expect(engine.backend).toBe('cpu');
    expect(engine.fallbackReason).toBeUndefined();
    expect(harness.cpuFactoryCalls).toBe(1);
    expect(harness.wasmFactoryUrls).toHaveLength(0);
  });

  it('uses the WASM backend when explicitly selected', async () => {
    const harness = createFactoryHarness();

    const engine = await createCprEngine({ backend: 'wasm' }, harness.factories);

    expect(engine.backend).toBe('wasm');
    expect(engine.fallbackReason).toBeUndefined();
    expect(harness.wasmFactoryUrls).toEqual([undefined]);
    expect(harness.cpuFactoryCalls).toBe(0);
  });

  it('prefers WASM in auto mode when initialization succeeds', async () => {
    const harness = createFactoryHarness();

    const engine = await createCprEngine(undefined, harness.factories);

    expect(engine.backend).toBe('wasm');
    expect(engine.fallbackReason).toBeUndefined();
    expect(harness.wasmFactoryUrls).toEqual([undefined]);
    expect(harness.cpuFactoryCalls).toBe(0);
  });

  it('falls back to CPU in auto mode and records the failure reason', async () => {
    const harness = createFactoryHarness();
    harness.wasmFactoryError = new Error('WebAssembly is not available');

    const engine = await createCprEngine({ backend: 'auto' }, harness.factories);

    expect(engine.backend).toBe('cpu');
    expect(engine.fallbackReason).toBe('WebAssembly is not available');
    expect(harness.wasmFactoryUrls).toHaveLength(1);
    expect(harness.cpuFactoryCalls).toBe(1);
  });

  it('records a string reason when WASM initialization throws a non-Error value', async () => {
    const harness = createFactoryHarness();
    harness.wasmFactoryError = 'no webassembly support';

    const engine = await createCprEngine({ backend: 'auto' }, harness.factories);

    expect(engine.backend).toBe('cpu');
    expect(engine.fallbackReason).toBe('no webassembly support');
  });

  it('propagates WASM initialization failure when WASM is explicitly selected', async () => {
    const harness = createFactoryHarness();
    harness.wasmFactoryError = new Error('compile error');

    await expect(createCprEngine({ backend: 'wasm' }, harness.factories))
      .rejects.toThrow('compile error');
    expect(harness.cpuFactoryCalls).toBe(0);
  });

  it('passes wasmUrl through to the WASM factory in auto mode', async () => {
    const harness = createFactoryHarness();
    const wasmUrl = 'https://cdn.example.com/cpr.wasm';

    const engine = await createCprEngine({ wasmUrl }, harness.factories);

    expect(engine.backend).toBe('wasm');
    expect(harness.wasmFactoryUrls).toEqual([wasmUrl]);
  });
});

describe('createCprEngine state machine', () => {
  it('rejects extract before any volume is set', async () => {
    const harness = createFactoryHarness();
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);

    await expect(engine.extract(curve)).rejects.toThrow(
      'CPR engine requires a volume before extraction',
    );
    expect(harness.cpu.extractCalls).toHaveLength(0);
  });

  it('rejects an invalid volume before reaching the backend', async () => {
    const harness = createFactoryHarness();
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);

    await expect(engine.setVolume({
      data: new Int16Array(7),
      dimensions: [2, 2, 2],
      spacing: [0.3, 0.3, 0.3],
    })).rejects.toThrow('Volume data length must equal dimensions product');
    expect(harness.cpu.setVolumeCalls).toHaveLength(0);
    await expect(engine.extract(curve)).rejects.toThrow(
      'CPR engine requires a volume before extraction',
    );
  });

  it('accepts a replacement volume and delegates it to the backend', async () => {
    const harness = createFactoryHarness();
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);
    const first = makeVolume();
    const second = makeVolume();

    await engine.setVolume(first);
    await engine.setVolume(second);

    expect(harness.cpu.setVolumeCalls).toEqual([first, second]);
    await engine.extract(curve);
    expect(harness.cpu.extractCalls).toHaveLength(1);
  });

  it('rejects an invalid curve before reaching the backend', async () => {
    const harness = createFactoryHarness();
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);
    await engine.setVolume(makeVolume());

    await expect(engine.extract({
      points: [{ x: 0, y: 0, z: 0 }],
      sample: () => ({ x: 0, y: 0, z: 0 }),
    })).rejects.toThrow('Curve must contain at least two points');
    expect(harness.cpu.extractCalls).toHaveLength(0);
  });

  it('rejects invalid extract options at the public boundary', async () => {
    const harness = createFactoryHarness();
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);
    await engine.setVolume(makeVolume());

    await expect(engine.extract(curve, { pixelSize: 0 })).rejects.toThrow(
      'Pixel size must be a positive finite number',
    );
    expect(harness.cpu.extractCalls).toHaveLength(0);
  });

  it('normalizes default extract options against the current volume', async () => {
    const harness = createFactoryHarness();
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);
    await engine.setVolume(makeVolume());

    await engine.extract(curve);

    expect(harness.cpu.extractCalls[0].options).toEqual({
      thickness: 20,
      pixelSize: 0.3,
      mode: 'mean',
      depthRangeMm: [0, 3],
    });
  });

  it('returns backend result data with backend and elapsedMs metadata', async () => {
    const harness = createFactoryHarness();
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);
    await engine.setVolume(makeVolume());

    const result = await engine.extract(curve, { mode: 'max' });

    expect(result.data).toBe(harness.cpu.result.data);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.backend).toBe('cpu');
    expect(Number.isFinite(result.elapsedMs)).toBe(true);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('measures backend extraction time in elapsedMs', async () => {
    const harness = createFactoryHarness();
    harness.cpu.extractDelayMs = 6;
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);
    await engine.setVolume(makeVolume());

    const result = await engine.extract(curve);

    expect(result.elapsedMs).toBeGreaterThanOrEqual(5);
  });

  it('rejects every call after dispose', async () => {
    const harness = createFactoryHarness();
    const engine = await createCprEngine({ backend: 'cpu' }, harness.factories);
    await engine.setVolume(makeVolume());

    engine.dispose();

    await expect(engine.setVolume(makeVolume())).rejects.toThrow('CPR engine is disposed');
    await expect(engine.extract(curve)).rejects.toThrow('CPR engine is disposed');
    expect(() => engine.dispose()).toThrow('CPR engine is disposed');
    expect(harness.cpu.disposeCount).toBe(1);
  });
});

interface FakeWasmBindings extends WasmBindings {
  setVolumeCalls: CprVolume[];
  extractCalls: Array<{ curve: PreparedCurve; options: NormalizedCprExtractOptions }>;
  disposeCount: number;
}

function createFakeWasmBindings(): FakeWasmBindings {
  return {
    setVolumeCalls: [],
    extractCalls: [],
    disposeCount: 0,
    setVolume(volume): void {
      this.setVolumeCalls.push(volume);
    },
    extract(preparedCurve, options): CprBackendResult {
      this.extractCalls.push({ curve: preparedCurve, options });
      return { data: Float32Array.from([9]), width: 1, height: 1 };
    },
    dispose(): void {
      this.disposeCount++;
    },
  };
}

describe('WasmCprBackend adapter', () => {
  it('stores the volume by reference and prepares 512 curve samples per extract', () => {
    const bindings = createFakeWasmBindings();
    const adapter = new WasmCprBackend(bindings);
    const volume = makeVolume();

    adapter.setVolume(volume);
    const result = adapter.extract(curve, normalizedOptions);

    expect(bindings.setVolumeCalls).toEqual([volume]);
    expect(bindings.setVolumeCalls[0]).toBe(volume);
    expect(bindings.extractCalls[0].curve)
      .toEqual(prepareCurveSamples(curve, volume, 512));
    expect(bindings.extractCalls[0].curve.x).toHaveLength(512);
    expect(bindings.extractCalls[0].options).toBe(normalizedOptions);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it('rejects extract before a volume is set', () => {
    const adapter = new WasmCprBackend(createFakeWasmBindings());

    expect(() => adapter.extract(curve, normalizedOptions)).toThrow(
      'WASM backend requires a volume before extraction',
    );
  });

  it('delegates disposal to the bindings', () => {
    const bindings = createFakeWasmBindings();
    const adapter = new WasmCprBackend(bindings);

    adapter.dispose();

    expect(bindings.disposeCount).toBe(1);
  });
});

describe('createCprEngine with the default factories', () => {
  const extractOptions: CprExtractOptions = {
    thickness: 2,
    pixelSize: 0.5,
    mode: 'mean',
    depthRangeMm: [0.5, 2.5],
  };

  it('runs a real CPU extraction end to end', async () => {
    const engine = await createCprEngine({ backend: 'cpu' });
    const volume = makeVolume();
    await engine.setVolume(volume);

    const result = await engine.extract(curve, extractOptions);

    const oracle = new CpuCprBackend();
    oracle.setVolume(volume);
    const expected = oracle.extract(curve, {
      thickness: 2,
      pixelSize: 0.5,
      mode: 'mean',
      depthRangeMm: [0.5, 2.5],
    });
    expect(result.backend).toBe('cpu');
    expect(result.width).toBe(expected.width);
    expect(result.height).toBe(expected.height);
    expect(result.data).toEqual(expected.data);
    engine.dispose();
  });

  it('runs a real WASM extraction end to end from a provided wasmUrl', async () => {
    const binary = await readFile(new URL('../generated/cpr.wasm', import.meta.url));
    const wasmUrl = `data:application/wasm;base64,${binary.toString('base64')}`;
    const engine = await createCprEngine({ backend: 'wasm', wasmUrl });
    const volume = makeVolume();
    await engine.setVolume(volume);

    const result = await engine.extract(curve, extractOptions);

    const oracle = new CpuCprBackend();
    oracle.setVolume(volume);
    const expected = oracle.extract(curve, {
      thickness: 2,
      pixelSize: 0.5,
      mode: 'mean',
      depthRangeMm: [0.5, 2.5],
    });
    expect(engine.backend).toBe('wasm');
    expect(result.backend).toBe('wasm');
    expect(result.width).toBe(expected.width);
    expect(result.height).toBe(expected.height);
    expect(result.data).toHaveLength(expected.data.length);
    for (let index = 0; index < expected.data.length; index++) {
      expect(result.data[index]).toBeCloseTo(expected.data[index], 4);
    }
    engine.dispose();
  });

  it('selects the real WASM backend in auto mode when initialization succeeds', async () => {
    const binary = await readFile(new URL('../generated/cpr.wasm', import.meta.url));
    const wasmUrl = `data:application/wasm;base64,${binary.toString('base64')}`;
    const engine = await createCprEngine({ wasmUrl });
    const volume = makeVolume();
    await engine.setVolume(volume);

    const result = await engine.extract(curve, extractOptions);

    expect(engine.backend).toBe('wasm');
    expect(engine.fallbackReason).toBeUndefined();
    expect(result.data.length).toBeGreaterThan(0);
    engine.dispose();
  });
});
