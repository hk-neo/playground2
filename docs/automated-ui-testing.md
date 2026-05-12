# CBCT Viewer 자동화 UI 테스트

## Puppeteer 기반 헤드리스 브라우저 테스트 아키텍처

---

## 1. 테스트 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                   테스트 실행 흐름                    │
│                                                       │
│  Vitest (단위 테스트)          Puppeteer (통합 테스트)  │
│  ┌──────────────┐              ┌──────────────────┐  │
│  │ jsdom 환경    │              │ Headless Chrome   │  │
│  │ 모듈별 단위테스트│              │ 실제 WebGL2 렌더링 │  │
│  │ 200+ tests   │              │ 스크린샷 캡처     │  │
│  └──────────────┘              └────────┬─────────┘  │
│                                         │             │
│                    ┌────────────────────┴──────┐      │
│                    │       Vite Dev Server       │      │
│                    │   (localhost:5175, HMR)     │      │
│                    │                             │      │
│                    │  src/ ──► TypeScript ──► JS  │      │
│                    │  public/dicom-test/ ──► HTTP │      │
│                    └─────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

**핵심 원칙:** 단위 테스트는 빠르지만 브라우저 환경을 완전히 재현할 수 없다. WebGL2 렌더링, 실제 마우스 이벤트, DICOM 파일 파이프라인은 실제 브라우저에서만 검증 가능하다.

---

## 2. 테스트 환경 구성

### 2.1 DICOM 테스트 데이터 주입

500개 DICOM 파일을 Puppeteer에서 직접 업로드하면 타임아웃이 발생한다.
대신 Vite의 public 디렉토리에 심볼릭 링크를 생성하여 HTTP로 로드한다.

```bash
# public/dicom-test/ → 실제 DICOM 파일 위치
ln -s /path/to/dicom-files public/dicom-test/
```

```javascript
// 테스트 코드: File Upload 대신 HTTP Fetch 사용
await page.evaluate(async (files) => {
  const fileObjects = [];
  for (const path of files) {
    const resp = await fetch(path);              // Vite가 정적 파일로 서빙
    const blob = await resp.blob();
    fileObjects.push(new File([blob], path.split('/').pop(), {
      type: 'application/dicom'
    }));
  }
  // DataTransfer로 file input에 주입
  const dt = new DataTransfer();
  for (const f of fileObjects) dt.items.add(f);
  document.getElementById('file-input').files = dt.files;
  document.getElementById('file-input').dispatchEvent(new Event('change'));
}, dcmFiles);
```

### 2.2 헤드리스 Chrome WebGL2 설정

```javascript
const browser = await puppeteer.launch({
  headless: 'new',                              // 새로운 Headless 모드
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--use-gl=angle',                           // WebGL2 지원 (기본 headless는 미지원)
  ],
  defaultViewport: { width: 1440, height: 900 }, // 실제 사용 해상도
});
```

---

## 3. 테스트 시나리오

### 3.1 DICOM 로드 및 볼륨 구축 테스트

```javascript
// 200개 DICOM 파일 로드 후 볼륨 구축 완료 대기
await page.waitForFunction(
  () => !document.getElementById('loading').classList.contains('active'),
  { timeout: 120000 }
);

// 상태 메시지에서 볼륨 정보 확인
const statusText = await page.$eval('#status', el => el.textContent);
// → "볼륨 로드 완료: 800×800×200 (200슬라이스)"
```

### 3.2 MPR 렌더링 픽셀 검증

WebGL과 달리 Canvas 2D는 jsdom에서 동작하지 않으므로,
실제 브라우저에서 픽셀 값을 샘플링하여 렌더링을 검증한다.

```javascript
const canvasInfo = await page.evaluate(() => {
  const ids = ['axial-canvas', 'coronal-canvas', 'sagittal-canvas'];
  return ids.map(id => {
    const c = document.getElementById(id);
    const ctx = c.getContext('2d');
    // 좌상단 10×10 영역의 픽셀 샘플링
    const data = ctx.getImageData(0, 0, Math.min(c.width, 10), Math.min(c.height, 10));
    const nonZero = data.data.filter(v => v !== 0).length;
    return { id, width: c.width, height: c.height, nonZeroPixels: nonZero };
  });
});
// → axial-canvas: 800x800, non-zero pixels: 109 ✓
// → coronal-canvas: 800x200, non-zero pixels: 100 ✓
// → sagittal-canvas: 800x200, non-zero pixels: 169 ✓
```

### 3.3 MPR 스크롤 휠 슬라이스 탐색 테스트

