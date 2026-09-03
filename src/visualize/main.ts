import { initPanoWiring, setPanoVolume, LAYOUT_RESIZED_EVENT, PANORAMA_PICK_EVENT, getCurveFrameFor3D, getCurveSamplesFor3D } from './pano-wiring';

import { DicomTagReader, PixelDataDecoder, TransferSyntaxRegistry, ParallelJpegDecoder } from '../dicom';
import { SliceExtractor } from '../mpr/slice-extractor';
import { WLWWApplier } from '../mpr/wlww-applier';
import { applyWlwwToPano } from './pano-wiring';
import { MPRPlane } from '../shared/types/rendering';
import type { VolumeData } from '../shared/types/volume';
import type { DecodingInfo, TransferSyntaxInfo } from '../shared/types/dicom';
import type { DicomTags } from '../shared/types/patient';
import type { Mat4 } from '../shared/types/core';
import { computeBackbufferSize } from './backbuffer-size';

import { getVolumeCameraTarget, getVolumeModelScale, resolveViewerCameraAction } from './viewer-input';
import { uploadVolume3D } from '../webgl/texture';
import { OrbitalCamera } from '../camera/orbital-camera';
import { InputHandler } from '../input/input-handler';
import { InputType } from '../shared/types/input';
import { PatientDataManager } from '../patient/patient-data-manager';
import { SyncController } from '../sync/sync-controller';
import { CoordinateTransformer } from '../sync/coordinate-transformer';
import type { PatientInfo } from '../shared/types/patient';

let volume: VolumeData | null = null;
const patientDataManager = new PatientDataManager();
const syncController = new SyncController();
const coordTransformer = new CoordinateTransformer();
const extractor = new SliceExtractor();
const wlww = new WLWWApplier();

wlww.setDefaultCBCT();

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updatePatientInfo(patient: PatientInfo | null) {
  if (!patient) {
    patientPanel.classList.remove('visible');
    return;
  }
  patientPanel.classList.add('visible');
  piName.textContent = patient.patientName;
  piId.textContent = patient.patientID;
  piBirth.textContent = formatDate(patient.birthDate);
  piStudy.textContent = formatDate(patient.studyDate);
  piModality.textContent = patient.modality || '—';
  piDesc.textContent = patient.studyDescription || patient.seriesDescription || '—';
}

patientDataManager.onPatientChange((patient) => updatePatientInfo(patient));

const axialCanvas = document.getElementById('axial-canvas') as HTMLCanvasElement;
const canvas3d = document.getElementById('3d-canvas') as HTMLCanvasElement;
const axialSlider = document.getElementById('axial-slider') as HTMLInputElement;
const wlSlider = document.getElementById('wl-slider') as HTMLInputElement;
const wwSlider = document.getElementById('ww-slider') as HTMLInputElement;
const tfSlider = document.getElementById('tf-slider') as HTMLInputElement;
const statusEl = document.getElementById('status')!;
const controlsMpm = document.getElementById('controls-mpm')!;
const loadingEl = document.getElementById('loading')!;
const loadBtn = document.getElementById('load-btn')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const patientPanel = document.getElementById('patient-panel')!;
const piName = document.getElementById('pi-name')!;
const piId = document.getElementById('pi-id')!;
const piBirth = document.getElementById('pi-birth')!;
const piStudy = document.getElementById('pi-study')!;
const piModality = document.getElementById('pi-modality')!;
const piDesc = document.getElementById('pi-desc')!;

// 3D renderer state
let gl3d: WebGL2RenderingContext | null = null;
let volumeTexture: WebGLTexture | null = null;
let backFaceProgram: WebGLProgram | null = null;
let rayMarchProgram: WebGLProgram | null = null;
let tfTexture: WebGLTexture | null = null;
let boxVBO: WebGLBuffer | null = null;
let boxIBO: WebGLBuffer | null = null;
let backFBO: WebGLFramebuffer | null = null;
let backTex: WebGLTexture | null = null;

// Orbital camera + Input handler
const camera = new OrbitalCamera();
// 초기 시점: 정면(z=-2.5)에서 +z를 향해 = axial plane 정면 응시.
// 이전 rotate(-0.6, 0.4)는 비스듬한 각도로 인해 모델 스케일 비등방과 결합되어
// box가 한쪽으로 치우쳐 보이는 회귀가 있었다.
camera.rotate(0, 0.15);

const inputHandler = new InputHandler();
inputHandler.attach(canvas3d);

const ROTATION_SENSITIVITY = 0.005;
const ZOOM_SENSITIVITY = 0.002;

let isDragging3d = false;
let drag3dButton = -1;
const PAN_SENSITIVITY = 0.003;

canvas3d.style.cursor = 'grab';
canvas3d.addEventListener('contextmenu', (e) => e.preventDefault());

