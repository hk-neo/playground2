import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CprEngine } from '../../cpr';
import type { VolumeData } from '../../shared/types/volume';

const mocks = vi.hoisted(() => ({
  engines: [] as Array<{
    setVolume: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
  controllers: [] as Array<{
    schedule: ReturnType<typeof vi.fn>;
    cancelPending: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('../../cpr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../cpr')>();
  return {
    ...actual,
    createCprEngine: vi.fn(async (): Promise<CprEngine> => {
      const engine = {
        backend: 'cpu' as const,
        setVolume: vi.fn(async () => {}),
        extract: vi.fn(async () => ({
          data: new Float32Array(0),
          width: 0,
          height: 0,
          backend: 'cpu' as const,
          elapsedMs: 0,
        })),
        dispose: vi.fn(),
      };
      mocks.engines.push(engine);
      return engine;
    }),
  };
});

vi.mock('../cpr-request-controller', () => ({
  CprRequestController: class {
    schedule = vi.fn();
    cancelPending = vi.fn();
    dispose = vi.fn();
    constructor() {
      mocks.controllers.push(this);
    }
  },
}));

const ELEMENT_IDS = [
  'workspace',
  'region-top',
  'region-bottom-left',
  'region-bottom-right',
  'resize-h',
  'resize-v',
  'curve-editor-modal',
  'btn-pano-edit',
  'ce-state',
  'ce-point-list',
  'ce-point-count',
  'ce-undo',
  'ce-redo',
  'ce-apply',
  'ce-cancel',
  'ce-close',
  'ce-preset-ellipse',
  'ce-preset-arch',
  'ce-mode-min',
  'ce-mode-max',
  'ce-mode-mean',
  'modal-axial-slider',
  'modal-axial-val',
  'pano-tag',
];

const CANVAS_IDS = [
  'modal-axial-canvas',
  'modal-pano-canvas',
  'pano-canvas',
  'axial-canvas',
  'coronal-canvas',
  'sagittal-canvas',
  '3d-canvas',
];

function setupDom(): void {
  for (const id of ELEMENT_IDS) {
    const el = id === 'modal-axial-slider'
      ? document.createElement('input')
      : document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  for (const id of CANVAS_IDS) {
    const el = document.createElement('canvas');
    el.id = id;
    document.body.appendChild(el);
  }
  const row = document.createElement('div');
  row.className = 'region-bottom-row';
  document.body.appendChild(row);
}

function makeVolume(): VolumeData {
  const dimensions: [number, number, number] = [4, 4, 4];
  return {
    buffer: new ArrayBuffer(dimensions[0] * dimensions[1] * dimensions[2] * 2),
    dimensions,
    spacing: [1, 1, 1],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('pano-wiring volume swap cancellation', () => {
  beforeEach(async () => {
    setupDom();
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    mocks.engines.length = 0;
    mocks.controllers.length = 0;
  });

  async function loadPanoWiring(): Promise<typeof import('../pano-wiring')> {
    return import('../pano-wiring');
  }

  it('cancels pending extractions before swapping in a new volume', async () => {
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();

    setPanoVolume(makeVolume());
    await nextTick();
    expect(mocks.engines).toHaveLength(1);
    expect(mocks.engines[0].setVolume).toHaveBeenCalledTimes(1);
    expect(mocks.controllers).toHaveLength(1);
    const controller = mocks.controllers[0];
    const cancelsAfterFirstLoad = controller.cancelPending.mock.calls.length;

    setPanoVolume(makeVolume());
    // 취소는 새 볼륨의 setVolume보다 먼저(동기로) 일어나야 한다.
    expect(controller.cancelPending.mock.calls.length).toBe(cancelsAfterFirstLoad + 1);
    expect(mocks.engines[0].setVolume).toHaveBeenCalledTimes(1);
    const cancelCalls = controller.cancelPending.mock.invocationCallOrder;
    const cancelOrder = cancelCalls[cancelCalls.length - 1];
    await nextTick();
    expect(mocks.engines[0].setVolume).toHaveBeenCalledTimes(2);
    const secondSetVolumeOrder = mocks.engines[0].setVolume.mock.invocationCallOrder[1];
    expect(cancelOrder).toBeLessThan(secondSetVolumeOrder);
  });

  it('creates the controller while loading a volume so a later swap can cancel it', async () => {
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();

    expect(mocks.controllers).toHaveLength(0);
    setPanoVolume(makeVolume());
    await nextTick();
    expect(mocks.controllers).toHaveLength(1);

    setPanoVolume(makeVolume());
    await nextTick();
    expect(mocks.controllers[0].cancelPending.mock.calls.length).toBeGreaterThanOrEqual(1);
    // 볼륨 교체만으로는 새 추출이 예약되지 않는다.
    expect(mocks.controllers[0].schedule).not.toHaveBeenCalled();
  });
});
