import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgesView, calendarWeeks, checkinView, mapView, statsView, themeWordsView, wordStatus,
} from '../../docs/js/view/progress.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const TODAY = '2026-10-20';
const at = (id, step, due = '2026-10-25') => ({ ...learnedProgress(id, '2026-10-01'), step, due });
const mapOf = (list) => new Map(list.map((p) => [p.id, p]));
const t01 = data.words.filter((w) => w.theme === 't01');
const t02 = data.words.filter((w) => w.theme === 't02');

test('the map has a tile per theme, done, current or locked, with shares', () => {
  const sections = mapView(data, mapOf([...t01.map((w) => at(w.id, 7)), at(t02[0].id, 1), at(t02[1].id, 2)]));
  assert.deepEqual(sections.map((s) => [s.title, s.statusLabel, s.counts]), [['HSK 1-2', '', '14 of 61 learned']]);
  const tiles = sections[0].tiles;
  assert.deepEqual(tiles.map((t) => [t.id, t.name, t.statusLabel]), [
    ['t01', 'Starter Kit', 'Done'], ['t02', 'Greetings & Courtesy', 'Now'], ['t03', 'Numbers & Measure Words', 'Locked'],
    ['t04', 'Family & People', 'Locked'], ['t05', 'Food & Drink', 'Locked'],
  ]);
  assert.deepEqual(tiles.map((t) => t.href).slice(0, 2), ['#/theme/t01/1-2', '#/theme/t02/1-2']);
  assert.deepEqual([tiles[0].learnedPct, tiles[0].masteredPct], ['100%', '100%']);
  assert.deepEqual([tiles[1].learnedPct, tiles[1].masteredPct, tiles[1].counts], ['20%', '0%', '2 of 10 learned, 0 mastered']);
});

test("a finished level group says Done, and its tiles count only that group's words", () => {
  const themes = [{ id: 't01', order: 1, name: 'Starter Kit' }, { id: 't02', order: 2, name: 'Food & Drink' }];
  const words = [['a', 't01', 1], ['b', 't02', 2], ['c', 't02', 3], ['d', 't01', 4]]
    .map(([id, theme, lv], i) => ({ id, theme, lv, ord: i + 1 }));
  const sections = mapView({ themes, words }, mapOf([at('a', 1), at('b', 1)]));
  assert.deepEqual(sections.map((s) => [s.title, s.statusLabel, s.tiles.map((t) => [t.name, t.statusLabel, t.counts])]), [
    ['HSK 1-2', 'Done', [['Starter Kit', 'Done', '1 of 1 learned, 0 mastered'], ['Food & Drink', 'Done', '1 of 1 learned, 0 mastered']]],
    ['HSK 3', '', [['Food & Drink', 'Now', '0 of 1 learned, 0 mastered']]],
    ['HSK 4', '', [['Starter Kit', 'Locked', '0 of 1 learned, 0 mastered']]],
  ]);
  // A started tile that is not the current one shows its learned share instead of Locked.
  const started = mapView({ themes, words: [...words, { id: 'e', theme: 't01', lv: 4, ord: 5 }] }, mapOf([at('a', 1), at('d', 1)]));
  assert.deepEqual(started.map((s) => s.tiles.map((t) => t.statusLabel)), [['Done', 'Now'], ['Locked'], ['50%']]);
});

test("a tile's word list holds only that level group's words of the theme", () => {
  const v = themeWordsView(data, 't05', new Map(), '1-2');
  assert.equal(v.name, 'Food & Drink, HSK 1-2');
  assert.equal(v.words.length, 15);
  const themes = [{ id: 't02', order: 1, name: 'Food & Drink' }];
  const words = [{ ...data.words[0], id: 'a', theme: 't02', lv: 2, ord: 1 }, { ...data.words[1], id: 'b', theme: 't02', lv: 3, ord: 2 }];
  const hsk3 = themeWordsView({ themes, words }, 't02', new Map(), '3');
  assert.deepEqual([hsk3.name, hsk3.words.map((w) => w.id)], ['Food & Drink, HSK 3', ['b']]);
  assert.deepEqual(themeWordsView({ themes, words }, 't02', new Map()).words.map((w) => w.id), ['a', 'b']);
  assert.equal(themeWordsView({ themes, words }, 't02', new Map(), '9'), null);
});

test('a theme lists its words in teaching order with their place', () => {
  const v = themeWordsView(data, 't05', mapOf([at(data.words.find((w) => w.hz === '苹果').id, 3), at(data.words.find((w) => w.hz === '茶').id, 8)]));
  assert.equal(v.name, 'Food & Drink');
  assert.deepEqual(v.words.slice(0, 3).map((w) => [w.hz, w.status]), [['苹果', 'Step 3'], ['米饭', 'New'], ['茶', 'Mastered']]);
  assert.equal(themeWordsView(data, 't99', new Map()), null);
  assert.equal(wordStatus({ step: 0 }), 'New');
});

