---
project_key: PLAYG
---

Xray에 새로운 Cucumber 테스트를 생성하고 테스트 스크립트를 추가합니다.

## 사용법
/add-xray-test PLAYG-2534

## 수행 단계

1. **Test 이슈 생성**
```bash
source .env 2>/dev/null; export $(grep -v '^#' .env | xargs) 2>/dev/null
```
   - Jira에 Test 타입 이슈 생성 (issuetype: Test)
   - summary: 테스트 시나리오명
   - labels: 관련 라벨
   - description: ADF 형식으로 영문 설명 (특수문자 주의: gl_FrontFacing 등은 JSON 파싱 주의)

   ```bash
   cat > /tmp/xray-test.json << 'EOFJSON'
   {
     "fields": {
       "project": {"key": "PLAYG"},
       "summary": "테스트 시나리오명",
       "issuetype": {"name": "Test"},
       "labels": ["label1", "label2"],
       "description": {
         "type": "doc",
         "version": 1,
         "content": [
           {"type": "paragraph", "content": [{"type": "text", "text": "설명"}]}
         ]
       }
     }
   }
   EOFJSON
   python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py create /tmp/xray-test.json
   ```

2. **Cucumber 타입으로 변경** (Xray GraphQL API)
   - 기본 생성 시 Manual 타입이므로 Cucumber로 변경 필요
   - Bearer token: `python3 AutoDevAgent/goose_assets/runner/xray_toolkit.py get_token`

   ```bash
   TOKEN=$(python3 AutoDevAgent/goose_assets/runner/xray_toolkit.py get_token)
   curl -s -X POST "https://xray.cloud.getxray.app/api/v2/graphql" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"query":"mutation { updateTestType(issueId: \"ISSUE_ID\", testType: { name: \"Cucumber\", kind: \"AUTOMATED\" }) }"}'
   ```

3. **Gherkin 스텝 설정** (Xray GraphQL API)
   ```bash
   curl -s -X POST "https://xray.cloud.getxray.app/api/v2/graphql" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"query":"mutation { updateGherkinTestDefinition(issueId: \"ISSUE_ID\", gherkin: \"Given ...\\nWhen ...\\nThen ...\") }"}'
   ```

4. **Test Execution에 추가** (선택)
   - 기존 Test Execution에 연결하려면 Jira link 사용
   ```bash
   python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py link {TestExecution키} {Test키} Relates
   ```

5. **테스트 스크립트 추가**
   - `tests/xray/new-tests.mjs` 또는 개별 `tests/xray/PLAYG-XXXX.mjs` 파일에 테스트 코드 추가
   - `tests/xray/new-scenarios.json`에 시나리오 정보 추가
   - Cucumber feature 파일: `tests/xray/features/N_PLAYG-XXXX.feature` 생성

6. **Jira 코멘트 등록**
```bash
python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py comment {Test키} "Cucumber 테스트 생성 완료: {요약}"
```

## 주의사항

- **JSON에 특수문자 주의**: `gl_FrontFacing`, 백슬래시 등 JSON 파싱 오류 발생 가능 → 영문 설명 권장
- **Test 타입 이슈의 issueId**: Jira REST API의 numeric ID가 필요 (Xray GraphQL에서 사용)
  - `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/{키}?fields=summary"` 에서 `id` 필드
- **Cucumber 타입 변경 필수**: 기본 Manual → Cucumber 변경해야 Gherkin 스텝 설정 가능
- **Headless Chrome WebGL 제한**: 3D 렌더링 테스트는 픽셀 검증 대신 shader uniform 검증 방식 사용
