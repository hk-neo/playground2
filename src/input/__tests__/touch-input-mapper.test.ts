import { describe, it, expect } from 'vitest';
import { TouchInputMapper } from '../touch-input-mapper';
import { InputType, GestureType } from '../../shared/types/input';
import { PinchDetector } from '../pinch-detector';

interface MockTouch {
  x: number;
  y: number;
}

function createMockTouchList(touches: MockTouch[]): any {
  const list = touches.map((t, i) => ({
    identifier: i,
    target: document.body,
    clientX: t.x,
    clientY: t.y,
  }));
  Object.defineProperty(list, 'length', { value: list.length });
  return list;
}

function createTouchEvent(type: string, touches: MockTouch[]): TouchEvent {
  const mockTouches = createMockTouchList(touches);
  return new TouchEvent(type, {
    touches: mockTouches,
    changedTouches: mockTouches,
    bubbles: true,
    cancelable: true,
  } as any);
}

describe('TouchInputMapper', () => {
  it('should map single touch start', () => {
    const mapper = new TouchInputMapper();
    const event = createTouchEvent('touchstart', [{ x: 100, y: 200 }]);
    const result = mapper.mapEvent(event);
    expect(result.type).toBe(InputType.TouchStart);
    expect(result.position.x).toBe(100);
    expect(result.position.y).toBe(200);
    expect(result.gesture).toBe(GestureType.Pan);
  });

  it('should compute delta between touches', () => {
    const mapper = new TouchInputMapper();
    mapper.mapEvent(createTouchEvent('touchstart', [{ x: 100, y: 100 }]));
    const result = mapper.mapEvent(createTouchEvent('touchmove', [{ x: 120, y: 110 }]));
    expect(result.delta.x).toBe(20);
    expect(result.delta.y).toBe(10);
  });

  it('should detect pinch gesture with two touches', () => {
    const mapper = new TouchInputMapper();
    mapper.mapEvent(createTouchEvent('touchstart', [{ x: 100, y: 200 }, { x: 200, y: 200 }]));
    const result = mapper.mapEvent(createTouchEvent('touchmove', [{ x: 90, y: 200 }, { x: 210, y: 200 }]));
    expect(result.gesture).toBe(GestureType.Pinch);
    expect(result.scale).toBeDefined();
  });

  it('should handle touchend with no touches', () => {
    const mapper = new TouchInputMapper();
    const result = mapper.mapEvent(createTouchEvent('touchend', []));
    expect(result.type).toBe(InputType.TouchEnd);
  });
});

describe('PinchDetector', () => {
  it('should return null for single touch', () => {
    const detector = new PinchDetector();
    expect(detector.detect(createMockTouchList([{ x: 100, y: 100 }]))).toBeNull();
  });

  it('should detect pinch scale', () => {
    const detector = new PinchDetector();
    const t1 = createMockTouchList([{ x: 100, y: 200 }, { x: 200, y: 200 }]);
    detector.startPinch(t1);

    const t2 = createMockTouchList([{ x: 50, y: 200 }, { x: 250, y: 200 }]);
    const result = detector.getPinchResult(t2);
    expect(result).not.toBeNull();
    expect(result!.scale).toBeCloseTo(2, 1);
  });

  it('should compute pinch center', () => {
    const detector = new PinchDetector();
    const touches = createMockTouchList([{ x: 100, y: 200 }, { x: 200, y: 400 }]);
    detector.startPinch(touches);
    const result = detector.getPinchResult(touches);
    expect(result!.center.x).toBe(150);
    expect(result!.center.y).toBe(300);
  });

  it('should reset state', () => {
    const detector = new PinchDetector();
    const touches = createMockTouchList([{ x: 100, y: 200 }, { x: 200, y: 200 }]);
    detector.startPinch(touches);
    detector.reset();
    expect(detector.getCurrentScale()).toBe(1);
  });
});
