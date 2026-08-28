import { describe, it, expect } from 'vitest';
import { getCrosshairCanvasSize } from '../crosshair-size';
import { MPRPlane } from '../../shared/types/rendering';

describe('getCrosshairCanvasSize', () => {
  // 회귀 가드: .crosshair-overlay 캔버스와 .mpr(슬라이스 이미지) 캔버스가
  // 같은 내부 width/height를 가져야만 픽셀 좌표 기준으로 그은 십자선이 화면상에서
  // 이미지의 동일 픽셀과 겹친다. helper가 슬라이스 평면과 볼륨 차원에서
  // 올바른 크기를 반환하는지 확인한다.

  const dims = [512, 512, 300] as const; // dx, dy, dz

  it('Axial 평면은 dx × dy', () => {
    const s = getCrosshairCanvasSize(MPRPlane.Axial, dims);
    expect(s).toEqual({ width: 512, height: 512 });
  });

  it('Coronal 평면은 dx × dz', () => {
    const s = getCrosshairCanvasSize(MPRPlane.Coronal, dims);
    expect(s).toEqual({ width: 512, height: 300 });
  });

  it('Sagittal 평면은 dy × dz', () => {
    const s = getCrosshairCanvasSize(MPRPlane.Sagittal, dims);
    expect(s).toEqual({ width: 512, height: 300 });
  });

  it('비등방 차원 (예: dy ≠ dz)에서도 평면별 매핑이 정확', () => {
    const asymmetric = [400, 300, 200] as const;
    expect(getCrosshairCanvasSize(MPRPlane.Axial, asymmetric)).toEqual({ width: 400, height: 300 });
    expect(getCrosshairCanvasSize(MPRPlane.Coronal, asymmetric)).toEqual({ width: 400, height: 200 });
    expect(getCrosshairCanvasSize(MPRPlane.Sagittal, asymmetric)).toEqual({ width: 300, height: 200 });
  });

  it('반환값은 슬라이스 추출에 사용되는 평면 차원과 일치 (회귀 가드)', () => {
    // slice-renderer / renderSlice도 같은 매핑을 사용한다. 어긋나면 십자선과
    // 이미지가 어긋나게 그려진다.
    const d = [256, 256, 128] as const;
    // Axial: sliceW=dx, sliceH=dy
    // Coronal: sliceW=dx, sliceH=dz
    // Sagittal: sliceW=dy, sliceH=dz
    expect(getCrosshairCanvasSize(MPRPlane.Axial, d))
      .toEqual({ width: 256, height: 256 });
    expect(getCrosshairCanvasSize(MPRPlane.Coronal, d))
      .toEqual({ width: 256, height: 128 });
    expect(getCrosshairCanvasSize(MPRPlane.Sagittal, d))
      .toEqual({ width: 256, height: 128 });
  });
});
