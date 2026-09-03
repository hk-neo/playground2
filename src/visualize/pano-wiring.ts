/**
 * Pano wiring — dental Z crop + full in-plane 자동, mode 버튼만, WL/WW는 MPR view에서 연동.
 */
import { ViewLayoutManager } from '../app/view-layout-manager';
import { computeLayoutFlex } from '../app/layout-flex';
import {
  PanoramicCurve, FocalTrough, CurveEditorController, CurveEditorView,
  PanoView, PanoRenderer, hitTestCanvasPoint,
  GpuCprViewport,
  CurveFrameSampler, buildCrossSectionSpec, extractCrossSection,
} from '../pano';
import { renderMprSlice, installWlwwSync, setSharedWlww, getWlwwApplier } from '../pano/slice-renderer';
import { computeAutoWLWW } from '../pano/pano-auto-wlww';
import { createCprEngine, validateVolume } from '../cpr';
import type { CprEngine, CprMode, CprResult, CprVolume } from '../cpr';
import { CprRequestController, type CprRequest } from './cpr-request-controller';
import type { LayoutRegion, LayoutSnapshot } from '../shared/interfaces/layout';
import type { VolumeData } from '../shared/types/volume';
import { MPRPlane } from '../shared/types/rendering';

let initialized = false;
let currentVolume: VolumeData | null = null;
let layout: ViewLayoutManager;

/**
 * layout/창 리사이즈로 캔버스 크기가 바뀐 뒤 dispatch되는 커스텀 이벤트 이름.
 * main.ts가 이 이벤트를 받아 renderAll()로 슬라이스를 다시 그린다 —
 * resizeCanvases가 canvas.width/height를 재할당하면 비트맵이 초기화되므로,
 * 별도 트리거 없이는 다음 슬라이더/휠 입력까지 이미지가 비어 있다.
 */
export const LAYOUT_RESIZED_EVENT = 'cbct-layout-resized';
/** 파노라마에서 curve 위치를 선택했을 때 3D 단면 갱신용 이벤트 */
export const PANORAMA_PICK_EVENT = 'cbct-pano-pick';
let curveEditorCtl: CurveEditorController;
let curveEditorView: CurveEditorView;
let focalTrough: FocalTrough;
// 공개 CPR 엔진(src/cpr) — 메인 + 모달 preview 결과 일치를 위한 단일 인스턴스.
// (renderPanoPreview 실시간 drag preview는 focalTrough CPU로 가볍게 유지 — 60fps 보존)
let panoThicknessMm = 15;
let panoMode: CprMode = 'mean';
const CPR_SUPERIOR_MARGIN_MM = 50;
let cprEnginePromise: Promise<CprEngine> | null = null;
let cprControllerPromise: Promise<CprRequestController> | null = null;
let cprController: CprRequestController | null = null;
let cprVolumeReady: Promise<void> = Promise.resolve();
// 볼륨 교체(시리즈 변경) 세대. setPanoVolume마다 증가하며, 이 값이 바뀌면
// 그 전에 예약된 추출은 옛 볼륨 기준이므로 폐기한다(새 볼륨에 렌더 방지).
let cprVolumeGeneration = 0;
let panoView: PanoView;
let panePanoView: PanoView;
let gpuPano: GpuCprViewport | null = null;
let gpuActive = false;
// Cross-section(orthogonal/tangential) 렌더 상태.
let curveSampler: CurveFrameSampler | null = null;
let selectedU = 0.5; // panorama에서 선택된 curve 위치 (0..1, arc-length normalized)
// Auto WL/WW: extract 후 데이터 분포에 기반해 WL/WW를 자동 계산.
// 사용자가 슬라이더로 수동 조정하면 true가 되어 auto가 비활성화됨.
// setPanoVolume(새 볼륨 로드) 시 false로 리셋.
let userOverrodeWLWW = false;
let workspace: HTMLElement;
let regionTop: HTMLElement;
let regionBottomLeft: HTMLElement;
let regionBottomRow: HTMLElement;
let regionBottomRight: HTMLElement;
let resizeH: HTMLDivElement;
let resizeV: HTMLDivElement;
let curveEditorModal: HTMLElement;
let btnPanoEdit: HTMLButtonElement;
let ceState: HTMLElement;
let cePointList: HTMLElement;
let cePointCount: HTMLElement;
let ceUndo: HTMLButtonElement;
let ceRedo: HTMLButtonElement;
let ceApply: HTMLButtonElement;
let ceCancel: HTMLButtonElement;
let ceClose: HTMLButtonElement;
let cePresetEllipse: HTMLButtonElement;
let cePresetArch: HTMLButtonElement;
let modalAxialCanvas: HTMLCanvasElement;
let modalPanoCanvas: HTMLCanvasElement;
let ceModeMin: HTMLButtonElement;
let ceModeMax: HTMLButtonElement;
let ceModeMean: HTMLButtonElement;
let modalAxialSlider: HTMLInputElement;
let modalAxialSliderVal: HTMLElement;
let panoCanvas: HTMLCanvasElement;
let panoTag: HTMLElement;
let axialCanvas: HTMLCanvasElement;
let coronalCanvas: HTMLCanvasElement;
let sagittalCanvas: HTMLCanvasElement;

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`pano-wiring: #${id} not found`);
  return el;
};

