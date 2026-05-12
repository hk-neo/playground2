# AutoDevAgent 개발 워크플로우

## 로컬 CBCT 웹 뷰어 프로젝트를 통해 검증된 전체 라이프사이클

---

## 1. 시스템 아키텍처

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Jira Cloud │◄────│ AutoDevAgent │────►│   GitHub    │
│  (이슈 추적)  │     │   (AI Agent)  │     │ (형상 관리)  │
└─────────────┘     └──────┬───────┘     └─────────────┘
       ▲                    │                     ▲
       │              ┌─────┴──────┐              │
       │              │  AI Engine  │              │
       │              │ (Claude/GLM)│              │
       │              └────────────┘              │
       │                                          │
   !command 입력                          코드/문서 Push
```

### 핵심 구성 요소

| 구성 요소 | 역할 | 기술 |
|----------|------|------|
| Jira Cloud | 이슈 추적, 명령어 입력, 추적성 관리 | Atlassian Cloud API |
| AutoDevAgent | AI 에이전트 프레임워크, 스킬 실행 | Python, Goose Framework |
| AI Engine | 문서 생성, 코드 구현, 분석 | Claude API / GLM API |
| GitHub | 소스 코드 및 문서 형상 관리 | Git, Submodule |

---

## 2. IEC 62304 V-Model 라이프사이클

```
     요구사항          ────────→         시스템 테스트
       ▲                                  │
       │  검증                             │
       │                                   ▼
   아키텍처 설계       ────────→       통합 테스트
       ▲                                  │
       │  검증                             │
       │                                   ▼
   상세 설계           ────────→       단위 검증
       ▲                                  │
       │                                   │
       └─────────── 구현 ─────────────────┘


   PA Phase (좌측)                  EA Phase (우측)
   ───────────────                  ───────────────
   IU → SyRS → 분류                  RMR → SRS → SAD → SDS
   SW개발계획                         → 모듈설계 → 태스크
   위험관리계획                         → 구현
```

---

## 3. 전체 워크플로우 다이어그램

```
 Phase 0          Phase 1: PA             Phase 2: EA            Phase 3: 구현
 ─────────        ──────────              ──────────             ──────────

 ┌─────────┐    ┌──────────────┐      ┌──────────────┐       ┌──────────────┐
 │프로젝트   │    │   PA Gate    │      │   EA Gate    │       │  구현 반복    │
 │초기화    │───►│  !create-subs│──►   │  !create-subs│──►    │   루프       │
 └─────────┘    └──────┬───────┘      └──────┬───────┘       └──────┬───────┘
     │                 │                      │                       │
     │           ┌─────┴─────┐          ┌────┴────┐            ┌────┴────┐
     │           ▼           ▼          ▼         ▼            ▼         ▼
     │       ┌───────┐  ┌───────┐  ┌──────┐ ┌──────┐    ┌──────┐ ┌──────┐
     │       │IU Doc │  │SyRS   │  │RMR   │ │SRS   │    │!plan │ │!trace│
     │       │!gen   │  │Doc    │  │Doc   │ │Doc   │    │      │ │ability│
     │       └───┬───┘  └──┬───┘  └──┬───┘ └──┬───┘    └──┬───┘ └──────┘
     │           │         │         │        │            │
     │           ▼         ▼         ▼        ▼            ▼
     │       ┌─────────────────────────────────────┐  ┌────────────┐
     │       │!create-subs → IU, SR 티켓 생성      │  │!implement  │
     │       │!generate → 문서 자동 생성             │  │코드 작성    │
     │       └─────────────────────────────────────┘  │테스트 수행   │
 setup_project.py                                       │Git 커밋    │
 .env 설정                                              └─────┬──────┘
 .claude/commands/                                              │
     │                                                          │
     └──────────────────────────────────────────────────────────┘
