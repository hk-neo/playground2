import type { IComponent } from '../shared/interfaces/app';
import { StateManager } from './state-manager';
import { BrowserCompatibilityChecker } from './browser-compatibility-checker';
import { LayoutManager } from './layout-manager';
import { ComponentRegistry } from './component-registry';

export class ApplicationShell {
  private stateManager: StateManager;
  private components: ComponentRegistry;
  private compatibilityChecker: BrowserCompatibilityChecker;
  private layoutManager: LayoutManager;
  private isInitialized = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.stateManager = new StateManager();
    this.components = new ComponentRegistry();
    this.compatibilityChecker = new BrowserCompatibilityChecker();
    this.layoutManager = new LayoutManager();
  }

  async init(): Promise<void> {
    const browserInfo = this.compatibilityChecker.checkBrowser();
    if (!browserInfo.isSupported) {
      console.warn(this.compatibilityChecker.getUnsupportedMessage());
    }

    this.isInitialized = true;
  }

  mount(root: HTMLElement): void {
    const rect = root.getBoundingClientRect();
    const layout = this.layoutManager.computeLayout({
      width: rect.width,
      height: rect.height,
    });

    this.stateManager.setState({ uiLayout: layout });

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.handleResize();
      }
    });
    this.resizeObserver.observe(root);
  }

  unmount(): void {
    this.components.disposeAll();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.isInitialized = false;
  }

  getComponent(id: string): IComponent | null {
    return this.components.get(id) ?? null;
  }

  handleResize(): void {
    const layout = this.layoutManager.getCurrentLayout();
    this.stateManager.setState({ uiLayout: layout });
  }

  getStateManager(): StateManager {
    return this.stateManager;
  }

  getComponentRegistry(): ComponentRegistry {
    return this.components;
  }

  getLayoutManager(): LayoutManager {
    return this.layoutManager;
  }

  getBrowserChecker(): BrowserCompatibilityChecker {
    return this.compatibilityChecker;
  }

  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}
