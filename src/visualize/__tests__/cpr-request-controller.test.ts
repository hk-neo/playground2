import { describe, expect, it } from 'vitest';
import type { CprCurve, CprEngine, CprExtractOptions, CprResult } from '../../cpr';
import { CprRequestController, type CprRequest } from '../cpr-request-controller';

const curve: CprCurve = {
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
  ],
  sample: (t) => ({ x: 3 * t, y: 0, z: 0 }),
};

function makeResult(seed: number): CprResult {
  return {
    data: Float32Array.of(seed),
    width: 1,
    height: 1,
    backend: 'cpu',
    elapsedMs: seed,
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createFrameHarness() {
  const callbacks: Array<() => void> = [];
  return {
    requestFrame: (callback: () => void): void => {
      callbacks.push(callback);
    },
    flushFrames: (): void => {
      const queued = callbacks.splice(0, callbacks.length);
      for (const callback of queued) callback();
    },
  };
}

interface StubEngineHarness {
  engine: CprEngine;
  extractCalls: Array<{ curve: CprCurve; options: CprExtractOptions | undefined }>;
  resolveAt: (index: number, result: CprResult) => void;
}

function createStubEngine(fallbackReason?: string): StubEngineHarness {
  const extractCalls: Array<{ curve: CprCurve; options: CprExtractOptions | undefined }> = [];
  const resolvers: Array<(result: CprResult) => void> = [];
  const engine: CprEngine = {
    backend: 'cpu',
    fallbackReason,
    setVolume: () => Promise.resolve(),
    extract: (extractCurve, options) => {
      extractCalls.push({ curve: extractCurve, options });
      return new Promise<CprResult>((resolve) => {
        resolvers.push(resolve);
      });
    },
    dispose: () => {},
  };
  return {
    engine,
    extractCalls,
    resolveAt: (index, result) => resolvers[index](result),
  };
}

function createController(
  engine: CprEngine,
  frames: ReturnType<typeof createFrameHarness>,
  onResult: (result: CprResult, request: CprRequest) => void,
): CprRequestController {
  return new CprRequestController({
    engine,
    onResult,
    requestFrame: frames.requestFrame,
  });
}

describe('CprRequestController', () => {
  it('coalesces same-frame requests into one extract with the latest options', async () => {
    const frames = createFrameHarness();
    const stub = createStubEngine();
    const delivered: CprRequest[] = [];
    const controller = createController(stub.engine, frames, (_result, request) => {
      delivered.push(request);
    });

    controller.schedule({ curve, quality: 'preview', options: { pixelSize: 0.6 } });
    controller.schedule({ curve, quality: 'preview', options: { pixelSize: 0.5, mode: 'max' } });
    controller.schedule({ curve, quality: 'final', options: { pixelSize: 0.3 } });
    expect(stub.extractCalls).toHaveLength(0);

    frames.flushFrames();
    expect(stub.extractCalls).toHaveLength(1);
    expect(stub.extractCalls[0].options?.pixelSize).toBe(0.3);

    stub.resolveAt(0, makeResult(1));
    await settle();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].quality).toBe('final');
    expect(delivered[0].options?.pixelSize).toBe(0.3);
  });

  it('drops superseded results instead of delivering them', async () => {
    const frames = createFrameHarness();
    const stub = createStubEngine();
    const delivered: CprRequest[] = [];
    const controller = createController(stub.engine, frames, (_result, request) => {
      delivered.push(request);
    });

    controller.schedule({ curve, options: { pixelSize: 0.6 } });
    frames.flushFrames();
    expect(stub.extractCalls).toHaveLength(1);

    controller.schedule({ curve, options: { pixelSize: 0.3 } });
    stub.resolveAt(0, makeResult(1));
    await settle();
    expect(delivered).toHaveLength(0);
    expect(stub.extractCalls).toHaveLength(1);

    frames.flushFrames();
    expect(stub.extractCalls).toHaveLength(2);
    stub.resolveAt(1, makeResult(2));
    await settle();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].options?.pixelSize).toBe(0.3);
  });

  it('guarantees a full-resolution extract with the latest options after drag end', async () => {
    const frames = createFrameHarness();
    const stub = createStubEngine();
    const delivered: CprRequest[] = [];
    const controller = createController(stub.engine, frames, (_result, request) => {
      delivered.push(request);
    });

    controller.schedule({ curve, quality: 'preview', options: { pixelSize: 0.6 } });
    frames.flushFrames();
    controller.schedule({ curve, quality: 'preview', options: { pixelSize: 0.6, thickness: 16 } });
    stub.resolveAt(0, makeResult(1));
    await settle();
    expect(delivered).toHaveLength(0);

    controller.schedule({ curve, quality: 'final', options: { pixelSize: 0.3 } });
    frames.flushFrames();
    expect(stub.extractCalls).toHaveLength(2);
    expect(stub.extractCalls[1].options?.pixelSize).toBe(0.3);
    stub.resolveAt(1, makeResult(2));
    await settle();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].quality).toBe('final');
    expect(delivered[0].options?.pixelSize).toBe(0.3);
  });

  it('keeps delivering results when the engine fell back (fallbackReason set)', async () => {
    const frames = createFrameHarness();
    const stub = createStubEngine('wasm unavailable; using cpu');
    const delivered: CprResult[] = [];
    const controller = createController(stub.engine, frames, (result) => {
      delivered.push(result);
    });
    expect(stub.engine.fallbackReason).toBe('wasm unavailable; using cpu');

    controller.schedule({ curve, quality: 'final', options: { pixelSize: 0.3 } });
    frames.flushFrames();
    stub.resolveAt(0, makeResult(7));
    await settle();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].data[0]).toBe(7);
  });

  it('discards in-flight results after dispose and ignores further schedules', async () => {
    const frames = createFrameHarness();
    const stub = createStubEngine();
    const delivered: CprRequest[] = [];
    const controller = createController(stub.engine, frames, (_result, request) => {
      delivered.push(request);
    });

    controller.schedule({ curve });
    frames.flushFrames();
    expect(stub.extractCalls).toHaveLength(1);

    controller.dispose();
    stub.resolveAt(0, makeResult(1));
    await settle();
    expect(delivered).toHaveLength(0);

    controller.schedule({ curve });
    frames.flushFrames();
    expect(stub.extractCalls).toHaveLength(1);
  });

  it('cancelPending drops a queued request before it starts', () => {
    const frames = createFrameHarness();
    const stub = createStubEngine();
    const delivered: CprRequest[] = [];
    const controller = createController(stub.engine, frames, (_result, request) => {
      delivered.push(request);
    });

    controller.schedule({ curve, options: { pixelSize: 0.6 } });
    controller.cancelPending();
    frames.flushFrames();

    expect(stub.extractCalls).toHaveLength(0);
    expect(delivered).toHaveLength(0);
  });

  it('cancelPending discards an in-flight result but keeps the controller usable', async () => {
    const frames = createFrameHarness();
    const stub = createStubEngine();
    const delivered: CprRequest[] = [];
    const controller = createController(stub.engine, frames, (_result, request) => {
      delivered.push(request);
    });

    controller.schedule({ curve, options: { pixelSize: 0.6 } });
    frames.flushFrames();
    expect(stub.extractCalls).toHaveLength(1);

    controller.cancelPending();
    stub.resolveAt(0, makeResult(1));
    await settle();
    expect(delivered).toHaveLength(0);

    controller.schedule({ curve, options: { pixelSize: 0.3 } });
    frames.flushFrames();
    expect(stub.extractCalls).toHaveLength(2);
    stub.resolveAt(1, makeResult(2));
    await settle();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].options?.pixelSize).toBe(0.3);
  });

  it('never starts more than one extract per frame even when results settle immediately', async () => {
    const frames = createFrameHarness();
    const delivered: CprRequest[] = [];
    const engine: CprEngine = {
      backend: 'cpu',
      setVolume: () => Promise.resolve(),
      extract: () => Promise.resolve(makeResult(1)),
      dispose: () => {},
    };
    const controller = createController(engine, frames, (_result, request) => {
      delivered.push(request);
    });

    controller.schedule({ curve, options: { pixelSize: 0.6 } });
    controller.schedule({ curve, options: { pixelSize: 0.3 } });
    frames.flushFrames();
    await settle();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].options?.pixelSize).toBe(0.3);

    controller.schedule({ curve, options: { pixelSize: 0.3 } });
    frames.flushFrames();
    await settle();
    expect(delivered).toHaveLength(2);
  });
});
