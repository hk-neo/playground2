#!/usr/bin/env python3
"""Architecture 티켓 일괄 생성 스크립트"""
import json, pathlib, requests, os, time, sys

# 환경변수 직접 읽기 (os.environ 명시적 사용)
JIRA_URL = os.environ.get('JIRA_URL', '')
JIRA_EMAIL = os.environ.get('JIRA_EMAIL', '')
JIRA_API_TOKEN = os.environ.get('JIRA_API_TOKEN', '')

if not all([JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN]):
    print("Error: Missing environment variables")
    sys.exit(1)

print(f"JIRA_URL: {JIRA_URL}", flush=True)
print(f"JIRA_EMAIL: {JIRA_EMAIL}", flush=True)

def text_to_adf(text):
    paragraphs = []
    for line in text.split('\n'):
        content = [{"type": "text", "text": line}] if line.strip() else []
        paragraphs.append({"type": "paragraph", "content": content})
    return {"type": "doc", "version": 1, "content": paragraphs}

def create_ticket(summary, description_text):
    fields = {
        "project": {"key": "PLAYG"},
        "summary": summary,
        "issuetype": {"name": "Architecture"},
        "description": text_to_adf(description_text)
    }
    resp = requests.post(
        JIRA_URL + '/rest/api/3/issue',
        json=fields,
        auth=(JIRA_EMAIL, JIRA_API_TOKEN),
        headers={"Accept": "application/json", "Content-Type": "application/json"}
    )
    if resp.status_code == 201:
        key = resp.json()['key']
        print(f"  Created: {key}", flush=True)
        return key
    else:
        print(f"  Error: {resp.status_code} - {resp.text[:200]}", flush=True)
        return None

def create_link(link_type, inward_key, outward_key):
    payload = {
        "type": {"name": link_type},
        "inwardIssue": {"key": inward_key},
        "outwardIssue": {"key": outward_key}
    }
    resp = requests.post(
        JIRA_URL + '/rest/api/3/issueLink',
        json=payload,
        auth=(JIRA_EMAIL, JIRA_API_TOKEN),
        headers={"Accept": "application/json", "Content-Type": "application/json"}
    )
    if resp.status_code in (200, 201, 204):
        print(f"  Linked: {outward_key} -[{link_type}]-> {inward_key}", flush=True)
    else:
        print(f"  Link failed: {resp.status_code} - {resp.text[:100]}", flush=True)

# 데이터 로드
data = json.loads(pathlib.Path('temp_architectures.json').read_text(encoding='utf-8'))
architectures = data['architectures']
print(f"Loaded {len(architectures)} architectures", flush=True)

results = []
for i, arch in enumerate(architectures):
    print(f"\n[{i+1}/{len(architectures)}] {arch['summary']}", flush=True)

    issue_key = create_ticket(arch['summary'], arch['description'])
    if not issue_key:
        continue
    time.sleep(0.5)

    for req_key in arch.get('implements', []):
        create_link('Implements', issue_key, req_key)
        time.sleep(0.3)

    create_link('Relates', issue_key, 'PLAYG-2154')
    time.sleep(0.3)

    results.append({
        'key': issue_key,
        'summary': arch['summary'],
        'implements': arch.get('implements', [])
    })

print(f"\n{'='*50}", flush=True)
print(f"Completed: {len(results)}/{len(architectures)} architectures created", flush=True)
print(f"{'='*50}", flush=True)

for r in results:
    impl_str = ', '.join(r['implements'])
    print(f"  {r['key']}: {r['summary']}", flush=True)
    print(f"    implements: [{impl_str}]", flush=True)

pathlib.Path('temp_arch_results.json').write_text(
    json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8'
)
