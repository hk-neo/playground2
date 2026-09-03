// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createCprWorkerHandler } from '../cpr-worker';
import { CpuCprBackend, type CprBackendResult } from '../cpu-backend';
import { prepareCurveSamples } from '../curve-samples';
import {
  createCprEngine,
  type CprBackendFactories,
  type CprBackendImpl,
} from '../engine';
import type {
  CprCurve,
  CprExtractOptions,
  CprVolume,
  CprWorkerFactory,
  CprWorkerTransport,
  NormalizedCprExtractOptions,
} from '../types';
import type {
  CprWorkerInitRequest,
  CprWorkerRequest,
  CprWorkerResponse,
  CprWorkerScope,
  CprWorkerSetVolumeRequest,
} from '../worker-protocol';
import {
  createWorkerCprBackend,
  CprRequestSupersededError,
} from '../worker-engine';

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
  depthRangeMm: [0.5, 2.5],
};

const extractOptions: CprExtractOptions = {
  thickness: 2,
  pixelSize: 0.5,
  mode: 'mean',
  depthRangeMm: [0.5, 2.5],
};

function makeVolume(): CprVolume {
  const data = new Int16Array(dimensions[0] * dimensions[1] * dimensions[2]);
  for (let index = 0; index < data.length; index++) data[index] = index;
  return { data, dimensions, spacing };
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface ScriptedWorkerHarness {
  worker: CprWorkerTransport;
  posted: Array<{ message: CprWorkerRequest; transfer?: Transferable[] }>;
  terminated: boolean;
  emit(message: CprWorkerResponse): void;
}

function createScriptedWorker(): ScriptedWorkerHarness {
  const posted: Array<{ message: CprWorkerRequest; transfer?: Transferable[] }> = [];
  let terminated = false;
  const worker: CprWorkerTransport = {
    onmessage: null,
    postMessage(message, transfer) {
      posted.push({ message: message as CprWorkerRequest, transfer });
    },
    terminate() {
      terminated = true;
    },
  };
  return {
    worker,
    posted,
    get terminated() {
      return terminated;
    },
    emit(message) {
      worker.onmessage?.({ data: message } as unknown as MessageEvent);
    },
  };
}

interface InMemoryWorkerHarness {
  factory: CprWorkerFactory;
  requests: Array<{ message: CprWorkerRequest; transfer?: Transferable[] }>;
  responses: Array<{ message: CprWorkerResponse; transfer?: Transferable[] }>;
  terminatedCount: number;
}

function createInMemoryWorkerDouble(handlerFactories?: CprBackendFactories): InMemoryWorkerHarness {
  const harness: InMemoryWorkerHarness = {
    factory: () => {
      throw new Error('in-memory worker double not initialized');
    },
    requests: [],
    responses: [],
    terminatedCount: 0,
  };
  harness.factory = () => {
    const worker: CprWorkerTransport = {
      onmessage: null,
      postMessage() {},
      terminate() {
        harness.terminatedCount++;
      },
    };
    const scope: CprWorkerScope = {
      postMessage(message, transfer) {
        harness.responses.push({ message, transfer });
        queueMicrotask(() => {
          worker.onmessage?.({ data: message } as unknown as MessageEvent);
        });
      },
    };
    const handler = createCprWorkerHandler(scope, handlerFactories);
    worker.postMessage = (message, transfer) => {
      const request = message as CprWorkerRequest;
      harness.requests.push({ message: request, transfer });
      queueMicrotask(() => handler(request));
    };
    return worker;
  };
  return harness;
}

interface RecordingScopeHarness {
  scope: CprWorkerScope;
  responses: Array<{ message: CprWorkerResponse; transfer?: Transferable[] }>;
}

function createRecordingScope(): RecordingScopeHarness {
  const responses: Array<{ message: CprWorkerResponse; transfer?: Transferable[] }> = [];
  return {
    responses,
    scope: {
      postMessage(message, transfer) {
        responses.push({ message, transfer });
      },
    },
  };
}

interface FakeBackend extends CprBackendImpl {
  setVolumeCalls: CprVolume[];
  extractCalls: Array<{ curve: CprCurve; options: NormalizedCprExtractOptions }>;
  disposeCount: number;
  result: CprBackendResult;
}

function createFakeBackend(): FakeBackend {
  return {
    setVolumeCalls: [],
    extractCalls: [],
    disposeCount: 0,
    result: { data: Float32Array.from([1, 2, 3, 4]), width: 2, height: 2 },
    setVolume(volume) {
      this.setVolumeCalls.push(volume);
    },
    extract(extractCurve, options) {
      this.extractCalls.push({ curve: extractCurve, options });
      return this.result;
    },
    dispose() {
      this.disposeCount++;
    },
  };
}

function createFakeFactories(cpu: FakeBackend, wasmError?: unknown): CprBackendFactories {
  return {
    createCpuBackend: () => cpu,
    createWasmBackend: async () => {
      if (wasmError !== undefined) throw wasmError;
      return cpu;
    },
  };
}

async function ackInit(harness: ScriptedWorkerHarness): Promise<void> {
  const initRequest = harness.posted[0].message as CprWorkerInitRequest;
  harness.emit({ type: 'result', id: initRequest.id, init: { backend: 'cpu' } });
}

async function ackSetVolume(harness: ScriptedWorkerHarness, postedIndex: number): Promise<void> {
  const request = harness.posted[postedIndex].message as CprWorkerSetVolumeRequest;
  harness.emit({ type: 'result', id: request.id });
}

describe('worker backend protocol', () => {
  it('assigns strictly increasing request ids across init, set-volume, and extract', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'cpu',
      volumePolicy: 'copy',
      workerFactory: () => double.worker,
    });
    expect(double.posted).toHaveLength(1);
    expect(double.posted[0].message.type).toBe('init');
    await ackInit(double);
    const handle = await pendingBackend;

    const volume = makeVolume();
    const pendingVolume = handle.impl.setVolume(volume);
    await ackSetVolume(double, 1);
    await pendingVolume;

    const pendingExtract = handle.impl.extract(curve, normalizedOptions) as Promise<CprBackendResult>;
    const extractRequest = double.posted[2].message;
    expect(extractRequest.type).toBe('extract');
    double.emit({
      type: 'result',
      id: extractRequest.id,
      extract: { data: Float32Array.from([1]), width: 1, height: 1 },
    });
    await pendingExtract;

    const ids = double.posted.map((entry) => entry.message.id);
    expect(ids).toHaveLength(3);
    for (let index = 1; index < ids.length; index++) {
      expect(ids[index]).toBeGreaterThan(ids[index - 1]);
    }
  });

  it('announces the backend selection and wasmUrl in the init message', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'wasm',
      volumePolicy: 'copy',
      wasmUrl: 'https://cdn.example.com/cpr.wasm',
      workerFactory: () => double.worker,
    });
    const initRequest = double.posted[0].message as CprWorkerInitRequest;
    expect(initRequest).toMatchObject({
      type: 'init',
      backend: 'wasm',
      wasmUrl: 'https://cdn.example.com/cpr.wasm',
    });
    double.emit({ type: 'result', id: initRequest.id, init: { backend: 'wasm' } });
    const handle = await pendingBackend;
    expect(handle.backend).toBe('wasm');
    expect(handle.fallbackReason).toBeUndefined();
  });

  it('copy policy keeps the caller buffer and sends a copy', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'cpu',
      volumePolicy: 'copy',
      workerFactory: () => double.worker,
    });
    await ackInit(double);
    const handle = await pendingBackend;

    const volume = makeVolume();
    const pendingVolume = handle.impl.setVolume(volume);
    const request = double.posted[1].message as CprWorkerSetVolumeRequest;
    expect(request.volume.data).not.toBe(volume.data);
    expect(Array.from(request.volume.data)).toEqual(Array.from(volume.data));
    expect(double.posted[1].transfer ?? []).toHaveLength(0);
    expect(volume.data.buffer.byteLength).toBeGreaterThan(0);
    expect(volume.data[5]).toBe(5);
    await ackSetVolume(double, 1);
    await pendingVolume;
  });

  it('transfer policy moves the caller buffer into the transfer list', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'cpu',
      volumePolicy: 'transfer',
      workerFactory: () => double.worker,
    });
    await ackInit(double);
    const handle = await pendingBackend;

    const volume = makeVolume();
    const pendingVolume = handle.impl.setVolume(volume);
    const request = double.posted[1].message as CprWorkerSetVolumeRequest;
    expect(request.volume.data).toBe(volume.data);
    expect(double.posted[1].transfer).toEqual([volume.data.buffer]);
    await ackSetVolume(double, 1);
    await pendingVolume;
  });

  it('per-call volumePolicy overrides the engine default', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'cpu',
      volumePolicy: 'copy',
      workerFactory: () => double.worker,
    });
    await ackInit(double);
    const handle = await pendingBackend;

    const volume = makeVolume();
    const pendingVolume = handle.impl.setVolume(volume, { volumePolicy: 'transfer' });
    expect(double.posted[1].transfer).toEqual([volume.data.buffer]);
    await ackSetVolume(double, 1);
    await pendingVolume;
  });

  it('rejects superseded extractions and never lets a stale result resolve the latest request', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'cpu',
      volumePolicy: 'copy',
      workerFactory: () => double.worker,
    });
    await ackInit(double);
    const handle = await pendingBackend;
    const pendingVolume = handle.impl.setVolume(makeVolume());
    await ackSetVolume(double, 1);
    await pendingVolume;

    const first = handle.impl.extract(curve, normalizedOptions) as Promise<CprBackendResult>;
    const firstId = double.posted[2].message.id;
    const second = handle.impl.extract(curve, normalizedOptions) as Promise<CprBackendResult>;
    const secondId = double.posted[3].message.id;
    expect(secondId).toBeGreaterThan(firstId);

    await expect(first).rejects.toBeInstanceOf(CprRequestSupersededError);

    const staleData = Float32Array.from([9, 9, 9, 9]);
    double.emit({ type: 'result', id: firstId, extract: { data: staleData, width: 2, height: 2 } });

    let settled = false;
    void second.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await flushAsync();
    expect(settled).toBe(false);

    const freshData = Float32Array.from([1, 2, 3, 4]);
    double.emit({ type: 'result', id: secondId, extract: { data: freshData, width: 2, height: 2 } });
    const result = await second;
    expect(result.data).toBe(freshData);
  });

  it('routes error responses to the request with the matching id', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'cpu',
      volumePolicy: 'copy',
      workerFactory: () => double.worker,
    });
    await ackInit(double);
    const handle = await pendingBackend;

    const pendingVolume = handle.impl.setVolume(makeVolume()) as Promise<void>;
    const setVolumeId = double.posted[1].message.id;
    const pendingExtract = handle.impl.extract(curve, normalizedOptions) as Promise<CprBackendResult>;
    const extractId = double.posted[2].message.id;

    double.emit({ type: 'error', id: setVolumeId, message: 'volume exploded' });
    await expect(pendingVolume).rejects.toThrow('volume exploded');

    let settled = false;
    void pendingExtract.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await flushAsync();
    expect(settled).toBe(false);

    double.emit({
      type: 'result',
      id: extractId,
      extract: { data: Float32Array.from([1]), width: 1, height: 1 },
    });
    await expect(pendingExtract).resolves.toMatchObject({ width: 1, height: 1 });
  });

  it('ignores responses for unknown request ids', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'cpu',
      volumePolicy: 'copy',
      workerFactory: () => double.worker,
    });
    await ackInit(double);
    const handle = await pendingBackend;
    const pendingVolume = handle.impl.setVolume(makeVolume());
    await ackSetVolume(double, 1);
    await pendingVolume;

    const pendingExtract = handle.impl.extract(curve, normalizedOptions) as Promise<CprBackendResult>;
    const extractId = double.posted[2].message.id;

    double.emit({ type: 'result', id: 999, extract: { data: Float32Array.from([0]), width: 1, height: 1 } });
    double.emit({ type: 'error', id: 777, message: 'ghost' });

    double.emit({
      type: 'result',
      id: extractId,
      extract: { data: Float32Array.from([3]), width: 1, height: 1 },
    });
    await expect(pendingExtract).resolves.toMatchObject({ width: 1, height: 1 });
  });

  it('rejects pending requests and terminates the worker on dispose', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'cpu',
      volumePolicy: 'copy',
      workerFactory: () => double.worker,
    });
    await ackInit(double);
    const handle = await pendingBackend;
    const pendingVolume = handle.impl.setVolume(makeVolume());
    await ackSetVolume(double, 1);
    await pendingVolume;

    const pendingExtract = handle.impl.extract(curve, normalizedOptions) as Promise<CprBackendResult>;
    handle.impl.dispose();

    await expect(pendingExtract).rejects.toThrow(/disposed/);
    expect(double.terminated).toBe(true);
    await expect(
      handle.impl.extract(curve, normalizedOptions) as Promise<CprBackendResult>,
    ).rejects.toThrow(/disposed/);
    await expect(handle.impl.setVolume(makeVolume()) as Promise<void>).rejects.toThrow(/disposed/);
  });

  it('terminates the worker when initialization fails', async () => {
    const double = createScriptedWorker();
    const pendingBackend = createWorkerCprBackend({
      backend: 'wasm',
      volumePolicy: 'copy',
      workerFactory: () => double.worker,
    });
    double.emit({ type: 'error', id: double.posted[0].message.id, message: 'no wasm here' });
    await expect(pendingBackend).rejects.toThrow('no wasm here');
    expect(double.terminated).toBe(true);
  });
});

