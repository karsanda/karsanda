import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('npm run weave loads local/weave.env when present (shell values still win)', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.weave, 'node --env-file-if-exists=local/weave.env src/cli.ts');
});

test('the timer tries hourly on weekdays from 10:30 to 17:30 Jakarta time, catching up after sleep', () => {
  const timer = readFileSync('systemd/karsanda-weave.timer', 'utf8');
  assert.match(timer, /^OnCalendar=Mon\.\.Fri 10\.\.17:30 Asia\/Jakarta$/m);
  assert.match(timer, /^Persistent=true$/m);
});

test('the launchd agent tries at the same slots as the systemd timer', () => {
  const plist = readFileSync('launchd/local.karsanda.weave.plist', 'utf8');
  const slots = [...plist.matchAll(/<key>Weekday<\/key><integer>(\d+)<\/integer><key>Hour<\/key><integer>(\d+)<\/integer><key>Minute<\/key><integer>(\d+)<\/integer>/g)]
    .map(([, d, h, m]) => `${d} ${h}:${m}`);
  const expected = [1, 2, 3, 4, 5].flatMap((d) => [10, 11, 12, 13, 14, 15, 16, 17].map((h) => `${d} ${h}:30`));
  assert.deepEqual(slots, expected);
  assert.match(plist, /<string>__REPO__\/scripts\/publish\.sh<\/string>/);
});
