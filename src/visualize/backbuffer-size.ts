/**
 * 3D 렌더러의 back-face 텍스처 크기를 계산한다.
 *
 * 배경: 3D Volume 렌더링은 두 패스로 동작한다 — 첫 패스에서 unit cube의
 * back-face를 텍스처에 렌더링해서 각 픽셀의 ray exit point를 저장하고, 두 번째
 * 패스에서 그 텍스처를 샘플링하면서 ray-marching한다. 이 back-face 텍스처는
 * 풀 해상도일 필요가 없다 (ray-marching은 fragment shader에서 텍스처를
 * nearest로 샘플링) — 큰 뷰포트에서 메모리를 낭비하지 않도록 캡을 둔다.
 *
 * 또한 GPU 드라이버(특히 ANGLE/D3D)는 MAX_TEXTURE_SIZE 단독으로는 부족한
 * "총 텍스처 할당 한계"가 있어, 큰 캔버스 + 고DPI 조합에서
 * "Texture total allocation size is too large" 에러가 날 수 있다.
 *
 * @param cssW   캔버스 CSS 박스 너비 (px)
 * @param cssH   캔버스 CSS 박스 높이 (px)
 * @param dpr    devicePixelRatio
 * @param maxDim 각 차원의 최댓값 (기본 4096). 초과 시 종횡비를 유지하며 축소.
 *               일반 모니터(1080p/1440p + dpr≤2)에서는 축소 없이 풀 해상도를
 *               유지해 시각적 품질을 보존하고, 4K + dpr=2 같은 극단 조합에서만
 *               안티에일리어싱된 축소가 적용된다.
 * @returns      `{w, h}` 또는 `null` (입력이 유효하지 않을 때)
 */
export function computeBackbufferSize(
  cssW: number,
  cssH: number,
  dpr: number,
  maxDim = 4096,
): { w: number; h: number } | null {
  if (!Number.isFinite(cssW) || !Number.isFinite(cssH) || !Number.isFinite(dpr)) return null;
  if (cssW <= 0 || cssH <= 0 || dpr <= 0) return null;

  let w = Math.floor(cssW * dpr);
  let h = Math.floor(cssH * dpr);
  if (w <= 0 || h <= 0) return null;

  // 한 차원이라도 maxDim을 넘으면 둘 다 비례 축소해 종횡비를 유지한다.
  // ray-marching은 nearest 샘플링이라 half-resolution 정도면 시각적으로 동일하다.
  const largest = Math.max(w, h);
  if (largest > maxDim) {
    const scale = maxDim / largest;
    w = Math.max(1, Math.floor(w * scale));
    h = Math.max(1, Math.floor(h * scale));
  }
  return { w, h };
}