```

---

## 4. Phase별 상세 워크플로우

### 4.1 Phase 0: 프로젝트 초기화

```bash
# 대상 프로젝트에 AutoDevAgent 서브모듈 추가
python3 AutoDevAgent/setup/setup_project.py --project PLAYG --repo /path/to/project
```

**생성 산출물:**

| 파일 | 용도 |
|------|------|
| `AutoDevAgent/` | Git 서브모듈 (에이전트 본체) |
| `.claude/commands/implement.md` | Claude Code 구현 커맨드 |
| `.env` | Jira 인증 정보 (수동 편집) |
| `.gitignore` | .env 제외 규칙 추가 |

---

### 4.2 Phase 1: PA Gate (제품 분석)

**명령어 순서:**

```
PA Gate 티켓
  │
  ├─ !create-subs ──→ 7개 Document 티켓 자동 생성
  │                     ├── Intended Use
  │                     ├── System Requirement Specification
  │                     ├── Classification
  │                     ├── SW Development Plan
  │                     ├── Risk Management Plan
  │                     ├── Security Maintenance Plan
  │                     └── Configuration Management Plan
  │
  ├─ [Intended Use Doc] ──► !create-subs ──► IU 티켓 생성
  │                                      └─► !generate ──► docs/intended-use.md
  │
  ├─ [SyRS Doc] ──► !create-subs ──► System Requirement 티켓들 생성
  │                                 (SR-001 ~ SR-013, 총 13건)
  │
  ├─ [Classification Doc] ──► !create-subs ──► Classification 티켓 (자동 분류)
  │
  └─ [각 Plan Doc] ──► !generate ──► docs/sw-dev-plan.md 등 자동 생성
```

**실제 프로젝트 결과:**

| 산출물 | Jira 키 | 상태 |
|--------|---------|------|
| Intended Use | PLAYG-1962 | 완료 |
| System Requirement Specification | PLAYG-1963 | 완료 |
| Classification (Class A, II급) | PLAYG-1964 | 완료 |
| SW Development Plan | PLAYG-1965 | 완료 |
| Risk Management Plan | PLAYG-1966 | 완료 |
| Security Maintenance Plan | PLAYG-1967 | 완료 |
| Configuration Management Plan | PLAYG-1968 | 완료 |
| System Requirements (13건) | PLAYG-1970~1982 | 완료 |

---

### 4.3 Phase 2: EA Gate (엔지니어링 분석)

**명령어 순서:**

```
EA Gate 티켓
  │
  ├─ !create-subs ──→ 4개 Document 티켓 생성
  │                     ├── Risk Management Report
  │                     ├── SW Requirements Specification
  │                     ├── SW Architecture Document
  │                     └── SW Detailed Design Document
  │
  ├─ [RMR Doc] ──► !create-subs ──► Hazard 티켓 생성
  │                                   (위험 분석, severity/P1/P2 자동 설정)
  │
  ├─ [SRS Doc] ──► !create-subs ──► Requirement 티켓 생성
  │                                  (Hazard Mitigates, SyRS Implements)
  │               ──► !generate ──► docs/srs.md
  │
  ├─ [SAD Doc] ──► !create-subs ──► Architecture 티켓 생성
  │               ──► !generate ──► docs/sad.md
  │
  └─ [SDS Doc] ──► !create-subs-sds ──► Module 설계 티켓 생성 (8~15개)
                   ──► !generate ──► docs/sds.md
                   ──► !create-tasks ──► Task 티켓 생성 (Bottom-Up 6 Phase)
