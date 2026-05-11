import { describe, it, expect } from 'vitest';
import { MouseInputMapper } from '../mouse-input-mapper';
import { InputType } from '../../shared/types/input';

function createMouseEvent(
  type: string, x: number, y: number, button = 0,
  ctrlKey = false, shiftKey = false, altKey = false,
): MouseEvent {
  return new MouseEvent(type, {
    clientX: x, clientY: y, button,
    ctrlKey, shiftKey, altKey,
    bubbles: true, cancelable: true,
  });
}

function createWheelEvent(deltaX: number, deltaY: number): WheelEvent {
  return new WheelEvent('wheel', {
    deltaX, deltaY, bubbles: true, cancelable: true,
  });
}

describe('MouseInputMapper', () => {
  it('should map mousedown event', () => {
    const mapper = new MouseInputMapper();
    const result = mapper.mapEvent(createMouseEvent('mousedown', 100, 200));
    expect(result.type).toBe(InputType.MouseDown);
    expect(result.position.x).toBe(100);
    expect(result.position.y).toBe(200);
    expect(result.button).toBe(0);
  });

  it('should compute delta between consecutive events', () => {
    const mapper = new MouseInputMapper();
    mapper.mapEvent(createMouseEvent('mousedown', 100, 100));
    const result = mapper.mapEvent(createMouseEvent('mousemove', 150, 120));
    expect(result.delta.x).toBe(50);
    expect(result.delta.y).toBe(20);
  });

  it('should have zero delta for first event', () => {
    const mapper = new MouseInputMapper();
    const result = mapper.mapEvent(createMouseEvent('mousedown', 50, 50));
    expect(result.delta.x).toBe(0);
    expect(result.delta.y).toBe(0);
  });

  it('should map mouseup event', () => {
    const mapper = new MouseInputMapper();
    const result = mapper.mapEvent(createMouseEvent('mouseup', 0, 0));
    expect(result.type).toBe(InputType.MouseUp);
  });

  it('should map wheel event', () => {
    const mapper = new MouseInputMapper();
    const result = mapper.mapEvent(createWheelEvent(10, -5));
    expect(result.type).toBe(InputType.Wheel);
    expect(result.delta.x).toBe(10);
    expect(result.delta.y).toBe(-5);
  });

  it('should include keyboard modifiers', () => {
    const mapper = new MouseInputMapper();
    const result = mapper.mapEvent(createMouseEvent('mousedown', 0, 0, 0, true, false, true));
    expect(result.modifiers?.ctrl).toBe(true);
    expect(result.modifiers?.shift).toBe(false);
    expect(result.modifiers?.alt).toBe(true);
  });

  it('should reset state', () => {
    const mapper = new MouseInputMapper();
    mapper.mapEvent(createMouseEvent('mousedown', 100, 100));
    mapper.reset();
    const result = mapper.mapEvent(createMouseEvent('mousemove', 200, 200));
    expect(result.delta.x).toBe(0);
  });
});
