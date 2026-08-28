import type { LayoutRegion, LayoutSnapshot } from '../shared/interfaces/layout';
import type { IViewLayoutManager } from '../shared/interfaces/layout';

const STORAGE_KEY = 'cbct-layout-v3';
const MIN_RATIO = 0.15;  // top column 비율 클램프 (min 10%)
const MAX_RATIO = 0.95; // top column 비율 클램프 (max 85% — 3D viewport)
const ROW_MIN = 0.05; // bottom-row 내 left/right 클램프
const ROW_MAX = 0.95;
const DEFAULTS: LayoutSnapshot['ratios'] = {
  top: 0.7,
  'bottom-left': 0.55,
  'bottom-right': 0.45,
};

type Listener = (s: LayoutSnapshot) => void;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export class ViewLayoutManager implements IViewLayoutManager {
  private _snapshot: LayoutSnapshot;
  private _listeners: Listener[] = [];

  constructor() {
    this._snapshot = {
      ratios: { ...DEFAULTS },
      maximized: null,
    };
  }

  getSnapshot(): LayoutSnapshot {
    return {
      ratios: { ...this._snapshot.ratios },
      maximized: this._snapshot.maximized,
    };
  }

  setRatio(region: LayoutRegion, ratio: number): void {
    if (region === 'top') {
      // top은 column 안 비율 (0~1), 클램프만
      this._snapshot.ratios.top = clamp(ratio, MIN_RATIO, MAX_RATIO);
    } else {
      // bottom-left/right는 bottom-row 안 비율. 합 = 1 유지하며 변경
      const r = clamp(ratio, ROW_MIN, ROW_MAX);
      const other: 'bottom-left' | 'bottom-right' = region === 'bottom-left' ? 'bottom-right' : 'bottom-left';
      this._snapshot.ratios[region] = r;
      this._snapshot.ratios[other] = 1 - r;
    }
    this.emit();
  }

  maximize(region: LayoutRegion): void {
    this._snapshot.maximized = region;
    this.emit();
  }

  restore(): void {
    this._snapshot.maximized = null;
    this.emit();
  }

  resetRatios(): void {
    this._snapshot.ratios = { ...DEFAULTS };
    this.emit();
  }

  isMaximized(): boolean {
    return this._snapshot.maximized !== null;
  }

  getMaximizedRegion(): LayoutRegion | null {
    return this._snapshot.maximized;
  }

  onChange(cb: Listener): void {
    this._listeners.push(cb);
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._snapshot));
    } catch {
      // localStorage 사용 불가 환경 (SSR, private mode 등) — 무시
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<LayoutSnapshot>;
      if (!parsed || !parsed.ratios) return false;

      const top = Number(parsed.ratios.top);
      const bl = Number(parsed.ratios['bottom-left']);
      const br = Number(parsed.ratios['bottom-right']);

      // 비정상 데이터면 무시 (기본값 유지)
      const valid =
        Number.isFinite(top) && Number.isFinite(bl) && Number.isFinite(br) &&
        top >= 0.1 && top <= 0.8 &&
        bl >= 0.05 && bl <= 0.95 &&
        br >= 0.05 && br <= 0.95;
      if (!valid) return false;

      this._snapshot = {
        ratios: { top, 'bottom-left': bl, 'bottom-right': br },
        maximized: null, // load 시에는 항상 restore (maximize 상태로 시작하지 않음)
      };
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    this._listeners = [];
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const cb of this._listeners) cb(snap);
  }
}