```

**실제 프로젝트 결과:**

| 단계 | 산출물 | 티켓 수 |
|------|--------|---------|
| RMR | Hazard 분석 | 3건 (PLAYG-2231~2234) |
| SRS | SW 요구사항 명세서 | 3건 (PLAYG-2277~2279) |
| SAD | 아키텍처 (ARCH-001~007) | 7건 |
| SDS | 상세 설계 모듈 (MOD-001~014) | 14건 |
| Tasks | 구현 태스크 (TASK-001~017) | 17건 |

---

### 4.4 Phase 3: 구현

**태스크별 워크플로우:**

```
Task 티켓 (예: PLAYG-2374 카메라 시스템)
  │
  ├─ 상위 연결: MOD-007 (설계) ──Implements──► SR-004 (요구사항)
  │
  ├─ !plan ──► plan.md 생성 (범위, 순서, 테스트 전략)
  │
  ├─ !implement ──► 코드 구현
  │                   ├── src/camera/orbital-camera.ts
  │                   ├── src/camera/quaternion-ops.ts
  │                   ├── src/camera/matrix-composer.ts
  │                   ├── __tests__/camera.test.ts (29 tests)
  │                   └── git commit "[PLAYG-2374] Implement: 카메라 시스템"
  │
  └─ Jira 상태 → Done, 완료 코멘트 자동 등록
```

**실제 구현 결과 (17개 태스크):**

| TASK | 모듈 | 테스트 | 상태 |
|------|------|--------|------|
| PLAYG-2374 | 카메라 시스템 (MOD-007) | 29 tests | 완료 |
| PLAYG-2375 | 입력 핸들러 (MOD-008) | 29 tests | 완료 |
| PLAYG-2376 | 측정 도구 엔진 (MOD-009) | 41 tests | 완료 |
| PLAYG-2377 | 오버레이 렌더러 (MOD-010) | 22 tests | 완료 |
| PLAYG-2378 | 환자 데이터 매니저 (MOD-011) | 21 tests | 완료 |
| PLAYG-2379 | 뷰포트 동기화 (MOD-012) | 17 tests | 완료 |
| PLAYG-2380 | 보안 및 감사 (MOD-013) | 21 tests | 완료 |
| PLAYG-2381 | 애플리케이션 셸 (MOD-014) | 26 tests | 완료 |
| PLAYG-2382 | UX/UI 개선 | 통합 테스트 | 완료 |

---

## 5. 추적성 (Traceability)

### 5.1 전체 추적성 체인

```
IU (Intended Use)
 └── SyRS (System Requirement)
      ├── Hazard ◄── "arises from"
      │    └── Requirement ◄── "Mitigates" (위험 완화)
      │         └── Architecture ◄── "Implements"
      │              └── Module (Detailed Design) ◄── "Implements"
      │                   └── Task ◄── "Implements"
      │
      └── Requirement
           └── Architecture
                └── Module
                     └── Task


 직접 추적: SyRS ══════════════════════════════════► Task
           (Implements 링크로 요구사항→구현 직접 연결)
