---
name: jira-commenter
description: Jira 티켓에 작업 결과(완료/질문/실패)를 댓글로 게시합니다
---

# Jira 댓글 게시 스킬

이 스킬은 Goose가 작업 중 Jira 티켓에 결과를 보고하거나 사용자에게 질문할 때 사용합니다.

## 언제 사용하나

1. **작업 완료 시** — 생성된 산출물 목록과 함께 완료 댓글 게시
2. **질문이 필요할 때** — 진행에 필요한 정보가 없으면 질문 댓글 후 세션 저장 종료
3. **실패 시** — GHA Step이 fallback으로 처리 (이 스킬은 사용 안 함)

## 사용 방법

### 작업 완료 댓글

```bash
python .agents/skills/jira-commenter/scripts/post_comment.py \
  --type done \
  --ticket <ticket_id from context.json> \
  --summary "생성된 파일: docs/01_PRD.md, docs/02_SRS.md ..."
```

### 질문 댓글 (세션 일시정지)

```bash
python .agents/skills/jira-commenter/scripts/post_comment.py \
  --type question \
  --ticket <ticket_id> \
  --summary "REST API 응답 형식을 어떻게 할까요? (JSON/XML)" \
  --session <session_id>
```

질문 댓글을 게시한 후에는 **즉시 작업을 중단하고 세션을 종료**하세요.
사용자가 Jira에 `!answer <답변>` 댓글을 달면 이 세션이 재개됩니다.

## 주의사항

- `context.json`에서 `ticket_id`를 읽어 사용하세요
- 환경변수 `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`이 필요합니다
- 질문은 1회만 허용됩니다 (연속 질문 루프 금지)
