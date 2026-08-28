/**
 * Pano wiring — simplified: full CBCT z + full in-plane 자동, mode 버튼만, WL/WW는 MPR view에서 연동.
 */
import { ViewLayoutManager } from '../app/view-layout-manager';
import { computeLayoutFlex } from '../app/layout-flex';
import {
  PanoramicCurve, FocalTrough, CurveEditorController, CurveEditorView,
  PanoView, PanoRenderer, hitTestCanvasPoint,
  GpuCprViewport, supportsGpuCpr,
} from '../pano';
import { renderMprSlice, installWlwwSync, setSharedWlww } from '../pano/slice-renderer';
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
let curveEditorCtl: CurveEditorController;
let curveEditorView: CurveEditorView;
let focalTrough: FocalTrough;
let panoView: PanoView;
let panePanoView: PanoView;
let gpuPano: GpuCprViewport | null = null;
let gpuActive = false;
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
  panoView = new PanoView();

  curveEditorCtl.onStateChange(() => syncCurveEditorState());
  curveEditorCtl.onCurveChange((curve) => {
    if (!curveEditorModal.hidden) {
      renderModalAxialSlice();
      curveEditorView.setCurve(curve);
      // renderModalPanoPreview는 무겁다(detectBestDepthRange + extract). Drag 중 pointermove가
      // 100Hz로 발화되면 매번 extract → 누적 1초+. rAF로 throttle하여 다음 frame에서
      // 한 번만 실행 (60fps 보장).
      if (curve.points.length >= 2 && !panoPreviewQueued) {
        panoPreviewQueued = true;
        requestAnimationFrame(() => {
          panoPreviewQueued = false;
          renderModalPanoPreview();
        });
      }
    }
    syncCurveEditorState();
  });

  // Try to enable GPU CPR (WebGL2). Fall back to existing CPU path otherwise.
  if (supportsGpuCpr() && regionBottomLeft) {
    gpuPano = new GpuCprViewport(regionBottomLeft, { sampleCount: 256, autoThickness: true });
    const ok = gpuPano.init();
    if (ok) {
      // Wrap panoCanvas (used by CSS layout) — keep element for size ref but hide it
      // since GPU viewport injects its own WebGL canvas on top.
      panoCanvas.style.display = 'none';
      gpuPano.resize();
      gpuActive = true;
    } else {
      gpuPano = null;
    }
  }

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
  currentVolume = volume;
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

  // WL/WW slider 변경 시 panorama에도 적용
  window.addEventListener('wlww-changed', ((e: Event) => {
    const ev = e as CustomEvent<{ wl: number; ww: number }>;
    const wl = ev.detail?.wl ?? 0;
    const ww = ev.detail?.ww ?? 400;
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
  });
}

function cancelCurveEditor(): void {
  curveEditorCtl.cancel();
  if (curveEditorModal) curveEditorModal.hidden = true;
}

function applyCurveEditor(): void {
  if (curveEditorCtl.curve.points.length < 2) return;
  curveEditorCtl.apply();
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
  // NOTE: GPU CPR viewport는 arch-spline 기반 WebGL ray-cast로 결과를 그리지만
  // CPU focal-trough IP와 시각적으로 다르고, 현재 상악동/신경관 같은 주변 구조가
  // 약하게 잡힌다. preview와 main이 같은 결과가 되도록 CPU 경로를 강제한다.
  // GPU 경로는 알고리즘이 CPU와 일치하도록 개선된 후 다시 활성화 예정.
  void gpuPano; // suppress unused warning
  // CPU final: depth auto-detect를 user curve z ±30 슬라이스(약 ±15mm)로.
  const userZ = userCurveZ(curveEditorCtl.curve);
  const { zMin, zMax } = focalTrough.detectBestDepthRange(currentVolume, { searchCenterZ: userZ, halfRange: 30 });
  focalTrough.setDepthRangeVox(zMin, zMax);
  // mm-based: 픽셀 수는 curve length/thickness와 spacing으로 자동 계산.
  const { data, curveWidth, inPlaneWidth } = focalTrough.extract(curveEditorCtl.curve, currentVolume);
  panoView.setIntensityMap(data, curveWidth, inPlaneWidth);
  const ctx = panoCanvas.getContext('2d');
  if (ctx) panoView.render(panoCanvas);
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
  setSize(coronalCanvas, cellW, cellH);
  setSize(sagittalCanvas, cellW, cellH);
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
}

export { PanoramicCurve };

let modalAxialPointerBound = false;
let modalAxialSliderBound = false;
let modalWlwwListenerBound = false;

// Curve drag 중 modal pano preview를 저해상도(mmPerPixel=1)로 그리고,
// drag 끝나면 풀해상도(0.5)로 다시 그린다 — drag 중 60fps 유지 + 끝에 고품질 확정.
let isCurveDragging = false;
// rAF throttle: 연속된 onCurveChange 호출은 다음 frame에서 한 번만 renderModalPanoPreview 실행.
let panoPreviewQueued = false;

function renderModalAxialSlice(): void {
  if (!currentVolume) return;
  const z = curveEditorCtl.getActiveSlice(MPRPlane.Axial);
  renderMprSlice(modalAxialCanvas, MPRPlane.Axial, z, currentVolume!);
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
      // drag 끝 → 풀해상도 pano preview 즉시 갱신 (rAF queue가 이미 있으면 그게 처리).
      if (curveEditorCtl.curve.points.length >= 2) renderModalPanoPreview();
    }
    dragged = false;
  });

  modalAxialCanvas.addEventListener('pointercancel', () => {
    suppressNextModalClick = true;
    dragIndex = -1;
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
    // NOTE: GPU CPR viewport는 .region-bottom-left에 별도 WebGL canvas를 띄우지만,
    // modal 안에는 GPU canvas가 없으므로 modal preview는 반드시 CPU로 그려야 한다.
    // 따라서 여기서 return하지 않고 아래 CPU path를 계속 진행한다.
  }
  // CPU modal preview: depth auto-detect를 user curve z ±10 슬라이스로 좁힘 (캐시됨).
  const userZ = userCurveZ(curveEditorCtl.curve);
  const { zMin, zMax } = focalTrough.detectBestDepthRange(currentVolume, { searchCenterZ: userZ, halfRange: 30 });
  focalTrough.setDepthRangeVox(zMin, zMax);
  // Drag 중에는 저해상도(mmPerPixel=1), 끝나면 풀해상도(0.5). Drag 종료 시
  // pointerup 핸들러가 isCurveDragging=false로 만들고 풀해상도로 즉시 갱신.
  const mmPerPixel = isCurveDragging ? 1.0 : 0.5;
  const { data, curveWidth, inPlaneWidth } = focalTrough.extract(curveEditorCtl.curve, currentVolume, { mmPerPixel });
  panePanoView.setIntensityMap(data, curveWidth, inPlaneWidth);
  panoView.setIntensityMap(data, curveWidth, inPlaneWidth);
  const ctx = modalPanoCanvas.getContext('2d');
  if (ctx) panePanoView.render(modalPanoCanvas);
  panoView.render(panoCanvas);
}

function updateTroughModeActive(): void {
  const mode = focalTrough.mode;
  for (const [btn, m] of [[ceModeMin, 'min'], [ceModeMax, 'max'], [ceModeMean, 'mean']] as const) {
    btn.classList.toggle('active', mode === m);
  }
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
  };
}
