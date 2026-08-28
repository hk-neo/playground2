/** 레이아웃 영역 식별자 */
export type LayoutRegion = 'top' | 'bottom-left' | 'bottom-right';

/** 레이아웃 스냅샷 (직렬화 가능) */
export interface LayoutSnapshot {
  /** 세 영역의 상대 비율 (합 = 1.0) */
  ratios: {
    top: number;
    'bottom-left': number;
    'bottom-right': number;
  };
  /** 현재 maximize된 영역 (없으면 null) */
  maximized: LayoutRegion | null;
}

/** View Layout Manager: 리사이즈/맥스 컨트롤을 위한 상태 관리 */
export interface IViewLayoutManager {
  /** 현재 스냅샷 (불변 복사본) */
  getSnapshot(): LayoutSnapshot;
  /** 비율 변경 (자동으로 0.1..0.8 클램프, 나머지 영역 비례 보정) */
  setRatio(region: LayoutRegion, ratio: number): void;
  /** 특정 영역 maximize */
  maximize(region: LayoutRegion): void;
  /** maximize 해제 */
  restore(): void;
  /** 기본 비율로 리셋 */
  resetRatios(): void;
  /** 현재 maximize 여부 */
  isMaximized(): boolean;
  /** maximize된 영역 */
  getMaximizedRegion(): LayoutRegion | null;

  /** 레이아웃 변경 콜백 (스냅샷 전달) */
  onChange(cb: (snapshot: LayoutSnapshot) => void): void;

  /** localStorage 저장/복원 (영속화) */
  save(): void;
  load(): boolean;

  /** dispose */
  dispose(): void;
}