inputHandler.on(InputType.MouseDown, (input) => {
  isDragging3d = true;
  drag3dButton = input.button ?? 0;
  canvas3d.style.cursor = 'grabbing';
});
inputHandler.on(InputType.MouseUp, () => {
  isDragging3d = false;
  drag3dButton = -1;
  canvas3d.style.cursor = 'grab';
});
inputHandler.on(InputType.MouseMove, (input) => {
  if (!isDragging3d) return;

  const action = resolveViewerCameraAction(drag3dButton, input.modifiers?.shift ?? false);

  if (action?.type === 'rotate') {
    camera.rotate(-input.delta.x * ROTATION_SENSITIVITY, input.delta.y * ROTATION_SENSITIVITY);
  } else if (action?.type === 'zoom') {
    camera.zoom(input.delta.y * camera.distance * 0.03);
  } else if (action?.type === 'pan') {
    // Right drag: pan. Camera follows the cursor, matching OrbitControls.
    camera.pan(input.delta.x * PAN_SENSITIVITY, input.delta.y * PAN_SENSITIVITY);
  }

  render3D();
});
inputHandler.on(InputType.Wheel, (input) => {
  camera.zoom(-input.delta.y * camera.distance * 0.03);
  render3D();
});

// Double-click: reset view
canvas3d.addEventListener('dblclick', () => {
  resetViewerCamera();
  render3D();
});

function resetViewerCamera(): void {
  camera.reset();
  camera.setTarget(getVolumeCameraTarget());
  // mm 기반 거리: 화면(display) 모델 박스 반폭의 4.0배
  if (volume) {
    const ext = displayModelExtents(volume);
    const maxH = Math.max(ext[0], ext[1], ext[2]);
    camera.setDistanceLimits(0.1, maxH * 30.0);
    camera.setDistance(maxH * 4.0);
  }
  // axial plane 정면 응시(살짝 위에서 내려다봄)
  camera.rotate(0, 0.15);
}

inputHandler.registerShortcut('r', () => { resetViewerCamera(); render3D(); });

loadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);
axialSlider.addEventListener('input', () => { updateSliderVal('axial'); renderAll(); });
wlSlider.addEventListener('input', () => { updateSliderVal('wl'); renderAll(); });
wwSlider.addEventListener('input', () => { updateSliderVal('ww'); renderAll(); });
tfSlider.addEventListener('input', () => { updateSliderVal('tf'); updateTF(); render3D(); });

// pano-wiring의 resizeCanvases()는 canvas.width/height를 재할당해 비트맵을
// 초기화한다. 슬라이더/휠 입력 없이도 슬라이스를 다시 그리도록 이벤트에 반응.
window.addEventListener(LAYOUT_RESIZED_EVENT, () => { renderAll(); });
// 파노라마에서 curve 위치를 클릭/드래그하면 3D 단면(orthogonal/tangential) 갱신.
window.addEventListener(PANORAMA_PICK_EVENT, () => { render3D(); });

// ===== Crosshair Overlay =====

// ===== MPR Viewport Interactions =====

type MPRPlaneKey = 'axial';

const mprCanvases: { canvas: HTMLCanvasElement; key: MPRPlaneKey; slider: HTMLInputElement }[] = [
  { canvas: axialCanvas, key: 'axial', slider: axialSlider },
];

// Cursor styles
mprCanvases.forEach(({ canvas }) => {
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
});

// 1) Scroll wheel → slice navigation
for (const { canvas, key, slider } of mprCanvases) {
  canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    if (!volume) return;

    const max = +slider.max;
    const current = +slider.value;
    const step = e.deltaMode === 1 ? 3 : 1;
    const delta = e.deltaY > 0 ? step : e.deltaY < 0 ? -step : 0;

    const next = Math.max(0, Math.min(max, current + delta));
    if (next !== current) {
      slider.value = String(next);
      updateSliderVal(key);
      renderAll();
    }
  }, { passive: false });
}

// 2) Left-drag → WL/WW adjustment (Horos/OsiriX convention)
const WLWW_SENSITIVITY = 4;
let mprDrag = { active: false, lastX: 0, lastY: 0, canvas: null as HTMLCanvasElement | null };

for (const { canvas } of mprCanvases) {
  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    mprDrag = { active: true, lastX: e.clientX, lastY: e.clientY, canvas };
    canvas.style.cursor = 'ns-resize';
  });
}

window.addEventListener('mousemove', (e: MouseEvent) => {
  if (!mprDrag.active) return;
  const dx = e.clientX - mprDrag.lastX;
  const dy = e.clientY - mprDrag.lastY;
  mprDrag.lastX = e.clientX;
  mprDrag.lastY = e.clientY;

  const newWW = Math.max(1, Math.min(8000, +wwSlider.value + dx * WLWW_SENSITIVITY));
  const newWL = Math.max(-2000, Math.min(4000, +wlSlider.value - dy * WLWW_SENSITIVITY));
  wwSlider.value = String(Math.round(newWW));
  wlSlider.value = String(Math.round(newWL));
  updateSliderVal('ww');
  updateSliderVal('wl');
  renderAll();
  // ★ Panorama도 같은 WL/WW로 (커브 에디터의 pano preview 포함)
  applyWlwwToPano(newWL, newWW);
  window.dispatchEvent(new CustomEvent('wlww-changed', { detail: { wl: newWL, ww: newWW } }));
});

window.addEventListener('mouseup', () => {
  if (mprDrag.active && mprDrag.canvas) {
    mprDrag.canvas.style.cursor = 'crosshair';
  }
  mprDrag.active = false;
  mprDrag.canvas = null;
});

