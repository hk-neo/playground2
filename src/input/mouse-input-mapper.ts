import type { IInputMapper } from '../shared/interfaces/input';
import type { ApplicationInput } from '../shared/types/input';
import { InputType } from '../shared/types/input';

export class MouseInputMapper implements IInputMapper {
  private lastPosition = { x: 0, y: 0 };
  private hasLastPosition = false;

  mapEvent(raw: Event): ApplicationInput {
    if (raw instanceof WheelEvent) {
      return this.mapWheelEvent(raw);
    }
    if (raw instanceof MouseEvent) {
      return this.mapMouseEvent(raw);
    }
    return this.fallbackEvent(raw);
  }

  private mapMouseEvent(e: MouseEvent): ApplicationInput {
    const position = { x: e.clientX, y: e.clientY };
    const delta = this.hasLastPosition
      ? { x: position.x - this.lastPosition.x, y: position.y - this.lastPosition.y }
      : { x: 0, y: 0 };

    let type: InputType;
    switch (e.type) {
      case 'mousedown': type = InputType.MouseDown; break;
      case 'mousemove': type = InputType.MouseMove; break;
      case 'mouseup': type = InputType.MouseUp; break;
      case 'dblclick': type = InputType.MouseDown; break;
      default: type = InputType.MouseMove;
    }

    this.lastPosition = { ...position };
    this.hasLastPosition = true;

    return {
      type,
      position,
      delta,
      button: e.button,
      modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
    };
  }

  private mapWheelEvent(e: WheelEvent): ApplicationInput {
    return {
      type: InputType.Wheel,
      position: { x: e.clientX, y: e.clientY },
      delta: { x: e.deltaX, y: e.deltaY },
      modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
    };
  }

  private fallbackEvent(raw: Event): ApplicationInput {
    return {
      type: InputType.MouseMove,
      position: { x: 0, y: 0 },
      delta: { x: 0, y: 0 },
    };
  }

  reset(): void {
    this.lastPosition = { x: 0, y: 0 };
    this.hasLastPosition = false;
  }
}
