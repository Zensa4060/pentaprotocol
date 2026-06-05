"""GitHub REST integration for the Argus personal assistant.

Uses the GitHub REST API via ``requests`` only. Authenticate with a
personal access token in ``GITHUB_TOKEN``.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

import requests

GITHUB_API = "https://api.github.com"
REQUEST_TIMEOUT = 30

PENTAPROTOCOL_CONTEXT = (
    "PentaProtocol is a live online strategy board game. "
    "It has 70 active users, runs on a Railway Python backend "
    "with MongoDB, Vercel frontend, and Supabase for profile "
    "images. It has a virtual economy with protocredits and "
    "shards. Users play ranked and unranked matches with an "
    "ELO system. Current focus is user retention and first "
    "monetization. Social presence is early stage - Instagram, "
    "YouTube, Reddit, Itch.io."
)

# Repo names treated as the primary PentaProtocol project (case-insensitive).
PRIMARY_REPO_NAMES = frozenset({"pentaprotocol", "penta-protocol"})


class GitHubServiceError(Exception):
    """Raised when the GitHub API cannot be queried."""


def _github_token() -> str:
    token = (os.getenv("GITHUB_TOKEN") or "").strip()
    if not token:
        raise GitHubServiceError("GITHUB_TOKEN is not set")
    return token


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_github_token()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _get(url: str, *, params: Optional[dict] = None) -> Any:
    response = requests.get(
        url,
        headers=_headers(),
        params=params,
        timeout=REQUEST_TIMEOUT,
    )
    if response.status_code == 401:
        raise GitHubServiceError("GitHub token is invalid or expired")
    if response.status_code == 403 and "rate limit" in response.text.lower():
        raise GitHubServiceError("GitHub API rate limit exceeded")
    if not response.ok:
        raise GitHubServiceError(
            f"GitHub API error {response.status_code}: {response.text[:300]}"
        )
    return response.json()


def _paginate(url: str, *, params: Optional[dict] = None) -> list[dict]:
    items: list[dict] = []
    page = 1
    base_params = dict(params or {})
    while True:
        page_params = {**base_params, "per_page": 100, "page": page}
        batch = _get(url, params=page_params)
        if not isinstance(batch, list) or not batch:
            break
        items.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return items


def _is_primary_repo(name: str) -> bool:
    return (name or "").strip().lower() in PRIMARY_REPO_NAMES


def _iso_or_none(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return value.replace("Z", "+00:00") if value.endswith("Z") else value


def list_my_repos() -> list[dict]:
    """Return all repos visible to the authenticated user."""
    return _paginate(
        f"{GITHUB_API}/user/repos",
        params={"affiliation": "owner,collaborator,organization_member", "sort": "pushed"},
    )


def get_recent_commits(full_name: str, *, limit: int = 5) -> list[dict]:
    """Last N commits for a repo (primary repos only in summaries)."""
    commits = _get(
        f"{GITHUB_API}/repos/{full_name}/commits",
        params={"per_page": limit},
    )
    if not isinstance(commits, list):
        return []
    rows: list[dict] = []
    for entry in commits:
        commit = entry.get("commit") or {}
        author = commit.get("author") or {}
        message = (commit.get("message") or "").strip()
        if "\n" in message:
            message = message.split("\n", 1)[0]
        rows.append(
            {
                "message": message,
                "date": _iso_or_none(author.get("date")),
                "author": author.get("name") or (entry.get("author") or {}).get("login"),
            }
        )
    return rows


def get_open_pull_requests(full_name: str) -> list[dict]:
    """Open pull requests for a repo."""
    pulls = _paginate(
        f"{GITHUB_API}/repos/{full_name}/pulls",
        params={"state": "open", "sort": "updated", "direction": "desc"},
    )
    rows: list[dict] = []
    for pr in pulls:
        user = pr.get("user") or {}
        rows.append(
            {
                "number": pr.get("number"),
                "title": pr.get("title"),
                "author": user.get("login"),
                "created_at": _iso_or_none(pr.get("created_at")),
                "updated_at": _iso_or_none(pr.get("updated_at")),
                "url": pr.get("html_url"),
            }
        )
    return rows


def _primary_repo_payload(repo: dict) -> dict:
    full_name = repo.get("full_name") or repo.get("name") or ""
    return {
        "name": repo.get("name"),
        "full_name": full_name,
        "last_pushed": _iso_or_none(repo.get("pushed_at")),
        "primary_language": repo.get("language"),
        "open_issues": int(repo.get("open_issues_count") or 0),
        "recent_commits": get_recent_commits(full_name, limit=5),
        "open_pull_requests": get_open_pull_requests(full_name),
    }


def _other_repo_payload(repo: dict) -> dict:
    return {
        "name": repo.get("name"),
        "last_commit_date": _iso_or_none(repo.get("pushed_at")),
        "open_issues": int(repo.get("open_issues_count") or 0),
    }


def get_github_summary() -> dict:
    """Build a context dict for Argus with repo activity and project background."""
    repos = list_my_repos()

    primary_repo: Optional[dict] = None
    other_repos: list[dict] = []
    all_open_pull_requests: list[dict] = []

    for repo in repos:
        name = repo.get("name") or ""
        if _is_primary_repo(name):
            primary_repo = _primary_repo_payload(repo)
            for pr in primary_repo.get("open_pull_requests") or []:
                all_open_pull_requests.append({**pr, "repo": name})
        else:
            other_repos.append(_other_repo_payload(repo))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_context": PENTAPROTOCOL_CONTEXT,
        "primary_repo": primary_repo,
        "other_repos": other_repos,
        "open_pull_requests": all_open_pull_requests,
        "repo_count": len(repos),
    }


if __name__ == "__main__":
    import json

    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass
    print(json.dumps(get_github_summary(), indent=2))
