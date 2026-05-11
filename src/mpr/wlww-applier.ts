import type { IWindowing } from '../shared/interfaces/mpr';

/** Window Level/Width 값을 픽셀 데이터에 적용 */
export class WLWWApplier implements IWindowing {
  private _windowLevel = 0;
  private _windowWidth = 1;

  get windowLevel(): number { return this._windowLevel; }
  get windowWidth(): number { return this._windowWidth; }

  apply(data: Float32Array, wl: number, ww: number): Uint8Array {
    const result = new Uint8Array(data.length);
    const low = wl - ww / 2;
    const scale = 255 / ww;

    for (let i = 0; i < data.length; i++) {
      const mapped = (data[i] - low) * scale;
      result[i] = Math.max(0, Math.min(255, mapped | 0));
    }

    return result;
  }

  applyCurrent(data: Float32Array): Uint8Array {
    return this.apply(data, this._windowLevel, this._windowWidth);
  }

  setWindowLevel(wl: number): void {
    this._windowLevel = wl;
  }

  setWindowWidth(ww: number): void {
    if (ww <= 0) throw new Error('Window width must be positive');
    this._windowWidth = ww;
  }

  setDefaultCBCT(): void {
    this._windowLevel = 500;
    this._windowWidth = 2500;
  }

  reset(): void {
    this._windowLevel = 0;
    this._windowWidth = 1;
  }
}
