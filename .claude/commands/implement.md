---
project_key: PLAYG
---

Task 티켓을 읽고 코드를 구현합니다.

## 사용법
/implement PLAYG-2368

## 수행 단계

1. **티켓 정보 조회**
```bash
source .env 2>/dev/null; export $(grep -v '^#' .env | xargs) 2>/dev/null
python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py fetch_linked $ARGUMENTS
```

2. **티켓 내용 분석**
   - summary, description 읽기
   - 연결된 Detailed Design 티켓 조회 (implements_dd)
   - 설계 내용 파악

3. **코드 구현**
   - 티켓 설명에 명시된 클래스/함수 구현
   - 관련 기존 코드 파악 후 일관성 유지
   - 타입스크립트/프로젝트 컨벤션 준수

4. **테스트**
   - 구현한 코드의 기본 동작 확인
   - 빌드 에러 없는지 확인

5. **커밋**
```bash
git add -A
git commit -m "[$ARGUMENTS] Implement: {요약}"
```

6. **Jira 업데이트**
```bash
source .env 2>/dev/null; export $(grep -v '^#' .env | xargs) 2>/dev/null
python3 AutoDevAgent/goose_assets/runner/jira_toolkit.py comment $ARGUMENTS "구현 완료: {요약}"
```
