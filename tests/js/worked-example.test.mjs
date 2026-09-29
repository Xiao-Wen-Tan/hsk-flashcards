// The design's worked example is 苹果 (píngguǒ, apple), first learned on Monday 5 October 2026.
// Each row is [date, quiz, answer, step after, next review], copied from the design's
// table as corrected on 2026-09-28. The quiz names are 'listen' (listen, pick meaning),
// 'pinyin' (meaning, pick pinyin) and 'recall' (recall and self-rate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMastered, learnedProgress, quizForReview, review } from '../../docs/js/srs.js';

const ROWS = [
  ['2026-10-06', 'listen', 'right', 2, '2026-10-08'],
  ['2026-10-08', 'pinyin', 'wrong', 1, '2026-10-09'],
  ['2026-10-09', 'recall', 'know', 2, '2026-10-11'],
  ['2026-10-11', 'pinyin', 'right', 3, '2026-10-15'],
  ['2026-10-15', 'listen', 'right', 4, '2026-10-22'],
  ['2026-10-22', 'pinyin', 'right', 5, '2026-11-06'],
  ['2026-11-06', 'recall', 'unsure', 5, '2026-11-13'],
  ['2026-11-13', 'listen', 'right', 6, '2026-12-13'],
  ['2026-12-13', 'pinyin', 'right', 7, '2027-02-11'],
];

test('苹果 follows the design table row by row, quiz column included', () => {
  let p = learnedProgress('w0026', '2026-10-05');
  assert.equal(p.step, 1);
  assert.equal(p.due, '2026-10-06');
  for (const [day, quiz, grade, step, due] of ROWS) {
    assert.equal(p.due, day, `the word is due on ${day}`);
    assert.equal(quizForReview(p), quiz, `quiz on ${day}`);
    p = review(p, grade, day);
    assert.equal(p.step, step, `step after ${day}`);
    assert.equal(p.due, due, `next review after ${day}`);
  }
  assert.ok(isMastered(p));
  assert.equal(p.reps, 9);
});

test('the Oct 8 re-ask the same day does not move the word or change the Oct 9 quiz', () => {
  let p = learnedProgress('w0026', '2026-10-05');
  p = review(p, 'right', '2026-10-06');
  p = review(p, 'wrong', '2026-10-08');
  const again = review(p, 'know', '2026-10-08');
  assert.equal(again.step, 1);
  assert.equal(again.due, '2026-10-09');
  assert.equal(again.reps, 2);
  assert.equal(quizForReview(again), 'recall');
});
