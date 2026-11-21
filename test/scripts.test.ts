import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('npm run weave loads local/weave.env when present (shell values still win)', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.weave, 'node --env-file-if-exists=local/weave.env src/cli.ts');
});
