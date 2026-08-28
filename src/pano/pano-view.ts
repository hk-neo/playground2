import type { IPanoView } from '../shared/interfaces/pano';
import { PanoRenderer } from './pano-renderer';

const DEFAULT_WL = 0;     // 공기/치아 중간
const DEFAULT_WW = 600;   // soft tissue(-200)~bone(+200) 영역을 0~255로 매핑 (치아/뼈 잘 보임)
const DEFAULT_ZOOM = 1;

export class PanoView implements IPanoView {
  private _data: Float32Array = new Float32Array(0);
  private _width = 0;
  private _height = 0;
  private _wl = DEFAULT_WL;
  private _ww = DEFAULT_WW;
  private _zoom = DEFAULT_ZOOM;
  private _panX = 0;
  private _panY = 0;
  private _renderer: PanoRenderer;
  private _lastCanvas: HTMLCanvasElement | null = null;
  private _lastImageData: ImageData | null = null;

  constructor() {
    this._renderer = new PanoRenderer();
  }

  setIntensityMap(data: Float32Array, width: number, height: number): void {
    this._data = data;
    this._width = width;
    this._height = height;
    this._lastImageData = null; // invalidate cache
  }

  setWLWW(wl: number, ww: number): void {
    this._wl = wl;
    this._ww = ww;
    this._lastImageData = null;
  }

  getWLWW(): { wl: number; ww: number } {
    return { wl: this._wl, ww: this._ww };
  }

  setZoomPan(zoom: number, panX: number, panY: number): void {
    this._zoom = zoom;
    this._panX = panX;
    this._panY = panY;
  }

  getZoomPan(): { zoom: number; panX: number; panY: number } {
    return { zoom: this._zoom, panX: this._panX, panY: this._panY };
  }

  resetView(): void {
    this._zoom = DEFAULT_ZOOM;
    this._panX = 0;
    this._panY = 0;
  }

  /** 테스트용: 현재 데이터 크기 */
  getDataSize(): { width: number; height: number } {
    return { width: this._width, height: this._height };
  }

  render(canvas?: HTMLCanvasElement): void {
    const c = canvas ?? this._lastCanvas;
    if (!c) {
      throw new Error('PanoView.render: no canvas. Pass a canvas or call render(canvas) at least once.');
    }
    this._lastCanvas = c;
    const ctx = c.getContext('2d');
    if (!ctx) {
      throw new Error('PanoView.render: 2D context unavailable');
    }
    if (this._width === 0 || this._height === 0) {
      // clear
      ctx.clearRect(0, 0, c.width, c.height);
      return;
    }
    this._renderer.draw(ctx, this._data, this._width, this._height, this._wl, this._ww, this._zoom, this._panX, this._panY);
  }

  dispose(): void {
    this._data = new Float32Array(0);
    this._width = 0;
    this._height = 0;
    this._lastImageData = null;
    this._lastCanvas = null;
  }
}
