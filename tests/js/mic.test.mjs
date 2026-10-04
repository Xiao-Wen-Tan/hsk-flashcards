import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopper } from '../../docs/js/ui/mic.js';

// Feeds a level every 50 ms and says when the try ended and why.
function runLevels(levels) {
  const decide = stopper();
  for (let i = 0; i < levels.length; i += 1) {
    const said = decide(levels[i], i * 50);
    if (said) return [said, i * 50];
  }
  return [null, levels.length * 50];
}

test('a try ends 0.7 seconds after the voice stops', () => {
  // A quiet room (0.002), a word from 0.5 s to 1.2 s (0.2), then quiet again.
  const levels = [...Array(10).fill(0.002), ...Array(14).fill(0.2), ...Array(40).fill(0.002)];
  assert.deepEqual(runLevels(levels), ['done', 1900]);
});

test('with no voice the try ends after 4 seconds, and a long one after 6', () => {
  assert.deepEqual(runLevels(Array(200).fill(0.002)), ['silent', 4000]);
  assert.deepEqual(runLevels([...Array(6).fill(0.002), ...Array(200).fill(0.3)]), ['done', 6000]);
});

test('a noisy room needs a voice four times louder than its noise', () => {
  // With noise at 0.05 from the start, 0.15 is not voice and 0.3 is.
  const levels = [...Array(10).fill(0.05), ...Array(10).fill(0.15), ...Array(10).fill(0.3), ...Array(20).fill(0.05)];
  assert.deepEqual(runLevels(levels), ['done', 2200]); // voice from 1.0 s to 1.5 s, then 0.7 s of quiet
});