export function initPanoWiring(): void {
  if (initialized) return;
  initialized = true;

  workspace = $('workspace');
  regionTop = $('region-top');
  regionBottomLeft = $('region-bottom-left');
  regionBottomRow = document.querySelector('.region-bottom-row') as HTMLElement;
  regionBottomRight = $('region-bottom-right');
  resizeH = $('resize-h') as HTMLDivElement;
  resizeV = $('resize-v') as HTMLDivElement;
  curveEditorModal = $('curve-editor-modal');
  btnPanoEdit = $('btn-pano-edit') as HTMLButtonElement;
  ceState = $('ce-state');
  cePointList = $('ce-point-list');
  cePointCount = $('ce-point-count');
  ceUndo = $('ce-undo') as HTMLButtonElement;
  ceRedo = $('ce-redo') as HTMLButtonElement;
  ceApply = $('ce-apply') as HTMLButtonElement;
  ceCancel = $('ce-cancel') as HTMLButtonElement;
  ceClose = $('ce-close') as HTMLButtonElement;
  cePresetEllipse = $('ce-preset-ellipse') as HTMLButtonElement;
  cePresetArch = $('ce-preset-arch') as HTMLButtonElement;
  modalAxialCanvas = $('modal-axial-canvas') as HTMLCanvasElement;
  modalPanoCanvas = $('modal-pano-canvas') as HTMLCanvasElement;
  panePanoView = new PanoView();
  ceModeMin = $('ce-mode-min') as HTMLButtonElement;
  ceModeMax = $('ce-mode-max') as HTMLButtonElement;
  ceModeMean = $('ce-mode-mean') as HTMLButtonElement;
  modalAxialSlider = $('modal-axial-slider') as HTMLInputElement;
  modalAxialSliderVal = $('modal-axial-val');
  panoCanvas = $('pano-canvas') as HTMLCanvasElement;
  panoTag = $('pano-tag');
  axialCanvas = $('axial-canvas') as HTMLCanvasElement;
  coronalCanvas = $('coronal-canvas') as HTMLCanvasElement;
  sagittalCanvas = $('sagittal-canvas') as HTMLCanvasElement;

  layout = new ViewLayoutManager();
  curveEditorCtl = new CurveEditorController();
  curveEditorView = new CurveEditorView();
  // full CBCT z + full 머리 깊이, max mode (치아/뼈 강조)
  focalTrough = new FocalTrough({ thickness: 15, mode: 'max' });
  // CPR 엔진(공개 API) 기본 옵션: thickness=15mm, pixelSize=0.3mm, mode='mean'.
  // 값은 요청별 옵션으로 전달되며, 여기서 초기값만 리셋한다.
  // mode='mean' — 'max'는 단일 bone voxel(3000+ HU)에 saturate해서 panorama가 모두
  // 255(흰색)로 칠해진 user report. mean은 ray 평균이라 다양한 강도가 살아남는다.
  panoThicknessMm = 15;
  panoMode = 'mean';
  panoView = new PanoView();

  curveEditorCtl.onStateChange(() => syncCurveEditorState());
  curveEditorCtl.onCurveChange((curve) => {
    if (!curveEditorModal.hidden) {
      renderModalAxialSlice();
      curveEditorView.setCurve(curve);
      // renderModalPanoPreview는 무겁다(detectBestDepthRange + extract). Drag 중 pointermove가
      // 100Hz로 발화되면 매번 extract → 누적 1초+. rAF로 throttle하여 다음 frame에서
      // 한 번만 실행 (60fps 보장).
      queueModalPanoPreview();
    }
    syncCurveEditorState();
  });

  // GPU CPR(WebGL2)는 메인/모달 파노라마 FOV를 다르게 만든다(수평 좌표를 arc-length 대신
  // uniform-t로 샘플 + 캔버스 비율 무시 스트레치 + 초점단 두께 2배 불일치). CPU ArchPresser가
  // modal preview와 동일한(정확한) 결과를 보장하므로 메인 파노라마는 CPU 경로로 고정한다.
  gpuActive = false;
  gpuPano = null;

  curveEditorView.mount({
    axial: axialCanvas,
    coronal: coronalCanvas,
    sagittal: sagittalCanvas,
  });

  setupLayout();
  setupCurveEditor();
  syncCurveEditorState();
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
  window.addEventListener('pagehide', disposePanoCpr, { once: true });
  wirePanoPick();

  if (currentVolume) {
    syncModalFromVolume();
  }
}

function syncModalFromVolume(): void {
  if (!currentVolume) return;
  const [dx, dy, dz] = currentVolume.dimensions;
  modalAxialSlider.max = String(dz - 1);
  modalAxialSlider.value = String(curveEditorCtl.getActiveSlice(MPRPlane.Axial));
  modalAxialSliderVal.textContent = modalAxialSlider.value;
}

export function applyWlwwToPano(wl: number, ww: number): void {
  if (gpuActive && gpuPano) {
    gpuPano.setWLWW(wl, ww);
  } else {
    if (panoView) { panoView.setWLWW(wl, ww); panoView.render(panoCanvas); }
    if (panePanoView) { panePanoView.setWLWW(wl, ww); panePanoView.render(modalPanoCanvas); }
  }
}

