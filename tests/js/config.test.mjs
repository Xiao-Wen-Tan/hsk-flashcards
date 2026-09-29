import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, normalizeSettings } from '../../docs/js/config.js';

test('the ladder has nine steps from 1 to 240 days', () => {
  assert.deepEqual(CONFIG.ladder, [1, 2, 4, 7, 15, 30, 60, 120, 240]);
  assert.equal(CONFIG.masteredStep, 7);
});

test('config cannot be changed at run time', () => {
  assert.throws(() => { CONFIG.reviewCap = 5; }, TypeError);
  assert.throws(() => { CONFIG.ladder.push(480); }, TypeError);
});

test('missing settings get the defaults', () => {
  assert.deepEqual(normalizeSettings(undefined), { reviewCap: 100, newPerDay: 12 });
  assert.deepEqual(normalizeSettings(null), { reviewCap: 100, newPerDay: 12 });
});

test('settings are kept inside their ranges and other keys survive', () => {
  assert.deepEqual(normalizeSettings({ newPerDay: 50, reviewCap: 5, autoplay: false }),
    { newPerDay: 30, reviewCap: 20, autoplay: false });
  assert.deepEqual(normalizeSettings({ newPerDay: '8', reviewCap: 'abc' }), { newPerDay: 8, reviewCap: 100 });
});
