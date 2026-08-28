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
    it('starts with default thickness=15, mode=min', () => {
      // dental 표준 focal trough 두께 (5~15mm). full 머리 깊이 적분 시 noise가
      // 심하므로 curve 중심에서 좁게만 적분하는 게 panoramic 품질의 핵심.
      const t = new FocalTrough();
      expect(t.thickness).toBe(15);
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
      const out = trough.extract(c, v, { inPlaneSamples: 5 });
      expect(out.data).toBeInstanceOf(Float32Array);
      expect(out.data.length).toBeGreaterThanOrEqual(5);
      expect(out.data.length % 5).toBe(0);
    });

    it('constant volume produces constant output (thickness=0, min mode)', () => {
      const v = makeVolume(123);
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });
      const out = trough.extract(c, v, { inPlaneSamples: 1 });
      for (let i = 0; i < out.data.length; i++) {
        expect(out.data[i]).toBeCloseTo(123, 4);
      }
    });

    it('thickness>0 produces output with values in volume range', () => {
      trough.setThickness(3);
      const v = makeGradientVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });
      const out = trough.extract(c, v, { inPlaneSamples: 5 });
      // 모든 값은 0..90 사이에 있어야 함
      for (let i = 0; i < out.data.length; i++) {
        expect(out.data[i]).toBeGreaterThanOrEqual(0);
        expect(out.data[i]).toBeLessThanOrEqual(90);
      }
    });

    it('mode=max picks values not lower than mode=min on same input', () => {
      const v = makeGradientVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });

      const troughMin = new FocalTrough({ thickness: 2, mode: 'min' });
      const troughMax = new FocalTrough({ thickness: 2, mode: 'max' });
      const outMin = troughMin.extract(c, v, { inPlaneSamples: 5 });
      const outMax = troughMax.extract(c, v, { inPlaneSamples: 5 });

      expect(outMin.data.length).toBe(outMax.data.length);
      for (let i = 0; i < outMin.data.length; i++) {
        expect(outMax.data[i]).toBeGreaterThanOrEqual(outMin.data[i] - 1e-3);
      }
    });

    it('throws on insufficient curve points', () => {
      const v = makeVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 5, y: 5, z: 5 });
      expect(() => trough.extract(c, v, { inPlaneSamples: 5 })).toThrow();
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
      const data = t.extract(c, v, { inPlaneSamples: W, curveSamples: N });

      expect(data.data.length).toBe(W * N);

      for (let cIdx = 0; cIdx < N; cIdx++) {
        const base = data.data[cIdx];
        for (let tIdx = 0; tIdx < W; tIdx++) {
          expect(data.data[tIdx * N + cIdx]).toBe(base);
        }
      }

      // curve가 움직였으므로 인접 col 값은 달라야 함 (옛 가로/세로 뒤바뀐 레이아웃이면 같아짐).
      expect(data.data[0]).not.toBe(data.data[1]);
      expect(data.data[1]).not.toBe(data.data[2]);
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

      const outMin = troughMin.extract(c, v, { inPlaneSamples: W, curveSamples: 8 });
      const outMean = troughMean.extract(c, v, { inPlaneSamples: W, curveSamples: 8 });
      const outMax = troughMax.extract(c, v, { inPlaneSamples: W, curveSamples: 8 });

      expect(outMin.data.length).toBe(outMean.data.length);
      expect(outMean.data.length).toBe(outMax.data.length);

      // min ≤ mean ≤ max (모든 픽셀)
      for (let i = 0; i < outMin.data.length; i++) {
        expect(outMin.data[i]).toBeLessThanOrEqual(outMean.data[i] + 1e-3);
        expect(outMean.data[i]).toBeLessThanOrEqual(outMax.data[i] + 1e-3);
      }
    });

    it('proper panoramic IP: results vary along the curve (different curve samples yield different values)', () => {
      // x축 gradient → 다른 curve sample은 다른 x → IP 결과도 달라야 함
      const v = makeGradientVolume();
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });

      const trough = new FocalTrough({ thickness: 5, mode: 'min' });
      const data = trough.extract(c, v, { inPlaneSamples: 3, curveSamples: 8 });
      // 같은 in-plane row에서 curve 방향(가로)으로 값이 변해야 함
      for (let row = 0; row < 3; row++) {
        const first = data.data[row * 8];
        const last = data.data[row * 8 + 7];
        expect(first).not.toBe(last);
      }
    });
  });

  // mm-based extract: 픽셀 수가 curve length(mm)와 thickness(mm)에 비례.
  // 결과는 비정사각형이며, mm/pixel이 같으면 mm 비율이 정확히 보존됨.
  describe('extract (mm-based, non-square panorama)', () => {
    it('returns { data, curveWidth, inPlaneWidth } (object, not raw Float32Array)', () => {
      const v = makeVolume(100);
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });
      const out = trough.extract(c, v);
      expect(out).toBeTypeOf('object');
      expect(out.data).toBeInstanceOf(Float32Array);
      expect(typeof out.curveWidth).toBe('number');
      expect(typeof out.inPlaneWidth).toBe('number');
    });

    it('curveWidth grows with curve length when using default mmPerPixel', () => {
      const v = makeVolume(100);
      trough.setThickness(0); // thickness=0 → in-plane samples should be clamped

      const cShort = new PanoramicCurve();
      cShort.addPoint({ x: 1, y: 5, z: 5 });
      cShort.addPoint({ x: 2, y: 5, z: 5 });
      const rShort = trough.extract(cShort, v);

      const cLong = new PanoramicCurve();
      cLong.addPoint({ x: 1, y: 5, z: 5 });
      cLong.addPoint({ x: 50, y: 5, z: 5 });
      const rLong = trough.extract(cLong, v);

      expect(rLong.curveWidth).toBeGreaterThan(rShort.curveWidth);
    });

    it('inPlaneWidth grows with thickness (in mm)', () => {
      const v = makeVolume(100);
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });

      trough.setThickness(4);
      const r4 = trough.extract(c, v);
      trough.setThickness(20);
      const r20 = trough.extract(c, v);
      expect(r20.inPlaneWidth).toBeGreaterThan(r4.inPlaneWidth);
    });

    it('mmPerPixel halves both dims when halved (more detail)', () => {
      // cap(>=8)에 걸리지 않을 만큼 큰 curve/thickness 사용.
      const v = makeVolume(100);
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 100, y: 5, z: 5 }); // 99mm
      trough.setThickness(20); // 20mm

      const r1 = trough.extract(c, v, { mmPerPixel: 1 });
      const r2 = trough.extract(c, v, { mmPerPixel: 0.5 });
      // 절반 mm/pixel = 두 배 픽셀 (정확히 2배: cap 없으면 ceil(N/0.5) = 2*ceil(N))
      expect(r2.curveWidth).toBeGreaterThanOrEqual(r1.curveWidth * 1.95);
      expect(r2.inPlaneWidth).toBeGreaterThanOrEqual(r1.inPlaneWidth * 1.95);
    });

    it('data length equals curveWidth * inPlaneWidth', () => {
      const v = makeVolume(100);
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });
      trough.setThickness(5);
      const r = trough.extract(c, v);
      expect(r.data.length).toBe(r.curveWidth * r.inPlaneWidth);
    });

    it('curveSamples / inPlaneSamples override mm-based counts', () => {
      const v = makeVolume(100);
      const c = new PanoramicCurve();
      c.addPoint({ x: 1, y: 5, z: 5 });
      c.addPoint({ x: 8, y: 5, z: 5 });
      trough.setThickness(5);
      const r = trough.extract(c, v, { curveSamples: 50, inPlaneSamples: 20 });
      expect(r.curveWidth).toBe(50);
      expect(r.inPlaneWidth).toBe(20);
      expect(r.data.length).toBe(1000);
    });
  });

  // detectBestDepthRange 캐싱 — volume 안 바뀌면 두 번째 호출은 캐시 적중.
  // 캐시는 volume identity(===) 기준.
  describe('detectBestDepthRange cache', () => {
    it('returns the same object reference on cache hit (no recomputation)', () => {
      const v = makeVolume(100);
      const r1 = trough.detectBestDepthRange(v);
      const r2 = trough.detectBestDepthRange(v);
      // 캐시 적중이면 동일 객체 참조 반환 (성능: variance 재계산 안 함)
      expect(r2).toBe(r1);
    });

    it('invalidates cache when a different volume is passed', () => {
      const v1 = makeVolume(100);
      const v2 = makeVolume(200);
      const r1 = trough.detectBestDepthRange(v1);
      const r2 = trough.detectBestDepthRange(v2);
      // 다른 volume → 캐시 미스 → 새 객체
      expect(r2).not.toBe(r1);
      expect(r2.zMax).toBeGreaterThanOrEqual(r2.zMin);
    });
  });
});
