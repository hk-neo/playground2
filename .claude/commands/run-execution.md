---
project_key: PLAYG
---

Test Execution에 연결된 테스트 스크립트를 실행하고 결과를 Xray에 등록합니다.

## 사용법
/run-execution PLAYG-2475

## 수행 단계

1. **Xray 인증 및 Test 키 조회**
```bash
source .env 2>/dev/null; export $(grep -v '^#' .env | xargs) 2>/dev/null
python3 AutoDevAgent/goose_assets/runner/xray_toolkit.py get_test_keys $ARGUMENTS
```

2. **Vite Dev Server 확인**
```bash
curl -s http://localhost:5175 > /dev/null 2>&1 && echo "running" || echo "not running"
```
   - 실행 중이 아니면 `npx vite --port 5175 &` 로 시작

3. **테스트 스크립트 실행**
   - 조회된 Test 키별로 `tests/xray/PLAYG-XXXX.mjs` 실행
   - 스크립트가 없으면 SKIPPED 처리
   - 각 결과에서 PASSED/FAILED/SKIPPED 수집

4. **Xray 결과 등록**
```bash
python3 AutoDevAgent/goose_assets/runner/xray_toolkit.py import_results --results-json '{"testExecutionKey":"$ARGUMENTS","tests":[...]}'
```

5. **Jira 코멘트 등록**
```bash
python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py comment $ARGUMENTS "테스트 실행 완료: PASSED X건, FAILED X건, SKIPPED X건 (총 X건)"
```
