/**
 * Cross-section extractor — panoramic curve의 특정 지점(u)에서의 단면을
 * 볼륨으로부터 추출한다.
 *
 *   - Orthogonal (법선 단면): curve에 수직. uAxis=협설(N), vAxis=상하(B).
 *   - Tangential (접선 단면): curve 접선 방향. uAxis=접선(T), vAxis=상하(B).
 *
 * 임의 평면(center + 두 직교축)에서 trilinear 샘플링으로 resample한다.
 * 순수 데이터 계층 — DOM/Canvas 접근 없음.
 */
import type { VolumeData } from '../shared/types/volume';
import type { Vec3 } from '../shared/types/core';
import { InterpolationEngine } from '../volume/interpolation-engine';
import type { CurveFrame } from './curve-frame';

export interface CrossSectionSpec {
  center: Vec3;
  uAxis: Vec3;       // 단위 벡터 (가로)
  vAxis: Vec3;       // 단위 벡터 (세로, ⊥ uAxis)
  uHalfExtent: number; // 가로 반폭 (voxel)
  vHalfExtent: number; // 세로 반폭 (voxel)
  outWidth: number;
  outHeight: number;
}

export type CrossSectionKind = 'orthogonal' | 'tangential';

/**
 * 주어진 cross-section spec에 따라 볼륨을 resample.
 * 각 출력 픽셀은 uAxis/vAxis로 이루어진 직사각형 그리드에서 trilinear 샘플링.
 * data 레이아웃: row-major (row = vAxis 방향, col = uAxis 방향).
 */
export function extractCrossSection(volume: VolumeData, spec: CrossSectionSpec): Float32Array {
  const { outWidth, outHeight } = spec;
  const out = new Float32Array(outWidth * outHeight);
  const ux = spec.center.x;
  const uy = spec.center.y;
  const uz = spec.center.z;

  for (let row = 0; row < outHeight; row++) {
    const vt = outHeight === 1 ? 0 : (row / (outHeight - 1)) * 2 - 1;
    for (let col = 0; col < outWidth; col++) {
      const ut = outWidth === 1 ? 0 : (col / (outWidth - 1)) * 2 - 1;
      const px = ux + spec.uAxis.x * ut * spec.uHalfExtent + spec.vAxis.x * vt * spec.vHalfExtent;
      const py = uy + spec.uAxis.y * ut * spec.uHalfExtent + spec.vAxis.y * vt * spec.vHalfExtent;
      const pz = uz + spec.uAxis.z * ut * spec.uHalfExtent + spec.vAxis.z * vt * spec.vHalfExtent;
      out[row * outWidth + col] = InterpolationEngine.trilinearInterpolate(
        { x: px, y: py, z: pz },
        volume,
      );
    }
  }
  return out;
}

/**
 * curve 프레임에서 cross-section spec 생성.
 *
 * @param kind  orthogonal(tangent에 수직) 또는 tangential(tangent 방향)
 * @param inPlaneHalfVox  가로 방향 반폭 (voxel): orthogonal이면 협설, tangential이면 접선
 * @param zHalfVox        세로(상하) 방향 반폭 (voxel)
 */
export function buildCrossSectionSpec(
  kind: CrossSectionKind,
  frame: CurveFrame,
  inPlaneHalfVox: number,
  zHalfVox: number,
  outWidth: number,
  outHeight: number,
): CrossSectionSpec {
  const uAxis = kind === 'orthogonal' ? frame.normal : frame.tangent;
  return {
    center: frame.position,
    uAxis,
    vAxis: frame.binormal,
    uHalfExtent: inPlaneHalfVox,
    vHalfExtent: zHalfVox,
    outWidth,
    outHeight,
  };
}