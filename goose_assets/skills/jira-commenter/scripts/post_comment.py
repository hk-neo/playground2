"""
skills/jira-commenter/scripts/post_comment.py
Jira 티켓에 댓글을 게시하는 경량 스탠드얼론 스크립트

Usage:
    python post_comment.py --type done    --ticket AUT-5 --summary "완료 내용"
    python post_comment.py --type question --ticket AUT-5 --summary "질문 내용" --session AUT-5
"""

import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path


def _make_headers(email: str, token: str) -> dict:
    cred = base64.b64encode(f"{email}:{token}".encode()).decode()
    return {
        "Authorization": f"Basic {cred}",
        "Content-Type":  "application/json",
        "Accept":        "application/json",
    }


def _adf_text(text: str) -> dict:
    return {"type": "paragraph", "content": [{"type": "text", "text": text}]}


def _build_body(comment_type: str, summary: str, session_id: str = "") -> dict:
    if comment_type == "done":
        header = "[AutoDevAgentTeam] 작업 완료"
        lines  = [summary]
    elif comment_type == "question":
        header = "[QUESTION] 추가 정보 필요"
        lines  = [
            summary,
            "",
            "Jira 댓글에 '!answer <답변>' 형식으로 답변해 주시면 작업을 재개합니다.",
        ]
        if session_id:
            lines.append(f"(session: {session_id})")
    else:
        header = "[AutoDevAgentTeam] 오류 발생"
        lines  = [summary]

    content = [
        {
            "type": "paragraph",
            "content": [{"type": "text", "text": header,
                         "marks": [{"type": "strong"}]}],
        }
    ]
    for line in lines:
        content.append(_adf_text(line) if line else {"type": "paragraph", "content": []})

    return {"body": {"type": "doc", "version": 1, "content": content}}


def _save_session_status(ticket_id: str, session_id: str, question: str) -> None:
    """workspace_info.json에 waiting 상태와 session_id 저장."""
    # Goose cwd는 source/ 이므로 workspace_info.json은 ../../workspace_info.json
    paths = [
        Path("../../workspace_info.json"),
        Path(f"workspace/{ticket_id}/workspace_info.json"),
    ]
    for wi_path in paths:
        if wi_path.exists():
            try:
                wi = json.loads(wi_path.read_text(encoding="utf-8"))
                wi["session_id"] = session_id or ticket_id
                wi["status"]     = "waiting"
                wi["last_question"] = question
                wi_path.write_text(json.dumps(wi, ensure_ascii=False, indent=2),
                                   encoding="utf-8")
                print(f"[OK] workspace_info.json 업데이트: {wi_path}")
                return
            except Exception as e:
                print(f"[WARN] workspace_info.json 업데이트 실패: {e}")


def post_comment(base_url: str, ticket_id: str,
                 headers: dict, body: dict) -> bool:
    url     = f"{base_url}/rest/api/3/issue/{ticket_id}/comment"
    payload = json.dumps(body).encode("utf-8")
    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            print(f"[OK] Jira 댓글 게시 완료: comment_id={result.get('id', '?')}")
            return True
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        print(f"[ERR] Jira HTTP {e.code}: {err[:200]}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[ERR] Jira 댓글 예외: {e}", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--type",    required=True, choices=["done", "question", "error"])
    parser.add_argument("--ticket",  required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--session", default="")
    args = parser.parse_args()

    base_url = os.environ.get("JIRA_BASE_URL", "").rstrip("/")
    email    = os.environ.get("JIRA_USER_EMAIL", "")
    token    = os.environ.get("JIRA_API_TOKEN", "")

    if not all([base_url, email, token]):
        print("[ERR] JIRA_BASE_URL / JIRA_USER_EMAIL / JIRA_API_TOKEN 필요", file=sys.stderr)
        sys.exit(1)

    headers = _make_headers(email, token)
    body    = _build_body(args.type, args.summary, args.session)

    ok = post_comment(base_url, args.ticket, headers, body)

    # 질문 타입인 경우 workspace_info.json에 상태 저장
    if args.type == "question" and ok:
        _save_session_status(args.ticket, args.session or args.ticket, args.summary)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
