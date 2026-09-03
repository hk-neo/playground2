/**
 * DICOM 환자 방향(orientation) 기반 볼륨 저장축 → 화면 좌표계 변환 계산.
 *
 * DICOM ImageOrientationPatient(0020,0037)는 첫 슬라이스의 row/column 방향을
 * 환자 좌표계(LPS: +x=Left, +y=Posterior, +z=Superior)로 제공한다.
 * 여기서 유추한 slice normal과 ImagePositionPatient(0020,0032)의 슬라이스 진행
 * 방향을 이용해, 볼륨 저장 인덱스(col/row/slice)를 화면 좌표계로 변환하는
 * 순열+반전 행렬(a 3x3)과 bias를 계산한다.
 *
 * 화면 좌표계(캐논컬 정면):
 *   - 오른쪽(+x) = 환자 Right
 *   - 위(+y)    = 환자 Superior (머리)
 *   - 깊이(+z)  = 환자 Posterior (뒷머리 → 얼굴(Anterior)이 정면)
 *
 * 변환: storageUV[i] = dot(a.row_i, displayUV) + bias[i]
 */

export interface VolumeStorageTransform {
  /** 3x3 row-major (a[row][col]) */
  a: number[];
  /** 3 */
  bias: number[];
}

const IDENTITY: VolumeStorageTransform = {
  a: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  bias: [0, 0, 0],
};

function cross3(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm3(a: number[]): number[] {
  const m = Math.hypot(a[0], a[1], a[2]);
  return m > 1e-9 ? [a[0] / m, a[1] / m, a[2] / m] : [0, 0, 1];
}

export function computeStorageTransform(
  iopStr: string | undefined,
  ippFirst: number[] | undefined,
  ippLast: number[] | undefined,
): VolumeStorageTransform {
  if (!iopStr) return IDENTITY;
  const p = iopStr.split('\\').map(Number);
  if (p.length < 6 || !p.every(Number.isFinite)) return IDENTITY;

  const row = [p[0], p[1], p[2]];
  const col = [p[3], p[4], p[5]];
  let slice = cross3(row, col);

  // IPP 증가 방향이 slice normal과 반대면 뒤집는다 (실제 슬라이스 진행 방향 보정).
  if (ippFirst && ippLast) {
    const d = [
      ippLast[0] - ippFirst[0],
      ippLast[1] - ippFirst[1],
      ippLast[2] - ippFirst[2],
    ];
    if (dot3(slice, d) < 0) slice = [-slice[0], -slice[1], -slice[2]];
  }

  // 볼륨 저장축: 0=col, 1=row, 2=slice.
  const axes = [norm3(col), norm3(row), norm3(slice)];
  // 화면 축(LPS): 오른쪽=Right(-1,0,0), 위=Superior(0,0,1), 깊이=Posterior(0,1,0).
  const targets: number[][] = [
    [-1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ];

  const a: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const bias: number[] = [0, 0, 0];
  for (let d = 0; d < 3; d++) {
    const t = targets[d];
    let bestAxis = -1;
    let bestMag = -Infinity;
    let bestDot = 0;
    for (let ax = 0; ax < 3; ax++) {
      const dd = dot3(axes[ax], t);
      const mag = Math.abs(dd);
      if (mag > bestMag) {
        bestMag = mag;
        bestDot = dd;
        bestAxis = ax;
      }
    }
    if (bestAxis < 0) continue;
    const s = bestDot >= 0 ? 1 : -1;
    a[bestAxis * 3 + d] = s;
    bias[bestAxis] = s < 0 ? 1 : 0;
  }
  return { a, bias };
}