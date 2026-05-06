---
name: create-subs
description: 하위 티켓들을 생성합니다. 티켓 타입과 인자에 따라 생성 대상이 달라집니다.
---

하위 티켓들을 생성합니다.

## 티켓 타입별 동작

| 티켓 타입 | 생성 대상 | 비고 |
|-----------|----------|------|
| Gate | 해당 Phase의 빈 Document 티켓들 | 제목만 설정 |
| Document (Intended Use) | IU 티켓들 | 내용+링크 포함 |
| Document (System Req) | System Requirement 티켓들 | 상위 문서들 참고, 링크 포함 |
| Document (SRS) | SAD/Architecture 티켓들 | |
| Document (SAD) | SDS/Detailed Design 티켓들 | |
| Document (SDS) | Task 티켓들 (!create-tasks 사용 권장) | |

## 수행 단계

1. **티켓 타입 확인**
   - 현재 티켓의 issue_type 확인
   - 생성할 하위 티켓 타입 결정

2. **인자 파싱**
   - command_args에서 추가 정보 추출
   - 예: "CBCT 웹 뷰어 - 로컬 데이터만 지원"

3. **하위 티켓 목록 작성**
   - 티켓 타입별 기본 항목
   - 인자로 전달된 내용 반영
   - 제목, 요약, 설명 작성

4. **티켓 생성**
   - Jira API로 일괄 생성
   - 각 티켓에 링크 설정 (is parent of)
   - 관련 티켓에 relates to 링크

5. **결과 보고**
   - 생성된 티켓 목록 코멘트
   - 링크 포함

## Gate → Documents 예시

PA Gate에서 !create-subs:
```
생성된 티켓:
- Intended Use Document
- System Requirement Document
- SRS Document
- SAD Document
- SDS Document
```

## Document → 하위 티켓 예시

Intended Use Document에서 !create-subs "CBCT 웹 뷰어":
```
생성된 티켓:
- IU-1: CBCT 데이터 로드
- IU-2: 2D 뷰어 표시
- IU-3: 3D 뷰어 표시
...
```

## 주의사항

- 이미 존재하는 하위 티켓은 중복 생성하지 않음
- 생성 전 --preview로 확인 가능 (향후 지원)
