import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashString, mulberry32, seeded, shuffled } from '../../docs/js/rng.js';

test('hashString matches the published FNV-1a values', () => {
  assert.equal(hashString(''), 2166136261);
  assert.equal(hashString('a'), 3826002220);
});

test('the same seed gives the same numbers, all from 0 up to 1', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('seeded is keyed by all its parts', () => {
  assert.equal(seeded('w0001', '2026-10-05')(), seeded('w0001', '2026-10-05')());
  assert.notEqual(seeded('w0001', '2026-10-05')(), seeded('w0001', '2026-10-06')());
});

test('shuffled keeps every item and leaves the input alone', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffled(input, mulberry32(7));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(out.slice().sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(shuffled(input, mulberry32(7)), out);
});
