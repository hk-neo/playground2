import type { Vec3 } from './core';

/** MPR 단면 평면 */
export enum MPRPlane {
  Axial = 'Axial',
  Coronal = 'Coronal',
  Sagittal = 'Sagittal',
}

/** 슬라이스 방향 정보 */
export interface SliceOrientation {
  directionCosines: [number, number, number, number, number, number];
  position: [number, number, number];
}

/** GPU 정보 */
export interface GPUInfo {
  vendor: string;
  renderer: string;
  maxTextureSize: number;
  max3DTextureSize: number;
}

/** 셰이더 소스 */
export interface ShaderSource {
  vertex: string;
  fragment: string;
}

/** 파노라믹 곡선의 컨트롤 포인트 스냅샷 (직렬화용) */
export interface CurveSnapshot {
  points: Vec3[];
  closed: boolean;
}

/** 파노라믹 프리셋 식별자 */
export type CurvePreset = 'Ellipse' | 'Arch';

/** 곡선 편집기 상태 */
export type CurveEditorState = 'Idle' | 'Drawing' | 'Editing' | 'Applied';

/** 파노라믹 통합 모드 */
export type TroughMode = 'min' | 'max' | 'mean';
