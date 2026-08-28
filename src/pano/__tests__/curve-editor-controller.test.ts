import { describe, it, expect, beforeEach } from 'vitest';
import { CurveEditorController } from '../curve-editor-controller';
import type { VolumeData } from '../../shared/types/volume';
import type { Vec2 } from '../../shared/types/core';
import { MPRPlane } from '../../shared/types/rendering';

function makeVolume(): VolumeData {
  const dx = 10, dy = 10, dz = 10;
  const buf = new ArrayBuffer(dx * dy * dz * 2);
  const view = new Int16Array(buf);
  view.fill(100);
  return {
    buffer: buf,
    dimensions: [dx, dy, dz],
    spacing: [1, 1, 1],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

describe('CurveEditorController', () => {
  let ctrl: CurveEditorController;
  let vol: VolumeData;
  beforeEach(() => {
    ctrl = new CurveEditorController();
    vol = makeVolume();
  });

  describe('initial state', () => {
    it('starts in Idle with empty curve', () => {
      expect(ctrl.state).toBe('Idle');
      expect(ctrl.curve.points).toHaveLength(0);
      expect(ctrl.canUndo).toBe(false);
      expect(ctrl.canRedo).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('beginDrawing → state = Drawing', () => {
      ctrl.beginDrawing();
      expect(ctrl.state).toBe('Drawing');
    });

    it('apply → state = Applied', () => {
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 5 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 8, y: 5 }, vol);
      ctrl.apply();
      expect(ctrl.state).toBe('Applied');
      expect(ctrl.curve.points.length).toBeGreaterThanOrEqual(2);
    });

    it('cancel → state = Idle, curve cleared', () => {
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 5 }, vol);
      ctrl.cancel();
      expect(ctrl.state).toBe('Idle');
      expect(ctrl.curve.points).toHaveLength(0);
    });

    it('onStateChange fires on transitions', () => {
      const seen: string[] = [];
      ctrl.onStateChange((s) => seen.push(s));
      ctrl.beginDrawing();
      ctrl.cancel();
      expect(seen).toEqual(['Drawing', 'Idle']);
    });
  });

  describe('point manipulation', () => {
    it('addPointFromCanvasPoint appends to curve', () => {
      ctrl.beginDrawing();
      const idx0 = ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 5 }, vol);
      const idx1 = ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 8, y: 5 }, vol);
      expect(idx0).toBe(0);
      expect(idx1).toBe(1);
      expect(ctrl.curve.points).toHaveLength(2);
    });

    it('onCurveChange fires on addPoint', () => {
      let count = 0;
      ctrl.onCurveChange(() => { count++; });
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 5 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 8, y: 5 }, vol);
      expect(count).toBe(2);
    });

    it('inserts a clicked point into its nearest curve segment', () => {
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 1, y: 5 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 8, y: 5 }, vol);

      const insertedIndex = ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 4, y: 5 }, vol);

      expect(insertedIndex).toBe(1);
      expect(ctrl.curve.points.map((p) => p.x)).toEqual([1, 4, 8]);
    });

    it('removePoint removes at index', () => {
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 5 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 8, y: 5 }, vol);
      ctrl.removePoint(0);
      expect(ctrl.curve.points).toHaveLength(1);
    });

    it('movePointFromCanvasDrag updates position', () => {
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 5 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 8, y: 5 }, vol);
      ctrl.movePointFromCanvasDrag(0, MPRPlane.Axial, { x: 1, y: 1 }, vol);
      // Axial 평면: 캔버스 X는 그대로 볼륨 X로 매핑, 캔버스 Y는 renderMprSlice의
      // Y-flip을 반영해 (dy-1)-canvasY 로 매핑. dy=10, canvasY=1 → volume y=8.
      expect(ctrl.curve.points[0].x).toBeCloseTo(1, 4);
      expect(ctrl.curve.points[0].y).toBeCloseTo(8, 4);
    });

    it('addPointFromCanvasPoint가 Axial 캔버스 Y를 volume Y로 flip 매핑', () => {
      // 회귀 가드: renderMprSlice가 Y를 뒤집어 그리므로, 클릭한 캔버스 픽셀의
      // 좌표를 그대로 월드 좌표로 쓰면 점이 이미지의 반대편에 그려진다.
      // (volume 차원: dx=10, dy=10, dz=10)
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 0 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 9 }, vol);
      // 캔버스 y=0 → volume y=9 (top of volume)
      // 캔버스 y=9 → volume y=0 (bottom of volume)
      expect(ctrl.curve.points[0].y).toBeCloseTo(9, 4);
      expect(ctrl.curve.points[1].y).toBeCloseTo(0, 4);
    });

    it('addPointFromCanvasPoint가 Coronal 캔버스 Y를 volume Z로 flip 매핑', () => {
      // Coronal 평면: 캔버스 세로 = volume Z, Y-flip 동일하게 적용.
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Coronal, { x: 3, y: 0 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Coronal, { x: 3, y: 9 }, vol);
      expect(ctrl.curve.points[0].z).toBeCloseTo(9, 4); // canvas y=0 → z=9
      expect(ctrl.curve.points[1].z).toBeCloseTo(0, 4); // canvas y=9 → z=0
    });

    it('addPointFromCanvasPoint가 Sagittal 캔버스 Y를 volume Z로 flip 매핑', () => {
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Sagittal, { x: 0, y: 0 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Sagittal, { x: 9, y: 9 }, vol);
      expect(ctrl.curve.points[0].y).toBeCloseTo(0, 4);  // canvas x=0 → volume y=0
      expect(ctrl.curve.points[0].z).toBeCloseTo(9, 4);  // canvas y=0 → volume z=9
      expect(ctrl.curve.points[1].y).toBeCloseTo(9, 4);  // canvas x=9 → volume y=9
      expect(ctrl.curve.points[1].z).toBeCloseTo(0, 4);  // canvas y=9 → volume z=0
    });
  });

  describe('undo / redo', () => {
    it('undo restores previous point count after removePoint', () => {
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 5 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 8, y: 5 }, vol);
      const before = ctrl.curve.points.length;
      ctrl.removePoint(0);
      expect(ctrl.curve.points.length).toBe(before - 1);
      ctrl.undo();
      expect(ctrl.curve.points.length).toBe(before);
      expect(ctrl.canRedo).toBe(true);
    });

    it('redo re-applies the change', () => {
      ctrl.beginDrawing();
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 5, y: 5 }, vol);
      ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: 8, y: 5 }, vol);
      ctrl.removePoint(0);
      const after = ctrl.curve.points.length;
      ctrl.undo();
      ctrl.redo();
      expect(ctrl.curve.points.length).toBe(after);
    });

    it('undo respects max history depth', () => {
      ctrl.beginDrawing();
      // 25번 add → 20까지만 undo
      for (let i = 0; i < 25; i++) {
        ctrl.addPointFromCanvasPoint(MPRPlane.Axial, { x: i % 10, y: Math.floor(i / 10) }, vol);
      }
      let undoCount = 0;
      while (ctrl.canUndo) {
        ctrl.undo();
        undoCount++;
        if (undoCount > 30) break;
      }
      expect(undoCount).toBeLessThanOrEqual(20);
    });
  });

  describe('presets', () => {
    it('loadPreset(Ellipse) populates curve with >= 8 points', () => {
      ctrl.beginDrawing();
      ctrl.loadPreset('Ellipse', vol);
      expect(ctrl.curve.points.length).toBeGreaterThanOrEqual(8);
      expect(ctrl.curve.closed).toBe(true);
    });

    it('loadPreset(Arch) populates U-shaped curve', () => {
      ctrl.beginDrawing();
      ctrl.loadPreset('Arch', vol);
      expect(ctrl.curve.points.length).toBeGreaterThanOrEqual(8);
      expect(ctrl.curve.closed).toBe(false);
    });
  });
});