describe('createCprEngine worker execution', () => {
  it('refuses to start a worker without a volume policy', async () => {
    let workerCreations = 0;

    await expect(createCprEngine({
      execution: 'worker',
      workerFactory: () => {
        workerCreations++;
        return createScriptedWorker().worker;
      },
    })).rejects.toThrow(/volumePolicy/);
    expect(workerCreations).toBe(0);
  });

  it('runs a real CPU extraction through an in-memory worker', async () => {
    const harness = createInMemoryWorkerDouble();
    const engine = await createCprEngine({
      execution: 'worker',
      backend: 'cpu',
      volumePolicy: 'copy',
      workerFactory: harness.factory,
    });
    expect(engine.backend).toBe('cpu');
    expect(engine.fallbackReason).toBeUndefined();
    const volume = makeVolume();
    await engine.setVolume(volume);

    const result = await engine.extract(curve, extractOptions);

    const oracle = new CpuCprBackend();
    oracle.setVolume(volume);
    const expected = oracle.extract(curve, normalizedOptions);
    expect(result.backend).toBe('cpu');
    expect(result.width).toBe(expected.width);
    expect(result.height).toBe(expected.height);
    expect(result.data).toEqual(expected.data);
    expect(volume.data[5]).toBe(5);
    expect(harness.requests.some((entry) => entry.message.type === 'init')).toBe(true);
    engine.dispose();
    expect(harness.terminatedCount).toBe(1);
  });

  it('falls back to CPU inside the worker and reports the reason', async () => {
    const cpu = createFakeBackend();
    const harness = createInMemoryWorkerDouble(createFakeFactories(cpu, new Error('no wasm here')));
    const engine = await createCprEngine({
      execution: 'worker',
      volumePolicy: 'copy',
      workerFactory: harness.factory,
    });
    expect(engine.backend).toBe('cpu');
    expect(engine.fallbackReason).toBe('no wasm here');

    await engine.setVolume(makeVolume());
    const result = await engine.extract(curve);
    expect(result.data).toBe(cpu.result.data);
    engine.dispose();
  });

  it('rejects engine creation when explicit wasm worker initialization fails', async () => {
    const cpu = createFakeBackend();
    const harness = createInMemoryWorkerDouble(createFakeFactories(cpu, new Error('no wasm here')));
    await expect(createCprEngine({
      execution: 'worker',
      backend: 'wasm',
      volumePolicy: 'copy',
      workerFactory: harness.factory,
    })).rejects.toThrow('no wasm here');
    expect(harness.terminatedCount).toBe(1);
  });
});

