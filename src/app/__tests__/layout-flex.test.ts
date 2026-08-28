import { describe, it, expect } from 'vitest';
import { computeLayoutFlex } from '../layout-flex';
import type { LayoutSnapshot } from '../../shared/interfaces/layout';

const snap = (ratios: LayoutSnapshot['ratios'], maximized: LayoutSnapshot['maximized'] = null): LayoutSnapshot => ({
  ratios,
  maximized,
});

describe('computeLayoutFlex', () => {
  it('기본 비율(top=0.7)에서 top/bottom-row flex 합이 1.0', () => {
    // 회귀 가드: region-top과 region-bottom-row가 flex container(workspace)에서
    // 형제이고, 두 flex-grow의 합이 1이 되어야 의도한 비율이 정확히 반영된다.
    // 이전 구현은 bottom-row의 flex-grow를 CSS(`flex: 3 1 0`) 그대로 두어
    // top 0.7이 실제 19%만 차지하는 버그가 있었다.
    const f = computeLayoutFlex(snap({ top: 0.7, 'bottom-left': 0.55, 'bottom-right': 0.45 }));
    const topGrow = parseFloat(f.top.split(' ')[0]);
    const bottomRowGrow = parseFloat(f.bottomRow.split(' ')[0]);
    expect(topGrow + bottomRowGrow).toBeCloseTo(1.0, 6);
    expect(topGrow).toBeCloseTo(0.7, 6);
    expect(bottomRowGrow).toBeCloseTo(0.3, 6);
  });

  it('top 비율을 최대로 올려도 top/bottom-row flex 합이 1.0', () => {
    const f = computeLayoutFlex(snap({ top: 0.95, 'bottom-left': 0.5, 'bottom-right': 0.5 }));
    const topGrow = parseFloat(f.top.split(' ')[0]);
    const bottomRowGrow = parseFloat(f.bottomRow.split(' ')[0]);
    expect(topGrow + bottomRowGrow).toBeCloseTo(1.0, 6);
    expect(topGrow).toBeCloseTo(0.95, 6);
  });

  it('top 비율을 최대로 내려도 합이 1.0', () => {
    const f = computeLayoutFlex(snap({ top: 0.15, 'bottom-left': 0.5, 'bottom-right': 0.5 }));
    const topGrow = parseFloat(f.top.split(' ')[0]);
    const bottomRowGrow = parseFloat(f.bottomRow.split(' ')[0]);
    expect(topGrow + bottomRowGrow).toBeCloseTo(1.0, 6);
  });

  it('bottom-left/right는 row 안 비율을 유지하고 합이 1.0', () => {
    const f = computeLayoutFlex(snap({ top: 0.6, 'bottom-left': 0.7, 'bottom-right': 0.3 }));
    const blGrow = parseFloat(f.bottomLeft.split(' ')[0]);
    const brGrow = parseFloat(f.bottomRight.split(' ')[0]);
    expect(blGrow + brGrow).toBeCloseTo(1.0, 6);
    expect(blGrow).toBeCloseTo(0.7, 6);
    expect(brGrow).toBeCloseTo(0.3, 6);
  });

  it('모든 반환값은 `grow shrink basis` 3-토큰 형식', () => {
    const f = computeLayoutFlex(snap({ top: 0.5, 'bottom-left': 0.5, 'bottom-right': 0.5 }));
    for (const v of [f.top, f.bottomRow, f.bottomLeft, f.bottomRight]) {
      const parts = v.split(' ');
      expect(parts).toHaveLength(3);
      expect(parts[1]).toBe('1'); // flex-shrink
      expect(parts[2]).toBe('0'); // flex-basis
    }
  });

  it('maximized 스냅샷에서도 동일하게 동작 (maximize 시 별도 분기 없음)', () => {
    const f = computeLayoutFlex(
      snap({ top: 0.8, 'bottom-left': 0.5, 'bottom-right': 0.5 }, 'top'),
    );
    const topGrow = parseFloat(f.top.split(' ')[0]);
    expect(topGrow).toBeCloseTo(0.8, 6);
  });
});
