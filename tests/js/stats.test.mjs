import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL_GROUPS, accuracy, activity, forecast, groupsDone, levelProgress, liveEvents, mapSections, themesDone, totals,
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

test('progress per HSK level for the Stats screen', () => {
  const lv1 = data.words.filter((w) => w.lv === 1);
  const progress = mapOf([...lv1.map((w) => at(w.id, 1)), at(data.words.find((w) => w.lv === 2).id, 8)]);
  assert.deepEqual(levelProgress(data.words, progress), [
    { lv: 1, total: 47, learned: 47, mastered: 0 },
    { lv: 2, total: 14, learned: 1, mastered: 1 },
  ]);
});

test('the level groups are HSK 1-2 together, then 3, 4, 5 and 6, and a group is done when all its words are learned', () => {
  assert.deepEqual(LEVEL_GROUPS.map((g) => [g.id, g.label, g.levels]), [
    ['1-2', 'HSK 1-2', [1, 2]], ['3', 'HSK 3', [3]], ['4', 'HSK 4', [4]], ['5', 'HSK 5', [5]], ['6', 'HSK 6', [6]],
  ]);
  const lv1 = data.words.filter((w) => w.lv === 1);
  assert.deepEqual(groupsDone(data.words, mapOf(lv1.map((w) => at(w.id, 1)))), []);
  assert.deepEqual(groupsDone(data.words, mapOf(data.words.map((w) => at(w.id, 1)))), ['1-2']);
});

test('the progress map marks themes done, current or locked, with learned and mastered shares', () => {
  const t01 = data.words.filter((w) => w.theme === 't01');
  const t02 = data.words.filter((w) => w.theme === 't02');
  const progress = mapOf([...t01.map((w) => at(w.id, 7)), at(t02[0].id, 1), at(t02[1].id, 2)]);
  const sections = mapSections(data.themes, data.words, progress);
  assert.deepEqual(sections.map((s) => [s.id, s.label, s.total, s.learned, s.done]), [['1-2', 'HSK 1-2', 61, 14, false]]);
  const map = sections[0].tiles;
  assert.deepEqual(map.map((t) => t.status), ['done', 'current', 'locked', 'locked', 'locked']);
  assert.equal(map[0].masteredShare, 1);
  assert.equal(map[1].learned, 2);
  assert.equal(map[1].learnedShare, 0.2);
  assert.equal(map[1].masteredShare, 0);
  assert.deepEqual(themesDone(data.themes, data.words, progress), ['t01']);
});

// Six words in the order of the user's decision of 2026-09-29: level group first, then theme.
const THEMES3 = [{ id: 't01', order: 1, name: 'Starter Kit' }, { id: 't02', order: 2, name: 'Food & Drink' },
  { id: 't03', order: 3, name: 'Transport & Travel' }];
const WORDS3 = [['a', 't01', 1], ['b', 't01', 2], ['c', 't02', 1], ['d', 't01', 3], ['e', 't03', 3], ['f', 't02', 5]]
  .map(([id, theme, lv], i) => ({ id, theme, lv, ord: i + 1 }));

test('the map has a section per level group, each with the themes that have words in it', () => {
  const learned = (ids) => mapOf(ids.map((id) => at(id, 1)));
  const tiles = (sections) => sections.map((s) => [s.label, s.done, s.tiles.map((t) => [t.name, t.total, t.status])]);
  assert.deepEqual(tiles(mapSections(THEMES3, WORDS3, learned(['a', 'b', 'c']))), [
    ['HSK 1-2', true, [['Starter Kit', 2, 'done'], ['Food & Drink', 1, 'done']]],
    ['HSK 3', false, [['Starter Kit', 1, 'current'], ['Transport & Travel', 1, 'locked']]],
    ['HSK 5', false, [['Food & Drink', 1, 'locked']]],
  ]);
  assert.deepEqual(themesDone(THEMES3, WORDS3, learned(['a', 'b', 'c'])), []);
  const later = learned(['a', 'b', 'c', 'd']);
  assert.deepEqual(mapSections(THEMES3, WORDS3, later)[1].tiles.map((t) => t.status), ['done', 'current']);
  assert.deepEqual(themesDone(THEMES3, WORDS3, later), ['t01']);
  assert.deepEqual(groupsDone(WORDS3, later), ['1-2']);
});

test('a tile with a learned word is started, never locked, when it is not the current tile', () => {
  // 'c' failed its lesson, so it is the next new word, while 'd' of the next tile was learned.
  const progress = mapOf(['a', 'b', 'd'].map((id) => at(id, 1)));
  const tiles = mapSections(THEMES3, WORDS3, progress).map((s) => s.tiles.map((t) => [t.name, t.status]));
  assert.deepEqual(tiles, [
    [['Starter Kit', 'done'], ['Food & Drink', 'current']],
    [['Starter Kit', 'done'], ['Transport & Travel', 'locked']],
    [['Food & Drink', 'locked']],
  ]);
  const words = WORDS3.map((w) => (w.id === 'e' ? { ...w, theme: 't01' } : w)); // HSK 3 Starter Kit: d and e
  const half = mapSections(THEMES3, words, progress)[1].tiles[0];
  assert.deepEqual([half.name, half.learned, half.total, half.status], ['Starter Kit', 1, 2, 'started']);
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
