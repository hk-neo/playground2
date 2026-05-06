#!/usr/bin/env python3
"""
Jira Toolkit - Jira API와 상호작용하는 도구
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests

# 설정
JIRA_URL = os.getenv("JIRA_URL", "https://neobiotech.atlassian.net")
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")


def get_headers():
    if not JIRA_EMAIL or not JIRA_API_TOKEN:
        raise ValueError("JIRA_EMAIL and JIRA_API_TOKEN must be set")
    return {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }


def get_auth():
    return (JIRA_EMAIL, JIRA_API_TOKEN)


def cmd_schema(args):
    """이슈 타입의 필드 스키마 조회"""
    url = f"{JIRA_URL}/rest/api/3/field"
    response = requests.get(url, headers=get_headers(), auth=get_auth())

    if response.status_code == 200:
        fields = response.json()
        # 기본 필드 + 커스텀 필드 표시
        print(json.dumps(fields, indent=2, ensure_ascii=False))
    else:
        print(f"Error: {response.status_code} - {response.text}")
        sys.exit(1)


def cmd_fetch_linked(args):
    """티켓과 연결된 티켓들 조회"""
    ticket_key = args.ticket_key

    # 티켓 정보 조회
    url = f"{JIRA_URL}/rest/api/3/issue/{ticket_key}"
    params = {
        "fields": "summary,description,issuetype,priority,status,issuelinks,subtasks,customfield_10100,customfield_10101"
    }
    response = requests.get(url, headers=get_headers(), auth=get_auth(), params=params)

    if response.status_code != 200:
        print(f"Error: {response.status_code} - {response.text}")
        sys.exit(1)

    issue = response.json()
    fields = issue["fields"]

    result = {
        "ticket": {
            "key": ticket_key,
            "summary": fields["summary"],
            "description": fields.get("description", ""),
            "issue_type": fields["issuetype"]["name"],
            "priority": fields["priority"]["name"],
            "status": fields["status"]["name"]
        },
        "parent": None,
        "subtasks": [],
        "linked": []
    }

    # 상위 티켓
    if fields.get("parent"):
        parent_key = fields["parent"]["key"]
        result["parent"] = parent_key

    # 하위 티켓 (subtasks)
    for subtask in fields.get("subtasks", []):
        result["subtasks"].append({
            "key": subtask["key"],
            "summary": subtask["fields"]["summary"],
            "status": subtask["fields"]["status"]["name"]
        })

    # 연결된 티켓 (issuelinks)
    for link in fields.get("issuelinks", []):
        if "outwardIssue" in link:
            result["linked"].append({
                "key": link["outwardIssue"]["key"],
                "summary": link["outwardIssue"]["fields"]["summary"],
                "link_type": link["type"]["outward"]
            })
        elif "inwardIssue" in link:
            result["linked"].append({
                "key": link["inwardIssue"]["key"],
                "summary": link["inwardIssue"]["fields"]["summary"],
                "link_type": link["type"]["inward"],
                "direction": "inward"
            })

    print(json.dumps(result, indent=2, ensure_ascii=False))


def cmd_update(args):
    """티켓 업데이트"""
    ticket_key = args.ticket_key
    fields_file = args.fields

    with open(fields_file, 'r', encoding='utf-8') as f:
        fields = json.load(f)

    url = f"{JIRA_URL}/rest/api/3/issue/{ticket_key}"
    data = {"fields": fields}

    response = requests.put(url, headers=get_headers(), auth=get_auth(), json=data)

    if response.status_code == 204:
        print(f"Success: {ticket_key} updated")
    else:
        print(f"Error: {response.status_code} - {response.text}")
        sys.exit(1)


def cmd_create(args):
    """티켓 생성"""
    issue_file = args.issue

    with open(issue_file, 'r', encoding='utf-8') as f:
        issue_data = json.load(f)

    url = f"{JIRA_URL}/rest/api/3/issue"

    response = requests.post(url, headers=get_headers(), auth=get_auth(), json=issue_data)

    if response.status_code == 201:
        result = response.json()
        print(f"Success: {result['key']} created")
    else:
        print(f"Error: {response.status_code} - {response.text}")
        sys.exit(1)


def cmd_comment(args):
    """코멘트 추가"""
    ticket_key = args.ticket_key
    comment_text = args.comment

    url = f"{JIRA_URL}/rest/api/3/issue/{ticket_key}/comment"
    data = {"body": {"type": "doc", "version": 1, "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": comment_text}]}
    ]}}

    response = requests.post(url, headers=get_headers(), auth=get_auth(), json=data)

    if response.status_code == 201:
        print(f"Success: Comment added to {ticket_key}")
    else:
        print(f"Error: {response.status_code} - {response.text}")
        sys.exit(1)


def cmd_delete(args):
    """티켓 삭제"""
    ticket_key = args.ticket_key

    url = f"{JIRA_URL}/rest/api/3/issue/{ticket_key}"

    response = requests.delete(url, headers=get_headers(), auth=get_auth())

    if response.status_code == 204:
        print(f"Success: {ticket_key} deleted")
    else:
        print(f"Error: {response.status_code} - {response.text}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Jira Toolkit")
    subparsers = parser.add_subparsers(dest="command", help="Command")

    # schema
    subparsers.add_parser("schema", help="Get field schema")

    # fetch_linked
    fetch_parser = subparsers.add_parser("fetch_linked", help="Fetch linked issues")
    fetch_parser.add_argument("ticket_key", help="Ticket key (e.g., PLAYG-123)")

    # update
    update_parser = subparsers.add_parser("update", help="Update ticket")
    update_parser.add_argument("ticket_key", help="Ticket key")
    update_parser.add_argument("fields", help="JSON file with fields to update")

    # create
    create_parser = subparsers.add_parser("create", help="Create ticket")
    create_parser.add_argument("issue", help="JSON file with issue data")

    # comment
    comment_parser = subparsers.add_parser("comment", help="Add comment")
    comment_parser.add_argument("ticket_key", help="Ticket key")
    comment_parser.add_argument("comment", help="Comment text")

    # delete
    delete_parser = subparsers.add_parser("delete", help="Delete ticket")
    delete_parser.add_argument("ticket_key", help="Ticket key")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "schema":
        cmd_schema(args)
    elif args.command == "fetch_linked":
        cmd_fetch_linked(args)
    elif args.command == "update":
        cmd_update(args)
    elif args.command == "create":
        cmd_create(args)
    elif args.command == "comment":
        cmd_comment(args)
    elif args.command == "delete":
        cmd_delete(args)


if __name__ == "__main__":
    main()
