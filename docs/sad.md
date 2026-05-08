# Software Architecture Document
## 로컬 CBCT 웹 뷰어

### 문서 정보

| 항목 | 내용 |
|------|------|
| 문서 ID | PLAYG-2154 |
| 문서명 | Software Architecture Document |
| 제품명 | 로컬 CBCT 웹 뷰어 (Local CBCT Web Viewer) |
| 프로젝트 | PLAYG |
| Phase | EA |
| 버전 | 1.0 |
| 작성일 | 2026-05-08 |
| 상태 | Drafting |

---

## 1. 소개

### 1.1 목적

본 문서는 "로컬 CBCT 웹 뷰어" 소프트웨어의 소프트웨어 아키텍처 문서(Software Architecture Document)로서, 소프트웨어 요구사항 명세서(SRS, PLAYG-2153)에 정의된 요구사항을 만족하기 위한 소프트웨어 아키텍처를 정의한다. IEC 62304에 부합하는 SAD 구조로 작성되었다.

### 1.2 범위

본 문서는 다음 사항을 다룬다:

- 아키텍처 스타일 및 고수준 구조
- 7개 아키텍처 컴포넌트의 설계 (ARCH-001 ~ ARCH-007)
- 데이터 아키텍처 및 데이터 흐름
- 외부/내부 인터페이스 설계
- 요구사항 추적성 매트릭스

**적용 제외 대상**:
- 상세 설계(SDS) 수준의 클래스/함수 명세
- 알고리즘 의사코드 수준의 상세 구현
- 테스트 케이스 및 검증 절차

### 1.3 참조 문서

| 참조 번호 | 문서명 | 경로/비고 |
|-----------|--------|-----------|
| REF-001 | Intended Use | docs/Intended_Use.md (PLAYG-1969) |
| REF-002 | Software Requirements Specification | docs/srs.md (PLAYG-2153) |
| REF-003 | EA Gate | PLAYG-2004 |
| REF-004 | ARCH-001 Rendering Pipeline Architecture | PLAYG-2299 |
| REF-005 | ARCH-002 Camera & Interaction Architecture | PLAYG-2300 |
| REF-006 | ARCH-003 Analysis Tools Architecture | PLAYG-2301 |
| REF-007 | ARCH-004 Data Layer Architecture | PLAYG-2302 |
| REF-008 | ARCH-005 Viewport Synchronization Architecture | PLAYG-2303 |
| REF-009 | ARCH-006 Security Architecture | PLAYG-2304 |
| REF-010 | ARCH-007 Frontend Application Architecture | PLAYG-2305 |

---

## 2. 아키텍처 개요

### 2.1 아키텍처 스타일

본 소프트웨어는 **클라이언트 단일 계층(Client-Side Monolithic) 아키텍처**를 채택한다. 서버 구성 요소가 없으며, 모든 데이터 처리와 렌더링은 사용자의 웹 브라우저 내에서 수행된다.

**핵심 아키텍처 특성**:
- **실행 환경**: 웹 브라우저 (Chrome, Edge 최신 버전)
- **렌더링 엔진**: WebGL 2.0 기반 GPU 가속
- **데이터 소스**: 사용자 로컬 파일 시스템의 DICOM 파일
- **네트워크**: 인터넷 연결 불필요 (완전 오프라인 동작)
- **보안 모델**: 로컬 전용, 외부 네트워크 전송 원천 차단

### 2.2 고수준 구조도

