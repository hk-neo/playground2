import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ViewLayoutManager } from '../view-layout-manager';

const STORAGE_KEY = 'cbct-layout-v3';

describe('ViewLayoutManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('starts with default ratios (top=0.7, bl=0.55, br=0.45)', () => {
      // top은 column 내 비율, bottom-left/right는 bottom-row 내 비율 (합 1)
      const m = new ViewLayoutManager();
      const snap = m.getSnapshot();
      expect(snap.ratios.top).toBeCloseTo(0.7, 5);
      expect(snap.ratios['bottom-left']).toBeCloseTo(0.55, 5);
      expect(snap.ratios['bottom-right']).toBeCloseTo(0.45, 5);
      expect(snap.maximized).toBeNull();
    });

    it('bottom-left + bottom-right = 1.0 (row 비율)', () => {
      const m = new ViewLayoutManager();
      const r = m.getSnapshot().ratios;
      expect(r['bottom-left'] + r['bottom-right']).toBeCloseTo(1.0, 5);
    });
  });

  describe('setRatio', () => {
    it('updates top ratio (column 내 비율, 다른 region 안 건드림)', () => {
      const m = new ViewLayoutManager();
      m.setRatio('top', 0.7);
      const r = m.getSnapshot().ratios;
      expect(r.top).toBeCloseTo(0.7, 5);
      // bottom-left/right는 row 안 비율이라 그대로
      expect(r['bottom-left']).toBeCloseTo(0.55, 5);
      expect(r['bottom-right']).toBeCloseTo(0.45, 5);
    });

    it('updates bottom-left ratio (row 내 비율, 합 1 유지)', () => {
      const m = new ViewLayoutManager();
      m.setRatio('bottom-left', 0.7);
      const r = m.getSnapshot().ratios;
      expect(r['bottom-left']).toBeCloseTo(0.7, 5);
      expect(r['bottom-right']).toBeCloseTo(0.3, 5);
      expect(r['bottom-left'] + r['bottom-right']).toBeCloseTo(1.0, 5);
    });

    it('clamps to min 0.1', () => {
      const m = new ViewLayoutManager();
      m.setRatio('top', 0.01);
      expect(m.getSnapshot().ratios.top).toBe(0.15);
    });

    it('clamps to max 0.95', () => {
      const m = new ViewLayoutManager();
      m.setRatio('top', 0.99);
      expect(m.getSnapshot().ratios.top).toBe(0.95);
    });
  });

  describe('maximize / restore', () => {
    it('maximize(top) sets maximized = "top"', () => {
      const m = new ViewLayoutManager();
      m.maximize('top');
      expect(m.isMaximized()).toBe(true);
      expect(m.getMaximizedRegion()).toBe('top');
    });

    it('restore() clears maximized', () => {
      const m = new ViewLayoutManager();
      m.maximize('top');
      m.restore();
      expect(m.isMaximized()).toBe(false);
      expect(m.getMaximizedRegion()).toBeNull();
    });
  });

  describe('resetRatios', () => {
    it('restores default ratios', () => {
      const m = new ViewLayoutManager();
      m.setRatio('top', 0.3);
      m.setRatio('bottom-left', 0.8);
      m.resetRatios();
      const r = m.getSnapshot().ratios;
      expect(r.top).toBeCloseTo(0.7, 5);
      expect(r['bottom-left']).toBeCloseTo(0.55, 5);
      expect(r['bottom-right']).toBeCloseTo(0.45, 5);
    });
  });

  describe('onChange', () => {
    it('fires on setRatio', () => {
      const m = new ViewLayoutManager();
      let count = 0;
      m.onChange(() => { count++; });
      m.setRatio('top', 0.6);
      m.setRatio('top', 0.7);
      expect(count).toBe(2);
    });

    it('fires on maximize', () => {
      const m = new ViewLayoutManager();
      let count = 0;
      m.onChange(() => { count++; });
      m.maximize('top');
      expect(count).toBe(1);
    });
  });

  describe('localStorage persistence', () => {
    it('save() persists to localStorage', () => {
      const m = new ViewLayoutManager();
      m.setRatio('top', 0.7);
      m.save();
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.ratios.top).toBeCloseTo(0.7, 5);
    });

    it('load() restores from localStorage', () => {
      const m1 = new ViewLayoutManager();
      m1.setRatio('top', 0.6);
      m1.save();

      const m2 = new ViewLayoutManager();
      const ok = m2.load();
      expect(ok).toBe(true);
      expect(m2.getSnapshot().ratios.top).toBeCloseTo(0.6, 5);
    });

    it('load() returns false when nothing stored', () => {
      const m = new ViewLayoutManager();
      const ok = m.load();
      expect(ok).toBe(false);
    });
  });
});
