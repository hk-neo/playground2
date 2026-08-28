# Design Spec — Panoramic View + Workspace Redesign

| 항목 | 값 |
|---|---|
| 문서 ID | PLAYG-PANO-001 |
| 작성일 | 2026-08-28 |
| 상태 | Draft → Implementation |
| 대상 모듈 | `src/pano/*` (신규), `src/app/*` (확장), `src/visualize/main.ts` (리팩터), `index.html` (리팩터) |
| 의존성 | 기존 `MPR`, `Volume`, `Camera`, `Overlay`, `Input` 모듈 |

---

## 1. 배경 & 목표

### 1.1 배경
현재 CBCT 뷰어는 4-grid (Axial / Coronal / Sagittal / 3D Volume)로 구성되어 있으나, 임플란트 플래너 / 진단 워크플로우에서 필수인 **파노라믹 뷰(Panoramic / Curved Planar Reformation)가 없음**. 또한 4개 뷰포트가 모두 같은 비중으로, 상황별 우선순위 조정이 어려움.

### 1.2 목표
1. **Pano 뷰포트** 추가: 사용자가 정의한 치아궁 곡선을 따라 곡면 슬라이스를 2D로 펼쳐 표시 (focal trough 두께 지원)
2. **워크스페이스 리디자인**: 3D (메인, 상단) / Pano (좌하단) / MPR 3-plane (우하단) 구조
3. **Curve Editor (사이드 패널)**: 사용자가 MPR 3-view에서 직접 곡선을 그리고 편집
4. **Resize handles & Maximize 컨트롤**: 사용자가 뷰포트 크기를 자유롭게 조절하거나, 한 뷰를 전체화면으로 잠시 확대

### 1.3 비목표 (이번 PR 범위 외)
- 자동 치아 검출 (curve 자동 생성)
- 임플란트 라이브러리 / 임플란트 시뮬레이션 / 신경관(IAN) 자동 검출
- 호스트 3D와 Pano의 실시간 sync (placeholder hook만 추가)
- 4D 애니메이션 / cine 모드
- 다국어 i18n

---

## 2. 사용자 시나리오

### 시나리오 1 — Pano 그리기
1. 사용자가 DICOM 로드
2. 3D / Pano(빈 상태) / MPR 3-view 표시
3. 우측 "Pano 그리기" 버튼 클릭 → Curve Editor 패널 펼침
4. MPR 3-view 중 하나(Axial 권장)에서 치아궁 따라 클릭 → 컨트롤 포인트 추가 (프리뷰가 다른 2-view에도 즉시 projection)
5. 컨트롤 포인트 드래그로 미세 조정
6. Focal trough 두께 슬라이더로 곡선 주변 통합 범위 조절
7. "Apply" 클릭 → Pano 뷰포트에 결과 표시, 패널은 collapse 가능

### 시나리오 2 — 뷰포트 리사이즈
1. 3D ↔ 하단 영역 사이 가로 핸들 드래그 → 상하 비율 변경
2. 하단 좌(Pano) ↔ 우(MPR) 사이 세로 핸들 드래그 → 좌우 비율 변경
3. 더블클릭 핸들 → 기본 비율로 리셋

### 시나리오 3 — Maximize
1. 어떤 뷰포트 우상단 maximize 아이콘 클릭 → 그 뷰포트만 풀스크린
2. 다시 클릭 또는 ESC → 원래 비율로 복귀
3. Curve Editor 작업 중에는 자동으로 maximize 해제 (편집 컨텍스트 보존)

### 시나리오 4 — 프리셋 곡선
1. Curve Editor 패널의 "Ellipse" / "Arch" 프리셋 클릭 → 즉시 곡선 생성
2. 프리셋 위에 자유 편집 가능

---

## 3. 모듈 설계 — `src/pano/`

### 3.1 `panoramic-curve.ts`
- 데이터 모델: 컨트롤 포인트 배열 `Vec3[]`
- 보간: **Catmull-Rom 스플라인** (3D 곡선 부드럽게)
- 프리셋: `createEllipseCurve(dims)`, `createArchCurve(dims)`
- API:
  ```ts
  interface IPanoramicCurve {
    readonly points: ReadonlyArray<Vec3>;
    addPoint(p: Vec3, index?: number): void;
    removePoint(index: number): void;
    movePoint(index: number, p: Vec3): void;
    sample(t: number): Vec3;              // 0..1 → 3D point
    sampleN(n: number): Vec3[];            // 균등 n개 샘플
    tangent(t: number): Vec3;              // 단위 접선 벡터
    length(): number;                      // 호 길이
    toJSON(): CurveSnapshot;
    static fromJSON(s: CurveSnapshot): IPanoramicCurve;
  }
  ```