```
┌──────────── Frontend Application (ARCH-007) ──────────────────┐
│  Application Shell (SPA)                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Component Layer                                         │  │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐             │  │
│  │  │  Viewport  │ │ Tool Panel│ │ Info Panel│             │  │
│  │  │ (MPR + 3D)│ │(측정/ROI) │ │(환자정보) │             │  │
│  │  └───────────┘ └───────────┘ └───────────┘             │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  State Management (중앙 집중식)                     │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘

┌───────────── Rendering Pipeline (ARCH-001) ──────────────────┐
│  ┌── Tier 1 ──┐  ┌── Tier 2 ──┐  ┌── Tier 3 ──┐           │
│  │Data Parsing│  │   Volume   │  │GPU Rendering│           │
│  │- 매직바이트 │  │Processing  │  │- MPR 단면   │           │
│  │- 필수태그   │  │- ArrayBuf  │  │- Ray Casting│           │
│  │- 전송구문   │  │- 512³ 인덱싱│  │- 전송함수   │           │
│  │- 픽셀디코드 │  │- 보간알고리즘│  │- 불투명도   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└────────────────────────────────────────────────────────────────┘

┌───────── Camera & Interaction (ARCH-002) ────────────────────┐
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │Camera Model│  │Input Handler│  │ Windowing  │            │
│  │(궤도형)     │  │(마우스/터치)│  │  System    │            │
│  │쿼터니언회전 │  │ 입력추상화  │  │ WL/WW매핑  │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└────────────────────────────────────────────────────────────────┘

┌──────────── Analysis Tools (ARCH-003) ───────────────────────┐
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Coordinate │  │    Tool    │  │   Overlay  │            │
│  │   Mapper   │  │  Registry  │  │  Renderer  │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└────────────────────────────────────────────────────────────────┘

┌────────────── Data Layer (ARCH-004) ─────────────────────────┐
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │File Access │  │DICOM Parser│  │Patient Data│            │
│  │   Layer    │  │            │  │  Manager   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Memory Manager                      │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘

┌───────── Viewport Synchronization (ARCH-005) ────────────────┐
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Event Bus  │  │Coordinate  │  │    Sync    │            │
│  │ (Pub/Sub)  │  │Transformer │  │ Controller │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└────────────────────────────────────────────────────────────────┘

┌─────────── Security Architecture (ARCH-006) ─────────────────┐
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Network   │  │   Cache    │  │   Access   │            │
│  │ Isolation  │  │   Policy   │  │  Control   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Audit Trail                        │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 아키텍처 결정 사항

| 결정 사항 | 선택 | 근거 |
|-----------|------|------|
| 실행 환경 | 웹 브라우저 SPA | 별도 설치 없이 접근성 극대화 (SW-REQ-011) |
| 렌더링 기반 | WebGL 2.0 | 브라우저 내 GPU 가속 렌더링을 위한 유일한 표준 옵션 |
| 데이터 처리 | 전체 로컬 처리 | 환자 데이터 보안 요구사항 (SW-REQ-012) |
| 카메라 모델 | 쿼터니언 기반 궤도형 | 수치 안정성 및 Gimbal Lock 방지 (SW-REQ-004) |
| 뷰 동기화 | 이벤트 버스 (Pub/Sub) | 뷰포트 간 느슨한 결합으로 독립적 렌더링 보장 (SW-REQ-009) |
| 상태 관리 | 중앙 집중식 | 뷰포트 간 일관된 상태 유지 및 동기화 |
---

## 3. 모듈 설계

### 3.1 ARCH-001: 렌더링 파이프라인 아키텍처

**Jira 티켓**: PLAYG-2299
**관련 요구사항**: SW-REQ-001, SW-REQ-002, SW-REQ-003, SW-REQ-005, SW-REQ-010

#### 3.1.1 책임

DICOM 데이터 파싱부터 MPR/3D 볼륨 렌더링까지의 전체 데이터 흐름을 관리한다. 3-티어 구조로 데이터 파싱, 볼륨 처리, GPU 렌더링을 독립적으로 분리하여 테스트 및 최적화를 가능하게 한다.

#### 3.1.2 구성 요소

| Tier | 구성 요소 | 역할 |
|------|-----------|------|
| Tier 1 | Data Parsing Layer | DICOM 파일 로드, 매직 바이트 검증, 필수 태그 파싱, 전송 구문 확인, 픽셀 데이터 디코딩, 무결성 검증 |
| Tier 2 | Volume Processing Layer | ArrayBuffer 기반 볼륨 데이터 구성, 512³ 볼륨 인덱싱, 보간(Interpolation) 알고리즘 적용, 점진적 로딩(Progressive Loading) 지원 |
| Tier 3 | GPU Rendering Layer | WebGL 2.0 셰이더 기반 MPR 단면 생성(Axial/Coronal/Sagittal), Ray Casting 기반 3D 볼륨 렌더링, 전송 함수(Transfer Function)를 통한 불투명도/색상 매핑 |

#### 3.1.3 인터페이스

- **입력**: DICOM 파일(로컬 파일 시스템)
- **출력**: MPR 3단면 영상, 3D 볼륨 렌더링 결과
- **내부 인터페이스**: Tier 1 → Tier 2 (파싱된 데이터 전달), Tier 2 → Tier 3 (볼륨 텍스처 전달)

#### 3.1.4 의존성

- ARCH-004 (Data Layer): DICOM 파일 로드 및 파싱 의존
- ARCH-007 (Frontend Application): 렌더링 결과 표시를 위한 UI 컴포넌트 의존
- WebGL 2.0 API: GPU 렌더링을 위한 외부 인터페이스 의존

#### 3.1.5 설계 결정 사항

- **WebGL 2.0 선택**: 브라우저 내 GPU 가속 렌더링을 위한 유일한 표준 옵션
- **3-티어 분리**: 데이터 파싱, 볼륨 처리, 렌더링의 독립적 테스트 및 최적화 가능
- **점진적 로딩**: 대용량 볼륨 데이터의 초기 응답성 보장 (SW-REQ-010-05)
- **보간 알고리즘**: 이중선형/삼중선형 보간으로 해부학적 구조 왜곡 방지 (SW-REQ-002-03)

---

### 3.2 ARCH-002: 카메라 및 인터랙션 아키텍처

**Jira 티켓**: PLAYG-2300
**관련 요구사항**: SW-REQ-004, SW-REQ-005

#### 3.2.1 책임

3D 볼륨 렌더링 뷰의 카메라 시스템과 사용자 입력(마우스/터치) 처리를 담당한다. 궤도형 카메라 모델을 기반으로 회전, 확대/축소, 팬 기능을 제공하며, WL/WW 제어를 통한 영상 밝기/대비 조절을 통합 관리한다.

#### 3.2.2 구성 요소

| 구성 요소 | 역할 |
|-----------|------|
| Camera Model | 궤도형(Orbital) 카메라 모델 - 타겟 중심 회전, 줌(확대/축소), 팬(Pan) 지원. 쿼터니언(Quaternion) 기반 회전으로 수치 오차 누적 방지, 뷰 리셋 시 초기 카메라 상태 복원 |
| Input Handler | 마우스 드래그(회전), 스크롤(줌), 터치(핀치/팬) 입력을 통합 처리하는 입력 추상화 계층 |
| Matrix Composer | 뷰 행렬(View Matrix) 및 투영 행렬(Projection Matrix) 계산 |
| Windowing System | WL/WW 값을 통한 픽셀-휘도 선형 매핑, CBCT 기본값 사전 설정, 한계값(Clipping) 처리, 뷰 간 WL/WW 일관성 유지 |

#### 3.2.3 인터페이스

- **입력**: 마우스/터치 입력 이벤트
- **출력**: 카메라 행렬(View/Projection Matrix)
- **내부 인터페이스**: Input Handler → Camera Model (입력 변환), Windowing System → Rendering Pipeline (WL/WW 적용)

#### 3.2.4 의존성

- ARCH-001 (Rendering Pipeline): 카메라 행렬을 GPU 렌더링 계층에 전달
- ARCH-007 (Frontend Application): 사용자 입력 이벤트 수신

#### 3.2.5 설계 결정 사항

- **쿼터니언 기반 회전**: 오일러 각도의 Gimbal Lock 문제 방지 및 수치 안정성 확보 (SW-REQ-004-03)
- **입력 추상화 계층**: 마우스/터치 입력의 통합 처리로 크로스 플랫폼 대응 (SW-REQ-004-04)
- **WL/WW 통합**: 렌더링 파이프라인 내에서 밝기/대비 제어를 일관되게 적용 (SW-REQ-005-06)

---

### 3.3 ARCH-003: 분석 도구 아키텍처

**Jira 티켓**: PLAYG-2301
**관련 요구사항**: SW-REQ-006, SW-REQ-007

#### 3.3.1 책임

MPR 단면 영상 위에 오버레이되는 측정 및 분석 도구(거리 측정, 각도 측정, ROI 표시)의 아키텍처를 정의한다. 오버레이 패턴을 통해 측정 도구를 렌더링 계층과 분리하여 독립적 렌더링을 보장한다.

#### 3.3.2 구성 요소

| 구성 요소 | 역할 |
|-----------|------|
| Coordinate Mapper | 화면 좌표(Screen) ↔ 볼륨 좌표(Volume) 간 양방향 변환, DICOM Pixel Spacing 기반 mm 단위 변환, 해상도 변경 시 좌표 일관성 유지 |
| Tool Registry | 측정 도구 유형(거리/각도/ROI) 등록 및 관리, 도구 간 전환 및 활성/비활성 상태 관리 |
| Overlay Renderer | 측정선/각도선/ROI 영역을 MPR 단면 위에 오버레이 렌더링, 단면 이동 시 해당 단면에 맞는 오버레이 표시 |
| Result Display | 측정 결과값(거리 mm, 각도 degree)을 소수점 둘째 자리까지 실시간 표시 |

#### 3.3.3 인터페이스

- **입력**: 사용자 클릭/드래그 이벤트 (화면 좌표)
- **출력**: 측정 결과값(mm, degree), 오버레이 그래픽
- **내부 인터페이스**: Coordinate Mapper → Tool Registry → Overlay Renderer → Result Display

#### 3.3.4 의존성

- ARCH-001 (Rendering Pipeline): MPR 단면 영상 위에 오버레이 표시
- ARCH-004 (Data Layer): DICOM Pixel Spacing 정보 참조

#### 3.3.5 설계 결정 사항

- **오버레이 패턴**: 측정 도구를 렌더링 계층과 분리하여 독립적 렌더링
- **Pixel Spacing 우선 적용**: DICOM 메타데이터의 측정 정확성 보장, 누락 시 경고 표시 (SW-REQ-006-02)
- **도구 레지스트리 패턴**: 새로운 분석 도구 추가 시 확장 가능한 구조
---

### 3.4 ARCH-004: 데이터 계층 아키텍처

**Jira 티켓**: PLAYG-2302
**관련 요구사항**: SW-REQ-001, SW-REQ-008

#### 3.4.1 책임

DICOM 파일의 로컬 로드, 환자 메타데이터 파싱/관리, 세션 데이터 관리를 위한 데이터 계층 아키텍처이다. 서버 없이 모든 데이터 처리를 브라우저 내에서 수행한다.

#### 3.4.2 구성 요소

| 구성 요소 | 역할 |
|-----------|------|
| File Access Layer | 브라우저 File API 기반 로컬 파일 접근. 서버 없이 클라이언트에서 직접 파일 로드 |
| DICOM Parser | 매직 바이트('DICM') 검증, 필수 태그 추출(Patient ID, Study Instance UID 등), 다양한 전송 구문(Transfer Syntax) 지원, 다양한 문자 인코딩(ASCII, UTF-8, ISO-2022-JR) 호환 |
| Patient Data Manager | 환자 정보 캐싱 및 세션 관리. 환자 전환 시 이전 데이터 완전 교체(정보 혼합 방지). 필수 환자 정보 화면 표시 |
| Memory Manager | 대용량 볼륨 데이터(최대 512³) 메모리 관리. ArrayBuffer 기반 효율적 데이터 저장. 가비지 컬렉션 최적화 |

#### 3.4.3 인터페이스

- **입력**: 로컬 파일 시스템의 DICOM 파일
- **출력**: 파싱된 볼륨 데이터, 환자 메타데이터
- **내부 인터페이스**: File Access Layer → DICOM Parser → Patient Data Manager / Memory Manager

#### 3.4.4 의존성

- 브라우저 File API: 로컬 파일 접근
- ARCH-001 (Rendering Pipeline): 파싱된 볼륨 데이터 전달

#### 3.4.5 설계 결정 사항

- **서버리스 아키텍처**: 모든 데이터 처리를 브라우저 내에서 수행
- **세션 격리**: 환자 전환 시 이전 세션 데이터 완전 교체로 정보 혼합 방지 (SW-REQ-008-03)
- **ArrayBuffer 활용**: 대용량 볼륨 데이터의 메모리 효율적 처리

---

### 3.5 ARCH-005: 뷰포트 동기화 아키텍처

**Jira 티켓**: PLAYG-2303
**관련 요구사항**: SW-REQ-009

#### 3.5.1 책임

MPR 3단면(Axial/Coronal/Sagittal)과 3D 볼륨 렌더링 뷰 간의 위치/방향 양방향 동기화를 위한 이벤트 기반 아키텍처를 담당한다.

#### 3.5.2 구성 요소

| 구성 요소 | 역할 |
|-----------|------|
| Event Bus | 뷰포트 간 이벤트 발행/구독(Pub/Sub) 패턴. MPR 클릭 이벤트 → 3D 뷰 반영, 3D 선택 이벤트 → MPR 단면 갱신 |
| Coordinate Transformer | MPR 공간과 3D 공간 간 좌표계 변환 행렬 관리. DICOM Image Orientation/Position 태그 기반 변환 기준. 변환 일관성 검증 |
| Sync Controller | 동기화 이벤트 라우팅 및 충돌 해결. 동기화 지연 100ms 이내 보장. 동기화 오류 발생 시 사용자 알림 |

#### 3.5.3 인터페이스

- **입력**: MPR 클릭 이벤트(위치 좌표), 3D 선택 이벤트(위치 좌표)
- **출력**: 동기화된 뷰포트 위치 정보
- **내부 인터페이스**: Event Bus → Coordinate Transformer → Sync Controller

#### 3.5.4 의존성

- ARCH-001 (Rendering Pipeline): MPR/3D 렌더링 뷰포트
- ARCH-007 (Frontend Application): 뷰포트 컴포넌트

#### 3.5.5 설계 결정 사항

- **이벤트 버스 패턴**: 뷰포트 간 느슨한 결합(Loose Coupling)으로 독립적 렌더링 보장
- **100ms 지연 목표**: 사용자 체감 수준의 실시간 동기화 (SW-REQ-009-05)
- **양방향 동기화**: MPR→3D, 3D→MPR 모두 지원

---

### 3.6 ARCH-006: 보안 아키텍처

**Jira 티켓**: PLAYG-2304
**관련 요구사항**: SW-REQ-012, SW-REQ-013

#### 3.6.1 책임

환자 데이터의 로컬 전용 처리를 보장하고, 외부 네트워크 전송을 원천 차단하는 보안 아키텍처이다. 네트워크 통신 코드 미포함, 브라우저 캐시 정책, 접근 권한 제어, 변경 추적을 포함한다.

#### 3.6.2 구성 요소

| 구성 요소 | 역할 |
|-----------|------|
| Network Isolation | 네트워크 통신 코드(fetch, XMLHttpRequest, WebSocket 등) 미포함 아키텍처. 빌드 시 정적 분석으로 외부 통신 코드 검증 |
| Cache Policy | 브라우저 캐시에 환자 데이터 저장 방지. 민감 데이터 메모리 외 저장 금지. 세션 종료 시 임시 데이터 안전 삭제 |
| Access Control | 로컬 파일 시스템 접근 권한 내에서만 동작. 환자 데이터에 대한 미승인 접근 방지 |
| Audit Trail | 소프트웨어 변경 추적을 위한 형상 관리 연동. V&V 문서화 체크리스트 자동 생성 지원 |

#### 3.6.3 인터페이스

- **입력**: 보안 정책 구성
- **출력**: 보안 검증 결과
- **내부 인터페이스**: 모든 모듈에 보안 정책 적용

#### 3.6.4 의존성

- 빌드 파이프라인: 정적 분석 도구
- ARCH-004 (Data Layer): 데이터 처리 보안 정책 적용

#### 3.6.5 설계 결정 사항

- **네트워크 코드 완전 배제**: 아키텍처 수준에서 외부 통신 불가능하게 설계 (SW-REQ-012-01)
- **로컬 전용 원칙**: 모든 데이터 처리가 사용자 로컬 환경에서만 수행
- **정적 분석 활용**: 빌드 파이프라인에서 외부 통신 코드 자동 검출
---

### 3.7 ARCH-007: 프론트엔드 애플리케이션 아키텍처

**Jira 티켓**: PLAYG-2305
**관련 요구사항**: SW-REQ-010, SW-REQ-011

#### 3.7.1 책임

Chrome/Edge 웹 브라우저에서 동작하는 프론트엔드 애플리케이션의 전체 구조, 컴포넌트 계층, 상태 관리, 반응형 레이아웃 아키텍처를 담당한다.

#### 3.7.2 구성 요소

| 구성 요소 | 역할 |
|-----------|------|
| Application Shell | 단일 페이지 애플리케이션(SPA) 구조. 브라우저 호환성 검증(WebGL 2.0 지원 확인, 비지원 브라우저 안내). 애플리케이션 수명주기 관리 |
| Component Layer | 뷰포트 컴포넌트(MPR 3단면 + 3D 뷰), 도구 패널(측정/ROI/WL/WW 컨트롤), 정보 패널(환자 정보, 측정 결과). 반응형 레이아웃(다양한 화면 크기 대응) |
| State Management | 애플리케이션 상태 중앙 관리(현재 볼륨 데이터, 활성 도구, WL/WW 값 등). 뷰포트 간 상태 공유. 환자 세션 상태 관리 |
| Performance Optimization | 512³ 볼륨 기준 MPR ≥30fps, 3D ≥15fps 달성을 위한 렌더링 최적화. 초기 로딩 ≤5초를 위한 점진적 로딩 전략 |

#### 3.7.3 인터페이스

- **입력**: 사용자 UI 상호작용(클릭, 드래그, 스크롤 등)
- **출력**: 화면 렌더링 결과
- **내부 인터페이스**: Component Layer → State Management → 각 아키텍처 모듈

#### 3.7.4 의존성

- ARCH-001 (Rendering Pipeline): 렌더링 결과 표시
- ARCH-002 (Camera & Interaction): 사용자 입력 처리
- ARCH-003 (Analysis Tools): 분석 도구 UI
- ARCH-004 (Data Layer): 데이터 로드 UI
- ARCH-005 (Viewport Synchronization): 뷰포트 동기화

#### 3.7.5 설계 결정 사항

- **SPA 구조**: 서버 없이 로컬에서 동작하는 단일 페이지 애플리케이션
- **중앙 상태 관리**: 뷰포트 간 일관된 상태 유지 및 동기화
- **반응형 레이아웃**: 다양한 화면 크기에서 사용성 보장 (SW-REQ-011-04)
- **성능 기준 준수**: MPR 30fps, 3D 15fps, 초기 로딩 5초 이내 목표 (SW-REQ-010)
---

## 4. 데이터 아키텍처

### 4.1 데이터 모델

본 소프트웨어의 핵심 데이터 모델은 다음과 같다:

| 데이터 유형 | 저장 형식 | 설명 |
|------------|-----------|------|
| DICOM 메타데이터 | JavaScript Object | Patient ID, Study Instance UID, Series Instance UID, SOP Instance UID, Rows, Columns, Bits Allocated 등 |
| 볼륨 데이터 | ArrayBuffer (Int16/Uint16) | 512x512x512 크기의 3D 볼륨 픽셀 데이터. GPU 텍스처로 직접 업로드 |
| 환자 정보 | JavaScript Object | Patient Name, Patient ID, Patient Birth Date, Study Date, Modality |
| 측정 결과 | JavaScript Object | 거리(mm), 각도(degree) 측정값. 소수점 둘째 자리까지 |
| ROI 데이터 | JavaScript Object | 사각형/원형/자유곡선 ROI의 화면 좌표 및 볼륨 좌표 |
| 카메라 상태 | JavaScript Object | 쿼터니언 회전 값, 타겟 위치, 줌 레벨 |
| WL/WW 설정 | JavaScript Object | Window Level, Window Width 값. CBCT 기본값 사전 설정 포함 |

### 4.2 데이터 흐름

```
로컬 파일 시스템
       |
       v
