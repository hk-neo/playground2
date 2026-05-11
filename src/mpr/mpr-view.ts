import type { MPRPlane, SliceOrientation } from '../shared/types/rendering';
import type { Dimensions } from '../shared/types/core';

/** 개별 단면 렌더링 상태 관리 */
export class MPRView {
  private _slicePosition = 0;
  private _orientation: SliceOrientation;
  private _width: number;
  private _height: number;

  constructor(
    public readonly plane: MPRPlane,
    width = 512,
    height = 512,
  ) {
    this._width = width;
    this._height = height;
    this._orientation = this.getDefaultOrientation(plane);
  }

  get slicePosition(): number { return this._slicePosition; }
  get orientation(): SliceOrientation { return this._orientation; }
  get width(): number { return this._width; }
  get height(): number { return this._height; }

  update(position: number): void {
    this._slicePosition = Math.max(0, Math.round(position));
  }

  setOrientation(orientation: SliceOrientation): void {
    this._orientation = orientation;
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) throw new Error('Dimensions must be positive');
    this._width = width;
    this._height = height;
  }

  getMaxSlice(dims: Dimensions): number {
    switch (this.plane) {
      case 'Axial': return dims.z;
      case 'Coronal': return dims.y;
      case 'Sagittal': return dims.x;
      default: return 0;
    }
  }

  getSliceDimensions(dims: Dimensions): { width: number; height: number } {
    switch (this.plane) {
      case 'Axial': return { width: dims.x, height: dims.y };
      case 'Coronal': return { width: dims.x, height: dims.z };
      case 'Sagittal': return { width: dims.y, height: dims.z };
      default: return { width: 0, height: 0 };
    }
  }

  private getDefaultOrientation(plane: MPRPlane): SliceOrientation {
    switch (plane) {
      case 'Axial':
        return { directionCosines: [1, 0, 0, 0, 1, 0], position: [0, 0, 0] };
      case 'Coronal':
        return { directionCosines: [1, 0, 0, 0, 0, -1], position: [0, 0, 0] };
      case 'Sagittal':
      default:
        return { directionCosines: [0, 1, 0, 0, 0, -1], position: [0, 0, 0] };
    }
  }
}
