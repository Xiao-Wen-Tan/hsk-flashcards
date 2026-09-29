import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  failedLessonProgress, intervalFor, isLearned, isMastered, learnedProgress, quizForReview, review,
} from '../../docs/js/srs.js';

const DAY = '2026-10-10';
const at = (step, extra = {}) => ({ ...learnedProgress('w0001', '2026-01-01'), step, ...extra });

test('a learned word is step 1 and due tomorrow', () => {
  assert.deepEqual(learnedProgress('w0001', '2026-10-05'), {
    id: 'w0001', step: 1, due: '2026-10-06', reps: 0, lapses: 0, lastReview: null, lastGrade: null,
    learned: '2026-10-05', lessonDay: '2026-10-05',
  });
});

test('a failed lesson is step 0 with no due day', () => {
  const p = failedLessonProgress('w0001', '2026-10-05');
  assert.equal(p.step, 0);
  assert.equal(p.due, null);
  assert.equal(p.lessonDay, '2026-10-05');
  assert.ok(!isLearned(p));
});

test('right or Know it moves up one step, with that step\'s gap', () => {
  const expected = [[1, 2, '2026-10-12'], [2, 3, '2026-10-14'], [3, 4, '2026-10-17'], [4, 5, '2026-10-25'],
    [5, 6, '2026-11-09'], [6, 7, '2026-12-09'], [7, 8, '2027-02-07'], [8, 9, '2027-06-07'], [9, 9, '2027-06-07']];
  for (const [from, to, due] of expected) {
    for (const grade of ['right', 'know']) {
      const p = review(at(from), grade, DAY);
      assert.equal(p.step, to, `step ${from} ${grade}`);
      assert.equal(p.due, due, `step ${from} ${grade}`);
    }
  }
});

test('Unsure keeps the step and comes back after half the gap, at least 1 day', () => {
  const expected = [[1, '2026-10-11'], [2, '2026-10-11'], [3, '2026-10-12'], [4, '2026-10-13'],
    [5, '2026-10-17'], [6, '2026-10-25'], [9, '2027-02-07']];
  for (const [step, due] of expected) {
    const p = review(at(step), 'unsure', DAY);
    assert.equal(p.step, step);
    assert.equal(p.due, due, `step ${step}`);
  }
});

test('wrong or Don\'t know drops two steps, never below 1, due tomorrow', () => {
  const expected = [[1, 1], [2, 1], [3, 1], [4, 2], [7, 5], [9, 7]];
  for (const [from, to] of expected) {
    for (const grade of ['wrong', 'dontknow']) {
      const p = review(at(from), grade, DAY);
      assert.equal(p.step, to, `step ${from} ${grade}`);
      assert.equal(p.due, '2026-10-11');
      assert.equal(p.lapses, 1);
    }
  }
});

test('only the first answer of a study day changes the schedule', () => {
  const first = review(at(3), 'wrong', DAY);
  assert.equal(first.step, 1);
  assert.equal(first.reps, 1);
  assert.equal(first.lastGrade, 'wrong');
  const second = review(first, 'right', DAY);
  assert.equal(second, first);
  const nextDay = review(first, 'right', '2026-10-11');
  assert.equal(nextDay.step, 2);
  assert.equal(nextDay.reps, 2);
});

test('mastered means step 7 or above', () => {
  assert.ok(!isMastered(at(6)));
  assert.ok(isMastered(at(7)));
  assert.ok(isMastered(at(9)));
  assert.ok(!isMastered(undefined));
});

test('step 1 gets listen, step 2 gets pinyin, and from step 3 the turn follows the review count', () => {
  assert.equal(quizForReview(at(1, { reps: 5 })), 'listen');
  assert.equal(quizForReview(at(2, { reps: 5 })), 'pinyin');
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((reps) => quizForReview(at(3, { reps }))),
    ['recall', 'listen', 'pinyin', 'recall', 'listen', 'pinyin', 'recall', 'listen', 'pinyin']);
  assert.equal(quizForReview(at(7, { reps: 8 })), 'pinyin');
});

test('the first review after a wrong answer is always a recall card, at any step', () => {
  for (const grade of ['wrong', 'dontknow']) {
    for (let step = 1; step <= 9; step++) {
      for (const reps of [0, 1, 2]) {
        const p = review(at(step, { reps }), grade, DAY);
        assert.equal(quizForReview(p), 'recall', `step ${step}, reps ${reps}, ${grade}`);
      }
    }
  }
});

test('Unsure and right answers do not force a recall card', () => {
  assert.equal(quizForReview(review(at(1), 'unsure', DAY)), 'listen');
  assert.equal(quizForReview(at(2, { reps: 3, lastGrade: 'unsure' })), 'pinyin');
  assert.equal(quizForReview(at(5, { reps: 7, lastGrade: 'unsure' })), 'listen');
  assert.equal(quizForReview(at(5, { reps: 7, lastGrade: 'know' })), 'listen');
  assert.equal(quizForReview(review(review(at(2), 'wrong', DAY), 'know', '2026-10-11')), 'pinyin');
});

test('bad input is refused', () => {
  assert.throws(() => review(at(2), 'maybe', DAY), /Unknown grade/);
  assert.throws(() => review(failedLessonProgress('w0001', DAY), 'right', DAY), /not learned/);
  assert.equal(intervalFor(9), 240);
});
