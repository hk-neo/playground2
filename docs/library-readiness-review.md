# 라이브러리화 검토 리포트 — local-cbct-viewer

> 검토 대상: `/Users/fotogrammer/Projects/playground2`
> 검토일: 2026-08-28
> 검토 범위: TypeScript 소스 구조 / 빌드 / 의존성 / API 표면 / 제약사항

---

## 1. 프로젝트 개요 (1줄)

치과용 CBCT(Cone Beam CT) DICOM 영상을 브라우저에서 조회·분석하는 **의료기기 SaMD** (TypeScript + WebGL, 129 src / 49 test).

| 항목 | 값 |
|---|---|
| 패키지명 | `local-cbct-viewer` |
| 버전 | `0.1.0` (private) |
| 런타임 | 브라우저 (WebGL 필수, DOM 사용) |
| 번들러 | Vite (개발), `tsc` (프로덕션) |
| 모듈 시스템 | ESM only (`module: ESNext`) |
| 모듈 개수 | 16개 (`src/<module>/index.ts` 배럴) |

---

## 2. 현재 모듈 구성 (잘 분리되어 있음)

| 모듈 | 책임 | 외부 노출 가치 |
|---|---|---|
| `dicom` | DICOM 파싱/디코딩 (`neo-dicom-parser` 래핑) | ⭐⭐⭐ (재사용성 높음) |
| `volume` | 볼륨 인덱싱/보간/메모리풀 | ⭐⭐⭐ |
| `mpr` | 다평면 재구성 (Axial/Coronal/Sagittal) | ⭐⭐⭐ |
| `volume-renderer` | GPU 레이캐스팅 / 트랜스퍼펑션 / BBox | ⭐⭐ (WebGL 종속) |
| `rendering` | WebGL 컨텍스트/버퍼/텍스처/셰이더 매니저 | ⭐⭐ |
| `camera` | 궤도 카메라, 쿼터니언, 행렬 합성 | ⭐⭐⭐ (수학 유틸로도 가치) |
| `measurement` | 거리/각도/ROI 측정 툴 | ⭐⭐ |
| `overlay` | 오버레이 렌더링 (라인/각도/ROI) | ⭐⭐ |
| `input` | 마우스/터치/핀치/키보드 | ⭐ |
| `sync` | 뷰포트 동기화 (크로스헤어 등) | ⭐⭐ |
| `patient` | 환자 정보 추출/포맷 | ⭐⭐ |
| `security` | 네트워크 격리/캐시정책/감사로그/접근제어 | ⭐ (의료 규정용) |
| `encoding` | Transfer Syntax / VR / 문자 인코딩 | ⭐⭐ |
| `webgl` | WebGL 유틸 (버퍼/텍스처/셰이더) | ⭐ |
| `app` | ApplicationShell, LayoutManager (UI 셸) | ❌ (앱 전용) |
| `shared` | 타입/인터페이스/에러 | ⭐⭐ (타입 재노출) |

**핵심 평가: 모듈 경계는 이미 라이브러리 친화적** — 각 모듈이 자체 `index.ts` 배럴을 가지고 있어 그대로 재노출 가능.

---

## 3. 라이브러리화 적합성 평가

### 3.1 이미 갖춰진 것 ✅

1. **TypeScript strict + declaration emit**
   - `tsconfig.json`에 `declaration: true`, `declarationMap: true`, `sourceMap: true` 이미 설정됨
   - 다른 TS 프로젝트에서 `.d.ts`로 import 가능한 상태
2. **모듈별 배럴 export** — `src/{dicom,volume,mpr,...}/index.ts`
3. **테스트** — 49개 테스트 파일 (vitest)
4. **내부 의존성 단방향성** — `shared` ← 하위 모듈, `app` → 모든 모듈, 순환 없어 보임
5. **Pure TS / WebGL 캡슐화** — UI는 `src/visualize/main.ts` 한 곳에 격리됨

### 3.2 막혀 있는 것 ❌ (다른 앱에서 `npm install`로 못 쓰는 이유)

