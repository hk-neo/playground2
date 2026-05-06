---
name: traceability
description: 추적성을 확인하고 관리합니다. --find-missing으로 누락된 링크 찾기, --fix로 자동 생성 제안, --project로 전체 현황 조회를 지원합니다.
---

추적성을 확인하고 관리합니다.

## 하위 명령어

| 명령어 | 설명 |
|--------|------|
| (기본) | 현재 티켓의 추적성 상태 확인 |
| --find-missing | 누락된 링크 찾기 |
| --fix | 누락된 링크 자동 생성 제안 |
| --project | 전체 프로젝트 추적성 현황 |

## 추적성 관계 정의

```
Intended Use Document
  └─ is parent of → IU-1, IU-2, IU-3...

System Requirement Document
  └─ is parent of → SR-1, SR-2, SR-3...
      └─ relates to → IU-1, IU-2...

SRS Document
  └─ is parent of → SAD-1, SAD-2...
      └─ implements → SR-1, SR-2...

SAD Document
  └─ is parent of → SDS-1, SDS-2...
      └─ implements → SAD-1, SAD-2...

SDS Document
  └─ is parent of → TASK-01, TASK-02...
      └─ implements → SDS-1, SDS-2...
```

## 수행 단계

### 1. 기본: 현재 티켓 추적성 확인
1. 현재 티켓의 연결 확인
2. 상위/하위 티켓 목록 표시
3. 관계 타입별 정리
4. 코멘트로 결과 보고

### 2. --find-missing: 누락된 링크 찾기
1. 예상되는 연결 정의 (티켓 타입별)
2. 실제 연결과 비교
3. 누락된 연결 목록 작성
4. 코멘트로 누락 목록 보고

### 3. --fix: 자동 생성 제안
1. --find-missing와 동일하게 누락 확인
2. 각 누락에 대해 연결 제안 생성
3. 사용자 승인 후 적용 (--preview와 함께 사용 권장)
4. Jira 링크 생성 API 호출

### 4. --project: 전체 현황
1. 프로젝트 전체 티켓 조회
2. 연결 그래프 생성
3. 통계: 연결율, 누락 수
4. 코멘트로 요약 보고

## 예시

```
!traceability
!traceability --find-missing
!traceability --fix
!traceability --project
```
