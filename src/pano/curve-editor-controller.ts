import type { VolumeData } from '../shared/types/volume';
import type { Vec2, Vec3 } from '../shared/types/core';
import type { CurveEditorState, CurvePreset } from '../shared/types/rendering';
import { MPRPlane } from '../shared/types/rendering';
import type {
  ICurveEditorController,
  IPanoramicCurve,
} from '../shared/interfaces/pano';
import { PanoramicCurve, createEllipseCurve, createArchCurve } from './panoramic-curve';

const UNDO_STACK_LIMIT = 20;

type StateListener = (s: CurveEditorState) => void;
type CurveListener = (c: IPanoramicCurve) => void;

/**
 * 캔버스 2D 좌표 → plane 기준 3D 점으로 변환.
 *
 * renderMprSlice()가 슬라이스를 캔버스에 그릴 때 Y축을 뒤집어 해부학적 방향을
 * 맞춘다 (canvas y=0 ↔ 볼륨 y=sliceH-1). 따라서 사용자가 캔버스에서 본 픽셀
 * 위치(canvasXY)는 그에 맞춰 flip 해서 월드 좌표로 바꿔야 한다. 이 함수가
 * 양방향 flip의 한 쪽을 담당한다 (반대쪽은 curve-editor-view의 scaleY).
 *
 * Flip이 필요한 축:
 *   - Axial    : canvasY → volume Y   (캔버스 세로 = 볼륨 세로, 뒤집힘)
 *   - Coronal  : canvasY → volume Z   (캔버스 세로 = 볼륨 깊이, 뒤집힘)
 *   - Sagittal : canvasY → volume Z   (캔버스 세로 = 볼륨 깊이, 뒤집힘)
 * X축(또는 Axial이 아닌 경우 canvasX→Y)은 flip하지 않는다.
 */
export function canvasToWorld(
  plane: MPRPlane,
  canvasXY: Vec2,
  activeSlice: { Axial: number; Coronal: number; Sagittal: number },
  volume: VolumeData,
): Vec3 {
  const [dx, dy, dz] = volume.dimensions;
  switch (plane) {
    case MPRPlane.Axial: {
      // Axial: XY plane, z = activeSlice.Axial
      return { x: canvasXY.x, y: (dy - 1) - canvasXY.y, z: activeSlice.Axial };
    }
    case MPRPlane.Coronal: {
      // Coronal: XZ plane, y = activeSlice.Coronal
      return { x: canvasXY.x, y: activeSlice.Coronal, z: (dz - 1) - canvasXY.y };
    }
    case MPRPlane.Sagittal: {
      // Sagittal: YZ plane, x = activeSlice.Sagittal
      return { x: activeSlice.Sagittal, y: canvasXY.x, z: (dz - 1) - canvasXY.y };
    }
    default: {
      void dx; void dy; void dz;
      return { x: 0, y: 0, z: 0 };
    }
  }
}

function squaredDistanceToSegment(point: Vec3, start: Vec3, end: Vec3): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  if (lengthSquared === 0) {
    const zeroX = point.x - start.x;
    const zeroY = point.y - start.y;
    const zeroZ = point.z - start.z;
    return zeroX * zeroX + zeroY * zeroY + zeroZ * zeroZ;
  }
  const dot = (point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz;
  const t = Math.max(0, Math.min(1, dot / lengthSquared));
  const px = start.x + t * dx - point.x;
  const py = start.y + t * dy - point.y;
  const pz = start.z + t * dz - point.z;
  return px * px + py * py + pz * pz;
}

export function findCurveInsertIndex(curve: IPanoramicCurve, point: Vec3): number {
  const points = curve.points;
  if (points.length < 2) return points.length;

  let bestIndex = points.length;
  let bestDistance = Infinity;
  const segmentCount = curve.closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index++) {
    const distance = squaredDistanceToSegment(
      point,
      points[index],
      points[(index + 1) % points.length],
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index + 1;
    }
  }
  return bestIndex;
}

export class CurveEditorController implements ICurveEditorController {
  private _state: CurveEditorState = 'Idle';
  private _curve: IPanoramicCurve = new PanoramicCurve();
  private _activeSlice: { Axial: number; Coronal: number; Sagittal: number };

  private _undoStack: string[] = []; // JSON snapshots
  private _redoStack: string[] = [];

  private _stateListeners: StateListener[] = [];
  private _curveListeners: CurveListener[] = [];

  constructor() {
    this._activeSlice = { Axial: 0, Coronal: 0, Sagittal: 0 };
  }