function updateSliderVal(which: string) {
  if (which === 'axial') document.getElementById('axial-val')!.textContent = axialSlider.value;
  if (which === 'wl') {
    document.getElementById('wl-val')!.textContent = wlSlider.value;
    wlww.setWindowLevel(+wlSlider.value);
    // slice-renderer / curve-editor-modal은 wlww-changed 이벤트로 동기화된다.
    // 슬라이더 경로에서도 동일하게 전파해야 모달 axial의 WL/WW가 main과 맞춰진다.
    dispatchWlwwChanged();
  }
  if (which === 'ww') {
    document.getElementById('ww-val')!.textContent = wwSlider.value;
    wlww.setWindowWidth(+wwSlider.value);
    dispatchWlwwChanged();
  }
  if (which === 'tf') document.getElementById('tf-val')!.textContent = tfSlider.value;
}

/**
 * 현재 WL/WW 슬라이더 값을 wlww-changed 이벤트로 broadcast한다.
 * installWlwwSync() (slice-renderer)와 pano-wiring.ts의 wlww-changed 리스너가
 * 이 이벤트로 동기화된다 — 마우스 드래그 경로에서도 dispatch하므로
 * 슬라이더 경로에서도 동일하게 발행해야 일관성이 유지된다.
 */
function dispatchWlwwChanged(): void {
  window.dispatchEvent(new CustomEvent('wlww-changed', {
    detail: { wl: +wlSlider.value, ww: +wwSlider.value },
  }));
}

async function handleFiles() {
  const files = fileInput.files;
  if (!files || files.length === 0) return;

  loadingEl.classList.add('active');
  statusEl.textContent = `${files.length}개 DICOM 파일 파싱 중...`;

  try {
    const { volumeData, firstTags } = await buildVolumeFromFiles(Array.from(files));
    volume = volumeData;
    setPanoVolume(volumeData, wlww.windowLevel, wlww.windowWidth);
    resetViewerCamera();
    const [dx, dy, dz] = volume.dimensions;
    statusEl.textContent = `볼륨 로드 완료: ${dx}×${dy}×${dz} (${files.length}슬라이스)`;
    if (firstTags) patientDataManager.loadFromDicom(firstTags);

    axialSlider.max = String(dz - 1);
    axialSlider.value = String(Math.floor(dz / 2));

    updateSliderVal('axial');

    controlsMpm.classList.add('open');
    init3DRenderer();
    renderAll();
  } catch (err) {
    statusEl.textContent = `에러: ${(err as Error).message}`;
    console.error(err);
  } finally {
    loadingEl.classList.remove('active');
  }
}

/** Explicit VR 짧은 길이 필드 VR 타입 집합 (DICOM PS3.5 long form VR 제외) */
const SHORT_VR = new Set([
  'AE', 'AS', 'AT', 'CS', 'DA', 'DS', 'DT', 'FL', 'FD', 'IS', 'LO', 'LT',
  'PN', 'SH', 'SL', 'SS', 'ST', 'TM', 'UI', 'UL', 'US',
]);

function isShortVR(vr: string): boolean {
  return SHORT_VR.has(vr);
}