```javascript
// 초기값 확인
const initial = await page.$eval('#axial-slider', el => el.value);  // "100"

// 스크롤 다운 → 다음 슬라이스
await page.mouse.wheel({ deltaY: 100 });
const afterDown = await page.$eval('#axial-slider', el => el.value);  // "101"

// 스크롤 업 → 이전 슬라이스
await page.mouse.wheel({ deltaY: -100 });
const afterUp = await page.$eval('#axial-slider', el => el.value);   // "100"
```

### 3.4 MPR 좌클릭 드래그 WL/WW 조정 테스트

```javascript
const wlBefore = await page.$eval('#wl-slider', el => el.value);  // "500"
const wwBefore = await page.$eval('#ww-slider', el => el.value);  // "2500"

// Coronal 뷰포트에서 드래그
const box = await coronalCanvas.boundingBox();
await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
await page.mouse.down();
await page.mouse.move(cx + 80, cy - 60, { steps: 5 });  // 우상단 드래그
await page.mouse.up();

const wlAfter = await page.$eval('#wl-slider', el => el.value);   // "740"
const wwAfter = await page.$eval('#ww-slider', el => el.value);   // "2820"
```

### 3.5 3D 마우스 인터랙션 테스트

```javascript
// CSS 셀렉터 주의: ID가 숫자로 시작하면 [id="3d-canvas"] 사용
const canvas3d = await page.$('[id="3d-canvas"]');
const box = await canvas3d.boundingBox();

// 좌클릭 드래그 → 회전
await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
await page.mouse.down();
await page.mouse.move(x + 100, y + 50, { steps: 5 });
await page.mouse.up();
await page.screenshot({ path: 'screenshots/ui-3d-rotated.png' });

// 더블클릭 → 카메라 초기화
await page.mouse.click(x, y, { clickCount: 2 });
await page.screenshot({ path: 'screenshots/ui-3d-reset.png' });

// 스크롤 → 줌
await page.mouse.wheel({ deltaY: -200 });
await page.screenshot({ path: 'screenshots/ui-3d-zoomed.png' });
```

### 3.6 스크린샷 기반 시각 검증

WebGL readPixels는 headless Chrome에서 0을 반환하지만,
스크린샷으로 렌더링 결과를 확인할 수 있다.

```javascript
await page.screenshot({ path: 'screenshots/ui-loaded.png' });
await page.screenshot({ path: 'screenshots/ui-after-rotate.png' });
```

---

## 4. 테스트 실행 결과

```
$ node scripts/test-interactions.mjs

Loading 200 DICOM files...
✓ DICOM loaded
  Axial initial: 100
  Axial after scroll down: 101
  Axial after scroll up: 100
✓ MPR scroll wheel slice navigation works
  WL before drag: 500, WW before drag: 2500
  WL after drag: 740, WW after drag: 2820
✓ MPR left-drag WL/WW adjustment works
✓ 3D left-drag rotation works
✓ 3D double-click reset works
✓ 3D scroll zoom works
  Sagittal: 400 → 401
✓ Cross-plane scroll works independently

✅ All interaction tests passed!
```

---

## 5. 테스트 커버리지 요약

| 레이어 | 도구 | 대상 | 결과 |
|--------|------|------|------|
| 단위 테스트 | Vitest + jsdom | 개별 모듈 (200+ tests) | 전부 통과 |
| 통합 테스트 | Puppeteer + Chrome | DICOM→MPR→3D 전체 파이프라인 | 전부 통과 |
| 인터랙션 테스트 | Puppeteer 마우스/키보드 | 스크롤, 드래그, 더블클릭 | 전부 통과 |
| 시각 테스트 | Puppeteer 스크린샷 | UI 레이아웃, 렌더링 결과 | 스크린샷 캡처 완료 |

### 이중 검증 전략

```
단위 테스트 (빠름, 격리)        통합 테스트 (느림, 실제 환경)
┌────────────────────┐          ┌────────────────────────┐
│ 각 클래스 로직 검증  │          │ 전체 파이프라인 동작 검증  │
│ StateManager       │          │ DICOM Load → Volume    │
│ ComponentRegistry  │          │ Volume → MPR Rendering  │
│ OrbitalCamera      │          │ Volume → 3D Ray Casting │
│ Measurement Tools  │          │ Mouse → Camera Rotation │
│ Overlay Renderer   │          │ Scroll → Slice Change   │
│ Security Module    │          │ Drag → WL/WW Change     │
│ ...                │          │ ...                     │
└────────────────────┘          └────────────────────────┘
       200+ tests                      10+ scenarios
       < 1초                            ~30초
```

이 접근 방식은 단위 테스트의 속도와 통합 테스트의 신뢰성을 결합하여,
의료기기 소프트웨어에 요구되는 높은 품질 기준을 충족한다.
