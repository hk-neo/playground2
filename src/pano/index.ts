export { PanoramicCurve, createEllipseCurve, createArchCurve } from './panoramic-curve';
export type { EllipsePresetOptions, ArchPresetOptions } from './panoramic-curve';

export { FocalTrough } from './focal-trough';
export type { FocalTroughOptions } from './focal-trough';

export { ArchPresser } from './arch-presser';
export type { ArchPresserOptions, ArchPresserResult } from './arch-presser';

export { CurveEditorController } from './curve-editor-controller';
export type { CanvasTriple } from './curve-editor-view';
export {
  CurveEditorView,
  projectCurveToAxial,
  projectCurveToCoronal,
  projectCurveToSagittal,
  hitTestPoint,
  hitTestCanvasPoint,
  getCurveDrawingSamples,
} from './curve-editor-view';

export { PanoView } from './pano-view';
export { PanoRenderer } from './pano-renderer';

// GPU CPR (WebGL2 curved planar reformation)
export {
  GpuCprViewport,
  supportsGpuCpr,
  packArchSpline,
  disposeArchSplineTextures,
  buildVolumeTexture,
  disposeVolumeTexture,
  makePanoramicMaterial,
  makeCrossSectionMaterial,
} from './gpu-cpr';
export type {
  GpuCprViewportOptions,
  ProjectionMode,
  ArchSplinePackingOptions,
  ArchSplineTextures,
  VolumeTextureOptions,
  VolumeTextureResult,
  PanoramicShaderUniforms,
  CrossSectionShaderUniforms,
} from './gpu-cpr';
