import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borderBits, decodeBorder } from '../src/weave/egg.ts';

for (const msg of ['halo, dunia!', 'hi', 'x', '']) {
  test(`round-trips ${JSON.stringify(msg)}`, () => {
    assert.equal(decodeBorder(borderBits(msg, 100)), msg);
  });
}

test('filler alternates outside the message', () => {
  const b = borderBits('hi', 100);
  assert.equal(b.length, 100);
  assert.deepEqual(b.slice(0, 2), [1, 0]);
  assert.deepEqual(b.slice(18, 22), [1, 0, 1, 0]);
});

test('message bits are MSB-first ASCII from index 2', () => {
  // 'h' = 0x68 = 01101000
  assert.deepEqual(borderBits('h', 100).slice(2, 10), [0, 1, 1, 0, 1, 0, 0, 0]);
});

test('rejects >12 chars, non-ASCII, and messages that do not fit', () => {
  assert.throws(() => borderBits('thirteen chars', 100));
  assert.throws(() => borderBits('héllo', 100));
  assert.throws(() => borderBits('twelve chars', 90));
});