export function setPanoVolume(
  volume: VolumeData | null,
  windowLevel = 500,
  windowWidth = 2500,
): void {
  const cprVolume = volume ? toCprVolume(volume) : null;
  if (cprVolume) validateVolume(cprVolume);
  cancelQueuedModalPanoPreview();
  currentVolume = volume;
  userOverrodeWLWW = false; // 새 볼륨 로드 → auto WL/WW 다시 활성화
  // 볼륨(시리즈) 교체 → 이전 볼륨 기준으로 진행 중/대기 중인 추출을 무효화한다.
  // 세대를 올려 옛 결과가 새 볼륨 위에 렌더되는 것을 막는다.
  cprVolumeGeneration += 1;
  cprController?.cancelPending();
  setSharedWlww(windowLevel, windowWidth);
  panoView.setWLWW(windowLevel, windowWidth);
  panePanoView.setWLWW(windowLevel, windowWidth);
  if (volume) {
    const [dx, dy, dz] = volume.dimensions;
    curveEditorCtl.setActiveSlice(MPRPlane.Axial, Math.floor(dz / 2));
    curveEditorCtl.setActiveSlice(MPRPlane.Coronal, Math.floor(dy / 2));
    curveEditorCtl.setActiveSlice(MPRPlane.Sagittal, Math.floor(dx / 2));
    syncModalFromVolume();
    // Full CBCT z range (머리끝~턱끝)
    focalTrough.setDepthRangeVox(0, dz - 1);
    // Full 머리 front-to-back depth
    const sp = volume.spacing;
    const headDepth = Math.max(dx * sp[0], dy * sp[1]);
    focalTrough.setThickness(headDepth);
    // 볼륨 변경 → CPR 엔진에 setVolume. 직렬 체인으로 순서 보장.
    // 컨트롤러도 함께 확보해둬야 이후 볼륨 교체 시 진행 중 추출을 취소할 수 있다.
    cprVolumeReady = cprVolumeReady
      .then(() => ensureCprController())
      .then(() => ensureCprEngine())
      .then((engine) => engine.setVolume(cprVolume!))
      .catch((error) => {
        console.error('pano-wiring: CPR setVolume failed', error);
      });
  }
  if (gpuActive && gpuPano) {
    gpuPano.setVolume(volume);
    gpuPano.setWLWW(windowLevel, windowWidth);
  }
}

function applyLayout(snap: LayoutSnapshot): void {
  const f = computeLayoutFlex(snap);
  (regionTop as HTMLElement).style.flex = f.top;
  (regionBottomRow as HTMLElement).style.flex = f.bottomRow;
  (regionBottomLeft as HTMLElement).style.flex = f.bottomLeft;
  (regionBottomRight as HTMLElement).style.flex = f.bottomRight;
  resizeCanvases();
}

function setupLayout(): void {
  layout.onChange(applyLayout);
  const initial = layout.getSnapshot();
  applyLayout(initial);
  wireResizeHandles();
  wireMaximizeButtons();
}

function wireMaximizeButtons(): void {
  for (const btn of Array.from(document.querySelectorAll('.vp-max'))) {
    const region = btn.getAttribute('data-region') as 'top' | 'bottom-left' | 'bottom-right' | null;
    if (!region) continue;
    btn.addEventListener('click', () => {
      const current = layout.getSnapshot();
      if (current.maximized === region) {
        layout.restore();
      } else {
        layout.maximize(region);
      }
    });
  }
}

