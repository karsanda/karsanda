/** WEAVE_NOTIFY_CMD gets (title, message); otherwise the platform's own desktop alert. */
export function notifyCommand(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, title: string, message: string): [string, string[]] {
  if (env.WEAVE_NOTIFY_CMD) return [env.WEAVE_NOTIFY_CMD, [title, message]];
  if (platform === 'darwin') {
    // Passed as argv, never spliced into the AppleScript source.
    const script = ['on run argv', 'display notification (item 2 of argv) with title (item 1 of argv)', 'end run'];
    return ['osascript', [...script.flatMap((line) => ['-e', line]), title, message]];
  }
  return ['notify-send', [title, message]];
}