### 3.2 `focal-trough.ts`
- 곡선 normal 방향으로 ±thickness/2 범위 슬라이스를 min/max IP로 통합
- API:
  ```ts
  interface IFocalTrough {
    readonly thickness: number;   // mm (또는 voxel)
    extract(curve: IPanoramicCurve, volume: VolumeData, width: number): Float32Array;
    // output: width × sampledPoints 2D intensity map
  }
  ```

### 3.3 `curve-editor-controller.ts`
- 상태 머신: `Idle | Drawing | Editing | Applied`
- Undo/Redo 스택 (최근 20단계)
- Hover 하이라이트 (MPR 위에 어느 점/구간에 마우스 있는지)
- API:
  ```ts
  interface ICurveEditorController {
    state: 'Idle' | 'Drawing' | 'Editing' | 'Applied';
    readonly curve: IPanoramicCurve;
    onStateChange(cb): void;
    onCurveChange(cb): void;
    addPointFromCanvasPoint(plane: MPRPlane, canvasXY: Vec2, volume: VolumeData): void;
    movePointFromCanvasDrag(idx: number, plane: MPRPlane, canvasXY: Vec2, volume: VolumeData): void;
    undo(): void;
    redo(): void;
    apply(): void;     // state → 'Applied', PanoView 갱신 트리거
    cancel(): void;    // state → 'Idle', curve 폐기
    loadPreset(name: 'Ellipse' | 'Arch', volume: VolumeData): void;
  }
  ```

### 3.4 `curve-editor-view.ts`
- MPR 3-view에 곡선 projection 오버레이 그리기
- 각 평면의 정상(normal)을 따라 곡선을 2D로 투영 → `OverlayRenderer` 재사용
- 컨트롤 포인트에 hit-target(8px) → 호버/선택 하이라이트
- API:
  ```ts
  interface ICurveEditorView {
    mount(canvases: { axial: HTMLCanvasElement; coronal: HTMLCanvasElement; sagittal: HTMLCanvasElement }): void;
    setCurve(curve: IPanoramicCurve): void;
    setHover(hit: { plane: MPRPlane; pointIndex: number } | null): void;
    setSelected(pointIndex: number | null): void;
    unmount(): void;
  }
  ```

### 3.5 `pano-view.ts` + `pano-renderer.ts`
- `PanoView`: 단일 Pano 뷰포트 상태 (zoom, pan, wl/ww, sliceSlider 미사용)
- `PanoRenderer`: `FocalTrough.extract()` 결과를 2D 텍스처로 업로드, `WLWWApplier`로 후처리, 캔버스에 그리기
- API:
  ```ts
  interface IPanoView {
    setIntensityMap(data: Float32Array, width: number, height: number): void;
    setWLWW(wl: number, ww: number): void;
    setZoomPan(z: number, px: number, py: number): void;
    render(): void;
  }
  ```

### 3.6 `index.ts` (배럴)
```ts
export { PanoramicCurve } from './panoramic-curve';
export type { IPanoramicCurve, CurveSnapshot, CurvePreset } from './panoramic-curve';
export { FocalTrough } from './focal-trough';
export type { IFocalTrough } from './focal-trough';
export { CurveEditorController } from './curve-editor-controller';
export type { ICurveEditorController, CurveEditorState } from './curve-editor-controller';
export { CurveEditorView } from './curve-editor-view';
export type { ICurveEditorView } from './curve-editor-view';
export { PanoView } from './pano-view';
export { PanoRenderer } from './pano-renderer';
export type { IPanoView, IPanoRenderer } from './pano-renderer';
```

---

## 4. UI / UX 설계

### 4.1 기본 레이아웃 (Mode A)
```
┌─────────────────────────────────────────────┬────────────┐
│ Header (50px)                               │            │
├─────────────────────────────────────────────┤  Curve     │
│                                             │  Editor    │
│          3D Volume Viewport                 │  Panel     │
│            (top, 50%)                       │  (350px,   │
│                                             │   collapse │
├──────────────────┬──────────────────────────┤   toggle)  │
│                  │ Axial │ Coronal │ Sagi.  │            │
│  Panoramic       ├───────┴──────┬──┤        │            │
│  (좌하단, 30%)   │   Sagittal (큰 거) │      │            │
│                  │                  │        │            │
│  [max][⤢]       │  [max][⤢] ...   │        │            │
└──────────────────┴──────────────────┴────────┴────────────┘
  Status Bar
```

### 4.2 Resize Handles
- **수평 핸들** (3D↔하단): 4px 두께, hover 시 시안색 강조
- **수직 핸들** (Pano↔MPR): 4px 두께, hover 시 시안색 강조
- **상호작용**:
  - drag → 실시간 비율 변경 (CSS `flex-basis` 업데이트)
  - double-click → 기본 비율(50/30/20)로 리셋
