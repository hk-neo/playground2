import type { ViewportSize, LayoutConfig, ViewportConfig, PanelConfig } from '../shared/types/app';

export class LayoutManager {
  private breakpoints = new Map<string, number>();
  private currentLayout: LayoutConfig;

  constructor() {
    this.breakpoints.set('mobile', 640);
    this.breakpoints.set('tablet', 1024);
    this.breakpoints.set('desktop', 1280);
    this.currentLayout = this.createEmptyLayout();
  }

  computeLayout(viewport: ViewportSize): LayoutConfig {
    const { width, height } = viewport;

    if (width < this.breakpoints.get('mobile')!) {
      this.currentLayout = this.computeSingleColumn(width, height);
    } else if (width < this.breakpoints.get('tablet')!) {
      this.currentLayout = this.computeTwoColumn(width, height);
    } else {
      this.currentLayout = this.computeFourGrid(width, height);
    }

    return { ...this.currentLayout };
  }

  onResize(size: ViewportSize): void {
    this.computeLayout(size);
  }

  getViewportConfig(id: string): ViewportConfig | undefined {
    return this.currentLayout.viewports.find(v => v.id === id);
  }

  getCurrentLayout(): LayoutConfig {
    return { ...this.currentLayout };
  }

  private computeFourGrid(width: number, height: number): LayoutConfig {
    const gap = 8;
    const cols = 2;
    const rows = 2;
    const vpWidth = (width - gap * (cols + 1)) / cols;
    const vpHeight = (height - gap * (rows + 1)) / rows;

    const viewports: ViewportConfig[] = [
      { id: 'axial', x: gap, y: gap, width: vpWidth, height: vpHeight, type: 'mpr' },
      { id: 'coronal', x: gap * 2 + vpWidth, y: gap, width: vpWidth, height: vpHeight, type: 'mpr' },
      { id: 'sagittal', x: gap, y: gap * 2 + vpHeight, width: vpWidth, height: vpHeight, type: 'mpr' },
      { id: '3d', x: gap * 2 + vpWidth, y: gap * 2 + vpHeight, width: vpWidth, height: vpHeight, type: '3d' },
    ];

    return { viewports, panels: [], totalWidth: width, totalHeight: height };
  }

  private computeTwoColumn(width: number, height: number): LayoutConfig {
    const gap = 8;
    const halfW = (width - gap * 3) / 2;
    const halfH = (height - gap * 3) / 2;

    const viewports: ViewportConfig[] = [
      { id: 'axial', x: gap, y: gap, width: halfW, height: halfH, type: 'mpr' },
      { id: '3d', x: gap * 2 + halfW, y: gap, width: halfW, height: height - gap * 2, type: '3d' },
      { id: 'coronal', x: gap, y: gap * 2 + halfH, width: halfW, height: halfH, type: 'mpr' },
    ];

    return { viewports, panels: [], totalWidth: width, totalHeight: height };
  }

  private computeSingleColumn(width: number, height: number): LayoutConfig {
    const gap = 8;
    const vpHeight = (height - gap * 4) / 3;

    const viewports: ViewportConfig[] = [
      { id: 'axial', x: gap, y: gap, width: width - gap * 2, height: vpHeight, type: 'mpr' },
      { id: 'coronal', x: gap, y: gap * 2 + vpHeight, width: width - gap * 2, height: vpHeight, type: 'mpr' },
      { id: '3d', x: gap, y: gap * 3 + vpHeight * 2, width: width - gap * 2, height: vpHeight, type: '3d' },
    ];

    return { viewports, panels: [], totalWidth: width, totalHeight: height };
  }

  private createEmptyLayout(): LayoutConfig {
    return { viewports: [], panels: [], totalWidth: 0, totalHeight: 0 };
  }
}
