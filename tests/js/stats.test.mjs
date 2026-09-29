import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accuracy, activity, forecast, levelProgress, levelsDone, liveEvents, themeProgress, themesDone, totals,
} from '../../docs/js/stats.js';
import { failedLessonProgress, learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const TODAY = '2026-10-20';
const at = (id, step, due = '2026-10-25') => ({ ...learnedProgress(id, '2026-10-01'), step, due });
const mapOf = (list) => new Map(list.map((p) => [p.id, p]));

test('Undo takes an event out of every count', () => {
  const events = [
    { seq: 1, day: TODAY, kind: 'review', grade: 'right' },
    { seq: 2, day: TODAY, kind: 'review', grade: 'wrong' },
    { seq: 3, day: TODAY, kind: 'undo', target: 2 },
  ];
  assert.deepEqual(liveEvents(events).map((e) => e.seq), [1]);
});

test('learned and mastered totals', () => {
  const list = [at('a', 1), at('b', 6), at('c', 7), at('d', 9), failedLessonProgress('e', TODAY)];
  assert.deepEqual(totals(list), { learned: 4, mastered: 2 });
});

test('progress per HSK level, and finished levels', () => {
  const lv1 = data.words.filter((w) => w.lv === 1);
  const progress = mapOf([...lv1.map((w) => at(w.id, 1)), at(data.words.find((w) => w.lv === 2).id, 8)]);
  assert.deepEqual(levelProgress(data.words, progress), [
    { lv: 1, total: 47, learned: 47, mastered: 0 },
    { lv: 2, total: 14, learned: 1, mastered: 1 },
  ]);
  assert.deepEqual(levelsDone(data.words, progress), [1]);
});

test('the progress map marks themes done, current or locked, with learned and mastered shares', () => {
  const t01 = data.words.filter((w) => w.theme === 't01');
  const t02 = data.words.filter((w) => w.theme === 't02');
  const progress = mapOf([...t01.map((w) => at(w.id, 7)), at(t02[0].id, 1), at(t02[1].id, 2)]);
  const map = themeProgress(data.themes, data.words, progress);
  assert.deepEqual(map.map((t) => t.status), ['done', 'current', 'locked', 'locked', 'locked']);
  assert.equal(map[0].masteredShare, 1);
  assert.equal(map[1].learned, 2);
  assert.equal(map[1].learnedShare, 0.2);
  assert.equal(map[1].masteredShare, 0);
  assert.deepEqual(themesDone(data.themes, data.words, progress), ['t01']);
});

test('30-day activity counts reviews and learned words per day', () => {
  const events = [
    { seq: 1, day: '2026-09-20', kind: 'review', grade: 'right' }, // 31 days ago, so left out
    { seq: 2, day: '2026-09-21', kind: 'review', grade: 'right' },
    { seq: 3, day: TODAY, kind: 'review', grade: 'right' },
    { seq: 4, day: TODAY, kind: 'reask', grade: 'know' },
    { seq: 5, day: TODAY, kind: 'final', grade: 'right', outcome: 'learned' },
  ];
  const rows = activity(events, [TODAY], TODAY);
  assert.equal(rows.length, 30);
  assert.deepEqual(rows[0], { day: '2026-09-21', reviews: 1, learned: 0, checkedIn: false });
  assert.deepEqual(rows[29], { day: TODAY, reviews: 1, learned: 1, checkedIn: true });
});

test('7-day forecast puts overdue words on today', () => {
  const list = [at('a', 1, '2026-10-18'), at('b', 1, TODAY), at('c', 2, '2026-10-22'), at('d', 3, '2026-10-26'),
    at('e', 3, '2026-10-27'), failedLessonProgress('f', TODAY)];
  assert.deepEqual(forecast(list, TODAY).map((r) => r.due), [2, 0, 1, 0, 0, 0, 1]);
});

test('7-day accuracy counts only scheduled reviews', () => {
  const events = [
    { seq: 1, day: '2026-10-13', kind: 'review', grade: 'wrong' }, // 8 days ago, so left out
    { seq: 2, day: '2026-10-14', kind: 'review', grade: 'right' },
    { seq: 3, day: TODAY, kind: 'review', grade: 'know' },
    { seq: 4, day: TODAY, kind: 'review', grade: 'unsure' },
    { seq: 5, day: TODAY, kind: 'review', grade: 'wrong' },
    { seq: 6, day: TODAY, kind: 'reask', grade: 'know' },
  ];
  assert.deepEqual(accuracy(events, TODAY), { answered: 4, right: 2, rate: 0.5 });
  assert.deepEqual(accuracy([], TODAY), { answered: 0, right: 0, rate: null });
});
