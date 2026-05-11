---
---

Jira 티켓 정보를 조회합니다.

## 사용법
/jira-read PLAYG-2368

## 실행
```bash
source .env 2>/dev/null; export $(grep -v '^#' .env | xargs) 2>/dev/null
python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py fetch_linked {{arg1}}
```

조회된 정보를 분석해서 요약해주세요.