async function buildVolumeFromFiles(files: File[]): Promise<{ volumeData: VolumeData; firstTags: DicomTags | null }> {
  const registry = new TransferSyntaxRegistry();

  let firstTags: DicomTags | null = null;
  const isCompressedSeries: boolean[] = [];

  // Phase 1: 메인 스레드에서 태그 파싱만 빠르게 수행 (~0ms/file)
  const parsedSlices: {
    index: number;
    position: number;
    ipp: number[];
    rows: number;
    cols: number;
    arrayBuffer: ArrayBuffer;
    pixelDataStart: number;
    isEncapsulated: boolean;
    tsDef: { uid: string; name: string; isCompressed: boolean; isLittleEndian: boolean };
    bitsAllocated: number;
    bitsStored: number;
    pixelRepresentation: number;
  }[] = [];

  statusEl.textContent = `태그 파싱 중... (0/${files.length})`;

  for (let i = 0; i < files.length; i++) {
    try {
      const arrayBuffer = await files[i].arrayBuffer();
      const reader = new DicomTagReader(arrayBuffer);
      const tags: DicomTags = reader.parseAllTags();
      if (!firstTags) firstTags = tags;

      const tsUid = (tags.get('00020010')?.value as string) || '';
      const tsDef = registry.lookup(tsUid);

      const rows = Number(tags.get('00280010')?.value) || 0;
      const cols = Number(tags.get('00280011')?.value) || 0;
      const bitsAllocated = Number(tags.get('00280100')?.value) || 16;
      const bitsStored = Number(tags.get('00280101')?.value) || bitsAllocated;
      const pixelRepresentation = Number(tags.get('00280103')?.value) || 0;

      const positionTag = tags.get('00200032')?.value as string;
      let position = 0;
      let ipp: number[] = [0, 0, 0];
      if (positionTag) {
        const parts = positionTag.split('\\').map(Number);
        ipp = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
        position = parts[2] || parts[1] || parts[0];
      }

      const pixelTag = tags.get('7fe00010');
      if (!pixelTag || rows === 0 || cols === 0) continue;

      const headerSize = isShortVR(pixelTag.vr) ? 8 : 12;
      const pixelDataStart = pixelTag.offset + headerSize;
      const isEncapsulated = pixelTag.length === 0xFFFFFFFF;
      isCompressedSeries.push(tsDef.isCompressed && isEncapsulated);

      parsedSlices.push({
        index: i, position, ipp, rows, cols, arrayBuffer, pixelDataStart, isEncapsulated,
        tsDef: { uid: tsDef.uid, name: tsDef.name, isCompressed: tsDef.isCompressed, isLittleEndian: tsDef.isLittleEndian },
        bitsAllocated, bitsStored, pixelRepresentation,
      });
    } catch (err) {
      console.error(`[DICOM] 태그 파싱 실패 (${files[i].name}):`, err);
    }

    if (i % 100 === 0) {
      statusEl.textContent = `태그 파싱 중... (${i + 1}/${files.length})`;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (parsedSlices.length === 0) throw new Error('No valid DICOM slices found');

  // Phase 2: 픽셀 데이터 디코딩
  const hasCompressed = isCompressedSeries.some(Boolean);
  const firstParsed = parsedSlices[0];
  const decodeInfo: DecodingInfo = {
    bitsAllocated: firstParsed.bitsAllocated, bitsStored: firstParsed.bitsStored,
    pixelRepresentation: firstParsed.pixelRepresentation, rows: firstParsed.rows, columns: firstParsed.cols,
  };
  const decoder = new PixelDataDecoder(decodeInfo);

  let decodedBuffers: ArrayBuffer[];

  if (hasCompressed) {
    // 압축: Web Worker로 병렬 디코딩
    statusEl.textContent = `JPEG 디코딩 중... (Web Workers)`;
    await new Promise(r => setTimeout(r, 0));

    const parallelDecoder = new ParallelJpegDecoder(
      () => new Worker(new URL('../jpeg-decoder-worker.ts', import.meta.url), { type: 'module' }),
    );
    decodedBuffers = await parallelDecoder.decodeAll(
      parsedSlices.map((s) => ({ buffer: s.arrayBuffer, pixelDataStart: s.pixelDataStart })),
    );
  } else {
    // 비압축: 메인 스레드에서 빠르게 처리
    decodedBuffers = parsedSlices.map((s) => {
      const uint8 = new Uint8Array(s.arrayBuffer);
      const pixelLength = s.arrayBuffer.byteLength - s.pixelDataStart;
      const pixelData = new ArrayBuffer(pixelLength);
      new Uint8Array(pixelData).set(uint8.slice(s.pixelDataStart, s.pixelDataStart + pixelLength));
      return decoder.decode(pixelData, {
        uid: s.tsDef.uid, name: s.tsDef.name,
        isCompressed: s.tsDef.isCompressed, isLittleEndian: s.tsDef.isLittleEndian,
      });
    });
  }

  // Phase 3: 볼륨 구축
  const sortedSlices = parsedSlices
    .map((s, i) => ({ position: s.position, ipp: s.ipp, buffer: decodedBuffers[i], rows: s.rows, cols: s.cols }))
    .sort((a, b) => a.position - b.position);
  if (sortedSlices.length === 0) throw new Error('No valid DICOM slices found');

  const first = sortedSlices[0];
  const dx = first.cols;
  const dy = first.rows;
  const dz = sortedSlices.length;

  // ── 환자 방향 정렬(orientation) —────────────────────────────
  // DICOM ImageOrientationPatient (0020,0037) + ImagePositionPatient (0020,0032)로
  // 볼륨 저장축(col/row/slice)을 화면 좌표계(오른쪽=Right, 위=Superior, 깊이=Posterior)
  // 로 변환하는 순열+반전 행렬(+bias)을 계산한다. 3D 렌더 셰이더에서 텍스처 샘플
  // 좌표에 적용된다.
  const iopStr = firstTags?.get('00200037')?.value as string | undefined;
  volumeStorageTransform = computeStorageTransform(
    iopStr,
    sortedSlices[0].ipp,
    sortedSlices[sortedSlices.length - 1].ipp,
  );

  // ── 스페이싱 — PixelSpacing (0028,0030): [rowSpacing, colSpacing] ──
  let spacingX = 0.2;
  let spacingY = 0.2;
  const psStr = firstTags?.get('00280030')?.value as string | undefined;
  if (psStr) {
    const ps = psStr.split('\\').map(Number);
    if (ps.length >= 2 && Number.isFinite(ps[0]) && Number.isFinite(ps[1])) {
      spacingY = ps[0]; // row
      spacingX = ps[1]; // col
    }
  }

  const totalVoxels = dx * dy * dz;
  const volumeBuffer = new ArrayBuffer(totalVoxels * 2);
  const volumeView = new Int16Array(volumeBuffer);

  for (let z = 0; z < dz; z++) {
    const sliceData = new Int16Array(sortedSlices[z].buffer);
    const offset = z * dx * dy;
    const copyLen = Math.min(sliceData.length, dx * dy);
    for (let i = 0; i < copyLen; i++) {
      volumeView[offset + i] = sliceData[i];
    }
  }

  const spacingZ = sortedSlices.length > 1
    ? Math.abs(sortedSlices[1].position - sortedSlices[0].position)
    : 1;

  return {
    volumeData: {
      buffer: volumeBuffer,
      dimensions: [dx, dy, dz],
      spacing: [spacingX, spacingY, spacingZ],
      origin: [0, 0, 0],
      dataType: 'int16',
    },
    firstTags,
  };
}

function renderAll() {
  if (!volume) return;

  renderSlice(axialCanvas, MPRPlane.Axial, +axialSlider.value);
  render3D();
}

function renderSlice(canvas: HTMLCanvasElement, plane: MPRPlane, position: number) {
  if (!volume) return;

  const [dx, dy, dz] = volume.dimensions;

  let sliceW: number, sliceH: number;
  switch (plane) {
    case MPRPlane.Axial: sliceW = dx; sliceH = dy; break;
    case MPRPlane.Coronal: sliceW = dx; sliceH = dz; break;
    case MPRPlane.Sagittal: sliceW = dy; sliceH = dz; break;
  }

  const sliceData = extractor.extract(plane, position, volume);
  const grayscale = wlww.applyCurrent(sliceData);

  canvas.width = sliceW;
  canvas.height = sliceH;

  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(sliceW, sliceH);
  // Flip Y-axis: map source rows bottom-to-top for correct anatomical orientation
  for (let y = 0; y < sliceH; y++) {
    const srcRow = (sliceH - 1 - y) * sliceW;
    const dstRow = y * sliceW * 4;
    for (let x = 0; x < sliceW; x++) {
      const dst = dstRow + x * 4;
      imageData.data[dst] = grayscale[srcRow + x];
      imageData.data[dst + 1] = grayscale[srcRow + x];
      imageData.data[dst + 2] = grayscale[srcRow + x];
      imageData.data[dst + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ===== 3D Volume Rendering =====

// ── 환자 방향(orientation) 변환 ────────────────────────────────
// 볼륨 저장축(col/row/slice) → 화면 좌표계 변환(순열+반전). 3D 렌더 셰이더에
// uniform(row0/row1/row2/bias)로 넘겨 텍스처 샘플 좌표에 적용한다.
import { computeStorageTransform, type VolumeStorageTransform } from './orientation';

let volumeStorageTransform: VolumeStorageTransform = {
  a: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  bias: [0, 0, 0],
};

const VS_BACK = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uMVP;
out vec3 vPos;
void main() {
  vPos = aPos * 0.5 + 0.5;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const FS_BACK = `#version 300 es
precision highp float;
in vec3 vPos;
out vec4 fragColor;
void main() { fragColor = vec4(vPos, 1.0); }`;

const VS_RAY = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uMVP;
out vec3 vPos;
void main() {
  vPos = aPos * 0.5 + 0.5;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const FS_RAY = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec3 vPos;
uniform sampler2D uBackFace;
uniform sampler3D uVolume;
uniform sampler2D uTF;
uniform vec2 uScreen;
uniform vec3 uCameraModelPos;
uniform vec3 uVolRow0;
uniform vec3 uVolRow1;
uniform vec3 uVolRow2;
uniform vec3 uVolBias;
uniform vec3 uDim;           // volume dimensions (voxel)
uniform vec3 uBoxMm;         // 모델 박스 전체 크기(mm) = dims * spacing
uniform float uAxial;        // axial 슬라이스 위치 (storage z, voxel)
uniform float uOrthoOn;      // orthogonal 단면 활성
uniform vec3 uOrthoCenter;   // storage voxel
uniform vec3 uOrthoNormal;   // storage 방향 (unit) = curve tangent
uniform float uTangOn;       // tangential 단면 활성
uniform vec3 uTangCenter;
uniform vec3 uTangNormal;    // = curve 협설 normal
uniform int uCurveCount;     // 파노라마 곡면 샘플 수
uniform vec3 uCurve[48];     // curve 위치 (storage voxel)
uniform float uCurveRadius;  // 곡면 두께 (voxel)
out vec4 fragColor;

vec3 rayDirection = vec3(0.0);
vec3 rayFront = vec3(0.0);
float rayLength = 0.0;

// display[0,1] → 볼륨 저장 좌표(정규화)
vec3 toStorage(vec3 p) {
  return vec3(
    dot(uVolRow0, p) + uVolBias.x,
    dot(uVolRow1, p) + uVolBias.y,
    dot(uVolRow2, p) + uVolBias.z
  );
}

vec2 rayBoxIntersect(vec3 origin, vec3 dir) {
  vec3 boxMin = vec3(0.005);
  vec3 boxMax = vec3(0.995);
  vec3 invD = 1.0 / dir;
  vec3 t0 = (boxMin - origin) * invD;
  vec3 t1 = (boxMax - origin) * invD;
  vec3 tN = min(t0, t1);
  vec3 tF = max(t0, t1);
  float tNear = max(max(tN.x, tN.y), tN.z);
  float tFar = min(min(tF.x, tF.y), tF.z);
  return vec2(tNear, tFar);
}

float grayscale(float hu) {
  return clamp((hu + 1024.0) / 5119.0, 0.0, 1.0);
}

// 절단 단면(평면)과 ray의 교차: u∈[0,1] 매개변수. hit 없으면 -1.
// n/center는 storage voxel 좌표. s0/sd는 storage 정규화 좌표(ray start와 진행).
float sliceHit(vec3 n, vec3 center, vec3 s0, vec3 sd, out vec3 snHit) {
  vec3 s0v = s0 * uDim;
  vec3 sdv = sd * uDim;
  float denom = dot(n, sdv);
  if (abs(denom) < 1e-9) return -1.0;
  float u = dot(n, center - s0v) / denom;
  if (u < 0.0 || u > 1.0) return -1.0;
  snHit = clamp(s0 + sd * u, 0.0, 1.0);
  return u;
}

void main() {
  vec3 camPos = uCameraModelPos / uBoxMm + 0.5;
  rayDirection = normalize(vPos - camPos);
  vec3 rayDir = rayDirection;

  vec2 hits = rayBoxIntersect(camPos, rayDir);
  if (hits.x > hits.y || hits.y < 0.0) { fragColor = vec4(0.0); return; }

  float tStart = max(hits.x, 0.0);
  vec3 front = camPos + rayDir * tStart;
  rayFront = front;
  vec3 back = camPos + rayDir * hits.y;

  vec3 dir = back - front;
  float len = length(dir);
  rayLength = len;
  if (len < 0.001) { fragColor = vec4(0.0); return; }
  vec3 dirN = normalize(dir);

  // storage 정규화 좌표의 ray 시작/끝 (단면 교차 계산용)
  vec3 s0 = toStorage(front);
  vec3 s1 = toStorage(back);
  vec3 sd = s1 - s0;

  // 각 단면과의 교차(u)를 계산해둔다 (볼륨 렌더 위에 반투명 슬라이스로 겹친다).
  vec3 snA = vec3(0.0);
  vec3 snO = vec3(0.0);
  vec3 snT = vec3(0.0);
  float uA = sliceHit(vec3(0.0, 0.0, 1.0), vec3(0.0, 0.0, uAxial), s0, sd, snA);
  float uO = uOrthoOn > 0.5 ? sliceHit(uOrthoNormal, uOrthoCenter, s0, sd, snO) : -1.0;
  float uT = uTangOn > 0.5 ? sliceHit(uTangNormal, uTangCenter, s0, sd, snT) : -1.0;

  // 볼륨 렌더
  vec4 acc = vec4(0.0);
  vec3 p = front;
  float step = 0.008;
  for (float t = 0.0; t < len; t += step) {
    vec3 sp = toStorage(p);
    float d = texture(uVolume, sp).r;
    float nd = (d + 1024.0) / 5119.0;
    nd = clamp(nd, 0.0, 1.0);
    vec4 c = texture(uTF, vec2(nd, 0.5));
    // 파노라마 곡면: curve 세그먼트들(z extrude)을 선분으로 이은 면 근처를 검출
    if (uCurveCount > 0) {
      vec3 sv = sp * uDim;
      float cd2 = 1e9;
      // 인접 샘플을 잇는 선분과의 xy 최소거리 (연속 곡면)
      for (int i = 0; i < 47; i++) {
        if (i + 1 >= uCurveCount) break;
        vec2 a = uCurve[i].xy;
        vec2 b = uCurve[i + 1].xy;
        vec2 ab = b - a;
        float l2 = dot(ab, ab);
        float tt = l2 > 1e-9 ? clamp(dot(sv.xy - a, ab) / l2, 0.0, 1.0) : 0.0;
        vec2 cl = a + ab * tt;
        vec2 dv = sv.xy - cl;
        cd2 = min(cd2, dot(dv, dv));
      }
      if (cd2 < uCurveRadius * uCurveRadius) {
        // 파노라마 곡면 위: 반투명(뒤 3D가 비침)
        acc = vec4(mix(acc.rgb, vec3(grayscale(d)), 0.6), max(acc.a, 0.6));
        break;
      }
    }
    acc.rgb += c.rgb * c.a * (1.0 - acc.a);
    acc.a += c.a * (1.0 - acc.a);
    if (acc.a > 0.95) break;
    p += dirN * step;
  }

  // 단면 슬라이스를 불투명하게: 카메라에서 가장 가까운 단면 하나를 표시.
  float bestU = 1e9;
  float bestG = 0.0;
  float hasSlice = 0.0;
  if (uA >= 0.0 && uA < bestU) { bestU = uA; bestG = grayscale(texture(uVolume, snA).r); hasSlice = 1.0; }
  if (uO >= 0.0 && uO < bestU) { bestU = uO; bestG = grayscale(texture(uVolume, snO).r); hasSlice = 1.0; }
  if (uT >= 0.0 && uT < bestU) { bestU = uT; bestG = grayscale(texture(uVolume, snT).r); hasSlice = 1.0; }

  if (hasSlice > 0.5) {
    fragColor = vec4(mix(acc.rgb, vec3(bestG), 0.6), 1.0);
    return;
  }

  fragColor = acc;
}
`;

function init3DRenderer() {
  if (!volume) return;

  // Get WebGL2 context for 3D canvas
  gl3d = canvas3d.getContext('webgl2', { alpha: false, antialias: false })!;
  if (!gl3d) { console.warn('No WebGL2 for 3D'); return; }
  const gl = gl3d;

  gl.getExtension('EXT_color_buffer_float');

  // Upload volume as 3D texture (normalize to float for sampling)
  const [dx, dy, dz] = volume.dimensions;
  const srcView = new Int16Array(volume.buffer);
  const floatData = new Float32Array(dx * dy * dz);
  for (let i = 0; i < floatData.length; i++) {
    floatData[i] = srcView[i];
  }

  volumeTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_3D, volumeTexture);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, dx, dy, dz, 0, gl.RED, gl.FLOAT, floatData);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

  // Transfer function texture
  tfTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tfTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    createTransferFunctionData(+tfSlider.value));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Compile shaders
  backFaceProgram = compileProgram(gl, VS_BACK, FS_BACK);
  rayMarchProgram = compileProgram(gl, VS_RAY, FS_RAY);

  // Bounding box (unit cube [-1,1]³)
  const aspectX = dx / Math.max(dx, dy, dz);
  const aspectY = dy / Math.max(dx, dy, dz);
  const aspectZ = dz / Math.max(dx, dy, dz);

  const verts = new Float32Array([
    -1,-1, 1, 1,-1, 1, 1, 1, 1,-1, 1, 1,
    -1,-1,-1,-1, 1,-1, 1, 1,-1, 1,-1,-1,
    -1, 1,-1,-1, 1, 1, 1, 1, 1, 1, 1,-1,
    -1,-1,-1, 1,-1,-1, 1,-1, 1,-1,-1, 1,
     1,-1,-1, 1, 1,-1, 1, 1, 1, 1,-1, 1,
    -1,-1,-1,-1,-1, 1,-1, 1, 1,-1, 1,-1,
  ]);
  const indices = new Uint16Array([0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11,12,13,14,12,14,15,16,17,18,16,18,19,20,21,22,20,22,23]);

  boxVBO = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, boxVBO);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  boxIBO = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boxIBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  // Back face FBO (initial size, will be resized in render3D)
  backTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, backTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  backFBO = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, backFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, backTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function ensure3DSize(): { w: number; h: number } | null {
  // 부모 요소(.region-top)의 clientWidth/clientHeight를 source로 쓴다.
  // devicePixelRatio를 곱하면 DICOM 로드 후 canvas buffer가 2배로 커지고,
  // pano-wiring.resizeCanvases(1:1 CSS pixel)와 불일치해 캔버스가 커 보이는
  // 회귀가 있었다. 1:1(CSS pixel)로 통일해 display와 buffer가 일치하게 한다.
  const parent = canvas3d.parentElement;
  if (!parent) return null;
  const size = computeBackbufferSize(parent.clientWidth, parent.clientHeight, 1);
  if (!size) return null;
  if (canvas3d.width !== size.w || canvas3d.height !== size.h) {
    canvas3d.width = size.w;
    canvas3d.height = size.h;
  }
  return size;
}

function render3D() {
  if (!gl3d || !volume || !volumeTexture || !backFaceProgram || !rayMarchProgram) return;
  const gl = gl3d;

  const size = ensure3DSize();
  if (!size) return; // 캔버스가 아직 레이아웃되지 않음 (0×0 가드)
  const { w, h } = size;

  // Resize back face texture if needed
  gl.bindTexture(gl.TEXTURE_2D, backTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, backFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, backTex, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, boxVBO);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boxIBO);

  const mvp = computeMVP();

  // Camera inside bounding box detection
  const camModelPos = computeCameraModelPos();
  const camInsideBox =
    camModelPos.x >= -1 && camModelPos.x <= 1 &&
    camModelPos.y >= -1 && camModelPos.y <= 1 &&
    camModelPos.z >= -1 && camModelPos.z <= 1;

  // Pass 1: back faces (exit points)
  gl.bindFramebuffer(gl.FRAMEBUFFER, backFBO);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  if (camInsideBox) {
    gl.clearDepth(0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    gl.depthFunc(gl.GREATER);
  } else {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
  }
  gl.useProgram(backFaceProgram);
  gl.uniformMatrix4fv(gl.getUniformLocation(backFaceProgram, 'uMVP'), false, mvp);
  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

  // Pass 2: ray march
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clearDepth(1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.depthFunc(gl.LESS);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(rayMarchProgram);
  gl.uniformMatrix4fv(gl.getUniformLocation(rayMarchProgram, 'uMVP'), false, mvp);
  gl.uniform2f(gl.getUniformLocation(rayMarchProgram, 'uScreen'), w, h);
  gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uCameraModelPos'), camModelPos.x, camModelPos.y, camModelPos.z);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, backTex);
  gl.uniform1i(gl.getUniformLocation(rayMarchProgram, 'uBackFace'), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, volumeTexture);
  gl.uniform1i(gl.getUniformLocation(rayMarchProgram, 'uVolume'), 1);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, tfTexture);
  gl.uniform1i(gl.getUniformLocation(rayMarchProgram, 'uTF'), 2);

  // 환자 orientation 변환 uniform
  const t = volumeStorageTransform;
  gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uVolRow0'), t.a[0], t.a[1], t.a[2]);
  gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uVolRow1'), t.a[3], t.a[4], t.a[5]);
  gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uVolRow2'), t.a[6], t.a[7], t.a[8]);
  gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uVolBias'), t.bias[0], t.bias[1], t.bias[2]);
  // 단면(axial/orthogonal/tangential) uniform
  gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uDim'), volume.dimensions[0], volume.dimensions[1], volume.dimensions[2]);
  const ext = displayModelExtents(volume);
  gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uBoxMm'), ext[0] * 2, ext[1] * 2, ext[2] * 2);
  gl.uniform1f(gl.getUniformLocation(rayMarchProgram, 'uAxial'), +axialSlider.value + 0.5);
  const frame3d = getCurveFrameFor3D();
  if (frame3d) {
    gl.uniform1f(gl.getUniformLocation(rayMarchProgram, 'uOrthoOn'), 1);
    gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uOrthoCenter'), frame3d.center.x, frame3d.center.y, frame3d.center.z);
    gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uOrthoNormal'), frame3d.tangent.x, frame3d.tangent.y, frame3d.tangent.z);
    gl.uniform1f(gl.getUniformLocation(rayMarchProgram, 'uTangOn'), 1);
    gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uTangCenter'), frame3d.center.x, frame3d.center.y, frame3d.center.z);
    gl.uniform3f(gl.getUniformLocation(rayMarchProgram, 'uTangNormal'), frame3d.normal.x, frame3d.normal.y, frame3d.normal.z);
  } else {
    gl.uniform1f(gl.getUniformLocation(rayMarchProgram, 'uOrthoOn'), 0);
    gl.uniform1f(gl.getUniformLocation(rayMarchProgram, 'uTangOn'), 0);
  }
  // 파노라마 곡면 (curve 샘플)
  const curvePts = getCurveSamplesFor3D(48);
  if (curvePts && curvePts.length > 0) {
    const flat = new Float32Array(48 * 3);
    for (let i = 0; i < 48; i++) {
      if (i < curvePts.length) {
        flat[i * 3] = curvePts[i].x;
        flat[i * 3 + 1] = curvePts[i].y;
        flat[i * 3 + 2] = curvePts[i].z;
      }
    }
    gl.uniform1i(gl.getUniformLocation(rayMarchProgram, 'uCurveCount'), curvePts.length);
    gl.uniform3fv(gl.getUniformLocation(rayMarchProgram, 'uCurve'), flat);
    gl.uniform1f(gl.getUniformLocation(rayMarchProgram, 'uCurveRadius'), 4.0);
  } else {
    gl.uniform1i(gl.getUniformLocation(rayMarchProgram, 'uCurveCount'), 0);
  }

  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

// orientation 변환을 반영해 화면(display) 축 기준의 모델 반폭(mm)을 구한다.
// storage 축 반폭(getVolumeModelScale)을 orientation permutation으로 display 축에 대응.
function displayModelExtents(volume: VolumeData): [number, number, number] {
  const storageHalf = getVolumeModelScale(volume);
  const A = volumeStorageTransform.a; // row-major: a[storageAxis*3 + displayAxis]
  const out: [number, number, number] = [storageHalf[0], storageHalf[1], storageHalf[2]];
  for (let d = 0; d < 3; d++) {
    for (let a = 0; a < 3; a++) {
      if (Math.abs(A[a * 3 + d]) > 0.5) {
        out[d] = storageHalf[a];
        break;
      }
    }
  }
  return out;
}

function computeMVP(): Mat4 {
  if (!volume) return new Float32Array(16);

  const [modelScaleX, modelScaleY, modelScaleZ] = displayModelExtents(volume);
  const model = new Float32Array([
    modelScaleX, 0, 0, 0,
    0, modelScaleY, 0, 0,
    0, 0, modelScaleZ, 0,
    0, 0, 0, 1,
  ]);

  const view = camera.getViewMatrix();
  const aspect = canvas3d.width / Math.max(1, canvas3d.height);
  const proj = camera.getProjectionMatrix(aspect);
  return mat4Mul(proj, mat4Mul(view, model));
}

function computeCameraModelPos(): { x: number; y: number; z: number } {
  const pos = camera.getPosition();
  if (!volume) return { x: 0, y: 0, z: 0 };
  // 카메라 위치(mm)를 그대로 전달 (셰이더에서 uBoxMm로 나눠 정규화)
  return { x: pos.x, y: pos.y, z: pos.z };
}

function mat4Mul(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[i + k * 4] * b[k + j * 4];
      out[i + j * 4] = sum;
    }
  }
  return out;
}

function compileProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, vsSrc);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) console.error('VS:', gl.getShaderInfoLog(vs));

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error('FS:', gl.getShaderInfoLog(fs));

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error('Link:', gl.getProgramInfoLog(prog));
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

function createTransferFunctionData(threshold: number): Uint8Array {
  // CBCT bone: threshold (0-100) controls how much is visible
  const t0 = -1024 + threshold * 51.19; // threshold in HU
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const d = -1024 + (i / 255) * 5119; // map to HU range
    let r = 0, g = 0, b = 0, a = 0;
    if (d < t0) { a = 0; }
    else if (d < t0 + 300) { const t = (d - t0) / 300; r = 0.7 * t; g = 0.35 * t; b = 0.25 * t; a = 0.15 * t; }
    else if (d < t0 + 800) { const t = (d - t0 - 300) / 500; r = 0.7 + 0.25 * t; g = 0.35 + 0.45 * t; b = 0.25 + 0.55 * t; a = 0.15 + 0.35 * t; }
    else if (d < t0 + 2000) { const t = (d - t0 - 800) / 1200; r = 0.95 + 0.05 * t; g = 0.8 + 0.2 * t; b = 0.8 + 0.2 * t; a = 0.5 + 0.4 * t; }
    else { r = 1; g = 1; b = 1; a = Math.min(1.0, 0.9 + (d - t0 - 2000) / 2000); }
    const idx = i * 4;
    data[idx] = Math.round(r * 255);
    data[idx + 1] = Math.round(g * 255);
    data[idx + 2] = Math.round(b * 255);
    data[idx + 3] = Math.round(a * 255);
  }
  return data;
}

function updateTF() {
  if (!gl3d || !tfTexture) return;
  gl3d.bindTexture(gl3d.TEXTURE_2D, tfTexture);
  gl3d.texImage2D(gl3d.TEXTURE_2D, 0, gl3d.RGBA, 256, 1, 0, gl3d.RGBA, gl3d.UNSIGNED_BYTE,
    createTransferFunctionData(+tfSlider.value));
}

// ── Pano wiring bootstrap ──
try {
  initPanoWiring();
} catch (e) {
  console.error('initPanoWiring failed', e);
}
