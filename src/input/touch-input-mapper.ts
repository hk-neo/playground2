import type { IInputMapper } from '../shared/interfaces/input';
import type { ApplicationInput } from '../shared/types/input';
import { InputType, GestureType } from '../shared/types/input';
import { PinchDetector } from './pinch-detector';
import { GestureRecognitionError } from '../shared/errors/input';

export class TouchInputMapper implements IInputMapper {
  private lastPosition = { x: 0, y: 0 };
  private hasLastPosition = false;
  private pinchDetector = new PinchDetector();

  mapEvent(raw: Event): ApplicationInput {
    if (!(raw instanceof TouchEvent)) {
      return { type: InputType.TouchMove, position: { x: 0, y: 0 }, delta: { x: 0, y: 0 } };
    }

    const e = raw as TouchEvent;
    const touches = e.touches;

    let type: InputType;
    switch (e.type) {
      case 'touchstart': type = InputType.TouchStart; break;
      case 'touchmove': type = InputType.TouchMove; break;
      case 'touchend': type = InputType.TouchEnd; break;
      default: type = InputType.TouchMove;
    }

    if (type === InputType.TouchStart && touches.length >= 2) {
      this.pinchDetector.startPinch(touches);
    }

    const gesture = this.detectGesture(touches, type);

    const position = touches.length > 0
      ? { x: touches[0].clientX, y: touches[0].clientY }
      : this.lastPosition;

    const delta = this.hasLastPosition
      ? { x: position.x - this.lastPosition.x, y: position.y - this.lastPosition.y }
      : { x: 0, y: 0 };

    if (touches.length > 0) {
      this.lastPosition = { ...position };
      this.hasLastPosition = true;
    }

    const result: ApplicationInput = {
      type,
      position,
      delta,
      gesture: gesture?.type ?? GestureType.None,
    };

    if (gesture?.scale !== undefined) {
      result.scale = gesture.scale;
    }

    return result;
  }

  private detectGesture(touches: TouchList, type: InputType): { type: GestureType; scale?: number } | null {
    if (touches.length === 0 && type === InputType.TouchEnd) {
      return { type: GestureType.Tap };
    }

    if (touches.length === 1) {
      return { type: GestureType.Pan };
    }

    if (touches.length >= 2) {
      const result = this.pinchDetector.detect(touches);
      if (result) return result;
    }

    return null;
  }

  reset(): void {
    this.lastPosition = { x: 0, y: 0 };
    this.hasLastPosition = false;
    this.pinchDetector.reset();
  }
}
