import { DicomTagReader } from '../dicom/tag-reader';
import { TransferSyntaxRegistry } from '../encoding/transfer-syntax-registry';
import { PixelDataDecoder } from '../dicom/pixel-data-decoder';
import { SliceExtractor } from '../mpr/slice-extractor';
import { WLWWApplier } from '../mpr/wlww-applier';
import { MPRPlane } from '../shared/types/rendering';
import type { VolumeData } from '../shared/types/volume';
import type { DecodingInfo, TransferSyntaxInfo } from '../shared/types/dicom';
import type { DicomTags } from '../shared/types/patient';
import type { Mat4 } from '../shared/types/core';
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
const coronalCanvas = document.getElementById('coronal-canvas') as HTMLCanvasElement;
const sagittalCanvas = document.getElementById('sagittal-canvas') as HTMLCanvasElement;
const canvas3d = document.getElementById('3d-canvas') as HTMLCanvasElement;
const axialSlider = document.getElementById('axial-slider') as HTMLInputElement;
const coronalSlider = document.getElementById('coronal-slider') as HTMLInputElement;
const sagittalSlider = document.getElementById('sagittal-slider') as HTMLInputElement;
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
const axialCH = document.getElementById('axial-crosshair') as HTMLCanvasElement;
const coronalCH = document.getElementById('coronal-crosshair') as HTMLCanvasElement;
const sagittalCH = document.getElementById('sagittal-crosshair') as HTMLCanvasElement;

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
camera.rotate(-0.6, 0.4);

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

  const btn = drag3dButton;
  const shiftPan = input.modifiers?.shift && btn === 0;

  if (btn === 0 && !shiftPan) {
    // Left drag: rotate
    camera.rotate(-input.delta.x * ROTATION_SENSITIVITY, input.delta.y * ROTATION_SENSITIVITY);
  } else if (btn === 2 || shiftPan) {
    // Right drag / Shift+Left: zoom (vertical movement)
    camera.zoom(input.delta.y * ZOOM_SENSITIVITY);
  } else if (btn === 1) {
    // Middle drag: pan
    camera.pan(-input.delta.x * PAN_SENSITIVITY, input.delta.y * PAN_SENSITIVITY);
  }

  render3D();
});
inputHandler.on(InputType.Wheel, (input) => {
  camera.zoom(-input.delta.y * ZOOM_SENSITIVITY);
  render3D();
});

// Double-click: reset view
canvas3d.addEventListener('dblclick', () => {
  camera.reset();
  camera.rotate(-0.6, 0.4);
  render3D();
});

inputHandler.registerShortcut('r', () => { camera.reset(); camera.rotate(-0.6, 0.4); render3D(); });

loadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);
axialSlider.addEventListener('input', () => { updateSliderVal('axial'); renderAll(); });
coronalSlider.addEventListener('input', () => { updateSliderVal('coronal'); renderAll(); });
sagittalSlider.addEventListener('input', () => { updateSliderVal('sagittal'); renderAll(); });
wlSlider.addEventListener('input', () => { updateSliderVal('wl'); renderAll(); });
wwSlider.addEventListener('input', () => { updateSliderVal('ww'); renderAll(); });
tfSlider.addEventListener('input', () => { updateSliderVal('tf'); updateTF(); render3D(); });

// ===== Crosshair Overlay =====

function drawCrosshair(
  chCanvas: HTMLCanvasElement,
  hPos: number, hMax: number,
  vPos: number, vMax: number,
) {
  const ctx = chCanvas.getContext('2d');
  if (!ctx || !volume) return;
  const w = chCanvas.width;
  const h = chCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const hx = Math.round((hPos / Math.max(hMax, 1)) * w);
  const vy = Math.round((vPos / Math.max(vMax, 1)) * h);

  ctx.strokeStyle = '#00e5c3';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(hx, 0); ctx.lineTo(hx, h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, vy); ctx.lineTo(w, vy);
  ctx.stroke();

  ctx.setLineDash([]);
}

function updateCrosshairs() {
  if (!volume) return;
  const [dx, dy, dz] = volume.dimensions;
  const ax = +axialSlider.value;
  const cr = +coronalSlider.value;
  const sg = +sagittalSlider.value;

  // Axial: horizontal=sagittal, vertical=coronal
  drawCrosshair(axialCH, sg, dx, cr, dy);
  // Coronal: horizontal=sagittal, vertical=axial
  drawCrosshair(coronalCH, sg, dx, ax, dz);
  // Sagittal: horizontal=coronal, vertical=axial
  drawCrosshair(sagittalCH, cr, dy, ax, dz);
}

