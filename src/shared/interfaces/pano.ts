import type { Vec2, Vec3 } from '../types/core';
import type { VolumeData } from '../types/volume';
import type { MPRPlane } from '../types/rendering';
import type { CurveSnapshot, CurvePreset, CurveEditorState, TroughMode } from '../types/rendering';

/** PanoramicCurve 생성자 시그니처 (static fromJSON용) */
export interface IPanoramicCurveConstructor {
  new (snapshot?: CurveSnapshot): IPanoramicCurve;
  fromJSON(s: CurveSnapshot): IPanoramicCurve;
}

/** 파노라믹 곡선: 3D 공간의 치아궁 곡선 (Catmull-Rom 보간) */
export interface IPanoramicCurve {
  readonly points: ReadonlyArray<Vec3>;
  readonly closed: boolean;

  /** 점 추가 (index 생략 시 끝에) */
  addPoint(p: Vec3, index?: number): void;
  /** 점 삭제 */
  removePoint(index: number): void;
  /** 점 이동 */
  movePoint(index: number, p: Vec3): void;
  /** 곡선 위 균등 t (0..1) 위치의 3D 점 */
  sample(t: number): Vec3;
  /** 균등 n개 샘플 */
  sampleN(n: number): Vec3[];
  /** t에서의 단위 접선 벡터 */
  tangent(t: number): Vec3;
  /** 호 길이 (보간 다항식 길이의 합) */
  length(): number;

  /** 직렬화 */
  toJSON(): CurveSnapshot;
}

/** Focal Trough: 곡선 normal 방향으로 ±thickness/2 범위 슬라이스를 통합 */
export interface IFocalTrough {
  readonly thickness: number;
  readonly mode: TroughMode;
  setThickness(t: number): void;
  setMode(m: TroughMode): void;
  /**
   * 곡선과 볼륨으로부터 2D intensity 맵 추출 (proper panoramic IP).
   *
   * 각 픽셀은 curve sample별 in-plane perpendicular 방향의 한 점에서
   * planeNormal(normal direction) 축으로 **CBCT 전체 extent**를 따라
   * min / max / mean intensity projection한 값.
   *
   * 데이터 레이아웃: row-major, 길이 = width × sampleCount
   *   row index = in-plane sample (0..width-1)  →  panorama의 세로축 (전후 깊이)
   *   col index = curve sample (0..sampleCount-1)  →  panorama의 가로축 (치아궁)
   *
   * 호출 측은 setIntensityMap(data, sampleCount, width)로 넘겨
   * curve를 가로, in-plane depth를 세로로 표시.
   *
   * @param curve  파노라믹 곡선
   * @param volume 3D 볼륨 데이터
   * @param width  in-plane(전후) 방향 샘플 개수 (= panorama의 세로 픽셀 수)
   * @returns Float32Array, 길이 = width * sampleCount
   */
  extract(curve: IPanoramicCurve, volume: VolumeData, width: number): Float32Array;
}

/** Curve Editor Controller: 상태머신 + undo/redo */
export interface ICurveEditorController {
  readonly state: CurveEditorState;
  readonly curve: IPanoramicCurve;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  onStateChange(cb: (s: CurveEditorState) => void): void;
  onCurveChange(cb: (c: IPanoramicCurve) => void): void;

  /** Drawing 진입 */
  beginDrawing(): void;
  /** 적용 확정 (state → Applied) */
  apply(): void;
  /** 작업 폐기 (state → Idle, curve 비움) */
  cancel(): void;

  /** 캔버스 좌표(2D) → MPR plane 역투영으로 3D 점 만들어 추가 */
  addPointFromCanvasPoint(plane: MPRPlane, canvasXY: Vec2, volume: VolumeData): number;
  /** 기존 점 드래그로 이동 */
  movePointFromCanvasDrag(index: number, plane: MPRPlane, canvasXY: Vec2, volume: VolumeData): void;
  /** 점 삭제 */
  removePoint(index: number): void;

  /** Undo/Redo */
  undo(): void;
  redo(): void;

  /** 프리셋 적용 */
  loadPreset(name: CurvePreset, volume: VolumeData): void;
}

/** Curve Editor View: MPR 3-view에 곡선 projection overlay */
export interface ICurveEditorView {
  mount(canvases: {
    axial: HTMLCanvasElement;
    coronal: HTMLCanvasElement;
    sagittal: HTMLCanvasElement;
  }): void;
  setCurve(curve: IPanoramicCurve): void;
  setHover(hit: { plane: MPRPlane; pointIndex: number } | null): void;
  setSelected(pointIndex: number | null): void;
  setEditable(editable: boolean): void;
  unmount(): void;
}

/** Pano Viewport: 단일 Pano 뷰포트 상태 (WL/WW, zoom, pan) */
export interface IPanoView {
  setIntensityMap(data: Float32Array, width: number, height: number): void;
  setWLWW(wl: number, ww: number): void;
  getWLWW(): { wl: number; ww: number };
  setZoomPan(zoom: number, panX: number, panY: number): void;
  getZoomPan(): { zoom: number; panX: number; panY: number };
  resetView(): void;
  render(): void;
  dispose(): void;
}

/** Pano Renderer: PanoView에 데이터를 그리는 2D 캔버스 렌더러 */
export interface IPanoRenderer {
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
  ): void;
}