+--------------+
| File Access  |  브라우저 File API로 파일 로드
|    Layer     |
+------+-------+
       |
       v
+--------------+
|    DICOM     |  매직 바이트 검증, 태그 파싱,
|    Parser    |  픽셀 데이터 디코딩
+------+-------+
       |
       +------------------+
       v                  v
+--------------+  +--------------+
|   Patient    |  |   Memory     |
|  Data Mgr    |  |   Manager    |
|(환자 정보)   |  |(ArrayBuffer) |
+------+-------+  +------+-------+
       |                  |
       v                  v
+--------------+  +--------------+
|   Info       |  |   Volume     |
|   Panel      |  | Processing   |
|(UI 표시)     |  |(보간/인덱싱) |
+--------------+  +------+-------+
                         |
                         v
                  +--------------+
                  |GPU Rendering |
                  |  (WebGL 2.0) |
                  | MPR + 3D    |
                  +--------------+
```

---

## 5. 인터페이스 설계

### 5.1 외부 인터페이스

| 인터페이스 | 유형 | 방향 | 설명 |
|------------|------|------|------|
| 브라우저 File API | API | 입력 | 로컬 파일 시스템의 DICOM 파일 로드 |
| WebGL 2.0 API | API | 출력 | GPU 가속 렌더링 (MPR, 3D 볼륨) |
| 마우스/터치 입력 | 이벤트 | 입력 | 사용자 상호작용 (회전, 줌, 측정 등) |
| 화면 표시 | 출력 | 출력 | 렌더링 결과, UI 컴포넌트 표시 |

### 5.2 내부 인터페이스

| 소스 모듈 | 대상 모듈 | 인터페이스 | 데이터 |
|-----------|-----------|------------|--------|
| File Access Layer | DICOM Parser | 파일 데이터 전달 | Raw DICOM bytes |
| DICOM Parser | Patient Data Manager | 환자 메타데이터 | DICOM 태그 값 |
| DICOM Parser | Memory Manager | 픽셀 데이터 | ArrayBuffer |
| Memory Manager | Volume Processing | 볼륨 데이터 | 3D ArrayBuffer |
| Volume Processing | GPU Rendering | 처리된 볼륨 | WebGL Texture |
| Camera Model | GPU Rendering | 카메라 행렬 | View/Projection Matrix |
| Windowing System | GPU Rendering | WL/WW 값 | Level/Width params |
| Input Handler | Camera Model | 입력 이벤트 | Mouse/Touch events |
| Event Bus | Sync Controller | 동기화 이벤트 | Position coordinates |
| Coordinate Mapper | Tool Registry | 변환된 좌표 | Volume coordinates |
| Tool Registry | Overlay Renderer | 측정 도구 데이터 | Measurement data |

---

## 6. 요구사항 추적성

### 6.1 SRS -> 아키텍처 컴포넌트 추적성

| SWS ID | 요구사항 명칭 | 아키텍처 컴포넌트 | ARCH 티켓 |
|--------|--------------|-------------------|-----------|
| SW-REQ-001 | DICOM 파일 로드 및 파싱 | Rendering Pipeline (Tier 1), Data Layer | ARCH-001, ARCH-004 |
| SW-REQ-002 | MPR 3단면 실시간 렌더링 | Rendering Pipeline (Tier 2, 3) | ARCH-001 |
| SW-REQ-003 | 3D 볼륨 렌더링 (Ray Casting) | Rendering Pipeline (Tier 3) | ARCH-001 |
| SW-REQ-004 | 3D 회전/확대/축소 제어 | Camera & Interaction | ARCH-002 |
| SW-REQ-005 | Window Level/Width 조절 | Camera & Interaction (Windowing System) | ARCH-002 |
| SW-REQ-006 | 거리 및 각도 측정 도구 | Analysis Tools | ARCH-003 |
| SW-REQ-007 | ROI(관심영역) 표시 | Analysis Tools | ARCH-003 |
| SW-REQ-008 | 환자 정보 표시 | Data Layer (Patient Data Manager) | ARCH-004 |
| SW-REQ-009 | MPR-3D 뷰 동기화 | Viewport Synchronization | ARCH-005 |
| SW-REQ-010 | 렌더링 성능 요구사항 | Rendering Pipeline, Frontend Application | ARCH-001, ARCH-007 |
| SW-REQ-011 | 사용자 인터페이스 요구사항 | Frontend Application | ARCH-007 |
| SW-REQ-012 | 환자 데이터 보안 요구사항 | Security Architecture | ARCH-006 |
| SW-REQ-013 | 의료기기 소프트웨어 규제 요구사항 | Security Architecture (Audit Trail) | ARCH-006 |

### 6.2 아키텍처 컴포넌트 -> Verification 추적성

| ARCH 티켓 | 컴포넌트 | Verification 티켓 |
|-----------|----------|-------------------|
| ARCH-001 | Rendering Pipeline | PLAYG-2267, PLAYG-2268, PLAYG-2269, PLAYG-2270, PLAYG-2271, PLAYG-2276 |
| ARCH-002 | Camera & Interaction | PLAYG-2270, PLAYG-2271 |
| ARCH-003 | Analysis Tools | PLAYG-2272, PLAYG-2273 |
| ARCH-004 | Data Layer | PLAYG-2267, PLAYG-2274 |
| ARCH-005 | Viewport Synchronization | PLAYG-2275 |
| ARCH-006 | Security Architecture | PLAYG-2278, PLAYG-2279 |
| ARCH-007 | Frontend Application | PLAYG-2276, PLAYG-2277 |

### 6.3 SyRS -> SRS -> SAD 추적성 요약

| System ID | SWS ID | 아키텍처 컴포넌트 | Verification |
|-----------|--------|-------------------|--------------|
| SR-001 | SW-REQ-001 | ARCH-001, ARCH-004 | PLAYG-2267 |
| SR-002 | SW-REQ-002 | ARCH-001 | PLAYG-2268 |
| SR-003 | SW-REQ-003 | ARCH-001 | PLAYG-2269 |
| SR-004 | SW-REQ-004 | ARCH-002 | PLAYG-2270 |
| SR-005 | SW-REQ-005 | ARCH-002 | PLAYG-2271 |
| SR-006 | SW-REQ-006 | ARCH-003 | PLAYG-2272 |
| SR-007 | SW-REQ-007 | ARCH-003 | PLAYG-2273 |
| SR-008 | SW-REQ-008 | ARCH-004 | PLAYG-2274 |
| SR-009 | SW-REQ-009 | ARCH-005 | PLAYG-2275 |
| SR-010 | SW-REQ-010 | ARCH-001, ARCH-007 | PLAYG-2276 |
| SR-011 | SW-REQ-011 | ARCH-007 | PLAYG-2277 |
| SR-012 | SW-REQ-012 | ARCH-006 | PLAYG-2278 |
| SR-013 | SW-REQ-013 | ARCH-006 | PLAYG-2279 |

---

## 7. 승인 이력

| 버전 | 일자 | 작성자 | 검토자 | 승인자 | 변경 내용 |
|------|------|--------|--------|--------|-----------|
| 1.0 | 2026-05-08 | AutoDevAgent | - | - | 초안 작성 |