// ===== MPR Viewport Interactions =====

type MPRPlaneKey = 'axial' | 'coronal' | 'sagittal';

const mprCanvases: { canvas: HTMLCanvasElement; key: MPRPlaneKey; slider: HTMLInputElement }[] = [
  { canvas: axialCanvas, key: 'axial', slider: axialSlider },
  { canvas: coronalCanvas, key: 'coronal', slider: coronalSlider },
  { canvas: sagittalCanvas, key: 'sagittal', slider: sagittalSlider },
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
  if (which === 'coronal') document.getElementById('coronal-val')!.textContent = coronalSlider.value;
  if (which === 'sagittal') document.getElementById('sagittal-val')!.textContent = sagittalSlider.value;
  if (which === 'wl') { document.getElementById('wl-val')!.textContent = wlSlider.value; wlww.setWindowLevel(+wlSlider.value); }
  if (which === 'ww') { document.getElementById('ww-val')!.textContent = wwSlider.value; wlww.setWindowWidth(+wwSlider.value); }
  if (which === 'tf') document.getElementById('tf-val')!.textContent = tfSlider.value;
}

async function handleFiles() {
  const files = fileInput.files;
  if (!files || files.length === 0) return;

  loadingEl.classList.add('active');
  statusEl.textContent = `${files.length}개 DICOM 파일 파싱 중...`;

  try {
    const { volumeData, firstTags } = await buildVolumeFromFiles(Array.from(files));
    volume = volumeData;
    const [dx, dy, dz] = volume.dimensions;
    statusEl.textContent = `볼륨 로드 완료: ${dx}×${dy}×${dz} (${files.length}슬라이스)`;
    if (firstTags) patientDataManager.loadFromDicom(firstTags);

    axialSlider.max = String(dz - 1);
    coronalSlider.max = String(dy - 1);
    sagittalSlider.max = String(dx - 1);
    axialSlider.value = String(Math.floor(dz / 2));
    coronalSlider.value = String(Math.floor(dy / 2));
    sagittalSlider.value = String(Math.floor(dx / 2));

    updateSliderVal('axial');
    updateSliderVal('coronal');
    updateSliderVal('sagittal');

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

/** Explicit VR 짧은 길이 필드 VR 타입 집합 */
const SHORT_VR = new Set([
  'AE', 'AS', 'AT', 'CS', 'DA', 'DS', 'DT', 'FL', 'FD', 'IS', 'LO', 'LT',
  'PN', 'SH', 'SL', 'SS', 'ST', 'TM', 'UI', 'UL', 'UN', 'US', 'UR', 'UT',
]);

function isShortVR(vr: string): boolean {
  return SHORT_VR.has(vr);
}

async function buildVolumeFromFiles(files: File[]): Promise<{ volumeData: VolumeData; firstTags: DicomTags | null }> {
  const registry = new TransferSyntaxRegistry();

  const sortedSlices: { position: number; buffer: ArrayBuffer; rows: number; cols: number }[] = [];
  let firstTags: DicomTags | null = null;

  let processed = 0;
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

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
      if (positionTag) {
        const parts = positionTag.split('\\');
        position = parseFloat(parts[2]) || parseFloat(parts[1]) || parseFloat(parts[0]);
      }

      const pixelTag = tags.get('7fe00010');
      if (!pixelTag || rows === 0 || cols === 0) continue;

      // VR long form (OW, OB 등): header = group(2) + element(2) + vr(2) + reserved(2) + length(4) = 12
      const headerSize = isShortVR(pixelTag.vr) ? 8 : 12;
      const pixelDataStart = pixelTag.offset + headerSize;
      const isEncapsulated = pixelTag.length === 0xFFFFFFFF;

      const decodeInfo: DecodingInfo = { bitsAllocated, bitsStored, pixelRepresentation, rows, columns: cols };
      const decoder = new PixelDataDecoder(decodeInfo);
      const syntaxInfo = {
        uid: tsDef.uid,
        name: tsDef.name,
        isCompressed: tsDef.isCompressed,
        isLittleEndian: tsDef.isLittleEndian,
      };

      let decodedBuffer: ArrayBuffer;

      if (tsDef.isCompressed && isEncapsulated) {
        // 압축 경로: encapsulated pixel data → JPEG 디코딩
        decodedBuffer = decoder.decodeCompressed(arrayBuffer, pixelDataStart, syntaxInfo, bitsAllocated);
      } else if (!tsDef.isCompressed && !isEncapsulated) {
        // 비압축 경로: raw pixel data 복사 + 엔디안 변환
        const pixelLength = pixelTag.length;
        const pixelData = new ArrayBuffer(pixelLength);
        new Uint8Array(pixelData).set(uint8.slice(pixelDataStart, pixelDataStart + pixelLength));
        decodedBuffer = decoder.decode(pixelData, syntaxInfo);
      } else {
        // 전송 구문과 encapsulated 여부 불일치 — 스킵
        continue;
      }

      sortedSlices.push({ position, buffer: decodedBuffer, rows, cols });
    } catch { /* skip */ }

    processed++;
    if (processed % 50 === 0) {
      statusEl.textContent = `파싱 중... ${processed}/${files.length}`;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  sortedSlices.sort((a, b) => a.position - b.position);
  if (sortedSlices.length === 0) throw new Error('No valid DICOM slices found');

  const first = sortedSlices[0];
  const dx = first.cols;
  const dy = first.rows;
  const dz = sortedSlices.length;

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
      spacing: [0.2, 0.2, spacingZ],
      origin: [0, 0, 0],
      dataType: 'int16',
    },
    firstTags,
  };
}