describe('createCprWorkerHandler', () => {
  it('acknowledges init with the resolved backend', async () => {
    const recording = createRecordingScope();
    const cpu = createFakeBackend();
    const handler = createCprWorkerHandler(recording.scope, createFakeFactories(cpu));

    handler({ type: 'init', id: 1, backend: 'cpu' });
    await flushAsync();

    expect(recording.responses).toHaveLength(1);
    expect(recording.responses[0].message).toEqual({
      type: 'result',
      id: 1,
      init: { backend: 'cpu' },
    });
    expect(recording.responses[0].transfer).toBeUndefined();
  });

  it('falls back to cpu in auto mode when wasm initialization fails', async () => {
    const recording = createRecordingScope();
    const cpu = createFakeBackend();
    const handler = createCprWorkerHandler(
      recording.scope,
      createFakeFactories(cpu, new Error('no wasm here')),
    );

    handler({ type: 'init', id: 1, backend: 'auto' });
    await flushAsync();

    expect(recording.responses[0].message).toEqual({
      type: 'result',
      id: 1,
      init: { backend: 'cpu', fallbackReason: 'no wasm here' },
    });
  });

  it('rejects requests that arrive before init', async () => {
    const recording = createRecordingScope();
    const handler = createCprWorkerHandler(recording.scope, createFakeFactories(createFakeBackend()));
    const prepared = prepareCurveSamples(curve, makeVolume(), 512);

    handler({ type: 'extract', id: 3, curve: prepared, options: normalizedOptions });
    await flushAsync();

    expect(recording.responses[0].message).toMatchObject({
      type: 'error',
      id: 3,
      message: expect.stringContaining('init'),
    });
  });

  it('rejects extract before set-volume with the request id intact', async () => {
    const recording = createRecordingScope();
    const handler = createCprWorkerHandler(recording.scope);
    const prepared = prepareCurveSamples(curve, makeVolume(), 512);

    handler({ type: 'init', id: 1, backend: 'cpu' });
    await flushAsync();
    handler({ type: 'extract', id: 7, curve: prepared, options: normalizedOptions });
    await flushAsync();

    expect(recording.responses[1].message).toMatchObject({
      type: 'error',
      id: 7,
      message: 'CPU backend requires a volume before extraction',
    });
  });

  it('transfers the extraction output buffer back to the main thread', async () => {
    const recording = createRecordingScope();
    const cpu = createFakeBackend();
    cpu.result = { data: Float32Array.from([5, 6, 7, 8]), width: 2, height: 2 };
    const handler = createCprWorkerHandler(recording.scope, createFakeFactories(cpu));
    const volume = makeVolume();
    const prepared = prepareCurveSamples(curve, volume, 512);

    handler({ type: 'init', id: 1, backend: 'cpu' });
    await flushAsync();
    handler({ type: 'set-volume', id: 2, volume });
    await flushAsync();
    handler({ type: 'extract', id: 3, curve: prepared, options: normalizedOptions });
    await flushAsync();

    const extractResponse = recording.responses.find(
      (entry) => entry.message.type === 'result' && entry.message.extract !== undefined,
    );
    expect(extractResponse).toBeDefined();
    expect(extractResponse?.message).toMatchObject({
      type: 'result',
      id: 3,
      extract: { data: cpu.result.data, width: 2, height: 2 },
    });
    expect(extractResponse?.transfer).toEqual([cpu.result.data.buffer]);
  });

  it('reconstructs a knot-exact curve from prepared samples', async () => {
    const recording = createRecordingScope();
    const cpu = createFakeBackend();
    const handler = createCprWorkerHandler(recording.scope, createFakeFactories(cpu));
    const volume = makeVolume();
    const prepared = prepareCurveSamples(curve, volume, 512);

    handler({ type: 'init', id: 1, backend: 'cpu' });
    await flushAsync();
    handler({ type: 'set-volume', id: 2, volume });
    await flushAsync();
    handler({ type: 'extract', id: 3, curve: prepared, options: normalizedOptions });
    await flushAsync();

    const received = cpu.extractCalls[0].curve;
    expect(received.points).toHaveLength(512);
    for (let index = 0; index < 512; index++) {
      const point = received.sample(index / 511);
      expect(point.x).toBe(prepared.x[index]);
      expect(point.y).toBe(prepared.y[index]);
    }
  });

  it('disposes the backend when requested', async () => {
    const recording = createRecordingScope();
    const cpu = createFakeBackend();
    const handler = createCprWorkerHandler(recording.scope, createFakeFactories(cpu));

    handler({ type: 'init', id: 1, backend: 'cpu' });
    await flushAsync();
    handler({ type: 'dispose', id: 2 });
    await flushAsync();

    expect(cpu.disposeCount).toBe(1);
    expect(recording.responses).toHaveLength(1);
  });
});
