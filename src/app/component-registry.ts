import type { IComponent } from '../shared/interfaces/app';
import { ComponentInitError } from '../shared/errors/app';

export class ComponentRegistry {
  private registry = new Map<string, IComponent>();
  private initialized = new Set<string>();

  register(id: string, component: IComponent): void {
    this.registry.set(id, component);
  }

  unregister(id: string): void {
    const comp = this.registry.get(id);
    if (comp && this.initialized.has(id)) {
      comp.dispose();
    }
    this.registry.delete(id);
    this.initialized.delete(id);
  }

  get(id: string): IComponent | undefined {
    return this.registry.get(id);
  }

  initializeAll(): void {
    for (const [id, component] of this.registry) {
      if (!this.initialized.has(id)) {
        try {
          component.init();
          this.initialized.add(id);
        } catch (e) {
          throw new ComponentInitError(id, (e as Error).message);
        }
      }
    }
  }

  disposeAll(): void {
    for (const [id, component] of this.registry) {
      if (this.initialized.has(id)) {
        try {
          component.dispose();
        } catch {}
      }
    }
    this.initialized.clear();
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  isInitialized(id: string): boolean {
    return this.initialized.has(id);
  }

  getIds(): string[] {
    return Array.from(this.registry.keys());
  }

  size(): number {
    return this.registry.size;
  }
}