  get state(): CurveEditorState {
    return this._state;
  }

  get curve(): IPanoramicCurve {
    return this._curve;
  }

  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  // ── 이벤트 ──

  onStateChange(cb: StateListener): void {
    this._stateListeners.push(cb);
  }

  onCurveChange(cb: CurveListener): void {
    this._curveListeners.push(cb);
  }

  private emitState(): void {
    for (const cb of this._stateListeners) cb(this._state);
  }

  private emitCurve(): void {
    for (const cb of this._curveListeners) cb(this._curve);
  }

  // ── 슬라이스 위치 (외부에서 setActiveSlice로 동기화) ──

  setActiveSlice(plane: MPRPlane, position: number): void {
    const key = plane as 'Axial' | 'Coronal' | 'Sagittal';
    this._activeSlice[key] = position;
  }

  getActiveSlice(plane: MPRPlane): number {
    return this._activeSlice[plane as 'Axial' | 'Coronal' | 'Sagittal'];
  }

  // ── 상태 전이 ──

  beginDrawing(): void {
    if (this._state === 'Applied') {
      // 이미 적용된 상태에서 다시 그리려면 cancel 후 진행
      this.cancel();
    }
    this._state = 'Drawing';
    this.emitState();
  }

  apply(): void {
    if (this._curve.points.length < 2) {
      throw new Error('CurveEditorController.apply: curve must have at least 2 points');
    }
    this._state = 'Applied';
    // apply 후에는 undo/redo 스택 비움
    this._undoStack = [];
    this._redoStack = [];
    this.emitState();
  }

  cancel(): void {
    this._state = 'Idle';
    this._curve = new PanoramicCurve();
    this._undoStack = [];
    this._redoStack = [];
    this.emitState();
    this.emitCurve();
  }

  // ── Undo / Redo ──

  private pushUndo(): void {
    this._undoStack.push(this._curve.toJSON().points.map((p) => `${p.x},${p.y},${p.z}`).join(';'));
    if (this._undoStack.length > UNDO_STACK_LIMIT) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  private restoreFromStack(snap: string): void {
    const pts = snap.split(';').map((s) => {
      const [x, y, z] = s.split(',').map(Number);
      return { x, y, z } as Vec3;
    });
    this._curve = new PanoramicCurve({ points: pts, closed: this._curve.closed });
    this.emitCurve();
  }

  undo(): void {
    const snap = this._undoStack.pop();
    if (!snap) return;
    this._redoStack.push(this._curve.toJSON().points.map((p) => `${p.x},${p.y},${p.z}`).join(';'));
    this.restoreFromStack(snap);
  }

  redo(): void {
    const snap = this._redoStack.pop();
    if (!snap) return;
    this._undoStack.push(this._curve.toJSON().points.map((p) => `${p.x},${p.y},${p.z}`).join(';'));
    this.restoreFromStack(snap);
  }

  // ── 점 조작 ──

  addPointFromCanvasPoint(plane: MPRPlane, canvasXY: Vec2, volume: VolumeData): number {
    if (this._state === 'Idle') this.beginDrawing();
    this.pushUndo();
    const p = canvasToWorld(plane, canvasXY, this._activeSlice, volume);
    const idx = findCurveInsertIndex(this._curve, p);
    this._curve.addPoint(p, idx);
    this.emitCurve();
    return idx;
  }

  movePointFromCanvasDrag(index: number, plane: MPRPlane, canvasXY: Vec2, volume: VolumeData): void {
    this.pushUndo();
    const p = canvasToWorld(plane, canvasXY, this._activeSlice, volume);
    this._curve.movePoint(index, p);
    this.emitCurve();
  }

  removePoint(index: number): void {
    this.pushUndo();
    this._curve.removePoint(index);
    this.emitCurve();
  }

  // ── 프리셋 ──

  loadPreset(name: CurvePreset, volume: VolumeData): void {
    if (this._state === 'Idle') this.beginDrawing();
    this.pushUndo();
    const [dx, dy, dz] = volume.dimensions;
    const dims = { x: dx, y: dy, z: dz };
    const axialSlice = Math.max(0, Math.min(dz - 1, this._activeSlice.Axial));
    const centerZ = axialSlice / dz;
    if (name === 'Ellipse') {
      this._curve = createEllipseCurve(dims, { centerZ });
    } else {
      this._curve = createArchCurve(dims, { center: { z: centerZ } });
    }
    this.emitCurve();
  }
}