| # | 문제 | 영향 |
|---|---|---|
| 1 | `package.json`에 `private: true` | npm에 publish 자체가 안 됨 |
| 2 | `main` / `module` / `exports` / `files` 필드 없음 | 다른 프로젝트에서 import 경로를 모름 |
| 3 | **최상위 `src/index.ts` (또는 `src/lib/index.ts`) 없음** | 진입점이 `visualize/main.ts`(앱 셋업 코드)뿐 |
| 4 | 빌드 산출물 미생성 (`dist/` 없음, `pnpm build`가 `tsc`만 돌림) | `npm pack` 결과가 없음 |
| 5 | 의존성 `neo-dicom-parser`가 `github:NeobiotechLabs/...` Git 직접 참조 | 외부 조직이 받으려면 GitHub 권한 필요 |
| 6 | `peerDependencies` 미선언 (`vite`는 devDep인데 WebGL/DOM 사용하는 쪽이 책임져야 함) | 호스트 앱에서 중복 설치 / 충돌 위험 |
| 7 | DOM/WebGL을 생성자에서 직접 사용 (e.g. `new LayoutManager()`가 `ResizeObserver` 가정) | SSR/Node/React Native에서 import만 해도 깨질 수 있음 |
| 8 | **의료기기 SaMD**로 분류 진행 중 (Intended Use/Classification 문서 존재) | 일반 OSS처럼 "그냥 publish"는 규제 리스크 |

---

## 4. 어떤 형태로 다른 앱에서 쓸 수 있는가

3가지 시나리오가 가능하며, 권장 순서대로 정리:

### 시나리오 A — **"모듈 단위로 부분 재사용"** (가장 쉬움, 즉시 가능)

CBCT 뷰어 전체를 한 덩어리로 가져오는 게 아니라, **DICOM 파싱·볼륨 인덱싱·MPR/카메라 수학** 같은 잘 분리된 모듈만 골라 import.

```ts
// host-app
import { DicomFileLoader, DicomTagReader, PixelDataDecoder } from 'local-cbct-viewer/dicom';
import { VolumeBuilder, VolumeIndexer } from 'local-cbct-viewer/volume';
import { SliceExtractor } from 'local-cbct-viewer/mpr';
import { OrbitalCamera, QuaternionOps, MatrixComposer } from 'local-cbct-viewer/camera';
import { TransferSyntaxRegistry } from 'local-cbct-viewer/encoding';
```

**장점**: UI/레이아웃 의존성 없이 호스트 앱이 자체적으로 뷰포트 렌더링을 조립.
**적합 대상**: 사내 다른 의료 SW, PACS 뷰어, AI 전처리 파이프라인.

→ 이 시나리오를 위해서는 **모듈별 경로 export**만 추가하면 됨 (작업량 최소).

### 시나리오 B — **"라이브러리 패키지" (단일 진입점)**

`src/index.ts`를 신설해 `ApplicationShell` + 핵심 렌더러를 묶어서 노출.

```ts
import { CBCTViewer } from 'local-cbct-viewer';
await viewer.mount('#root', { files: dicomFiles });
```

**장점**: 호스트 앱은 `<div id="root">`만 준비하면 됨.
**단점**: 디자인 시스템(헤더, 컨트롤 패널)이 `index.html`에 하드코딩돼 있어 호스트 앱의 룩앤필과 충돌. `index.html`에 박힌 약 700여 줄의 CSS를 토큰화하지 않으면 거의 재구현 필요.

### 시나리오 C — **"Web Component / Custom Element 래퍼"** (장기 권장)

`src/visualize/main.ts`의 DOM 의존을 떼어내 `<cbct-viewer>` 커스텀 엘리먼트로 래핑. React/Vue/Svelte 어디서든 사용 가능.

```html
<cbct-viewer src="/dicom-folder" theme="dark"></cbct-viewer>
```

