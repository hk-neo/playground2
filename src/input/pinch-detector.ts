import type { IGestureDetector } from '../shared/interfaces/input';
import type { PinchResult, GestureResult } from '../shared/types/input';
import { GestureType } from '../shared/types/input';
import { TouchValidationError } from '../shared/errors/input';

export class PinchDetector implements IGestureDetector {
  private initialDistance = 0;
  private currentScale = 1;

  detect(touches: TouchList): GestureResult | null {
    if (touches.length < 2) {
      this.reset();
      return null;
    }

    const result = this.computePinch(touches);
    if (!result) return null;

    return {
      type: GestureType.Pinch,
      scale: result.scale,
      center: result.center,
    };
  }

  getPinchResult(touches: TouchList): PinchResult | null {
    if (touches.length < 2) return null;
    return this.computePinch(touches);
  }

  startPinch(touches: TouchList): void {
    if (touches.length < 2) {
      throw new TouchValidationError('Pinch requires at least 2 touch points');
    }
    this.initialDistance = this.touchDistance(touches);
    this.currentScale = 1;
  }

  getCurrentScale(): number {
    return this.currentScale;
  }

  reset(): void {
    this.initialDistance = 0;
    this.currentScale = 1;
  }

  private computePinch(touches: TouchList): PinchResult | null {
    const dist = this.touchDistance(touches);
    if (this.initialDistance < 1e-6) {
      this.initialDistance = dist;
      return { scale: 1, center: this.touchCenter(touches) };
    }

    this.currentScale = dist / this.initialDistance;
    return {
      scale: this.currentScale,
      center: this.touchCenter(touches),
    };
  }

  private touchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private touchCenter(touches: TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }
}
