import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speakList, speakStatus, spokenWellBefore } from '../../docs/js/speaklist.js';
import { failedLessonProgress, learnedProgress } from '../../docs/js/srs.js';

const DAY = '2026-10-06';
let seq = 0;
const ans = (day, id, kind = 'final') => ({ seq: ++seq, day, kind, id, grade: 'right' });
const spoke = (day, id, result) => ({ seq: ++seq, day, kind: 'speak', id, result, tries: 1, check: { tones: 1, heard: null } });
const reviewed = (id, day) => ({ ...learnedProgress(id, '2026-10-01'), step: 2, lastReview: day });

// On 6 October c and a are reviewed (in that order), b is a new word learned, and d is a new word
// whose lesson ended without passing. e was learned on 5 October and is not studied today.
function day6() {
  const progress = [
    reviewed('a', DAY), learnedProgress('b', DAY), reviewed('c', DAY), failedLessonProgress('d', DAY), learnedProgress('e', '2026-10-05'),
  ];
  const events = [
    ans('2026-10-05', 'e'), spoke('2026-10-05', 'e', 'pass'),
    ans(DAY, 'c', 'review'), ans(DAY, 'a', 'review'), ans(DAY, 'b', 'check'), ans(DAY, 'd', 'check'), ans(DAY, 'b'), ans(DAY, 'd'),
  ];
  return { progress, events };
}

test('the list holds the words studied that day, new and reviewed, in the order they were studied', () => {
  const { progress, events } = day6();
  assert.deepEqual(speakList({ progress, events, day: DAY }), ['c', 'a', 'b', 'd']);
  assert.deepEqual(speakList({ progress, events, day: '2026-10-05' }), ['e']);
});

test('a word skipped on its latest earlier day comes back until it is spoken', () => {
  const { progress, events } = day6();
  // x was skipped on 4 October and y on 5 October, z was skipped on 3 and passed on 4 October.
  const more = [
    spoke('2026-10-03', 'z', 'skip'), spoke('2026-10-04', 'x', 'skip'), spoke('2026-10-04', 'z', 'pass'), spoke('2026-10-05', 'y', 'skip'),
  ];
  const all = [...events, ...more];
  assert.deepEqual(speakList({ progress, events: all, day: DAY }), ['c', 'a', 'b', 'd', 'x', 'y']);
  // Skipped again today, x comes back tomorrow. Spoken today, y does not.
  const today = [...all, spoke(DAY, 'x', 'skip'), spoke(DAY, 'y', 'listened')];
  assert.deepEqual(speakList({ progress, events: today, day: '2026-10-07' }), ['x']);
  // Before any learning on 7 October, the list holds only the carried word.
  assert.deepEqual(speakStatus({ progress, events: today, day: '2026-10-07' }), { list: ['x'], done: [], left: ['x'] });
});

test('the list is done when every word has a speak event that day', () => {
  const { progress, events } = day6();
  const half = [...events, spoke(DAY, 'c', 'pass'), spoke(DAY, 'a', 'skip')];
  assert.deepEqual(speakStatus({ progress, events: half, day: DAY }), { list: ['c', 'a', 'b', 'd'], done: ['c', 'a'], left: ['b', 'd'] });
  const all = [...half, spoke(DAY, 'b', 'listened'), spoke(DAY, 'd', 'pass')];
  assert.deepEqual(speakStatus({ progress, events: all, day: DAY }).left, []);
});

test('a word spoken well on an earlier day is known', () => {
  const { events } = day6();
  assert.equal(spokenWellBefore(events, 'e', DAY), true);
  assert.equal(spokenWellBefore(events, 'e', '2026-10-05'), false);
  assert.equal(spokenWellBefore([spoke('2026-10-05', 'f', 'skip')], 'f', DAY), false);
});
