---
project_key: PLAYG
---

Xray Cucumber 시나리오를 기반으로 Puppeteer 테스트 코드를 생성합니다.

## 사용법
/generate-tests PLAYG-2475

## 수행 단계

1. **Xray 인증 및 Test 키 조회**
```bash
source .env 2>/dev/null; export $(grep -v '^#' .env | xargs) 2>/dev/null
python3 AutoDevAgent/goose_assets/runner/xray_toolkit.py get_test_keys $ARGUMENTS
```

2. **Cucumber Feature Export**
```bash
python3 AutoDevAgent/goose_assets/runner/xray_toolkit.py export_cucumber "PLAYG-XXXX;PLAYG-YYYY;..." --output tests/xray
```

3. **Feature 파일 분석**
   - 각 `.feature` 파일 읽기
   - `@TEST_PLAYG-XXXX` 태그에서 테스트 키 추출
   - Given/When/Then 시나리오 분석

4. **테스트 코드 생성**
   - `tests/xray/` 디렉토리 생성
   - 이미 존재하는 파일은 건너뛰기 (수동 수정 보호)
   - 각 Test 키별 `tests/xray/PLAYG-XXXX.mjs` 생성
   - `tests/xray/helper.mjs` 공통 유틸리티 생성

5. **커밋**
```bash
git add tests/xray/
git commit -m "[$ARGUMENTS] Generate: Xray test scripts"
```
