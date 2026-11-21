#!/usr/bin/env bash
# Usage: scripts/privacy-check.sh [--history] [dir]
#
# Fails if any committed, untracked, or rendered file in <dir> (default: this repo) contains a
# string from this repo's local/forbidden.txt (one case-insensitive literal per line; blank
# lines and #-comments ignored). With --history it also scans every commit's diff, file
# paths, author/committer identities and messages: what a first `git push` would publish.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"

history=0
if [ "${1:-}" = "--history" ]; then history=1; shift; fi
target="${1:-$repo}"

list="$repo/local/forbidden.txt"
if [ ! -f "$list" ]; then
  echo "no local/forbidden.txt; nothing to check"
  exit 0
fi
patterns="$(grep -v -e '^[[:space:]]*$' -e '^#' "$list" || true)"
[ -n "$patterns" ] || { echo "privacy check passed (no patterns)"; exit 0; }

cd "$target"
hits="$( { git ls-files; git ls-files --others --exclude-standard; ls assets/*.svg 2>/dev/null || true; } \
  | sort -u | while IFS= read -r f; do [ -f "$f" ] && printf '%s\0' "$f"; done \
  | xargs -0 -r grep -I -n -o -i -F -e "$patterns" -- 2>/dev/null || true)"

if [ "$history" = 1 ]; then
  history_hits="$(git log --all -p --format='commit %H%nauthor %an <%ae>%ncommitter %cn <%ce>%n%B' 2>/dev/null \
    | grep -n -o -i -F -e "$patterns" | sed 's/^/history:/' || true)"
  hits="$(printf '%s\n%s' "$hits" "$history_hits" | sed '/^$/d')"
fi

if [ -n "$hits" ]; then
  echo "privacy check failed:"
  echo "$hits" | head -40
  exit 1
fi
echo "privacy check passed"
