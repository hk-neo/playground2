import type { InputCallback, ApplicationInput } from '../shared/types/input';
import { InputType } from '../shared/types/input';
import { MouseInputMapper } from './mouse-input-mapper';
import { TouchInputMapper } from './touch-input-mapper';
import { KeyboardShortcutManager } from './keyboard-shortcut-manager';

export class InputHandler {
  private listeners = new Map<string, InputCallback[]>();
  private element: HTMLElement | null = null;
  private mouseMapper = new MouseInputMapper();
  private touchMapper = new TouchInputMapper();
  private keyboardManager = new KeyboardShortcutManager();

  private boundHandlers: {
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    wheel: (e: WheelEvent) => void;
    dblclick: (e: MouseEvent) => void;
    touchstart: (e: TouchEvent) => void;
    touchmove: (e: TouchEvent) => void;
    touchend: (e: TouchEvent) => void;
    keydown: (e: KeyboardEvent) => void;
  };

  constructor() {
    this.boundHandlers = {
      mousedown: (e) => this.emit(this.mouseMapper.mapEvent(e)),
      mousemove: (e) => this.emit(this.mouseMapper.mapEvent(e)),
      mouseup: (e) => this.emit(this.mouseMapper.mapEvent(e)),
      wheel: (e) => { e.preventDefault(); this.emit(this.mouseMapper.mapEvent(e)); },
      dblclick: (e) => this.emit(this.mouseMapper.mapEvent(e)),
      touchstart: (e) => this.emit(this.touchMapper.mapEvent(e)),
      touchmove: (e) => { e.preventDefault(); this.emit(this.touchMapper.mapEvent(e)); },
      touchend: (e) => this.emit(this.touchMapper.mapEvent(e)),
      keydown: (e) => {
        if (!this.keyboardManager.handleKeyDown(e)) {
          const input: ApplicationInput = {
            type: InputType.KeyDown,
            position: { x: 0, y: 0 },
            delta: { x: 0, y: 0 },
            modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
          };
          (input as any).key = e.key;
          this.emit(input);
        }
      },
    };
  }

  attach(element: HTMLElement): void {
    this.detach();
    this.element = element;

    element.addEventListener('mousedown', this.boundHandlers.mousedown);
    window.addEventListener('mousemove', this.boundHandlers.mousemove);
    window.addEventListener('mouseup', this.boundHandlers.mouseup);
    element.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
    element.addEventListener('dblclick', this.boundHandlers.dblclick);
    element.addEventListener('touchstart', this.boundHandlers.touchstart, { passive: false });
    element.addEventListener('touchmove', this.boundHandlers.touchmove, { passive: false });
    element.addEventListener('touchend', this.boundHandlers.touchend);
    window.addEventListener('keydown', this.boundHandlers.keydown);
  }

  detach(): void {
    if (!this.element) return;

    const el = this.element;
    el.removeEventListener('mousedown', this.boundHandlers.mousedown);
    window.removeEventListener('mousemove', this.boundHandlers.mousemove);
    window.removeEventListener('mouseup', this.boundHandlers.mouseup);
    el.removeEventListener('wheel', this.boundHandlers.wheel);
    el.removeEventListener('dblclick', this.boundHandlers.dblclick);
    el.removeEventListener('touchstart', this.boundHandlers.touchstart);
    el.removeEventListener('touchmove', this.boundHandlers.touchmove);
    el.removeEventListener('touchend', this.boundHandlers.touchend);
    window.removeEventListener('keydown', this.boundHandlers.keydown);

    this.element = null;
  }

  on(event: string, callback: InputCallback): void {
    const list = this.listeners.get(event) || [];
    list.push(callback);
    this.listeners.set(event, list);
  }

  off(event: string, callback: InputCallback): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx >= 0) list.splice(idx, 1);
  }

  registerShortcut(key: string, action: () => void): void {
    this.keyboardManager.register(key, action);
  }

  unregisterShortcut(key: string): void {
    this.keyboardManager.unregister(key);
  }

  private emit(input: ApplicationInput): void {
    const list = this.listeners.get(input.type);
    if (!list) return;
    for (const cb of list) {
      cb(input);
    }
  }
}