**장점**: 프레임워크 중립, 호환성 최고, 헤더/컨트롤 슬롯화로 룩앤필 통합 가능.
**단점**: ApplicationShell/StateManager의 의존성 주입 구조를 좀 더 정돈해야 함.

---

## 5. 의료기기(SaMD) 규제 측면 — 반드시 짚어야 함

이 프로젝트는 `Intended Use`/`Classification` 문서가 있고 **의료기기 소프트웨어로 분류 진행 중**입니다.
따라서 다른 앱에서 "라이브러리처럼" 쓴다는 것은 곧 **SaMD를 구성품으로 재배포**하는 행위가 될 수 있습니다.

- **호스트 앱도 SaMD에 해당될 가능성** → 그 호스트 앱도 별도 Intended Use·IEC 62304 클래스 분류가 필요
- **감사로그(`AuditTrailLogger`)·데이터 폐기(`SecureDataDisposal`)는 의도된 사용 범위 안에서 검증된 동작** — 다른 UI 흐름에서 호출하면 검증 갱신이 필요
- 일반 OSS처럼 무심코 npm publish 하면 **규제 미준수 리스크**

> 권장: 사내/계약된 의료기기 시스템 간에만 "내부 패키지"로 배포 (시나리오 A). 외부 공개/범용화는 규제 검토 후 진행.

---

## 6. 권장 작업 (우선순위)

### 즉시 가능 (1~2일)
1. `package.json`에서 `private: true` 제거하고 `name`을 라이브러리 의도에 맞게 변경 (예: `@neobiotech/cbct-core`).
2. `package.json`에 `main`/`module`/`types`/`exports` 필드 추가 — 모듈별 서브패스 export:
   ```json
   {
     "main": "./dist/index.js",
     "module": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
       "./dicom":   "./dist/dicom/index.js",
       "./volume":  "./dist/volume/index.js",
       "./mpr":     "./dist/mpr/index.js",
       "./camera":  "./dist/camera/index.js",
       "./encoding":"./dist/encoding/index.js"
     },
     "files": ["dist", "README.md", "LICENSE"]
   }
   ```
3. `tsconfig.build.json` 추가: `rootDir: src`, `outDir: dist`, `composite: false` — 테스트/Vitest용과 분리.
4. `src/index.ts`(최상위 배럴) 추가: 시나리오 B 진입점 + `export * from './shared'`.
5. `peerDependencies` 선언: 없으면 `vite` 같은 빌드 의존만 dev로 유지.

### 중기 (1~2주)
6. **DOM 격리**: `LayoutManager`/`ApplicationShell`이 직접 `ResizeObserver`/`document`를 만지는 부분을 인터페이스화 (옵션 A: 호스트가 주입, 옵션 B: lazy require).
7. **WebGL 컨텍스트 캡슐화**: `WebGLContextFactory`는 이미 있으니, 렌더러들이 `HTMLCanvasElement`를 직접 받도록 통일.
8. `neo-dicom-parser`를 Git 참조 → 사내 레지스트리(Verdaccio/Nexus) 또는 scoped npm 패키지로 이전.
9. **예제 호스트 앱** 1개 (Vite + TS) — `examples/host-react/` 등으로 "이렇게 import해서 쓴다"를 보여줌.

### 장기
10. 시나리오 C(Web Component) 검토 — React/Vue 호스트 모두 수용.
11. CHANGELOG / SemVer 정책 / Public API 가드(API Extractor 등) 도입.
12. 의료기기 재사용 시 별도 V&V(Verification & Validation) — `docs/risk-management-report.md` 갱신.

---

## 7. 한 줄 결론

> **모듈 구조와 타입 정의는 이미 라이브러리급으로 잘 짜여 있다.** 다만 `package.json`의 publish 메타데이터, 최상위 진입점, 빌드 산출물, 그리고 **SaMD 규제 검토**만 채우면 사내 다른 의료 앱에서는 **부분 재사용(시나리오 A)** 이라고 당장 쓸 수 있고, 외부 공개는 규제/패키징 작업이 더 필요합니다.
