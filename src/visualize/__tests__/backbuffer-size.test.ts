import { describe, it, expect } from 'vitest';
import { computeBackbufferSize } from '../backbuffer-size';

describe('computeBackbufferSize', () => {
  it('일반적인 1080p 뷰포트 + dpr=1 → 1:1 매핑', () => {
    const r = computeBackbufferSize(1920, 1080, 1);
    expect(r).toEqual({ w: 1920, h: 1080 });
  });

  it('maxDim 이하면 dpr 적용 그대로 (800×600 @ dpr=2 → 1600×1200)', () => {
    const r = computeBackbufferSize(800, 600, 2);
    expect(r).toEqual({ w: 1600, h: 1200 });
  });

  it('큰 뷰포트에서 maxDim 초과 시 종횡비 유지하며 축소 (회귀 가드: INVALID_OPERATION 방지)', () => {
    // 4K + dpr=2 = 7680×4320, RGBA16F = 264 MB. ANGLE/D3D 드라이버의
    // "Texture total allocation size is too large" 에러 회피.
    // maxDim=4096 기본값 → 7680×4320 → 4096×2304 (16:9 유지)
    const r = computeBackbufferSize(3840, 2160, 2);
    expect(r).not.toBeNull();
    expect(r!.w).toBe(4096);
    expect(r!.h).toBe(2304);
    // 종횡비 보존 검증 (±1 오차 허용)
    expect(r!.w / r!.h).toBeCloseTo(3840 / 2160, 1);
  });

  it('세로가 더 긴 뷰포트에서도 종횡비 유지하며 축소', () => {
    // 1080×5000 + dpr=1, maxDim=4096 → 세로 5000이 maxDim 초과,
    // 세로를 4096에 맞추고 가로를 1080/5000*4096 = 884 로 축소.
    const r = computeBackbufferSize(1080, 5000, 1);
    expect(r).not.toBeNull();
    expect(r!.h).toBe(4096);
    expect(r!.w).toBe(884);
  });

  it('maxDim 이하면 축소하지 않음', () => {
    const r = computeBackbufferSize(1500, 800, 1, 4096);
    expect(r).toEqual({ w: 1500, h: 800 });
  });

  it('maxDim을 커스텀값으로 변경 가능', () => {
    const r = computeBackbufferSize(4000, 2000, 1, 1024);
    expect(r).toEqual({ w: 1024, h: 512 });
  });

  it('CSS 박스가 0×0이면 null (레이아웃 미정렬 가드)', () => {
    expect(computeBackbufferSize(0, 0, 1)).toBeNull();
    expect(computeBackbufferSize(0, 500, 1)).toBeNull();
    expect(computeBackbufferSize(500, 0, 1)).toBeNull();
  });

  it('음수 / NaN / Infinity 입력에 null 반환', () => {
    expect(computeBackbufferSize(-1, 100, 1)).toBeNull();
    expect(computeBackbufferSize(100, -1, 1)).toBeNull();
    expect(computeBackbufferSize(NaN, 100, 1)).toBeNull();
    expect(computeBackbufferSize(Infinity, 100, 1)).toBeNull();
    expect(computeBackbufferSize(100, 100, -1)).toBeNull();
    expect(computeBackbufferSize(100, 100, 0)).toBeNull();
  });

  it('축소 후 최소 1×1 보장 (극단적 종횡비에서도 0 안 됨)', () => {
    // 100×50000 + dpr=1 → 가로 1, 세로 maxDim
    const r = computeBackbufferSize(100, 50000, 1);
    expect(r).not.toBeNull();
    expect(r!.w).toBeGreaterThanOrEqual(1);
    expect(r!.h).toBeGreaterThanOrEqual(1);
  });
});
