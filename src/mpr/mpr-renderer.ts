import type { MPRPlane } from '../shared/types/rendering';
import type { Dimensions } from '../shared/types/core';
import type { IMPRRenderer } from '../shared/interfaces/mpr';
import { MPRView } from './mpr-view';
import { SliceExtractor } from './slice-extractor';
import { WLWWApplier } from './wlww-applier';
import { VolumeNotLoadedError } from '../shared/errors/mpr';

/** MPR 3단면 렌더링 오케스트레이션 */
export class MPRRenderer implements IMPRRenderer {
  private views = new Map<MPRPlane, MPRView>();
  private slicePositions = new Map<MPRPlane, number>();
  private volumeDims: Dimensions | null = null;
  private extractor = new SliceExtractor();
  private wlww = new WLWWApplier();

  constructor() {
    this.views.set('Axial' as MPRPlane, new MPRView('Axial' as MPRPlane));
    this.views.set('Coronal' as MPRPlane, new MPRView('Coronal' as MPRPlane));
    this.views.set('Sagittal' as MPRPlane, new MPRView('Sagittal' as MPRPlane));

    this.slicePositions.set('Axial' as MPRPlane, 0);
    this.slicePositions.set('Coronal' as MPRPlane, 0);
    this.slicePositions.set('Sagittal' as MPRPlane, 0);
  }

  setVolume(dims: Dimensions): void {
    this.volumeDims = dims;
    this.slicePositions.set('Axial' as MPRPlane, Math.floor(dims.z / 2));
    this.slicePositions.set('Coronal' as MPRPlane, Math.floor(dims.y / 2));
    this.slicePositions.set('Sagittal' as MPRPlane, Math.floor(dims.x / 2));
  }

  setSlicePosition(plane: MPRPlane, position: number): void {
    this.slicePositions.set(plane, position);
    const view = this.views.get(plane);
    if (view) view.update(position);
  }

  getSlicePosition(plane: MPRPlane): number {
    return this.slicePositions.get(plane) ?? 0;
  }

  render(plane: MPRPlane, position: number): Uint8Array {
    if (!this.volumeDims) throw new VolumeNotLoadedError();

    this.setSlicePosition(plane, position);
    return this.renderPlane(plane);
  }

  renderAll(): Map<MPRPlane, Uint8Array> {
    if (!this.volumeDims) throw new VolumeNotLoadedError();

    const results = new Map<MPRPlane, Uint8Array>();
    for (const plane of this.views.keys()) {
      const pos = this.slicePositions.get(plane) ?? 0;
      results.set(plane, this.renderPlane(plane));
    }
    return results;
  }

  getSliceImage(plane: MPRPlane): ImageData {
    if (!this.volumeDims) throw new VolumeNotLoadedError();

    const rendered = this.renderPlane(plane);
    const view = this.views.get(plane)!;
    const sliceDims = view.getSliceDimensions(this.volumeDims);
    const w = sliceDims.width;
    const h = sliceDims.height;

    const imageData = new ImageData(w, h);
    for (let i = 0; i < rendered.length; i++) {
      const idx = i * 4;
      imageData.data[idx] = rendered[i];
      imageData.data[idx + 1] = rendered[i];
      imageData.data[idx + 2] = rendered[i];
      imageData.data[idx + 3] = 255;
    }
    return imageData;
  }

  getView(plane: MPRPlane): MPRView | undefined {
    return this.views.get(plane);
  }

  getWLWW(): WLWWApplier {
    return this.wlww;
  }

  getExtractor(): SliceExtractor {
    return this.extractor;
  }

  getVolumeDims(): Dimensions | null {
    return this.volumeDims;
  }

  private renderPlane(plane: MPRPlane): Uint8Array {
    // CPU fallback: 실제 렌더링은 외부에서 VolumeData를 주입받아야 함
    // 여기서는 WL/WW 적용만 담당
    return new Uint8Array(0);
  }
}
