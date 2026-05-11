import type { CameraState } from './camera';
import type { PatientInfo } from './patient';

/** 뷰포트 설정 */
export interface ViewportConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'mpr' | '3d';
}

/** 패널 설정 */
export interface PanelConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'tool' | 'info';
}

/** 레이아웃 설정 */
export interface LayoutConfig {
  viewports: ViewportConfig[];
  panels: PanelConfig[];
  totalWidth: number;
  totalHeight: number;
}

/** 뷰포트 크기 */
export interface ViewportSize {
  width: number;
  height: number;
}

/** 애플리케이션 상태 */
export interface AppState {
  volumeLoaded: boolean;
  activeTool: string | null;
  wlww: {
    level: number;
    width: number;
  };
  slicePositions: {
    axial: number;
    coronal: number;
    sagittal: number;
  };
  cameraState: CameraState;
  patientInfo: PatientInfo | null;
  syncEnabled: boolean;
  uiLayout: LayoutConfig;
}

/** 브라우저 정보 */
export interface BrowserInfo {
  name: string;
  version: string;
  isSupported: boolean;
  webgl2Supported: boolean;
}

/** 상태 구독자 */
export type StateSubscriber = (state: AppState, key: string) => void;
