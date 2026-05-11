import { DicomTagReader } from '../dicom/tag-reader';
import { TransferSyntaxRegistry } from '../encoding/transfer-syntax-registry';
import { PixelDataDecoder } from '../dicom/pixel-data-decoder';
import { SliceExtractor } from '../mpr/slice-extractor';
import { WLWWApplier } from '../mpr/wlww-applier';
import { MPRPlane } from '../shared/types/rendering';
import type { VolumeData } from '../shared/types/volume';
import type { DecodingInfo } from '../shared/types/dicom';
import type { DicomTags } from '../shared/types/patient';

let volume: VolumeData | null = null;
const extractor = new SliceExtractor();
const wlww = new WLWWApplier();

wlww.setDefaultCBCT();

const axialCanvas = document.getElementById('axial-canvas') as HTMLCanvasElement;
const coronalCanvas = document.getElementById('coronal-canvas') as HTMLCanvasElement;
const sagittalCanvas = document.getElementById('sagittal-canvas') as HTMLCanvasElement;
const axialSlider = document.getElementById('axial-slider') as HTMLInputElement;
const coronalSlider = document.getElementById('coronal-slider') as HTMLInputElement;
const sagittalSlider = document.getElementById('sagittal-slider') as HTMLInputElement;
const wlSlider = document.getElementById('wl-slider') as HTMLInputElement;
const wwSlider = document.getElementById('ww-slider') as HTMLInputElement;
const statusEl = document.getElementById('status')!;
const controlsMpm = document.getElementById('controls-mpm')!;
const loadingEl = document.getElementById('loading')!;
const loadBtn = document.getElementById('load-btn')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

loadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);
axialSlider.addEventListener('input', () => { updateSliderVal('axial'); renderAll(); });
coronalSlider.addEventListener('input', () => { updateSliderVal('coronal'); renderAll(); });
sagittalSlider.addEventListener('input', () => { updateSliderVal('sagittal'); renderAll(); });
wlSlider.addEventListener('input', () => { updateSliderVal('wl'); renderAll(); });
wwSlider.addEventListener('input', () => { updateSliderVal('ww'); renderAll(); });

function updateSliderVal(which: string) {
  if (which === 'axial') document.getElementById('axial-val')!.textContent = axialSlider.value;
  if (which === 'coronal') document.getElementById('coronal-val')!.textContent = coronalSlider.value;
  if (which === 'sagittal') document.getElementById('sagittal-val')!.textContent = sagittalSlider.value;
  if (which === 'wl') { document.getElementById('wl-val')!.textContent = wlSlider.value; wlww.setWindowLevel(+wlSlider.value); }
  if (which === 'ww') { document.getElementById('ww-val')!.textContent = wwSlider.value; wlww.setWindowWidth(+wwSlider.value); }
}

async function handleFiles() {
  const files = fileInput.files;
  if (!files || files.length === 0) return;

  loadingEl.classList.add('active');
  statusEl.textContent = `${files.length}개 DICOM 파일 파싱 중...`;

  try {
    volume = await buildVolumeFromFiles(Array.from(files));
    const [dx, dy, dz] = volume.dimensions;
    statusEl.textContent = `볼륨 로드 완료: ${dx}×${dy}×${dz} (${files.length}슬라이스)`;

    axialSlider.max = String(dz - 1);
    coronalSlider.max = String(dy - 1);
    sagittalSlider.max = String(dx - 1);
    axialSlider.value = String(Math.floor(dz / 2));
    coronalSlider.value = String(Math.floor(dy / 2));
    sagittalSlider.value = String(Math.floor(dx / 2));

    updateSliderVal('axial');
    updateSliderVal('coronal');
    updateSliderVal('sagittal');

    controlsMpm.style.display = 'block';
    renderAll();
  } catch (err) {
    statusEl.textContent = `에러: ${(err as Error).message}`;
    console.error(err);
  } finally {
    loadingEl.classList.remove('active');
  }
}

async function buildVolumeFromFiles(files: File[]): Promise<VolumeData> {
  const registry = new TransferSyntaxRegistry();

  const sortedSlices: { position: number; buffer: ArrayBuffer; rows: number; cols: number }[] = [];

  let processed = 0;
  let errors = 0;
  let skippedNoPixel = 0;
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      const reader = new DicomTagReader(arrayBuffer);
      const tags: DicomTags = reader.parseAllTags();

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
      if (!pixelTag || rows === 0 || cols === 0) {
        skippedNoPixel++;
        continue;
      }

      const pixelOffset = pixelTag.offset + 4;
      const pixelLength = pixelTag.length;
      const pixelData = new ArrayBuffer(pixelLength);
      new Uint8Array(pixelData).set(uint8.slice(pixelOffset, pixelOffset + pixelLength));

      let decodedBuffer: ArrayBuffer = pixelData;
      if (tsDef && !tsDef.isCompressed) {
        const decodeInfo: DecodingInfo = { bitsAllocated, bitsStored, pixelRepresentation, rows, columns: cols };
        const decoder = new PixelDataDecoder(decodeInfo);
        decodedBuffer = decoder.decode(pixelData, {
          uid: tsDef.uid,
          name: tsDef.name,
          isCompressed: tsDef.isCompressed,
          isLittleEndian: tsDef.isLittleEndian,
        });
      }

      sortedSlices.push({ position, buffer: decodedBuffer, rows, cols });
    } catch (e) {
      errors++;
      if (processed === 0) console.error('First file parse error:', file.name, e);
    }

    processed++;
    if (processed % 50 === 0) {
      statusEl.textContent = `파싱 중... ${processed}/${files.length}`;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  sortedSlices.sort((a, b) => a.position - b.position);

  if (sortedSlices.length === 0) throw new Error(`No valid DICOM slices found (errors: ${errors}, skipped: ${skippedNoPixel}, total: ${files.length})`);

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
    buffer: volumeBuffer,
    dimensions: [dx, dy, dz],
    spacing: [0.2, 0.2, spacingZ],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

function renderAll() {
  if (!volume) return;

  renderSlice(axialCanvas, MPRPlane.Axial, +axialSlider.value);
  renderSlice(coronalCanvas, MPRPlane.Coronal, +coronalSlider.value);
  renderSlice(sagittalCanvas, MPRPlane.Sagittal, +sagittalSlider.value);
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
  for (let i = 0; i < grayscale.length; i++) {
    const idx = i * 4;
    imageData.data[idx] = grayscale[i];
    imageData.data[idx + 1] = grayscale[i];
    imageData.data[idx + 2] = grayscale[i];
    imageData.data[idx + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}
