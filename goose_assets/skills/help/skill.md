---
name: help
description: 사용 가능한 명령어 목록과 사용법을 표시합니다.
---

도움말을 표시합니다.

## 사용 가능한 명령어

| 명령어 | 설명 | 대상 티켓 |
|--------|------|-----------|
| !generate | 다음 단계 문서 생성 | Document |
| !create-subs | 하위 티켓 생성 | Gate, Document |
| !create-tasks | 구현 태스크 생성 | SDS Document |
| !traceability | 추적성 검증 | 모든 티켓 |
| !update | 내용 수정 | 모든 티켓 |
| !plan | 구현 계획 생성 | Task |
| !implement | 계획대로 구현 | Task |

## 자세한 사용법

### !generate
```jira
!generate
!generate --format=pdf
```

### !create-subs
```jira
!create-subs
!create-subs CBCT 웹 뷰어 - 로컬 데이터만 지원
```

### !create-tasks
```jira
!create-tasks
```

### !traceability
```jira
!traceability
!traceability --find-missing
!traceability --fix
!traceability --project
```

### !update
```jira
!update "수정할 내용"
!update --preview
!update --cascade both 2 "수정할 내용"
```

### !plan
```jira
!plan
```

### !implement
```jira
!implement
```
