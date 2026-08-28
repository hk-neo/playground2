import type { Vec2, Vec3 } from '../shared/types/core';
import { MPRPlane } from '../shared/types/rendering';
import type {
  ICurveEditorView,
  IPanoramicCurve,
} from '../shared/interfaces/pano';

// ──────────────── Pure helpers (testable) ────────────────

/** Axial (XY plane): 3D 점 → 2D (x, y) */
export function projectCurveToAxial(points: ReadonlyArray<Vec3>): Vec2[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}

/** Coronal (XZ plane): 3D 점 → 2D (x, z) */
export function projectCurveToCoronal(points: ReadonlyArray<Vec3>): Vec2[] {
  return points.map((p) => ({ x: p.x, y: p.z }));
}

/** Sagittal (YZ plane): 3D 점 → 2D (y, z) */
export function projectCurveToSagittal(points: ReadonlyArray<Vec3>): Vec2[] {
  return points.map((p) => ({ x: p.y, y: p.z }));
}

function projectToPlane(points: ReadonlyArray<Vec3>, plane: MPRPlane): Vec2[] {
  switch (plane) {
    case MPRPlane.Axial: return projectCurveToAxial(points);
    case MPRPlane.Coronal: return projectCurveToCoronal(points);
    case MPRPlane.Sagittal: return projectCurveToSagittal(points);
    default: return [];
  }
}

export function getCurveDrawingSamples(
  curve: IPanoramicCurve,
  segmentsPerSpan = 16,
): Vec3[] {
  const pointCount = curve.points.length;
  if (pointCount < 2) return [...curve.points];
  const segmentCount = curve.closed ? pointCount : pointCount - 1;
  const segments = Math.max(1, Math.floor(segmentsPerSpan));
  return curve.sampleN(segmentCount * segments + 1);
}

