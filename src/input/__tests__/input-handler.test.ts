import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputHandler } from '../input-handler';
import { InputType } from '../../shared/types/input';

describe('InputHandler', () => {
  let handler: InputHandler;
  let element: HTMLDivElement;

  beforeEach(() => {
    handler = new InputHandler();
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    handler.detach();
    document.body.removeChild(element);
  });

  it('should attach and emit mouse events to listeners', () => {
    handler.attach(element);
    const callback = vi.fn();
    handler.on(InputType.MouseDown, callback);

    element.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 60, bubbles: true }));
    expect(callback).toHaveBeenCalledOnce();
    expect(callback.mock.calls[0][0].type).toBe(InputType.MouseDown);
    expect(callback.mock.calls[0][0].position.x).toBe(50);
  });

  it('should emit wheel events', () => {
    handler.attach(element);
    const callback = vi.fn();
    handler.on(InputType.Wheel, callback);

    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
    expect(callback).toHaveBeenCalledOnce();
    expect(callback.mock.calls[0][0].delta.y).toBe(100);
  });

  it('should not emit after detach', () => {
    handler.attach(element);
    const callback = vi.fn();
    handler.on(InputType.MouseDown, callback);
    handler.detach();

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle on/off subscription', () => {
    handler.attach(element);
    const callback = vi.fn();
    handler.on(InputType.MouseUp, callback);
    handler.off(InputType.MouseUp, callback);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();
  });

  it('should register and trigger keyboard shortcuts', () => {
    handler.attach(element);
    const action = vi.fn();
    handler.registerShortcut('r', action);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(action).toHaveBeenCalledOnce();
  });

  it('should emit keydown for non-shortcut keys', () => {
    handler.attach(element);
    const callback = vi.fn();
    handler.on(InputType.KeyDown, callback);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should handle multiple listeners for same event', () => {
    handler.attach(element);
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    handler.on(InputType.MouseDown, cb1);
    handler.on(InputType.MouseDown, cb2);

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });
});
