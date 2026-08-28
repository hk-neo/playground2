/**
 * View Layout Manager의 비율 스냅샷을 flex shorthand 문자열로 매핑한다.
 *
 * 배경: workspace는 .region-top과 .region-bottom-row 두 flex item으로 나뉘고,
 * .region-bottom-row 자체는 다시 .region-bottom-left/right 두 flex item을 갖는다.
 * 비율 모델은 두 레벨이므로:
 *   - top vs bottom-row: r.top (workspace 안 비율, 0..1)
 *   - bottom-left vs bottom-right: r['bottom-left'] / r['bottom-right'] (row 안 비율, 합=1)
 *
 * 이전 구현은 region-top의 flex-grow만 r.top로 갱신하고 .region-bottom-row의
 * flex-grow는 CSS의 `flex: 3 1 0`이 그대로 남아, 실제 top 비율이 0.7이어도
 * 0.7 / (0.7 + 3) ≈ 19%만 차지하는 버그가 있었다. 이 헬퍼는 bottom-row의
 * flex-grow를 (1 - r.top)로 명시해 비율이 실제 높이로 정확히 반영되도록 한다.
 */
import type { LayoutSnapshot } from '../shared/interfaces/layout';

export interface LayoutFlex {
  /** region-top 인라인 flex 값 */
  top: string;
  /** region-bottom-row 인라인 flex 값 (top 비율의 보어) */
  bottomRow: string;
  /** region-bottom-left 인라인 flex 값 */
  bottomLeft: string;
  /** region-bottom-right 인라인 flex 값 */
  bottomRight: string;
}

/**
 * 스냅샷 비율을 각 region에 적용할 flex shorthand 문자열로 변환한다.
 *
 * @param snap  ViewLayoutManager의 스냅샷
 * @returns 각 region에 그대로 할당 가능한 `flex` 값들
 */
export function computeLayoutFlex(snap: LayoutSnapshot): LayoutFlex {
  const r = snap.ratios;
  const top = r.top;
  // bottom-left/right는 항상 합 = 1.0을 유지하지만, 방어적으로 0 나눗셈만 회피한다.
  const bottomSum = Math.max(0.0001, r['bottom-left'] + r['bottom-right']);
  const bottomLeftRatio = r['bottom-left'] / bottomSum;
  const bottomRightRatio = r['bottom-right'] / bottomSum;

  return {
    top: `${top} 1 0`,
    bottomRow: `${1 - top} 1 0`,
    bottomLeft: `${bottomLeftRatio} 1 0`,
    bottomRight: `${bottomRightRatio} 1 0`,
  };
}