function renderAll() {
  if (!volume) return;

  renderSlice(axialCanvas, MPRPlane.Axial, +axialSlider.value);
  renderSlice(coronalCanvas, MPRPlane.Coronal, +coronalSlider.value);
  renderSlice(sagittalCanvas, MPRPlane.Sagittal, +sagittalSlider.value);
  render3D();
  updateCrosshairs();
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
out vec4 fragColor;

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

void main() {
  vec3 camPos = uCameraModelPos * 0.5 + 0.5;
  vec3 rayDir = normalize(vPos - camPos);

  vec2 hits = rayBoxIntersect(camPos, rayDir);
  if (hits.x > hits.y || hits.y < 0.0) { fragColor = vec4(0.0); return; }

  float tStart = max(hits.x, 0.0);
  vec3 front = camPos + rayDir * tStart;
  vec3 back = camPos + rayDir * hits.y;

  vec3 dir = back - front;
  float len = length(dir);
  if (len < 0.001) { fragColor = vec4(0.0); return; }
  dir = normalize(dir);
  vec4 acc = vec4(0.0);
  vec3 p = front;
  float step = 0.008;
  for (float t = 0.0; t < len; t += step) {
    float d = texture(uVolume, p).r;
    float nd = (d + 1024.0) / 5119.0;
    nd = clamp(nd, 0.0, 1.0);
    vec4 c = texture(uTF, vec2(nd, 0.5));
    acc.rgb += c.rgb * c.a * (1.0 - acc.a);
    acc.a += c.a * (1.0 - acc.a);
    if (acc.a > 0.95) break;
    p += dir * step;
  }
  fragColor = acc;
}`;

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

function ensure3DSize(): { w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(canvas3d.clientWidth * dpr);
  const h = Math.floor(canvas3d.clientHeight * dpr);
  if (canvas3d.width !== w || canvas3d.height !== h) {
    canvas3d.width = w;
    canvas3d.height = h;
  }
  return { w, h };
}

function render3D() {
  if (!gl3d || !volumeTexture || !backFaceProgram || !rayMarchProgram) return;
  const gl = gl3d;

  const { w, h } = ensure3DSize();

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

  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

function computeMVP(): Mat4 {
  if (!volume) return new Float32Array(16);

  const [dx, dy, dz] = volume.dimensions;
  const maxDim = Math.max(dx, dy, dz);
  const model = new Float32Array([
    dx / maxDim, 0, 0, 0,
    0, dy / maxDim, 0, 0,
    0, 0, dz / maxDim, 0,
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
  const [dx, dy, dz] = volume.dimensions;
  const maxDim = Math.max(dx, dy, dz);
  return {
    x: pos.x * maxDim / dx,
    y: pos.y * maxDim / dy,
    z: pos.z * maxDim / dz,
  };
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