```

### 5.2 링크 타입 정의

| 출발 | 링크 타입 | 도착 | 의미 |
|------|-----------|------|------|
| Document | Blocks | Gate | Gate 완료 조건 |
| System Req | Relates | SyRS Document | 요구사항-문서 연결 |
| Hazard | Risk Source | IU/SyRS | 위험 도출 근거 |
| Requirement | Mitigates | Hazard | 위험 완화 조치 |
| Requirement | Implements | System Req | 요구사항 구현 |
| Architecture | Implements | Requirement | 아키텍처가 요구사항 구현 |
| Module | Implements | Architecture | 모듈이 아키텍처 구현 |
| Module | Implements | Requirement | 모듈이 요구사항 구현 |
| Task | Implements | Module | 태스크가 설계 구현 |
| Task | Implements | SyRS | 요구사항 직접 추적 |
| Task | Relates | SDS Document | 설계 문서 참조 |
| Task | Blocks | Task | 의존성 |

### 5.3 추적성 검증 명령어

```
!traceability               # 현재 티켓 링크 상태
!traceability --find-missing # Gate 내 누락 링크 탐지
!traceability --fix          # 누락 링크 자동 생성
!traceability --project      # 전체 프로젝트 현황 리포트
```

---

## 6. 명령어 레퍼런스

### 전체 명령어

| 명령어 | 위치 | 대상 티켓 타입 | 설명 |
|--------|------|---------------|------|
| `!create-subs` | Jira 코멘트 | Gate, Document | 하위 티켓 생성 |
| `!create-subs-sds` | Jira 코멘트 | SDS Document | 모듈 설계 티켓 생성 |
| `!create-tasks` | Jira 코멘트 | SDS Document | 구현 태스크 생성 |
| `!generate` | Jira 코멘트 | Document, SR | 문서 자동 생성 |
| `!plan` | Jira 코멘트 | Task | 구현 계획 수립 |
| `!implement` | Jira 코멘트 / Claude Code | Task | 코드 구현 |
| `!traceability` | Jira 코멘트 | 모든 티켓 | 추적성 검증 |
| `!update` | Jira 코멘트 | 모든 티켓 | 티켓 내용 수정 |
| `!help` | Jira 코멘트 | 모든 티켓 | 도움말 |

### 실행 환경

| 환경 | 명령어 | 실행 방식 |
|------|--------|----------|
| Jira 코멘트 | `!command` | Goose Agent가 Jira Webhook 감지 후 실행 |
| Claude Code CLI | `/implement TICKET` | 로컬 Claude Code가 jira_toolkit 직접 호출 |

---

## 7. 산출물 통계 (CBCT 웹 뷰어 프로젝트)

### 문서 산출물

| 산출물 | 경로 | Phase |
|--------|------|-------|
| Intended Use | `docs/intended-use.md` | PA |
| System Requirement Specification | `docs/srs.md` | PA |
| Classification | Jira 티켓 | PA |
| SW Development Plan | `docs/sw-dev-plan.md` | PA |
| Risk Management Plan | `docs/risk-management-plan.md` | PA |
| Security Maintenance Plan | `docs/security-maintenance-plan.md` | PA |
| Configuration Management Plan | `docs/config-management-plan.md` | PA |
| SW Architecture Document | `docs/sad.md` | EA |
| SW Detailed Design Document | `docs/sds.md` | EA |

### 코드 산출물

| 모듈 | 경로 | 테스트 |
|------|------|--------|
| DICOM Parser | `src/dicom/` | 포함 |
| Transfer Syntax | `src/encoding/` | 포함 |
| MPR Renderer | `src/mpr/` | 포함 |
| WebGL Texture | `src/webgl/` | 포함 |
| Camera System | `src/camera/` | 29 tests |
| Input Handler | `src/input/` | 29 tests |
| Measurement Tools | `src/measurement/` | 41 tests |
| Overlay Renderer | `src/overlay/` | 22 tests |
| Patient Data | `src/patient/` | 21 tests |
| Viewport Sync | `src/sync/` | 17 tests |
| Security Module | `src/security/` | 21 tests |
| Application Shell | `src/app/` | 26 tests |

**총 테스트: 200+ 개, TypeScript strict mode, 빌드 에러 0**

---

## 8. 워크플로우 요약 (발표용 한 장)

```
┌────────────────────────────────────────────────────────────────────┐
│                    AutoDevAgent 워크플로우                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Jira 코멘트로 !명령어 입력 → AI가 자동으로 문서/코드 생성           │
│                                                                    │
│  Phase 1 (PA)         Phase 2 (EA)          Phase 3 (구현)         │
│  ┌──────────┐        ┌──────────┐         ┌──────────┐            │
│  │ Gate     │──────► │ Gate     │────────►│ Task     │            │
│  │!create   │        │!create   │         │!plan     │            │
│  │!generate │        │!generate │         │!implement│            │
│  │ IU, SyRS │        │ RMR, SRS │         │ 코드 구현 │            │
│  │ 분류,계획 │        │ SAD, SDS │         │ 테스트   │             │
│  └──────────┘        └──────────┘         └──────────┘            │
│       │                    │                    │                   │
│       └──────── 추적성 ─────┴────────────────────┘                  │
│                                                                    │
│  핵심 가치:                                                        │
│  • IEC 62304 준수 자동화                                           │
│  • 전체 추적성 체인 보장 (SyRS → MOD → TASK)                       │
│  • AI 기반 문서/코드 일관성 유지                                    │
│  • Jira + GitHub 양방향 연동                                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```