test('stats show totals, levels, 30 days, the forecast and accuracy', () => {
  const progressList = [at(t01[0].id, 1, TODAY), at(t01[1].id, 7, '2026-10-22')];
  const events = [
    { seq: 1, day: TODAY, kind: 'review', grade: 'right' },
    { seq: 2, day: TODAY, kind: 'review', grade: 'wrong' },
    { seq: 3, day: '2026-10-19', kind: 'final', grade: 'right', outcome: 'learned' },
  ];
  const v = statsView({ data, progressList, events, checkedDays: ['2026-10-19'], today: TODAY });
  assert.deepEqual([v.learned, v.mastered, v.total], [2, 1, 61]);
  assert.deepEqual(v.levels.map((l) => l.label), ['HSK 1', 'HSK 2']);
  assert.equal(v.levels[0].text, '2 of 47 learned, 1 mastered');
  assert.equal(v.activity.length, 30);
  assert.deepEqual(v.activity.slice(-2).map((r) => [r.day, r.reviews, r.learned, r.checkedIn, r.height]),
    [['2026-10-19', 0, 1, true, 0.5], ['2026-10-20', 2, 0, false, 1]]);
  assert.deepEqual(v.forecast.map((r) => [r.label, r.due]),
    [['Today', 1], ['Wed', 0], ['Thu', 1], ['Fri', 0], ['Sat', 0], ['Sun', 0], ['Mon', 0]]);
  assert.equal(v.accuracy, '50% right (1 of 2 reviews).');
  assert.equal(statsView({ data, progressList: [], events: [], checkedDays: [], today: TODAY }).accuracy, 'No reviews in the last 7 days.');
});

test('badges list the earned ones by date and the next milestone of each kind', () => {
  const v = badgesView({
    earned: { 'theme-t01': '2026-10-05', 'streak-7': '2026-10-11' },
    data,
    progressList: t01.map((w) => at(w.id, 1)),
    checkedDays: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'],
  });
  assert.deepEqual(v.earned.map((b) => [b.title, b.day]), [['Finished Starter Kit', '2026-10-05'], ['7-day streak', '2026-10-11']]);
  assert.deepEqual(v.upcoming.map((u) => u.title), ['30-day streak', '10 check-ins', '50 words learned', '100 words mastered']);
  // With 55 of the fixture's 61 words learned, the next learned badge is the one for every word.
  const most = badgesView({ earned: {}, data, progressList: data.words.slice(0, 55).map((w) => at(w.id, 1)), checkedDays: [] });
  assert.deepEqual(most.upcoming.find((u) => u.title.includes('learned')), { title: 'Every word learned', have: '55 of 61' });
});

test('the calendar starts on Monday and pads the month with blanks', () => {
  const weeks = calendarWeeks(['2026-10-05'], '2026-10', '2026-10-07');
  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[0].map((c) => c && c.date), [null, null, null, 1, 2, 3, 4]); // 1 October 2026 is a Thursday
  assert.deepEqual([weeks[1][0].date, weeks[1][0].checkedIn, weeks[1][2].isToday], [5, true, true]);
  assert.deepEqual(weeks[4].map((c) => c && c.date), [26, 27, 28, 29, 30, 31, null]);
});

test('the check-in screen explains the session result', () => {
  const result = {
    day: TODAY, checkedIn: true, justCheckedIn: true, streak: 3, newBadges: ['theme-t01'],
    summary: { reviews: 12, firstRight: 11, learned: 12, failed: 0, perfect: false }, left: { reviews: [], newWords: [] },
  };
  const v = checkinView({ result, checkedDays: [TODAY], today: TODAY, themes: data.themes });
  assert.equal(v.title, 'Checked in!');
  assert.equal(v.streak, 3);
  assert.deepEqual(v.lines, ['12 reviews, 11 right first time.', '12 new words learned.']);
  assert.deepEqual(v.badges, ['Finished Starter Kit']);
  assert.equal(v.monthTitle, 'October 2026');
  const early = checkinView({ result: { ...result, checkedIn: false, justCheckedIn: false, newBadges: [], left: { reviews: ['a'], newWords: ['b', 'c'] } }, checkedDays: [], today: TODAY, themes: data.themes });
  assert.equal(early.title, 'Not checked in yet');
  assert.equal(early.lines.at(-1), 'Still left today: 1 review and 2 new words.');
  const plain = checkinView({ result: null, checkedDays: [], today: TODAY, themes: data.themes });
  assert.deepEqual([plain.title, plain.streak, plain.lines], ['Check-in', null, []]);
});
