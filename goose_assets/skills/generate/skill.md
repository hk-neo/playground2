---
name: generate
description: 현재 티켓에 맞는 다음 단계 산출물/문서를 생성합니다. 티켓 타입에 따라 다른 문서를 생성합니다.
---

티켓 타입에 따라 다음 단계 문서를 생성합니다.

## 티켓 타입별 동작

| 티켓 타입 | 생성물 | 참조 소스 |
|-----------|--------|----------|
| Intended Use Document | (없음) | - |
| System Requirement Document | SRS 문서 | 하위 티켓들 |
| SRS Document | SAD 문서 | GitHub의 SRS |
| SAD Document | SDS 문서 | GitHub의 SRS, SAD |
| SDS Document | (없음) | - |

## 수행 단계

1. **티켓 타입 확인**
   - 현재 티켓의 issue_type 확인
   - 생성 대상 결정

2. **참조 데이터 수집**
   - 하위 티켓들 조회
   - GitHub에서 관련 문서 조회 (있는 경우)

3. **문서 생성**
   - 템플릿 활용
   - 수집된 데이터로 내용 채우기
   - 한국어로 작성

4. **GitHub에 커밋**
   - 생성된 문서를 Git 커밋
   - 커밋 메시지: `[{TICKET_KEY}] Generate: {문서 타입}`

5. **Jira 코멘트**
   - 생성된 문서 링크 코멘트
   - 완료 통보

## 문서 템플릿 위치

`goose_assets/templates/`

- `srs_template.md` - SRS 문서 템플릿
- `sad_template.md` - SAD 문서 템플릿
- `sds_template.md` - SDS 문서 템플릿

## 옵션

```
!generate              -- 기본 동작
!generate --format=pdf -- PDF로 내보내기 (향후 지원)
```
