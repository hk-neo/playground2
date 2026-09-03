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

function makeVolume(
  dimensions: [number, number, number] = [4, 4, 4],
  spacing: [number, number, number] = [1, 1, 1],
): VolumeData {
  return {
    buffer: new ArrayBuffer(dimensions[0] * dimensions[1] * dimensions[2] * 2),
    dimensions,
    spacing,
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
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    mocks.engines.length = 0;
    mocks.controllers.length = 0;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it('crops modal and final CPR requests from the chin to 50mm above the editing axial slice', async () => {
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();
    setPanoVolume(makeVolume([20, 20, 200], [0.5, 0.5, 0.5]));
    await nextTick();

    const slider = document.getElementById('modal-axial-slider') as HTMLInputElement;
    slider.value = '80';
    slider.dispatchEvent(new Event('input'));
    document.getElementById('ce-preset-arch')!.click();
    await nextTick();

    const controller = mocks.controllers[0];
    expect(controller.schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      quality: 'final',
      options: expect.objectContaining({
        pixelSize: 0.3,
        depthRangeMm: [9.5, 100],
      }),
    }));

    document.getElementById('ce-apply')!.click();
    await nextTick();
    expect(controller.schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      quality: 'final',
      options: expect.objectContaining({ depthRangeMm: [9.5, 100] }),
    }));
  });

  it('reschedules the cropped preview when the editing axial slice changes', async () => {
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();
    setPanoVolume(makeVolume([20, 20, 100], [1, 1, 1]));
    await nextTick();

    document.getElementById('ce-preset-arch')!.click();
    await nextTick();
    const controller = mocks.controllers[0];
    const callsBeforeSliceChange = controller.schedule.mock.calls.length;

    const slider = document.getElementById('modal-axial-slider') as HTMLInputElement;
    slider.value = '20';
    slider.dispatchEvent(new Event('input'));
    await nextTick();

    expect(controller.schedule).toHaveBeenCalledTimes(callsBeforeSliceChange + 1);
    expect(controller.schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      options: expect.objectContaining({ depthRangeMm: [29, 100] }),
    }));
  });

  it('restores a cropped full-resolution request when curve dragging is cancelled', async () => {
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();
    setPanoVolume(makeVolume([20, 20, 200], [0.5, 0.5, 0.5]));
    await nextTick();
    document.getElementById('btn-pano-edit')!.click();
    document.getElementById('ce-preset-arch')!.click();
    await nextTick();

    const canvas = document.getElementById('modal-axial-canvas') as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 3, clientY: 3 }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { button: 0, clientX: 9, clientY: 3 }));
    await nextTick();
    const controller = mocks.controllers[0];
    expect(controller.schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      quality: 'preview',
      options: expect.objectContaining({ pixelSize: 0.6 }),
    }));
    const callsBeforeCancel = controller.schedule.mock.calls.length;

    canvas.dispatchEvent(new Event('pointercancel'));
    await nextTick();

    expect(controller.schedule).toHaveBeenCalledTimes(callsBeforeCancel + 1);
    expect(controller.schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      quality: 'final',
      options: expect.objectContaining({ pixelSize: 0.3, depthRangeMm: [0, 100] }),
    }));
  });

  it('drops an old queued preview without blocking a new-volume preview', async () => {
    const queuedFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();
    setPanoVolume(makeVolume([20, 20, 100], [1, 1, 1]));
    await nextTick();
    document.getElementById('ce-preset-arch')!.click();
    expect(queuedFrames).toHaveLength(1);

    setPanoVolume(makeVolume([20, 20, 120], [1, 1, 1]));
    const slider = document.getElementById('modal-axial-slider') as HTMLInputElement;
    slider.value = '20';
    slider.dispatchEvent(new Event('input'));
    expect(queuedFrames).toHaveLength(2);

    queuedFrames.shift()!(0);
    await nextTick();
    expect(mocks.controllers[0].schedule).not.toHaveBeenCalled();

    queuedFrames.shift()!(0);
    await nextTick();
    expect(mocks.controllers[0].schedule).toHaveBeenCalledTimes(1);
    expect(mocks.controllers[0].schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      options: expect.objectContaining({ depthRangeMm: [49, 120] }),
    }));
  });

  it('rejects invalid Z spacing before replacing the active volume', async () => {
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();
    setPanoVolume(makeVolume());
    await nextTick();
    const controller = mocks.controllers[0];
    const cancelCount = controller.cancelPending.mock.calls.length;

    expect(() => setPanoVolume(makeVolume([4, 4, 4], [1, 1, 0]))).toThrow(/spacing/i);
    expect(controller.cancelPending).toHaveBeenCalledTimes(cancelCount);
    expect(mocks.engines[0].setVolume).toHaveBeenCalledTimes(1);
  });

  it('coalesces curve and axial slice preview updates into one animation frame', async () => {
    const queuedFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();
    setPanoVolume(makeVolume([20, 20, 100], [1, 1, 1]));
    await nextTick();
    document.getElementById('ce-preset-arch')!.click();

    const slider = document.getElementById('modal-axial-slider') as HTMLInputElement;
    slider.value = '20';
    slider.dispatchEvent(new Event('input'));
    expect(mocks.controllers[0].schedule).not.toHaveBeenCalled();
    expect(queuedFrames).toHaveLength(1);

    queuedFrames.shift()!(0);
    await nextTick();
    expect(mocks.controllers[0].schedule).toHaveBeenCalledTimes(1);
    expect(mocks.controllers[0].schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      options: expect.objectContaining({ depthRangeMm: [29, 100] }),
    }));
  });

  it('invalidates a queued drag preview when pointer cancellation renders the final result', async () => {
    const queuedFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
    const { initPanoWiring, setPanoVolume } = await loadPanoWiring();
    initPanoWiring();
    setPanoVolume(makeVolume([20, 20, 200], [0.5, 0.5, 0.5]));
    await nextTick();
    document.getElementById('btn-pano-edit')!.click();
    queuedFrames.shift()!(0);
    document.getElementById('ce-preset-arch')!.click();
    queuedFrames.shift()!(0);
    await nextTick();

    const canvas = document.getElementById('modal-axial-canvas') as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 3, clientY: 3 }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { button: 0, clientX: 9, clientY: 3 }));
    expect(queuedFrames).toHaveLength(1);

    canvas.dispatchEvent(new Event('pointercancel'));
    await nextTick();
    const controller = mocks.controllers[0];
    const callsAfterFinal = controller.schedule.mock.calls.length;
    expect(controller.schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      quality: 'final',
      options: expect.objectContaining({ pixelSize: 0.3, depthRangeMm: [0, 100] }),
    }));

    queuedFrames.shift()!(0);
    await nextTick();
    expect(controller.schedule).toHaveBeenCalledTimes(callsAfterFinal);
  });
});
