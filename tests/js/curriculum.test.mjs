import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextNewWords } from '../../docs/js/curriculum.js';
import { failedLessonProgress, learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const idsByOrd = data.words.slice().sort((a, b) => a.ord - b.ord).map((w) => w.id);
const map = (...records) => new Map(records.map((p) => [p.id, p]));

test('new words come in ord order, not id order', () => {
  const ids = nextNewWords(data.words, new Map(), 4, '2026-10-05');
  assert.deepEqual(ids, idsByOrd.slice(0, 4));
  assert.deepEqual(ids.map((id) => data.words.find((w) => w.id === id).hz), ['我', '你', '他', '她']);
});

test('learned words are skipped', () => {
  const progress = map(learnedProgress(idsByOrd[0], '2026-10-01'), learnedProgress(idsByOrd[2], '2026-10-01'));
  assert.deepEqual(nextNewWords(data.words, progress, 3, '2026-10-05'), [idsByOrd[1], idsByOrd[3], idsByOrd[4]]);
});

test('a failed lesson waits for the next study day, then comes first', () => {
  const progress = map(learnedProgress(idsByOrd[0], '2026-10-05'), failedLessonProgress(idsByOrd[1], '2026-10-05'));
  assert.deepEqual(nextNewWords(data.words, progress, 2, '2026-10-05'), [idsByOrd[2], idsByOrd[3]]);
  assert.deepEqual(nextNewWords(data.words, progress, 2, '2026-10-06'), [idsByOrd[1], idsByOrd[2]]);
});

test('zero asked gives none, and the list ends with the words', () => {
  assert.deepEqual(nextNewWords(data.words, new Map(), 0, '2026-10-05'), []);
  assert.equal(nextNewWords(data.words, new Map(), 500, '2026-10-05').length, 61);
});
