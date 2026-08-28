import { MPRPlane } from '../shared/types/rendering';

/** 십자선 캔버스 한 장의 내부 픽셀 크기 */
export interface CrosshairCanvasSize {
  width: number;
  height: number;
}

/** 볼륨 차원 (x, y, z) */
export type VolumeDims = readonly [number, number, number];

/**
 * 십자선 오버레이 캔버스의 내부 width/height를 슬라이스 평면에 맞춰 계산한다.
 *
 * 슬라이스 추출과 동일한 차원을 사용한다:
 *   - Axial    → dx × dy
 *   - Coronal  → dx × dz
 *   - Sagittal → dy × dz
 *
 * .mpr(슬라이스 이미지)와 .crosshair-overlay(십자선) 두 캔버스를 같은 CSS 박스
 * 안에서 `object-fit: contain`으로 배치하면, 두 비트맵이 같은 종횡비로 letterbox
 * 되므로 픽셀 좌표 (hPos, vPos)에 그은 십자선이 화면상 이미지의 동일 픽셀과
 * 정확히 겹친다. 두 캔버스의 내부 해상도가 슬라이스 차원과 같아야만 이 정합이
 * 성립한다 — 본 헬퍼가 그 값을 보장한다.
 *
 * @param plane  MPR 평면
 * @param dims   볼륨 차원 [dx, dy, dz]
 */
export function getCrosshairCanvasSize(
  plane: MPRPlane,
  dims: VolumeDims,
): CrosshairCanvasSize {
  const [dx, dy, dz] = dims;
  switch (plane) {
    case MPRPlane.Axial:    return { width: dx, height: dy };
    case MPRPlane.Coronal:  return { width: dx, height: dz };
    case MPRPlane.Sagittal: return { width: dy, height: dz };
  }
}
