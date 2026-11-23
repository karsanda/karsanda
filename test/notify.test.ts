import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifyCommand } from '../src/notify.ts';

test('WEAVE_NOTIFY_CMD wins on every platform', () =>
  assert.deepEqual(notifyCommand({ WEAVE_NOTIFY_CMD: '/x/notify' }, 'darwin', 'T', 'M'), ['/x/notify', ['T', 'M']]));

test('Linux uses notify-send', () =>
  assert.deepEqual(notifyCommand({}, 'linux', 'T', 'M'), ['notify-send', ['T', 'M']]));

test('macOS uses osascript with the text as argv, not script source', () => {
  const [cmd, args] = notifyCommand({}, 'darwin', 'T', 'say "hi"; do shell script "x"');
  assert.equal(cmd, 'osascript');
  assert.deepEqual(args.slice(-2), ['T', 'say "hi"; do shell script "x"']);
  assert.ok(args.slice(0, -2).every((a) => a === '-e' || !a.includes('do shell script')));
});
