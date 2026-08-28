import type { IPanoRenderer } from '../shared/interfaces/pano';

/** WL/WW 적용: HU 값 → 0..255 그레이스케일 */
function applyWindow(value: number, wl: number, ww: number): number {
  if (ww <= 0) return 128;
  const low = wl - ww / 2;
  const high = wl + ww / 2;
  if (value <= low) return 0;
  if (value >= high) return 255;
  return Math.round(((value - low) / ww) * 255);
}

export interface IntensityBytes {
  /** Uint8 RGBA 픽셀 (4 bytes per pixel) */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export class PanoRenderer implements IPanoRenderer {
  /**
   * Float32Array intensity 맵 → RGBA bytes (canvas/ImageData 비의존).
   * 테스트는 이 메서드를 검증. 진짜 ctx에 그릴 때는 toImageData()로 wrap.
   */
  toIntensityBytes(data: Float32Array, width: number, height: number, wl: number, ww: number): IntensityBytes {
    const n = width * height;
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const v = applyWindow(data[i], wl, ww);
      const j = i * 4;
      out[j] = v;
      out[j + 1] = v;
      out[j + 2] = v;
      out[j + 3] = 255;
    }
    return { data: out, width, height };
  }

  /**
   * ImageData 생성 (브라우저 전용 — 글로벌 ImageData 필요).
   * jsdom + canvas 패키지 없을 때 throw.
   */
  toImageData(data: Float32Array, width: number, height: number, wl: number, ww: number): ImageData {
    if (typeof ImageData === 'undefined') {
      throw new Error('PanoRenderer.toImageData: ImageData is not available in this environment');
    }
    const bytes = this.toIntensityBytes(data, width, height, wl, ww);
    return new ImageData(bytes.data as Uint8ClampedArray<ArrayBuffer>, width, height);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    data: Float32Array,
    width: number,
    height: number,
    wl: number,
    ww: number,
    zoom: number,
    panX: number,
    panY: number,
  ): void {
    const bytes = this.toIntensityBytes(data, width, height, wl, ww);
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;

    // 1) 검은 배경
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);

    // 2) fit-contain: 비율 유지, 중앙 정렬
    const scale = Math.min(cw / width, ch / height);
    const dw = width * scale * zoom;
    const dh = height * scale * zoom;
    const dx = (cw - dw) / 2 + panX;
    const dy = (ch - dh) / 2 + panY;

    // 3) offscreen에 원본 그리기
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    if (offCtx) {
      const imgData = new ImageData(bytes.data as Uint8ClampedArray<ArrayBuffer>, width, height);
      offCtx.putImageData(imgData, 0, 0);
    }

    // 4) canvas에 fit-to-contain
    //    zoom=1(기본)이라도 픽셀이 거칠게 보이지 않도록 항상 smoothing 켬
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, dx, dy, dw, dh);
  }
}
