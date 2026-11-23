#!/usr/bin/env bash
# Installs and starts the weekly songket timer: systemd user units on Linux, a launchd agent on macOS.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f local/weave.env ]; then
  echo "local/weave.env is missing: copy weave.env.example to local/weave.env and fill it in" >&2
  exit 1
fi

if [ "$(uname -s)" = Darwin ]; then
  label=local.karsanda.weave
  # launchd fires in the Mac's local time; the 10:30-17:30 window assumes WIB.
  case "$(readlink /etc/localtime)" in
    */Asia/Jakarta) ;;
    *) echo "warning: this Mac's time zone is not Asia/Jakarta, so the tries will not land at 10:30-17:30 WIB" >&2 ;;
  esac
  agents="$HOME/Library/LaunchAgents"
  mkdir -p "$agents" "$HOME/Library/Logs"
  sed -e "s|__REPO__|$PWD|g" -e "s|__HOME__|$HOME|g" "launchd/$label.plist" > "$agents/$label.plist"
  plutil -lint -s "$agents/$label.plist"
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$agents/$label.plist"
  echo "installed $label; log: ~/Library/Logs/karsanda-weave.log; run now: launchctl kickstart gui/$(id -u)/$label"
  exit 0
fi

mkdir -p "$HOME/.config/systemd/user"
cp systemd/karsanda-weave.service systemd/karsanda-weave.timer "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now karsanda-weave.timer
systemctl --user list-timers karsanda-weave.timer --no-pager
