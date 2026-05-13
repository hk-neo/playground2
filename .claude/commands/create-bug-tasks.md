---
project_key: PLAYG
---

Test Execution에서 실패한 테스트 목록을 조회하여 Jira에 Bug 티켓을 생성합니다.

## 사용법
/create-bug-tasks PLAYG-2530

## 수행 단계

1. **FAILED 테스트 목록 조회**
```bash
source .env 2>/dev/null; export $(grep -v '^#' .env | xargs) 2>/dev/null
python3 AutoDevAgent/goose_assets/runner/xray_toolkit.py get_failed_tests $ARGUMENTS
```
   - `failed_count`가 0이면 "실패한 테스트가 없습니다" 출력 후 종료

2. **Jira Bug 티켓 생성** (FAILED 테스트 전체를 1개 티켓에 목록화)
   - summary: `[TEST-FAIL] $ARGUMENTS: N개 테스트 실패`
   - issuetype: Bug
   - labels: ["test-failure"]
   - description: FAILED 테스트 테이블 + 원인 분석 체크리스트 + 재현 방법

3. **Test Execution과 Bug 연결**
```bash
python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py link $ARGUMENTS {생성된Bug키} Relates
```

4. **Test Execution에 코멘트 등록**
```bash
python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py comment $ARGUMENTS "N개 실패 테스트에 대해 Bug 티켓 생성: {Bug키}"
```