/** 마우스 좌표가 어느 컨트롤 포인트 근처인지 판정. -1이면 miss */
export function hitTestPoint(
  curve: IPanoramicCurve,
  plane: MPRPlane,
  mouseXY: Vec2,
  threshold: number,
): number {
  const projected = projectToPlane(curve.points, plane);
  let bestIdx = -1;
  let bestDist = threshold;
  for (let i = 0; i < projected.length; i++) {
    const dx = projected[i].x - mouseXY.x;
    const dy = projected[i].y - mouseXY.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function hitTestCanvasPoint(
  curve: IPanoramicCurve,
  plane: MPRPlane,
  canvasXY: Vec2,
  threshold: number,
  canvas: HTMLCanvasElement,
): number {
  const projected = projectToPlane(curve.points, plane);
  let bestIndex = -1;
  let bestDistance = threshold * threshold;
  for (let index = 0; index < projected.length; index++) {
    const x = projected[index].x;
    const y = canvas.height - 1 - projected[index].y;
    const dx = x - canvasXY.x;
    const dy = y - canvasXY.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

// ──────────────── View (DOM/Canvas) ────────────────

export interface CanvasTriple {
  axial: HTMLCanvasElement;
  coronal: HTMLCanvasElement;
  sagittal: HTMLCanvasElement;
}

/** View 자체는 thin wrapper.
 *  - mount: 캔버스 참조 저장
 *  - setCurve: curve 변경 시 각 canvas에 overlay 그림
 *  - setHover / setSelected: 하이라이트
 *  - setEditable: 편집 가능 여부
 *  - unmount: 정리
 *
 *  실제 overlay 그리기는 외부(visualize/main.ts)에서 render를 호출해도 되고,
 *  내부적으로 setCurve/setHover가 트리거해도 됨.
 */
export class CurveEditorView implements ICurveEditorView {
  private _canvases: CanvasTriple | null = null;
  private _curve: IPanoramicCurve | null = null;
  private _hover: { plane: MPRPlane; pointIndex: number } | null = null;
  private _selected: number | null = null;
  private _editable = true;
  private _activePlane: MPRPlane | null = null;

  mount(canvases: CanvasTriple): void {
    this._canvases = canvases;
  }

  setActivePlane(plane: MPRPlane | null): void {
    this._activePlane = plane;
    this.drawAll();
  }

  setCurve(curve: IPanoramicCurve): void {
    this._curve = curve;
    this.drawAll();
  }

  setHover(hit: { plane: MPRPlane; pointIndex: number } | null): void {
    this._hover = hit;
    this.drawAll();
  }

  setSelected(pointIndex: number | null): void {
    this._selected = pointIndex;
    this.drawAll();
  }

  setEditable(editable: boolean): void {
    this._editable = editable;
  }

  unmount(): void {
    this.clearAll();
    this._canvases = null;
    this._curve = null;
    this._activePlane = null;
  }

  /** 외부에서 직접 호출 가능: 현재 상태로 모든 캔버스 다시 그림 */
  drawAll(): void {
    if (!this._canvases || !this._curve) return;
    if (!this._activePlane || this._activePlane === MPRPlane.Axial) {
      this.drawPlane(MPRPlane.Axial, this._canvases.axial);
    }
    if (!this._activePlane || this._activePlane === MPRPlane.Coronal) {
      this.drawPlane(MPRPlane.Coronal, this._canvases.coronal);
    }
    if (!this._activePlane || this._activePlane === MPRPlane.Sagittal) {
      this.drawPlane(MPRPlane.Sagittal, this._canvases.sagittal);
    }
  }

  private clearAll(): void {
    if (!this._canvases) return;
    for (const c of [this._canvases.axial, this._canvases.coronal, this._canvases.sagittal]) {
      const ctx = c.getContext('2d');
      ctx?.clearRect(0, 0, c.width, c.height);
    }
  }

  private drawPlane(plane: MPRPlane, canvas: HTMLCanvasElement): void {
    if (!this._curve) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 이미 그려진 MPR 위에 overlay만 그림
    ctx.save();
    const curveProjection = projectToPlane(getCurveDrawingSamples(this._curve), plane);
    const controlProjection = projectToPlane(this._curve.points, plane);
    if (curveProjection.length === 0) {
      ctx.restore();
      return;
    }

    // 곡선 라인
    ctx.lineWidth = 2;
    ctx.strokeStyle = this._editable ? '#00e5c3' : '#6c7693';
    ctx.beginPath();
    for (let i = 0; i < curveProjection.length; i++) {
      const p = curveProjection[i];
      // 캔버스 좌표로 매핑: volume 좌표를 캔버스 픽셀로 스케일
      const sx = this.scaleX(plane, p.x, canvas);
      const sy = this.scaleY(plane, p.y, canvas);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    if (this._curve.closed) ctx.closePath();
    ctx.stroke();

    // 컨트롤 포인트
    for (let i = 0; i < controlProjection.length; i++) {
      const sx = this.scaleX(plane, controlProjection[i].x, canvas);
      const sy = this.scaleY(plane, controlProjection[i].y, canvas);
      const isHover = this._hover?.plane === plane && this._hover.pointIndex === i;
      const isSelected = this._selected === i;

      ctx.beginPath();
      ctx.arc(sx, sy, isHover || isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffb443' : (isHover ? '#ffffff' : '#00e5c3');
      ctx.fill();
      ctx.strokeStyle = '#0d0f13';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** plane에 따라 volume 좌표 → 캔버스 픽셀로 스케일링.
   *  캔버스 내부 픽셀 크기 = volume의 plane-축 2D dimensions (axial=dx×dy 등).
   *  1 world voxel per canvas pixel — display CSS may scale the canvas
   *  visually but the world↔canvas pixel mapping remains 1:1.
   *
   *  Y축은 renderMprSlice가 슬라이스를 그릴 때 뒤집기 때문에, 캔버스에 점/
   *  라인을 그리려면 월드 좌표를 동일하게 뒤집어야 이미지의 같은 픽셀과
   *  시각적으로 겹친다. canvasToWorld()와 짝을 이루는 flip이다. */
  private scaleX(plane: MPRPlane, volX: number, canvas: HTMLCanvasElement): number {
    return volX;
  }

  private scaleY(plane: MPRPlane, volY: number, canvas: HTMLCanvasElement): number {
    // 캔버스 height는 해당 평면의 슬라이스 차원과 같다 (axial=dy, coronal=dz,
    // sagittal=dz). renderMprSlice는 sliceH-1-Y를 0에 매핑하므로, 우리도
    // 동일하게 거꾸로 매핑한다.
    return (canvas.height - 1) - volY;
  }
}