function wireResizeHandles(): void {
  // Drag the horizontal split (between 3D top region and panoramic/MPR bottom row)
  resizeH.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    resizeH.classList.add('dragging');
    const startY = e.clientY;
    const initial = layout.getSnapshot();
    const startTop = initial.ratios.top;
    const workspaceRect = workspace.getBoundingClientRect();
    const totalH = workspaceRect.height;
    const onMove = (ev: MouseEvent) => {
      const delta = (ev.clientY - startY) / Math.max(1, totalH);
      // ratio is for the TOP region in [0..1] (clamped by manager)
      layout.setRatio('top', startTop + delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizeH.classList.remove('dragging');
      try { layout.save(); } catch { /* ignore */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Drag the vertical split (between bottom-left panorama and bottom-right MPR strip)
  resizeV.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    resizeV.classList.add('dragging');
    const startX = e.clientX;
    const initial = layout.getSnapshot();
    const startLeft = initial.ratios['bottom-left'] /
      Math.max(0.001, initial.ratios['bottom-left'] + initial.ratios['bottom-right']);
    const bottomRect = regionBottomRow.getBoundingClientRect();
    const totalW = bottomRect.width;
    const onMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) / Math.max(1, totalW);
      layout.setRatio('bottom-left', startLeft + delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizeV.classList.remove('dragging');
      try { layout.save(); } catch { /* ignore */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function setupCurveEditor(): void {
  curveEditorView.mount({
    axial: axialCanvas,
    coronal: coronalCanvas,
    sagittal: sagittalCanvas,
  });
  ceClose.addEventListener('click', cancelCurveEditor);
  ceApply.addEventListener('click', applyCurveEditor);
  ceCancel.addEventListener('click', cancelCurveEditor);
  btnPanoEdit.addEventListener('click', openCurveEditor);

  cePresetEllipse.addEventListener('click', () => {
    if (currentVolume) curveEditorCtl.loadPreset('Ellipse', currentVolume);
  });
  cePresetArch.addEventListener('click', () => {
    if (currentVolume) curveEditorCtl.loadPreset('Arch', currentVolume);
  });
  ceUndo.addEventListener('click', () => curveEditorCtl.undo());
  ceRedo.addEventListener('click', () => curveEditorCtl.redo());
  // Trough mode
  const onModeChange = () => {
    panoMode = focalTrough.mode;
    if (gpuActive && gpuPano) {
      gpuPano.setProjection(focalTrough.mode);
    }
    updateTroughModeActive();
    renderModalPanoPreview();
  };
  ceModeMin.addEventListener('click', () => { focalTrough.setMode('min'); onModeChange(); });
  ceModeMax.addEventListener('click', () => { focalTrough.setMode('max'); onModeChange(); });
  ceModeMean.addEventListener('click', () => { focalTrough.setMode('mean'); onModeChange(); });
  updateTroughModeActive();

  // WL/WW slider 변경 시 panorama에도 적용 + auto WL/WW 비활성화
  window.addEventListener('wlww-changed', ((e: Event) => {
    const ev = e as CustomEvent<{ wl: number; ww: number }>;
    const wl = ev.detail?.wl ?? 0;
    const ww = ev.detail?.ww ?? 400;
    userOverrodeWLWW = true; // 사용자 수동 조정 — auto WL/WW 중지
    applyWlwwToPano(wl, ww);
  }) as EventListener);

  // 키보드 단축키
  document.addEventListener('keydown', onCurveEditorKeydown);

  // 모달 Axial slice 슬라이더 — setActiveSlice는 listener를 emit하지 않으므로
  // 슬라이더 변경 시 명시적으로 modal axial view를 다시 그린다 (실시간 갱신).
  modalAxialSlider.addEventListener('input', () => {
    if (!currentVolume) return;
    const v = +modalAxialSlider.value;
    curveEditorCtl.setActiveSlice(MPRPlane.Axial, v);
    modalAxialSliderVal.textContent = modalAxialSlider.value;
    renderModalAxialSlice();
    queueModalPanoPreview();
  });
}

function cancelCurveEditor(): void {
  curveEditorCtl.cancel();
  if (curveEditorModal) curveEditorModal.hidden = true;
}

function applyCurveEditor(): void {
  if (curveEditorCtl.curve.points.length < 2) return;
  curveEditorCtl.apply();
  cancelQueuedModalPanoPreview();
  renderPanoFinal();
  if (curveEditorModal) curveEditorModal.hidden = true;
}

function onCurveEditorKeydown(e: KeyboardEvent): void {
  if (curveEditorModal.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); cancelCurveEditor(); return; }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault(); curveEditorCtl.undo(); return;
  }
  if ((e.metaKey || e.ctrlKey) && (e.shiftKey && e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
    e.preventDefault(); curveEditorCtl.redo(); return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (curveEditorCtl.curve.points.length >= 2) applyCurveEditor();
  }
}

function syncCurveEditorState(): void {
  ceState.textContent = curveEditorCtl.state;
  ceUndo.disabled = !curveEditorCtl.canUndo;
  ceRedo.disabled = !curveEditorCtl.canRedo;
  const n = curveEditorCtl.curve.points.length;
  cePointCount.textContent = String(n);
  if (n === 0) {
    cePointList.innerHTML = '<div style="color:var(--text-muted); padding:8px 0;">No points yet.</div>';
  } else {
    cePointList.innerHTML = '';
    curveEditorCtl.curve.points.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'curve-point';
      const coord = document.createElement('span');
      coord.className = 'curve-point-coord';
      coord.textContent = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
      const id = document.createElement('span');
      id.className = 'curve-point-id';
      id.textContent = `#${i}`;
      const del = document.createElement('button');
      del.className = 'curve-point-del';
      del.textContent = '✕';
      del.addEventListener('click', () => curveEditorCtl.removePoint(i));
      row.append(id, coord, del);
      cePointList.appendChild(row);
    });
  }
  panoTag.textContent = curveEditorCtl.state === 'Applied' ? 'Panoramic' : 'Panoramic (Preview)';
}


/**
 * 사용자가 그린 curve의 평균 z. detectBestDepthRange에 searchCenterZ로 넘기면 z 적분
 * 범위를 그 주변 ±halfRange 슬라이스로 좁혀 다른 z의 arch가 IP에 섞이는 것을 방지한다
 * (ripple/찌그러짐 artifact 제거).
 */
function userCurveZ(curve: { points: ReadonlyArray<{ z: number }> }): number {
  if (curve.points.length === 0) return 0;
  let sum = 0;
  for (const p of curve.points) sum += p.z;
  return sum / curve.points.length;
}

function dentalDepthRangeMm(volume: VolumeData): [number, number] {
  const depth = volume.dimensions[2];
  const spacingZ = volume.spacing[2] || 1;
  const lastSlice = depth - 1;
  const editingSlice = Math.max(
    0,
    Math.min(lastSlice, curveEditorCtl.getActiveSlice(MPRPlane.Axial)),
  );
  const superiorSlice = Math.min(lastSlice, editingSlice + CPR_SUPERIOR_MARGIN_MM / spacingZ);

  // CPR depth is inverted: 0mm starts at the superior end, while storage z=0 is the chin.
  return [(lastSlice - superiorSlice) * spacingZ, depth * spacingZ];
}

function toCprVolume(volume: VolumeData): CprVolume {
  const view = volume as VolumeData & { byteOffset?: number; dataLength?: number };
  const byteOffset = view.byteOffset ?? 0;
  const data = volume.dataType === 'int16'
    ? new Int16Array(volume.buffer, byteOffset, view.dataLength)
    : new Uint16Array(volume.buffer, byteOffset, view.dataLength);
  return { data, dimensions: volume.dimensions, spacing: volume.spacing };
}

function ensureCprEngine(): Promise<CprEngine> {
  if (!cprEnginePromise) {
    cprEnginePromise = createCprEngine({ backend: 'auto' });
  }
  return cprEnginePromise;
}

function ensureCprController(): Promise<CprRequestController> {
  if (!cprControllerPromise) {
    cprControllerPromise = ensureCprEngine().then((engine) => {
      const controller = new CprRequestController({
        engine,
        onResult: applyCprResult,
        onError: (error) => console.error('pano-wiring: CPR extract failed', error),
      });
      cprController = controller;
      return controller;
    });
  }
  return cprControllerPromise;
}

function scheduleCprExtract(request: CprRequest): void {
  // setVolume 완료 후에만 extract가 돌도록 직렬 체인을 먼저 기다린다.
  // 예약 시점의 볼륨 세대를 캡처해, 대기 중에 볼륨이 교체되면 옛 요청을 폐기한다.
  const generation = cprVolumeGeneration;
  void cprVolumeReady
    .then(() => ensureCprController())
    .then((controller) => {
      if (generation !== cprVolumeGeneration) return;
      controller.schedule(request);
    })
    .catch((error) => {
      console.error('pano-wiring: CPR schedule failed', error);
    });
}

function applyCprResult(result: CprResult): void {
  const { data, width, height } = result;

  // WL/WW: 사용자가 수동 조정하지 않았으면 데이터 분포 기반 auto.
  if (!userOverrodeWLWW) {
    const auto = computeAutoWLWW(data);
    panoView.setWLWW(auto.wl, auto.ww);
    panePanoView.setWLWW(auto.wl, auto.ww);
  }

  panoView.setIntensityMap(data, width, height);
  panePanoView.setIntensityMap(data, width, height);
  const ctx = panoCanvas.getContext('2d');
  if (ctx) panoView.render(panoCanvas);
  const modalCtx = modalPanoCanvas ? modalPanoCanvas.getContext('2d') : null;
  if (modalCtx) panePanoView.render(modalPanoCanvas);
}

function disposePanoCpr(): void {
  cprController?.dispose();
  cprController = null;
  cprControllerPromise = null;
  // 진행 중인 setVolume 이후에 엔진을 정리한다. 체인 콜백은 마이크로태스크에서
  // 모듈 변수를 읽으므로, 널 대입 전에 반드시 로컬로 캡처해야 한다.
  const enginePromise = cprEnginePromise;
  cprEnginePromise = null;
  cprVolumeReady = cprVolumeReady
    .then(() => enginePromise)
    .then((engine) => {
      engine?.dispose();
    })
    .catch(() => { /* teardown 중 오류는 무시 */ });
}

function renderPanoPreview(): void {
  if (!currentVolume) return;
  if (curveEditorCtl.curve.points.length < 2) return;
  if (gpuActive && gpuPano) {
    gpuPano.setCurve(curveEditorCtl.curve);
    return;
  }
  // CPU preview: depth auto-detect를 user curve z 근처 ±10 슬라이스(약 ±5mm)로 좁힘.
  // 큰 CBCT에서 한 z slice에서 그린 curve로 전체 z IP하면 다른 z의 arch가 섞여 ripple/찌그러짐
  // artifact가 생긴다. user curve의 z에 집중해 arch 정확도↑.
  const userZ = userCurveZ(curveEditorCtl.curve);
  const { zMin, zMax } = focalTrough.detectBestDepthRange(currentVolume, { searchCenterZ: userZ, halfRange: 30 });
  focalTrough.setDepthRangeVox(zMin, zMax);
  // mm-based: 픽셀 수는 curve length/thickness와 spacing으로 자동 계산.
  const { data, curveWidth, inPlaneWidth } = focalTrough.extract(curveEditorCtl.curve, currentVolume);
  panoView.setIntensityMap(data, curveWidth, inPlaneWidth);
  const ctx = panoCanvas.getContext('2d');
  if (ctx) panoView.render(panoCanvas);
}

function renderPanoFinal(): void {
  if (!currentVolume) return;
  if (curveEditorCtl.curve.points.length < 2) return;
  const curve = curveEditorCtl.curve;
  const depthRangeMm = dentalDepthRangeMm(currentVolume);

  // cross-section(orthogonal/tangential)용 curve frame 샘플러 갱신.
  // 추출 결과와 무관하게 curve에만 의존하므로 즉시 갱신한다.
  curveSampler = new CurveFrameSampler(curve, 256);
  renderCrossSections();

  scheduleCprExtract({
    curve,
    quality: 'final',
    options: {
      thickness: panoThicknessMm,
      pixelSize: 0.3, // 풀해상도
      mode: panoMode,
      depthRangeMm,
    },
  });
}

/** HU → 0..255 그레이스케일 (dental bone window 호환) */
function applyWindowForCrossSection(value: number, wl: number, ww: number): number {
  if (ww <= 0) return 128;
  const low = wl - ww / 2;
  const high = wl + ww / 2;
  if (value <= low) return 0;
  if (value >= high) return 255;
  return Math.round(((value - low) / ww) * 255);
}

function renderCrossSectionCanvas(
  canvas: HTMLCanvasElement,
  spec: ReturnType<typeof buildCrossSectionSpec>,
  wl: number,
  ww: number,
): void {
  if (!currentVolume) return;
  const data = extractCrossSection(currentVolume, spec);
  const w = spec.outWidth;
  const h = spec.outHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w;
    const dstRow = y * w * 4;
    for (let x = 0; x < w; x++) {
      const v = applyWindowForCrossSection(data[srcRow + x], wl, ww);
      const d = dstRow + x * 4;
      img.data[d] = v;
      img.data[d + 1] = v;
      img.data[d + 2] = v;
      img.data[d + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function renderCrossSections(): void {
  if (!currentVolume || !curveSampler) {
    for (const c of [coronalCanvas, sagittalCanvas]) {
      const ctx = c?.getContext('2d');
      ctx?.clearRect(0, 0, c.width, c.height);
    }
    return;
  }
  const spacing = currentVolume.spacing;
  const sp0 = spacing[0] || 1;
  const sp1 = spacing[1] || 1;
  const sp2 = spacing[2] || 1;
  const avgInPlane = (sp0 + sp1) / 2;
  const frame = curveSampler.frameAtU(selectedU);
  const wlwwApplier = getWlwwApplier();
  const wl = wlwwApplier.windowLevel;
  const ww = wlwwApplier.windowWidth;

  // orthogonal/tangential 단면: 원본 voxel 해상도(1px ≈ 1voxel)로 추출해
  // 셀 표시 시 해상도가 떨어지지 않게 한다. 비등방 spacing은 세로 픽셀 수로 보정해
  // 실제 mm 비율이 유지되도록 한다. (표시는 .mpr의 object-fit:contain이 중앙 정렬)
  const orthoHalfVox = currentVolume.dimensions[0] / 2; // 협설(가로) 전체
  const tangHalfVox = currentVolume.dimensions[1] / 2;  // 접선(가로) 전체
  const zHalfVox = currentVolume.dimensions[2] / 2;     // 상하(z) 전체

  const makeSpec = (
    kind: 'orthogonal' | 'tangential',
    halfU: number,
  ) => {
    const outW = Math.max(32, Math.round(halfU * 2));
    const outH = Math.max(32, Math.round(zHalfVox * 2 * (sp2 / avgInPlane)));
    return buildCrossSectionSpec(kind, frame, halfU, zHalfVox, outW, outH);
  };

  const orthoSpec = makeSpec('orthogonal', orthoHalfVox);
  const tangSpec = makeSpec('tangential', tangHalfVox);
  renderCrossSectionCanvas(coronalCanvas, orthoSpec, wl, ww);
  renderCrossSectionCanvas(sagittalCanvas, tangSpec, wl, ww);
}

/** panorama 클릭/드래그 → curve 위치(u) 선택 → cross-section 갱신 */
function wirePanoPick(): void {
  let down = false;
  const update = (e: PointerEvent): void => {
    if (!currentVolume || !curveSampler) return;
    const rect = regionBottomLeft.getBoundingClientRect();
    if (rect.width <= 0) return;
    selectedU = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    renderCrossSections();
    // 3D 볼륨의 orthogonal/tangential 단면도 실시간 갱신
    window.dispatchEvent(new CustomEvent(PANORAMA_PICK_EVENT));
  };

  // 휠: focal trough 두께 조절 (밝기/대비 초기화 방지)
  regionBottomLeft.addEventListener('wheel', (e) => {
    if (!currentVolume || curveEditorCtl.curve.points.length < 2) return;
    e.preventDefault();
    const step = 0.5;
    const nt = Math.max(2, Math.min(40, panoThicknessMm + (e.deltaY < 0 ? step : -step)));
    panoThicknessMm = nt;
    focalTrough.setThickness(nt);
    userOverrodeWLWW = true; // auto WL/WW 재계산 방지
    renderPanoFinal();
  }, { passive: false });

  regionBottomLeft.addEventListener('pointerdown', (e) => {
    down = true;
    update(e);
    try { regionBottomLeft.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  regionBottomLeft.addEventListener('pointermove', (e) => {
    if (down) update(e);
  });
  window.addEventListener('pointerup', () => { down = false; });
}

function resizeCanvases(): void {
  const setSize = (el: HTMLElement, w: number, h: number) => {
    if (el.tagName === 'CANVAS') {
      (el as HTMLCanvasElement).width = w;
      (el as HTMLCanvasElement).height = h;
    }
  };
  const pr = regionBottomLeft.getBoundingClientRect();
  setSize(panoCanvas, Math.max(64, Math.floor(pr.width)), Math.max(64, Math.floor(pr.height)));
  const br = regionBottomRight.getBoundingClientRect();
  const cellW = Math.max(64, Math.floor(br.width / 3));
  const cellH = Math.max(64, Math.floor(br.height));
  setSize(axialCanvas, cellW, cellH);
  const tr = regionTop.getBoundingClientRect();
  setSize(document.getElementById('3d-canvas') as HTMLCanvasElement, Math.max(64, Math.floor(tr.width)), Math.max(64, Math.floor(tr.height)));
  if (curveEditorCtl.curve.points.length > 0) {
    curveEditorView.setCurve(curveEditorCtl.curve);
  }
  if (gpuActive && gpuPano) gpuPano.resize();

  // Modal canvases — modal이 열려있을 때만 사이즈 동기화.
  // 닫혀있을 때는 이전 사이즈 유지 (열릴 때 깜빡임 방지).
  if (curveEditorModal && !curveEditorModal.hidden) {
    // Modal Axial canvas: CBCT의 axial 평면 크기(dx × dy)에 맞춰야 voxel 좌표가
    // canvas 픽셀과 1:1로 일치한다. 기본 300×150이면 큰 CBCT에서 voxel (300+)가
    // canvas 밖에 그려져 점이 안 보이는 버그 발생. CSS max-width로 container에 맞춰
    // 표시되므로 canvas 내부 해상도는 dx × dy로 설정.
    if (modalAxialCanvas && currentVolume) {
      const [dx, dy] = currentVolume.dimensions;
      setSize(modalAxialCanvas, dx, dy);
    }
    // Modal Pano canvas: 부모(.modal-pano) 크기로 동기화. 기본 300×150은 너무 작아
    // preview가 보이지 않으므로 명시적으로 잡는다.
    if (modalPanoCanvas) {
      const mp = modalPanoCanvas.parentElement;
      if (mp) {
        setSize(modalPanoCanvas, Math.max(64, mp.clientWidth), Math.max(64, mp.clientHeight));
      }
    }
  }

  // canvas.width/height 할당은 비트맵을 초기화하므로 슬라이스 이미지가 사라진다.
  // main.ts의 renderAll()이 다시 renderSlice를 호출하도록 알려준다.
  // (휠/슬라이더 입력 외에는 redraw 트리거가 없는 문제를 해결)
  window.dispatchEvent(new CustomEvent(LAYOUT_RESIZED_EVENT));

  // 파노라마도 위 setSize로 비트맵이 초기화되므로, 캐시된 데이터로 즉시 다시 그린다.
  redrawPano();
}

/** 리사이즈 후 캐시된 파노라마 데이터를 다시 그린다 (재추출 없이 가볍게). */
function redrawPano(): void {
  if (panoView.getDataSize().width > 0) panoView.render(panoCanvas);
  if (panePanoView.getDataSize().width > 0 && modalPanoCanvas) panePanoView.render(modalPanoCanvas);
}

export { PanoramicCurve };

let modalAxialPointerBound = false;
let modalAxialSliderBound = false;
let modalWlwwListenerBound = false;

// Curve drag 중 modal pano preview를 저해상도(mmPerPixel=1)로 그리고,
// drag 끝나면 풀해상도(0.5)로 다시 그린다 — drag 중 60fps 유지 + 끝에 고품질 확정.
let isCurveDragging = false;
// rAF throttle: 연속된 onCurveChange 호출은 다음 frame에서 한 번만 renderModalPanoPreview 실행.
let panoPreviewQueuedGeneration: number | null = null;
let panoPreviewQueueToken = 0;

function cancelQueuedModalPanoPreview(): void {
  panoPreviewQueuedGeneration = null;
  panoPreviewQueueToken += 1;
}

function queueModalPanoPreview(): void {
  if (curveEditorCtl.curve.points.length < 2) return;
  const generation = cprVolumeGeneration;
  if (panoPreviewQueuedGeneration === generation) return;
  panoPreviewQueuedGeneration = generation;
  const token = ++panoPreviewQueueToken;
  requestAnimationFrame(() => {
    if (token !== panoPreviewQueueToken) return;
    panoPreviewQueuedGeneration = null;
    if (generation !== cprVolumeGeneration) return;
    renderModalPanoPreview();
  });
}

function renderModalAxialSlice(): void {
  if (!currentVolume) return;
  const z = curveEditorCtl.getActiveSlice(MPRPlane.Axial);
  renderMprSlice(modalAxialCanvas, MPRPlane.Axial, z, currentVolume!);
  // 슬라이스 재렌더 후 그려둔 curve 오버레이(컨트롤 포인트/스플라인)를 다시 그린다.
  curveEditorView.drawAll();
}

function overlayCurveOnModalAxial(): void {
  if (!modalAxialPointerBound) {
    modalAxialCanvas.addEventListener('click', (e: MouseEvent) => {
      if (!currentVolume) return;
      if (suppressNextModalClick) {
        suppressNextModalClick = false;
        return;
      }
      const rect = modalAxialCanvas.getBoundingClientRect();
      // Map display pixel → canvas internal pixel (= voxel coords for axial).
      const cx = (e.clientX - rect.left) * (modalAxialCanvas.width / rect.width);
      const cy = (e.clientY - rect.top) * (modalAxialCanvas.height / rect.height);
      // canvasToWorld가 renderMprSlice의 Y-flip을 내부적으로 반영하므로
      // 여기서 별도로 flip하지 않는다. flip을 양쪽에서 동시에 하면
      // 점이 화면상 반전된 위치에 그려진다.
      curveEditorCtl.addPointFromCanvasPoint(
        MPRPlane.Axial,
        { x: cx, y: cy },
        currentVolume!,
      );
    });
    wireModalAxialDrag();
    modalAxialPointerBound = true;
  }
}

let suppressNextModalClick = false;

function wireModalAxialDrag(): void {
  let dragIndex = -1;
  let dragged = false;
  let startX = 0;
  let startY = 0;

  // 휠: axial 슬라이스 이동
  modalAxialCanvas.addEventListener('wheel', (e: WheelEvent) => {
    if (!currentVolume) return;
    e.preventDefault();
    const max = +modalAxialSlider.max;
    const cur = +modalAxialSlider.value;
    const next = Math.max(0, Math.min(max, cur + (e.deltaY > 0 ? 1 : -1)));
    if (next !== cur) {
      modalAxialSlider.value = String(next);
      modalAxialSliderVal.textContent = String(next);
      curveEditorCtl.setActiveSlice(MPRPlane.Axial, next);
      renderModalAxialSlice();
      queueModalPanoPreview();
    }
  }, { passive: false });

  modalAxialCanvas.addEventListener('pointerdown', (event) => {
    if (!currentVolume || event.button !== 0) return;
    const rect = modalAxialCanvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? modalAxialCanvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? modalAxialCanvas.height / rect.height : 1;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    dragIndex = hitTestCanvasPoint(
      curveEditorCtl.curve,
      MPRPlane.Axial,
      { x, y },
      10 * Math.max(scaleX, scaleY),
      modalAxialCanvas,
    );
    dragged = false;
    startX = event.clientX;
    startY = event.clientY;
    if (dragIndex >= 0) {
        isCurveDragging = true;
        modalAxialCanvas.setPointerCapture(event.pointerId);
      }
  });

  modalAxialCanvas.addEventListener('pointermove', (event) => {
    if (!currentVolume || dragIndex < 0) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 4) dragged = true;
    if (!dragged) return;
    const rect = modalAxialCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (modalAxialCanvas.width / Math.max(1, rect.width));
    const y = (event.clientY - rect.top) * (modalAxialCanvas.height / Math.max(1, rect.height));
    curveEditorCtl.movePointFromCanvasDrag(dragIndex, MPRPlane.Axial, { x, y }, currentVolume);
  });

  modalAxialCanvas.addEventListener('pointerup', () => {
    suppressNextModalClick = dragged || dragIndex >= 0;
    dragIndex = -1;
    if (isCurveDragging) {
      isCurveDragging = false;
      cancelQueuedModalPanoPreview();
      // drag 끝 → 대기 중인 저해상도 frame을 버리고 풀해상도로 즉시 갱신.
      if (curveEditorCtl.curve.points.length >= 2) renderModalPanoPreview();
    }
    dragged = false;
  });

  modalAxialCanvas.addEventListener('pointercancel', () => {
    suppressNextModalClick = true;
    dragIndex = -1;
    if (isCurveDragging) {
      isCurveDragging = false;
      cancelQueuedModalPanoPreview();
      if (curveEditorCtl.curve.points.length >= 2) renderModalPanoPreview();
    }
    dragged = false;
  });
}

function openCurveEditor(): void {
  if (!currentVolume) return;
  installWlwwSync();
  curveEditorModal.hidden = false;
  if (curveEditorCtl.state === 'Idle') {
    curveEditorCtl.beginDrawing();
  }
  syncModalFromVolume();
  // Modal이 열렸으니 modal-pano canvas 사이즈를 부모에 맞춰 잡는다 (resizeCanvases 내부에서
  // !curveEditorModal.hidden 체크). 또한 GPU CPR의 viewport도 동기화.
  resizeCanvases();
  // Re-render on WL/WW changes (modal preview stays in sync).
  if (!modalWlwwListenerBound) {
    modalWlwwListenerBound = true;
    window.addEventListener('wlww-changed', () => {
      if (curveEditorModal.hidden) return;
      renderModalAxialSlice();
      curveEditorView.drawAll();
      if (curveEditorCtl.curve.points.length >= 2) renderModalPanoPreview();
    });
  }
  requestAnimationFrame(() => {
    // 1) Draw the axial MPR slice to the modal canvas (so the CT is visible).
    renderModalAxialSlice();

    // 2) Mount curve editor for overlay only on the now-CT-filled axial canvas.
    curveEditorView.mount({
      axial: modalAxialCanvas,
      coronal: modalAxialCanvas,
      sagittal: modalAxialCanvas,
    });
    curveEditorView.setActivePlane(MPRPlane.Axial);
    curveEditorView.setCurve(curveEditorCtl.curve);
    curveEditorView.drawAll();

    // 3) Modal pano preview (CPU or GPU path handled inside renderModalPanoPreview).
    if (curveEditorCtl.curve.points.length >= 2) {
      renderModalPanoPreview();
    }

    // 4) Click/drag point editing on modal axial canvas (one-time wiring).
    overlayCurveOnModalAxial();
  });
}

function renderModalPanoPreview(): void {
  if (!currentVolume) return;
  if (curveEditorCtl.curve.points.length < 2) return;
  if (gpuActive && gpuPano) {
    gpuPano.setCurve(curveEditorCtl.curve);
    // NOTE: modal 안에는 GPU canvas가 없으므로 아래 CPU path도 항상 실행.
  }
  // 공개 CPR 엔진 — 메인과 동일한 developable surface panorama 알고리즘. 결과 일치.
  // Drag 중에는 저해상도(pixelSize=0.6), 끝나면 풀해상도(0.3). pointerup에서 즉시 갱신.
  // 편집 axial 평면 위 50mm부터 턱까지로 제한해 불필요한 superior Z 계산을 피한다.
  const depthRangeMm = dentalDepthRangeMm(currentVolume);
  scheduleCprExtract({
    curve: curveEditorCtl.curve,
    quality: isCurveDragging ? 'preview' : 'final',
    options: {
      thickness: panoThicknessMm,
      pixelSize: isCurveDragging ? 0.6 : 0.3,
      mode: panoMode,
      depthRangeMm,
    },
  });
}

function updateTroughModeActive(): void {
  const mode = focalTrough.mode;
  for (const [btn, m] of [[ceModeMin, 'min'], [ceModeMax, 'max'], [ceModeMean, 'mean']] as const) {
    btn.classList.toggle('active', mode === m);
  }
}

/**
 * 3D 볼륨에 orthogonal/tangential 단면을 그리기 위한 curve 프레임을 반환한다.
 * main.ts의 3D 렌더러가 호출. curve가 적용되기 전이면 null.
 * 좌표는 storage voxel 기준.
 */
export interface Pano3DFrame {
  center: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };   // 협설 (tangential 평면의 법선)
  tangent: { x: number; y: number; z: number };  // 접선 (orthogonal 평면의 법선)
}

export function getCurveFrameFor3D(): Pano3DFrame | null {
  if (!currentVolume || !curveSampler) return null;
  const f = curveSampler.frameAtU(selectedU);
  return {
    center: { x: f.position.x, y: f.position.y, z: f.position.z },
    normal: { x: f.normal.x, y: f.normal.y, z: f.normal.z },
    tangent: { x: f.tangent.x, y: f.tangent.y, z: f.tangent.z },
  };
}

/** 3D 볼륨에 파노라마 곡면(curve를 z로 extrude)을 그리기 위한 curve 샘플 위치. */
export function getCurveSamplesFor3D(maxCount = 48): { x: number; y: number; z: number }[] | null {
  if (!currentVolume || !curveSampler) return null;
  const n = curveSampler.frameCount;
  const count = Math.min(maxCount, n);
  const stride = count === 0 ? 0 : (n - 1) / (count - 1);
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    const f = curveSampler.frameAt(Math.round(i * stride));
    out.push({ x: f.position.x, y: f.position.y, z: f.position.z });
  }
  return out;
}

// Expose debug hooks
declare global {
  interface Window { __panoDebug?: Record<string, unknown> }
}

function exposePanoDebug(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __panoDebug?: Record<string, unknown> };
  w.__panoDebug = {
    getDataSummary: () => {
      const data = (panoView as unknown as { _data: Float32Array; _width: number; _height: number })._data;
      if (!data || data.length === 0) return { ok: false };
      let mn = Infinity, mx = -Infinity, sum = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] < mn) mn = data[i];
        if (data[i] > mx) mx = data[i];
        sum += data[i];
      }
      return { ok: true, min: mn, max: mx, mean: sum / data.length };
    },
    reExtract: (mmPerPixel = 0.5) => {
      if (!currentVolume) return { ok: false };
      const { data, curveWidth, inPlaneWidth } = focalTrough.extract(curveEditorCtl.curve, currentVolume, { mmPerPixel });
      panoView.setIntensityMap(data, curveWidth, inPlaneWidth);
      return { ok: true };
    },
    setMode: (m: 'min' | 'max' | 'mean') => { focalTrough.setMode(m); renderPanoFinal(); return m; },
    setThickness: (mm: number) => { focalTrough.setThickness(mm); renderPanoFinal(); return mm; },
    getAutoWLWW: () => {
      const data = (panoView as unknown as { _data: Float32Array })._data;
      if (!data || data.length === 0) return { ok: false };
      return { ok: true, ...computeAutoWLWW(data) };
    },
    isAutoWLWW: () => !userOverrodeWLWW,
    resetAutoWLWW: () => {
      userOverrodeWLWW = false;
      renderPanoFinal();
      return { ok: true };
    },
  };
}
