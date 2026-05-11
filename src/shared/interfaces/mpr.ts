import type { VolumeData } from '../types/volume';
import type { MPRPlane } from '../types/rendering';

/** MPR 렌더링 추상화 */
export interface IMPRRenderer {
  render(plane: MPRPlane, position: number): void;
  renderAll(): void;
  getSliceImage(plane: MPRPlane): ImageData;
}

/** 단면 추출 추상화 */
export interface ISliceExtractor {
  extract(plane: MPRPlane, position: number, volume: VolumeData): Float32Array;
}

/** WL/WW 적용 추상화 */
export interface IWindowing {
  apply(data: Float32Array, wl: number, ww: number): Uint8Array;
  setDefaultCBCT(): void;
  reset(): void;
}
