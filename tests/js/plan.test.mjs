import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDayDone, newQuota, planDay, sortDue } from '../../docs/js/plan.js';
import { failedLessonProgress, learnedProgress } from '../../docs/js/srs.js';
import { syntheticWords } from './helpers.mjs';

const TODAY = '2026-10-20';
const SETTINGS = { reviewCap: 100, newPerDay: 12 };
const rec = (id, step, due, extra = {}) => ({ ...learnedProgress(id, '2026-09-01'), step, due, ...extra });

test('the new-word quota is full up to the cap, halved up to twice the cap, and zero above', () => {
  assert.equal(newQuota(0, 100, 12), 12);
  assert.equal(newQuota(100, 100, 12), 12);
  assert.equal(newQuota(101, 100, 12), 6);
  assert.equal(newQuota(200, 100, 12), 6);
  assert.equal(newQuota(201, 100, 12), 0);
  assert.equal(newQuota(150, 100, 13), 6);
});

test('most overdue first, by days overdue divided by the gap, then lower step', () => {
  const list = [
    rec('late30', 6, '2026-10-10'), // 10 days late on a 30-day gap gives 0.33
    rec('late2', 2, '2026-10-17'), // 3 days late on a 2-day gap gives 1.5
    // The next two tie at 0 and share a due day. Their IDs sort the opposite way to their
    // steps ('a-step4' comes before 'b-step1' alphabetically), so only the lower-step rule
    // can put 'b-step1' first. Without that rule the ID fallback would put 'a-step4' first.
    rec('a-step4', 4, TODAY), // 0
    rec('b-step1', 1, TODAY), // 0, and a lower step than a-step4
    rec('late1', 1, '2026-10-19'), // 1 day late on a 1-day gap gives 1.0
  ];
  assert.deepEqual(sortDue(list, TODAY).map((p) => p.id), ['late2', 'late1', 'late30', 'b-step1', 'a-step4']);
});

function progressWithDue(n) {
  return Array.from({ length: n }, (_, i) =>
    rec(`x${String(i + 1).padStart(5, '0')}`, 1 + (i % 5), TODAY));
}

test('a normal day has all due reviews and 12 new words', () => {
  const words = syntheticWords(300);
  const plan = planDay({ words, progress: progressWithDue(40), today: TODAY, settings: SETTINGS });
  assert.equal(plan.reviews.length, 40);
  assert.equal(plan.quota, 12);
  assert.deepEqual(plan.newWords, words.slice(40, 52).map((w) => w.id));
});

test('150 due reviews give 100 reviews and 6 new words', () => {
  const plan = planDay({ words: syntheticWords(400), progress: progressWithDue(150), today: TODAY, settings: SETTINGS });
  assert.equal(plan.reviews.length, 100);
  assert.equal(plan.backlog, 150);
  assert.equal(plan.newWords.length, 6);
});

test('250 due reviews give 100 reviews and no new words', () => {
  const plan = planDay({ words: syntheticWords(400), progress: progressWithDue(250), today: TODAY, settings: SETTINGS });
  assert.equal(plan.reviews.length, 100);
  assert.equal(plan.newWords.length, 0);
});

test('a second session the same day only gets what is left of the cap and quota', () => {
  const progress = progressWithDue(150);
  for (let i = 0; i < 100; i++) progress[i] = { ...progress[i], lastReview: TODAY, due: '2026-10-22' };
  const words = syntheticWords(400);
  progress.push(learnedProgress(words[200].id, TODAY), learnedProgress(words[201].id, TODAY));
  const plan = planDay({ words, progress, today: TODAY, settings: SETTINGS });
  assert.equal(plan.reviewsDone, 100);
  assert.equal(plan.backlog, 150);
  assert.equal(plan.reviews.length, 0);
  assert.equal(plan.newDone, 2);
  assert.equal(plan.newWords.length, 4);
});

test('an unfinished word from yesterday comes first and counts toward the quota', () => {
  const words = syntheticWords(100);
  const progress = [failedLessonProgress(words[0].id, '2026-10-19')];
  const plan = planDay({ words, progress, today: TODAY, settings: SETTINGS });
  assert.equal(plan.newWords.length, 12);
  assert.equal(plan.newWords[0], words[0].id);
});

test('the day is done when no reviews and no new words are left', () => {
  assert.ok(isDayDone({ reviews: [], newWords: [] }));
  assert.ok(!isDayDone({ reviews: ['a'], newWords: [] }));
  assert.ok(!isDayDone({ reviews: [], newWords: ['a'] }));
});
