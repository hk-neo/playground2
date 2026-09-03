import { describe, it, expect } from 'vitest';
import { computeStorageTransform } from '../orientation';

describe('computeStorageTransform', () => {
  it('returns identity for missing IOP', () => {
    const t = computeStorageTransform(undefined, undefined, undefined);
    expect(t.a).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(t.bias).toEqual([0, 0, 0]);
  });

  it('handles standard axial IOP (row=Left, col=Posterior, slice=Superior)', () => {
    // 실제 CBCT: IOP "1\0\0\0\1\0" → row=(1,0,0), col=(0,1,0).
    // IPP z 증가(발→머리).
    const t = computeStorageTransform(
      '1\\0\\0\\0\\1\\0',
      [0, 0, -200],
      [0, 0, 0],
    );
    // row-major 3x3: row0(col), row1(row), row2(slice)
    // right=Right(-1,0,0)→row축(row=1) sign -1
    // up=Superior(0,0,1)→slice축(2) sign +1
    // deep=Posterior(0,1,0)→col축(0) sign +1
    expect(t.a[1 * 3 + 0]).toBe(-1); // a[row][right]
    expect(t.a[2 * 3 + 1]).toBe(1);  // a[slice][up]
    expect(t.a[0 * 3 + 2]).toBe(1);  // a[col][deep]
    expect(t.bias[1]).toBe(1);       // row 축 반전 bias
  });

  it('maps head(superior) to up via higher slice index', () => {
    const t = computeStorageTransform('1\\0\\0\\0\\1\\0', [0, 0, -200], [0, 0, 0]);
    // storageUV = a * displayUV + bias
    const apply = (px: number, py: number, pz: number): number[] => {
      const p = [px, py, pz];
      const q = [
        t.a[0] * p[0] + t.a[1] * p[1] + t.a[2] * p[2] + t.bias[0],
        t.a[3] * p[0] + t.a[4] * p[1] + t.a[5] * p[2] + t.bias[1],
        t.a[6] * p[0] + t.a[7] * p[1] + t.a[8] * p[2] + t.bias[2],
      ];
      return q;
    };
    // 화면 위(display y=1) → storage slice(q[2])이 1 (머리/높은 슬라이스).
    expect(apply(0.5, 1, 0.5)[2]).toBeCloseTo(1, 5);
    // 화면 아래(display y=0) → storage slice 0 (턱/낮은 슬라이스).
    expect(apply(0.5, 0, 0.5)[2]).toBeCloseTo(0, 5);
  });
});