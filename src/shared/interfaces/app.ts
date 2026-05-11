import type { AppState, LayoutConfig, ViewportSize, StateSubscriber } from '../types/app';

/** UI 컴포넌트 추상화 */
export interface IComponent {
  init(): void;
  render(): void;
  dispose(): void;
}

/** 상태 관리 추상화 */
export interface IStateManager {
  getState(): AppState;
  setState(partial: Partial<AppState>): void;
  subscribe(key: string, callback: StateSubscriber): void;
  unsubscribe(key: string, callback: StateSubscriber): void;
  resetState(): void;
}

/** 레이아웃 관리 추상화 */
export interface ILayoutManager {
  computeLayout(viewport: ViewportSize): LayoutConfig;
  onResize(size: ViewportSize): void;
  getViewportConfig(id: string): LayoutConfig['viewports'][number] | undefined;
}
