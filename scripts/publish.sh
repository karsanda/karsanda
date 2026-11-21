#!/usr/bin/env bash
# Weekly publish: render the woven year and push it, at most once per ISO week.
#
# Works in a scratch worktree on a fresh origin/<branch>, so nothing from your own checkout
# (staged drafts, unpushed commits, other branches) is ever published, and your checkout is
# never touched. Only assets/ is committed, after a privacy check on the rendered files.
# Never mints credentials: an optional local hook may only load one that already exists.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

if [ -f local/weave.env ]; then
  set -a; . local/weave.env; set +a
fi

if [ -z "${GITLAB_TOKEN:-}" ] && [ -n "${WEAVE_CREDENTIAL_HOOK:-}" ] && [ -f "$WEAVE_CREDENTIAL_HOOK" ]; then
  # The hook runs third-party shell code: give it a plain shell, not our strict mode.
  set +euo pipefail
  . "$WEAVE_CREDENTIAL_HOOK"
  set -euo pipefail
  export GITLAB_TOKEN
fi

cache="${WEAVE_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/karsanda-weave}"
branch="${WEAVE_BRANCH:-main}"
week="$(TZ=Asia/Jakarta date +%G-W%V)"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "no remote; not pushing"
  exit 0
fi

mkdir -p "$cache"
wt="$cache/worktree"
git worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"
git worktree prune
git fetch -q origin "$branch"
git worktree add -q --detach "$wt" "origin/$branch"
trap 'git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1 || true' EXIT

code=0
WEAVE_OUT_DIR="$wt/assets" ${WEAVE_CLI:-node src/cli.ts --scheduled} || code=$?
# Nothing after the render needs the token: keep it away from git, ssh and hooks.
unset GITLAB_TOKEN GITLAB_TOKEN_LEASE GITLAB_TOKEN_ROLE

case "$code" in
  0) ;;
  10) echo "waiting for GitLab data"; exit 0 ;;
  11) echo "already pushed this week"; exit 0 ;;
  *) exit "$code" ;;
esac

if ! "$repo/scripts/privacy-check.sh" "$wt" >/dev/null; then
  echo "privacy check failed on the rendered assets; not pushing" >&2
  "$repo/scripts/privacy-check.sh" "$wt" >&2 || true
  exit 1
fi

git -C "$wt" add -- assets
if ! git -C "$wt" diff --cached --quiet -- assets; then
  git -C "$wt" -c user.name=songket-weaver -c user.email=songket-weaver@karsanda.invalid \
    commit -q -m "weave: $week" -- assets
  git -C "$wt" push -q origin "HEAD:$branch"
fi

echo "$week" > "$cache/pushed-week"
echo "published $week"
