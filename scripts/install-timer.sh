#!/usr/bin/env bash
# Installs and starts the weekly songket timer (systemd user units).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f local/weave.env ]; then
  echo "local/weave.env is missing: copy weave.env.example to local/weave.env and fill it in" >&2
  exit 1
fi

mkdir -p "$HOME/.config/systemd/user"
cp systemd/karsanda-weave.service systemd/karsanda-weave.timer "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now karsanda-weave.timer
systemctl --user list-timers karsanda-weave.timer --no-pager