- 저장: `localStorage` (다음 세션에 유지)

### 4.3 Maximize 컨트롤
- 위치: 각 뷰포트 우상단 (오버레이)
- 아이콘: ⛶ / ⤢ (lucide-style inline SVG)
- 동작:
  - 클릭 → 그 뷰포트 `position: fixed; inset: 0; z-index: 1000`
  - 다시 클릭 또는 ESC → 원래 위치로
  - Curve Editor 작업 중 maximize 진입 시 자동으로 editor 닫기 (재진입 시 사용자가 펼침)

### 4.4 Curve Editor 사이드 패널
- 너비 350px (collapse 시 0)
- 구성:
  - 상단: 상태 표시 ("Idle" / "Drawing..." / "Editing" / "Applied")
  - 프리셋 버튼: [Ellipse] [Arch]
  - 컨트롤 포인트 리스트 (번호, 3D 좌표, 삭제 버튼)
  - Focal Trough 두께 슬라이더 (0~20mm)
  - Undo / Redo / Apply / Cancel 버튼
- 폭 변경: 불가 (고정)

### 4.5 인터랙션 매핑
- **MPR 위 클릭** (Drawing 상태): 가장 가까운 plane에 컨트롤 포인트 추가
- **MPR 위 드래그** (Editing 상태, 컨트롤 포인트 위): 포인트 이동
- **휠** (Pano 뷰포트): zoom
- **드래그** (Pano 뷰포트): pan
- **드래그** (Pano 뷰포트 우클릭): WL/WW
- **R 키**: 카메라 리셋 (3D 뷰포트)

### 4.6 디자인 톤
- 기존 다크 + 시안 액센트(`#00e5c3`) 유지
- Resize handle: `--border` 평소, `--accent` hover
- Maximize 버튼: 반투명 배경 + 호버 시 배경 불투명
- 폰트: 기존 Syne / Work Sans / JetBrains Mono

---

## 4.6 Curve Editor 풀스크린 모달 (Pano 그리기 화면)

기존 우측 사이드 패널 방식은 점 찍기 영역(MPR 3분할)이 좁아서 UX가 어색했음. **풀스크린 모달**로 변경:

### 4.6.1 트리거
- 헤더의 **"Curve Editor"** 버튼 클릭 → 모달 오픈
- 현재 우측 사이드 패널은 제거 (또는 미니 상태로만)

### 4.6.2 모달 레이아웃
```
┌──────────────────────────────────────────────────────────┐
│ [✕ Close]  Curve Editor        [Arch][Ellipse] [Apply ✓] │
├─────────────────────────────────┬────────────────────────┤
│                                 │  Control Points (5)    │
│                                 │  #0  120, 80, 64  ✕   │
│       AXIAL VIEW (large)        │  #1  150, 80, 64  ✕   │
│   (click to add / drag to move) │  ...                  │
│   spline 실시간 표시             │  Thickness            │
│   (control points + 라인 강조)   │  ━━●━━━━ 3.0 mm       │
│                                 │                       │
│                                 │  Mode                 │
│                                 │  [min] [max] [mean]   │
│                                 │                       │
│                                 │  [↶ Undo] [↷ Redo]    │
├─────────────────────────────────┤  [Cancel]             │
│       PANO PREVIEW (real-time)  │  [Apply ✓]            │
│   (spline 따라 즉시 갱신)         │                       │
└─────────────────────────────────┴────────────────────────┘
```

### 4.6.3 인터랙션
- **Axial view**:
  - `mousedown`: hit test (threshold 20px) → 있으면 drag 시작, 없으면 새 점 추가
  - `mousemove` (drag 중): 점 이동
  - `click`: 새 점 추가 (단, drag 안 했을 때만)
  - hover: control point 강조 (8px)
  - selected: 10px + 색상 강조
- **Pano preview**: 곡선 변경/두께 변경 시 즉시 갱신 (preview 모드)
- **Apply**: state → Applied, 메인 Pano viewport에 최종 결과 반영, 모달 닫힘
- **Cancel**: state → Idle, 변경 폐기, 모달 닫힘

### 4.6.4 키보드
- **ESC**: 모달 닫기 (Cancel)
- **Cmd/Ctrl+Z**: Undo
- **Cmd/Ctrl+Shift+Z** (또는 Cmd/Ctrl+Y): Redo
- **Enter** (state가 Editing/Drawing일 때): Apply

### 4.6.5 단계
1. 헤더 "Curve Editor" 버튼 → 모달 오픈, Axial slice 가운데로 자동 스크롤
2. 큰 Axial에서 클릭으로 점 추가 또는 프리셋 선택
3. Pano preview가 실시간으로 결과 표시
4. Undo/Redo/두께/모드 미세 조정
5. Apply → 메인 Pano viewport에 결과, 모달 닫힘

