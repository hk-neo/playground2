---
---

Jira 티켓에 코멘트를 게시합니다.

## 사용법
/jira-comment PLAYG-2368 구현 완료

## 실행
```bash
source .env 2>/dev/null; export $(grep -v '^#' .env | xargs) 2>/dev/null
python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py comment {{arg1}} "{{args}}"
```
