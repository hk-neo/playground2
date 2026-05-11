import { describe, it, expect, vi } from 'vitest';
import { KeyboardShortcutManager } from '../keyboard-shortcut-manager';

function createKeyEvent(key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
}

describe('KeyboardShortcutManager', () => {
  it('should register and trigger shortcut', () => {
    const mgr = new KeyboardShortcutManager();
    const action = vi.fn();
    mgr.register('r', action);

    const handled = mgr.handleKeyDown(createKeyEvent('r'));
    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  it('should not trigger unregistered key', () => {
    const mgr = new KeyboardShortcutManager();
    expect(mgr.handleKeyDown(createKeyEvent('x'))).toBe(false);
  });

  it('should handle modifier keys', () => {
    const mgr = new KeyboardShortcutManager();
    const action = vi.fn();
    mgr.register('ctrl+z', action);

    const handled = mgr.handleKeyDown(createKeyEvent('z', { ctrlKey: true }));
    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  it('should not trigger without required modifier', () => {
    const mgr = new KeyboardShortcutManager();
    const action = vi.fn();
    mgr.register('ctrl+z', action);

    expect(mgr.handleKeyDown(createKeyEvent('z'))).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('should unregister shortcut', () => {
    const mgr = new KeyboardShortcutManager();
    const action = vi.fn();
    mgr.register('r', action);
    mgr.unregister('r');
    expect(mgr.handleKeyDown(createKeyEvent('r'))).toBe(false);
  });

  it('should clear all shortcuts', () => {
    const mgr = new KeyboardShortcutManager();
    mgr.register('a', () => {});
    mgr.register('b', () => {});
    mgr.clear();
    expect(mgr.hasShortcut('a')).toBe(false);
    expect(mgr.hasShortcut('b')).toBe(false);
  });

  it('should handle multiple modifiers', () => {
    const mgr = new KeyboardShortcutManager();
    const action = vi.fn();
    mgr.register('ctrl+shift+s', action);

    expect(mgr.handleKeyDown(createKeyEvent('s', { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });
});
