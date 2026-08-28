import { describe, it, expect, beforeEach } from 'vitest';
import { FocalTrough } from '../focal-trough';
import { PanoramicCurve } from '../panoramic-curve';
import { PanoView } from '../pano-view';
import type { VolumeData } from '../../shared/types/volume';

function makeVolume(value = 100): VolumeData {
  const dx = 10, dy = 10, dz = 10;
  const buf = new ArrayBuffer(dx * dy * dz * 2); // int16
  const view = new Int16Array(buf);
  view.fill(value);
  return {
    buffer: buf,
    dimensions: [dx, dy, dz],
    spacing: [1, 1, 1],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

function makeGradientVolume(): VolumeData {
  // x축 방향으로 0..90 값
  const dx = 10, dy = 10, dz = 10;
  const buf = new ArrayBuffer(dx * dy * dz * 2);
  const view = new Int16Array(buf);
  for (let z = 0; z < dz; z++) {
    for (let y = 0; y < dy; y++) {
      for (let x = 0; x < dx; x++) {
        view[z * dx * dy + y * dx + x] = x * 10;
      }
    }
  }
  return {
    buffer: buf,
    dimensions: [dx, dy, dz],
    spacing: [1, 1, 1],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

describe('FocalTrough', () => {
  let trough: FocalTrough;
  beforeEach(() => {
    trough = new FocalTrough({ thickness: 0, mode: 'min' });
  });

  describe('configuration', () => {
    it('starts with default thickness=200, mode=min', () => {
      // thickness = in-plane(전후) 범위(mm). full 머리 깊이 ~200mm.
      const t = new FocalTrough();
      expect(t.thickness).toBe(200);
      expect(t.mode).toBe('min');
    });

    it('setThickness updates thickness (non-negative)', () => {
      trough.setThickness(5);
      expect(trough.thickness).toBe(5);
    });

    it('setThickness clamps negative to 0', () => {
      trough.setThickness(-3);
      expect(trough.thickness).toBe(0);
    });

    it('setMode changes integration mode', () => {
      trough.setMode('max');
      expect(trough.mode).toBe('max');
    });
  });

  describe('extract', () => {
    it('returns Float32Array whose length is divisible by width', () => {
      const v = makeVolume(100);
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });
      const out = trough.extract(c, v, 5);
      expect(out).toBeInstanceOf(Float32Array);
      expect(out.length).toBeGreaterThanOrEqual(5);
      expect(out.length % 5).toBe(0);
    });

    it('constant volume produces constant output (thickness=0, min mode)', () => {
      const v = makeVolume(123);
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });
      const out = trough.extract(c, v, 1);
      for (let i = 0; i < out.length; i++) {
        expect(out[i]).toBeCloseTo(123, 4);
      }
    });

    it('thickness>0 produces output with values in volume range', () => {
      trough.setThickness(3);
      const v = makeGradientVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });
      const out = trough.extract(c, v, 5);
      // 모든 값은 0..90 사이에 있어야 함
      for (let i = 0; i < out.length; i++) {
        expect(out[i]).toBeGreaterThanOrEqual(0);
        expect(out[i]).toBeLessThanOrEqual(90);
      }
    });

    it('mode=max picks values not lower than mode=min on same input', () => {
      const v = makeGradientVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });

      const troughMin = new FocalTrough({ thickness: 2, mode: 'min' });
      const troughMax = new FocalTrough({ thickness: 2, mode: 'max' });
      const outMin = troughMin.extract(c, v, 5);
      const outMax = troughMax.extract(c, v, 5);

      expect(outMin.length).toBe(outMax.length);
      for (let i = 0; i < outMin.length; i++) {
        expect(outMax[i]).toBeGreaterThanOrEqual(outMin[i] - 1e-3);
      }
    });

    it('throws on insufficient curve points', () => {
      const v = makeVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 5, y: 5, z: 5 });
      expect(() => trough.extract(c, v, 5)).toThrow();
    });

    // 회귀 방지: 데이터 레이아웃은 (thickness × curve) row-major.
    // 즉 out[t * N + c] = (thickness sample t, curve sample c).
    // 호출부는 setIntensityMap(data, N, W)로 넘겨
    //   image[x, y] = data[y * N + x] = (thickness y, curve x)
    // → panorama의 가로 = curve (N=256), 세로 = thickness (W).
    // 이게 깨지면 row마다 4개 curve 샘플이 압축된 "바코드"가 됨.
    it('stores data as (thickness × curve) row-major: out[t*N + c] = (thickness t, curve c)', () => {
      const v = makeGradientVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });

      // sampleCount=8 (FocalTrough 생성자에서 Math.max(8, ...)로 강제), thickness=0
      // thickness=0 → 모든 curve sample에 대해 두께 방향 샘플이 같은 점.
      // → data[t*N + c] === data[c] for all t
      const t = new FocalTrough({ thickness: 0, mode: 'min', sampleCount: 8 });
      const W = 3;
      const N = 8;
      const data = t.extract(c, v, W);

      expect(data.length).toBe(W * N);

      for (let cIdx = 0; cIdx < N; cIdx++) {
        const base = data[cIdx];
        for (let tIdx = 0; tIdx < W; tIdx++) {
          expect(data[tIdx * N + cIdx]).toBe(base);
        }
      }

      // curve가 움직였으므로 인접 col 값은 달라야 함 (옛 가로/세로 뒤바뀐 레이아웃이면 같아짐).
      expect(data[0]).not.toBe(data[1]);
      expect(data[1]).not.toBe(data[2]);
    });

    it('PanoView.setIntensityMap(data, sampleCount, width) places curve horizontal and thickness vertical', () => {
      // 합성 데이터: out[t*N + c] = t * 100  →  각 row(thickness t)가 일정 값.
      // panorama에 표시하면 thickness는 세로, curve는 가로.
      const N = 8;
      const W = 3;
      const data = new Float32Array(W * N);
      for (let t = 0; t < W; t++) {
        for (let c = 0; c < N; c++) {
          data[t * N + c] = t * 100;
        }
      }

      const view = new PanoView();
      view.setIntensityMap(data, N, W);
      const size = view.getDataSize();
      expect(size.width).toBe(N);
      expect(size.height).toBe(W);
    });

    it('proper panoramic IP: mode=max picks values not lower than mode=mean, and mode=mean not lower than mode=min', () => {
      // x축 gradient 볼륨 + xy 평면(z=5) 위 직선 곡선.
      // mode별로 planeNormal(=z축) 방향 IP 결과 비교.
      const v = makeGradientVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });

      const W = 5;
      const troughMin = new FocalTrough({ thickness: 5, mode: 'min', sampleCount: 8 });
      const troughMean = new FocalTrough({ thickness: 5, mode: 'mean', sampleCount: 8 });
      const troughMax = new FocalTrough({ thickness: 5, mode: 'max', sampleCount: 8 });

      const outMin = troughMin.extract(c, v, W);
      const outMean = troughMean.extract(c, v, W);
      const outMax = troughMax.extract(c, v, W);

      expect(outMin.length).toBe(outMean.length);
      expect(outMean.length).toBe(outMax.length);

      // min ≤ mean ≤ max (모든 픽셀)
      for (let i = 0; i < outMin.length; i++) {
        expect(outMin[i]).toBeLessThanOrEqual(outMean[i] + 1e-3);
        expect(outMean[i]).toBeLessThanOrEqual(outMax[i] + 1e-3);
      }
    });

    it('proper panoramic IP: results vary along the curve (different curve samples yield different values)', () => {
      // x축 gradient → 다른 curve sample은 다른 x → IP 결과도 달라야 함
      const v = makeGradientVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });

      const trough = new FocalTrough({ thickness: 5, mode: 'min', sampleCount: 8 });
      const data = trough.extract(c, v, 3);
      // 같은 in-plane row에서 curve 방향(가로)으로 값이 변해야 함
      for (let row = 0; row < 3; row++) {
        const first = data[row * 8];
        const last = data[row * 8 + 7];
        expect(first).not.toBe(last);
      }
    });
  });
});