### 4.6.6 모듈 변경
- HTML: `<div class="curve-editor-modal">` 추가, 헤더에 트리거 버튼 (이름: "Curve Editor")
- CSS: 풀스크린 모달 (position: fixed, inset: 0, z-index: 1000), 내부 grid
- `pano-wiring.ts`: 모달 open/close 로직, 키보드 핸들러, Axial 큰 canvas 렌더링, Pano preview
- `bindMprClick` hit threshold: 12 → 20

## 5. API 표면 (Public)

`src/pano/index.ts`에서 노출되는 신규 심볼. 다른 모듈에서 import 가능:
- `PanoramicCurve`, `FocalTrough`, `CurveEditorController`, `CurveEditorView`, `PanoView`, `PanoRenderer`

`src/app/layout-manager.ts` 확장:
- 새 클래스 `ViewLayoutManager` (또는 `LayoutManager` 확장)
  - `setRatio(region, ratio)`, `getRatio(region)`, `resetRatios()`, `maximize(target)`, `restore()`, `isMaximized()`
  - `onLayoutChange(cb)` 이벤트

`src/shared/interfaces/` 새 파일:
- `pano.ts`: `IPanoramicCurve`, `IFocalTrough`, `ICurveEditorController`, `ICurveEditorView`, `IPanoView`, `IPanoRenderer`
- `layout.ts`: `IViewLayoutManager`, `LayoutRegion`, `LayoutSnapshot`

---

## 6. 데이터 흐름

```
DICOM 로드
  → VolumeBuilder
  → volume → MPR (3 planes) + PanoRenderer + 3D Renderer

"Pano 그리기" 클릭
  → CurveEditorController.setState('Drawing')
  → CurveEditorView 활성화 (MPR 오버레이)

사용자 클릭 (MPR)
  → addPointFromCanvasPoint()
  → curve 변경 이벤트
  → CurveEditorView 다시 그림 (projection 갱신)
  → PanoRenderer 미리보기 (apply 전에는 흐리게)

"Apply" 클릭
  → controller.apply()
  → state = 'Applied'
  → FocalTrough.extract() (full resolution)
  → PanoView.setIntensityMap() → render
  → "Applied" 상태에서는 PanoView가 정식 표시
```

---

## 7. 위험 & 결정

| 위험 | 대응 |
|---|---|
| SaMD 규제 — 새 뷰포트 추가 = 의도된 사용 범위 확장 | CPR 자체는 기존 IU 안에서 진단 보조용으로 흡수 가능. 별도 Class 변경 불필요 예상. `docs/Intended_Use.md` 에 Pano view 1줄 추가만 진행 |
| WebGL 텍스처 한도 | Pano는 2D 캔버스 + ImageData로 처리 (WebGL 불필요). 3D와 독립 |
| Curve 잘못 정의 시 부정확한 진단 결과 | 상태머신 `Applied` 전까지는 `Preview` 워터마크. Pano 뷰포트 헤더에 "Preview" 라벨 명시 |
| Resize handle UX 미세 조정 필요 | 기본 비율 50/30/20 + 사용자 조정폭 `min: 100px`, `max: 80%` |
| 기존 4-grid → 새 layout 변경 시 회귀 | 기존 visualize/main.ts를 점진적으로 리팩터. TDD로 MPR/Volume/Patient/Input 단위 테스트는 그대로 통과해야 함 |

---

## 8. 의존성

- **신규 npm 의존성: 없음**. Catmull-Rom 보간, focal trough integration 모두 pure TS로 구현
- **기존 재사용**: `MPRView` (overlay만 추가), `OverlayRenderer`, `WLWWApplier`, `Camera`, `Input`, `Sync`

---

## 9. 수용 기준 (Acceptance Criteria)

1. ✅ Pano 뷰포트에 focal trough 두께 슬라이더로 즉시 결과 갱신
2. ✅ Curve Editor 패널 펼침/접힘 정상 작동
3. ✅ MPR 3-view 위에서 클릭으로 컨트롤 포인트 추가 → 다른 2-view에 즉시 projection
4. ✅ 프리셋(Ellipse/Arch) 곡선 즉시 적용
5. ✅ Undo/Redo 정상 작동
6. ✅ Resize handle로 3D↔하단, Pano↔MPR 비율 자유 조절 가능, double-click 리셋
7. ✅ Maximize 컨트롤로 한 뷰 전체화면, ESC/재클릭 복귀
8. ✅ WL/WW, R(reset), Threshold 단축키 모두 보존
9. ✅ 다크 테마 + 시안 액센트 일관성 유지
10. ✅ 단위 테스트 추가 (`src/pano/__tests__/`) — 각 모듈별 최소 5개 테스트
