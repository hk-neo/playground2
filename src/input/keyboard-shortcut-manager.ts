import type { ShortcutAction } from '../shared/types/input';

export class KeyboardShortcutManager {
  private shortcuts = new Map<string, ShortcutAction>();

  register(key: string, action: ShortcutAction): void {
    const normalizedKey = this.normalizeKey(key);
    this.shortcuts.set(normalizedKey, action);
  }

  unregister(key: string): void {
    this.shortcuts.delete(this.normalizeKey(key));
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    const key = this.buildKey(e);
    const action = this.shortcuts.get(key);
    if (action) {
      action();
      return true;
    }
    return false;
  }

  hasShortcut(key: string): boolean {
    return this.shortcuts.has(this.normalizeKey(key));
  }

  clear(): void {
    this.shortcuts.clear();
  }

  private buildKey(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  private normalizeKey(key: string): string {
    return key.toLowerCase();
  }
}
