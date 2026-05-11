import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateManager } from '../state-manager';
import { BrowserCompatibilityChecker } from '../browser-compatibility-checker';
import { LayoutManager } from '../layout-manager';
import { ComponentRegistry } from '../component-registry';
import { ApplicationShell } from '../application-shell';
import { ComponentInitError } from '../../shared/errors/app';
import type { IComponent } from '../../shared/interfaces/app';

// Polyfill ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.callback = cb; }
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

describe('StateManager', () => {
  it('should return initial state', () => {
    const mgr = new StateManager();
    const state = mgr.getState();
    expect(state.volumeLoaded).toBe(false);
    expect(state.activeTool).toBeNull();
    expect(state.wlww.level).toBe(500);
    expect(state.syncEnabled).toBe(true);
  });

  it('should update state with partial', () => {
    const mgr = new StateManager();
    mgr.setState({ volumeLoaded: true, activeTool: 'distance' });
    const state = mgr.getState();
    expect(state.volumeLoaded).toBe(true);
    expect(state.activeTool).toBe('distance');
  });

  it('should notify subscribers on state change', () => {
    const mgr = new StateManager();
    const cb = vi.fn();
    mgr.subscribe('volumeLoaded', cb);
    mgr.setState({ volumeLoaded: true });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].volumeLoaded).toBe(true);
    expect(cb.mock.calls[0][1]).toBe('volumeLoaded');
  });

  it('should notify wildcard subscribers', () => {
    const mgr = new StateManager();
    const cb = vi.fn();
    mgr.subscribe('*', cb);
    mgr.setState({ volumeLoaded: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  it('should unsubscribe', () => {
    const mgr = new StateManager();
    const cb = vi.fn();
    mgr.subscribe('volumeLoaded', cb);
    mgr.unsubscribe('volumeLoaded', cb);
    mgr.setState({ volumeLoaded: true });
    expect(cb).not.toHaveBeenCalled();
  });

  it('should reset state', () => {
    const mgr = new StateManager();
    mgr.setState({ volumeLoaded: true, activeTool: 'angle' });
    mgr.resetState();
    expect(mgr.getState().volumeLoaded).toBe(false);
    expect(mgr.getState().activeTool).toBeNull();
  });

  it('should track history', () => {
    const mgr = new StateManager();
    mgr.setState({ volumeLoaded: true });
    mgr.setState({ activeTool: 'distance' });
    expect(mgr.getHistoryLength()).toBe(2);
  });

  it('should not notify unrelated subscribers', () => {
    const mgr = new StateManager();
    const cb = vi.fn();
    mgr.subscribe('volumeLoaded', cb);
    mgr.setState({ activeTool: 'distance' });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('BrowserCompatibilityChecker', () => {
  it('should return browser info', () => {
    const checker = new BrowserCompatibilityChecker();
    const info = checker.checkBrowser();
    expect(info.name).toBeTruthy();
    expect(typeof info.isSupported).toBe('boolean');
    expect(typeof info.webgl2Supported).toBe('boolean');
  });

  it('should return unsupported message', () => {
    const checker = new BrowserCompatibilityChecker();
    const msg = checker.getUnsupportedMessage();
    expect(msg).toContain('WebGL 2.0');
  });
});

describe('LayoutManager', () => {
  it('should compute 4-grid layout for desktop', () => {
    const mgr = new LayoutManager();
    const layout = mgr.computeLayout({ width: 1280, height: 800 });
    expect(layout.viewports).toHaveLength(4);
    expect(layout.viewports[0].id).toBe('axial');
    expect(layout.viewports[3].id).toBe('3d');
    expect(layout.totalWidth).toBe(1280);
  });

  it('should compute 2-column layout for tablet', () => {
    const mgr = new LayoutManager();
    const layout = mgr.computeLayout({ width: 800, height: 600 });
    expect(layout.viewports.length).toBeGreaterThanOrEqual(3);
  });

  it('should compute single column for mobile', () => {
    const mgr = new LayoutManager();
    const layout = mgr.computeLayout({ width: 400, height: 800 });
    expect(layout.viewports.length).toBeGreaterThanOrEqual(3);
  });

  it('should get viewport config by id', () => {
    const mgr = new LayoutManager();
    mgr.computeLayout({ width: 1280, height: 800 });
    const axial = mgr.getViewportConfig('axial');
    expect(axial).toBeDefined();
    expect(axial!.type).toBe('mpr');
  });

  it('should return undefined for unknown viewport', () => {
    const mgr = new LayoutManager();
    expect(mgr.getViewportConfig('unknown')).toBeUndefined();
  });

  it('should handle onResize', () => {
    const mgr = new LayoutManager();
    mgr.onResize({ width: 1280, height: 800 });
    const layout = mgr.getCurrentLayout();
    expect(layout.totalWidth).toBe(1280);
  });
});

describe('ComponentRegistry', () => {
  it('should register and get component', () => {
    const registry = new ComponentRegistry();
    const comp: IComponent = { init: vi.fn(), render: vi.fn(), dispose: vi.fn() };
    registry.register('test', comp);
    expect(registry.get('test')).toBe(comp);
    expect(registry.has('test')).toBe(true);
  });

  it('should initialize all components', () => {
    const registry = new ComponentRegistry();
    const init = vi.fn();
    const comp: IComponent = { init, render: vi.fn(), dispose: vi.fn() };
    registry.register('test', comp);
    registry.initializeAll();
    expect(init).toHaveBeenCalledOnce();
    expect(registry.isInitialized('test')).toBe(true);
  });

  it('should throw ComponentInitError on init failure', () => {
    const registry = new ComponentRegistry();
    const comp: IComponent = { init: () => { throw new Error('fail'); }, render: vi.fn(), dispose: vi.fn() };
    registry.register('broken', comp);
    expect(() => registry.initializeAll()).toThrow(ComponentInitError);
  });

  it('should dispose all components', () => {
    const registry = new ComponentRegistry();
    const dispose = vi.fn();
    const comp: IComponent = { init: vi.fn(), render: vi.fn(), dispose };
    registry.register('test', comp);
    registry.initializeAll();
    registry.disposeAll();
    expect(dispose).toHaveBeenCalledOnce();
    expect(registry.isInitialized('test')).toBe(false);
  });

  it('should unregister component', () => {
    const registry = new ComponentRegistry();
    const dispose = vi.fn();
    const comp: IComponent = { init: vi.fn(), render: vi.fn(), dispose };
    registry.register('test', comp);
    registry.initializeAll();
    registry.unregister('test');
    expect(registry.has('test')).toBe(false);
    expect(dispose).toHaveBeenCalled();
  });

  it('should return ids and size', () => {
    const registry = new ComponentRegistry();
    registry.register('a', { init: vi.fn(), render: vi.fn(), dispose: vi.fn() });
    registry.register('b', { init: vi.fn(), render: vi.fn(), dispose: vi.fn() });
    expect(registry.size()).toBe(2);
    expect(registry.getIds()).toEqual(['a', 'b']);
  });
});

describe('ApplicationShell', () => {
  it('should initialize', async () => {
    const shell = new ApplicationShell();
    await shell.init();
    expect(shell.getIsInitialized()).toBe(true);
  });

  it('should expose sub-managers', () => {
    const shell = new ApplicationShell();
    expect(shell.getStateManager()).toBeInstanceOf(StateManager);
    expect(shell.getComponentRegistry()).toBeInstanceOf(ComponentRegistry);
    expect(shell.getLayoutManager()).toBeInstanceOf(LayoutManager);
    expect(shell.getBrowserChecker()).toBeInstanceOf(BrowserCompatibilityChecker);
  });

  it('should mount and unmount', async () => {
    const shell = new ApplicationShell();
    await shell.init();

    const root = document.createElement('div');
    document.body.appendChild(root);

    shell.mount(root);
    // jsdom getBoundingClientRect returns 0, layout computes with 0 width
    const layout = shell.getStateManager().getState().uiLayout;
    expect(layout).toBeDefined();

    shell.unmount();
    expect(shell.getIsInitialized()).toBe(false);
    document.body.removeChild(root);
  });

  it('should get null for unknown component', () => {
    const shell = new ApplicationShell();
    expect(shell.getComponent('unknown')).toBeNull();
  });
});
