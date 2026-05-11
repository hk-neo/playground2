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
