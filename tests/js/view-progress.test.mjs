import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgesView, calendarWeeks, checkinView, mapView, statsView, themeWordsView, wordBackHref, wordStatus,
} from '../../docs/js/view/progress.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { badgeFacts } from '../../docs/js/badges.js';
import { THEME_COLORS } from '../../docs/js/view/format.js';
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
  assert.deepEqual(tiles.map((t) => t.color), THEME_COLORS.slice(0, 5)); // each theme in its colour
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
  assert.deepEqual(hsk3.words.map((w) => w.href), ['#/word/b/3']);
  assert.deepEqual(themeWordsView({ themes, words }, 't02', new Map()).words.map((w) => w.href), ['#/word/a', '#/word/b']);
});

test("a word's Back link returns to the list it was opened from", () => {
  const w = { id: 'w0026', theme: 't05' };
  assert.equal(wordBackHref(w, '3'), '#/theme/t05/3');
  assert.equal(wordBackHref(w, undefined), '#/theme/t05');
});

test('a theme lists its words in teaching order with their place', () => {
  const v = themeWordsView(data, 't05', mapOf([at(data.words.find((w) => w.hz === '苹果').id, 3), at(data.words.find((w) => w.hz === '茶').id, 8)]));
  assert.equal(v.name, 'Food & Drink');
  assert.deepEqual(v.words.slice(0, 3).map((w) => [w.hz, w.status]), [['苹果', 'Step 3'], ['米饭', 'New'], ['茶', 'Mastered']]);
  assert.equal(themeWordsView(data, 't99', new Map()), null);
  assert.equal(wordStatus({ step: 0 }), 'New');
});

test('stats show this week and month, the all-time records, the levels and the goals', () => {
  // Today is Tuesday 20 October. A word was learned on Monday 12 and Monday 19 October, and two
  // reviews were answered today, 2 minutes apart, one of them wrong.
  const progressList = [at(t01[0].id, 1, TODAY), at(t01[1].id, 7, '2026-10-22')];
  const events = [
    { seq: 1, day: '2026-10-12', kind: 'final', grade: 'right', outcome: 'learned', ts: '2026-10-12T19:00:00Z' },
    { seq: 2, day: '2026-10-19', kind: 'final', grade: 'right', outcome: 'learned', ts: '2026-10-19T19:00:00Z' },
    { seq: 3, day: TODAY, kind: 'review', grade: 'right', ts: `${TODAY}T19:00:00Z` },
    { seq: 4, day: TODAY, kind: 'review', grade: 'wrong', ts: `${TODAY}T19:02:00Z` },
  ];
  const goals = [{ id: 'streak', text: '2 days to the 3-day badge', left: 2, share: 0.67 }];
  const v = statsView({ data, progressList, events, checkedDays: ['2026-10-12', '2026-10-19'], today: TODAY, goals });
  const tiles = (p) => [p.title, p.numbers.map((n) => `${n.value} ${n.label}`)];
  assert.deepEqual(v.periods.map(tiles), [
    ['This week', ['1 words learned', '2 reviews', '0 words spoken', '2 study days', '2 minutes']],
    ['October 2026', ['2 words learned', '2 reviews', '0 words spoken', '3 study days', '2 minutes']],
  ]);
  assert.deepEqual(v.bars7.map((r) => r.label), ['W', 'T', 'F', 'S', 'S', 'M', 'T']);
  assert.deepEqual(v.bars7.slice(-2).map((r) => [r.day, r.newWords, r.reviews, r.checkedIn, r.height]),
    [['2026-10-19', 1, 0, true, 0.5], ['2026-10-20', 0, 2, false, 1]]);
  assert.equal(v.bars30.length, 30);
  assert.deepEqual(v.forecast.map((r) => [r.label, r.due]),
    [['Today', 1], ['Wed', 0], ['Thu', 1], ['Fri', 0], ['Sat', 0], ['Sun', 0], ['Mon', 0]]);
  assert.equal(v.accuracy, '50% right (1 of 2 reviews).');
  assert.deepEqual(v.records.map((r) => `${r.label}: ${r.value}`), [
    'Best streak: 1 day', 'Perfect days: 2', 'Reviews answered: 2', 'Words learned: 2 of 61', 'Words mastered: 1',
    'Study days: 3', 'Minutes studied: 2',
  ]);
  assert.deepEqual(v.levels.map((l) => [l.label, l.text]), [['HSK 1', '2 of 47 learned, 1 mastered'], ['HSK 2', '0 of 14 learned, 0 mastered']]);
  assert.deepEqual(v.goals, ['2 days to the 3-day badge']);
  assert.equal(statsView({ data, progressList: [], events: [], checkedDays: [], today: TODAY }).accuracy, 'No reviews in the last 7 days.');
});

test('badges show group by group, each with its next badge and a progress bar', () => {
  // Checked in from Monday 5 to Sunday 11 October, with the 12 Starter Kit words learned.
  const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map((day) => ({ day }));
  const facts = badgeFacts({ data, progress: t01.map((w) => at(w.id, 1)), days, events: [] });
  const earned = { 'theme-t01': '2026-10-05', 'learned-10': '2026-10-05', 'streak-3': '2026-10-07', 'streak-7': '2026-10-11' };
  const v = badgesView({ earned, facts, themes: data.themes });
  assert.equal(v.count, 4);
  const g = Object.fromEntries(v.groups.map((x) => [x.id, x]));
  assert.deepEqual(g.streak.earned.map((b) => [b.title, b.day]), [['3-day streak', '2026-10-07'], ['7-day streak', '2026-10-11']]);
  assert.deepEqual([g.streak.next.title, g.streak.next.text, g.streak.next.pct], ['14-day streak', '7 / 14 days', '50%']);
  assert.deepEqual([g.learned.next.title, g.learned.next.text, g.learned.next.pct], ['25 words learned', '12 / 25 words', '48%']);
  assert.deepEqual([g.week.next.title, g.week.next.pct], ['Full week', null]);
  assert.deepEqual(g.theme.earned.map((b) => b.title), ['Finished Starter Kit']);
  assert.deepEqual([g.theme.next.title, g.theme.next.text], ['Finished Greetings & Courtesy', '0 / 10 words']);
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
  assert.deepEqual([plain.title, plain.streak, plain.lines, plain.confetti], ['Check-in', null, [], false]);
});

test("the check-in screen shows the day's four numbers, the personal bests and confetti", () => {
  const result = {
    day: TODAY, checkedIn: true, justCheckedIn: true, streak: 3, newBadges: [],
    summary: { reviews: 12, firstRight: 12, learned: 12, failed: 0, perfect: false }, left: { reviews: [], newWords: [] },
  };
  const counters = { newWords: 12, reviews: 12, answers: 48, right: 46, accuracy: 96, minutes: 21.4 };
  const v = checkinView({ result, checkedDays: [TODAY], today: TODAY, themes: data.themes, counters, bests: ['Best accuracy this week!'] });
  assert.deepEqual(v.numbers.map((t) => `${t.value} ${t.label}`), ['12 new words', '12 reviews', '96% accuracy', '21 minutes']);
  assert.deepEqual(v.bests, ['Best accuracy this week!']);
  assert.equal(v.confetti, true);
  assert.equal(checkinView({ result: { ...result, justCheckedIn: false }, checkedDays: [TODAY], today: TODAY, themes: data.themes }).confetti, false);
});

test('after the learning, the check-in screen sends the learner on to speaking practice', () => {
  const left = { reviews: [], newWords: [] };
  const learned = {
    day: TODAY, checkedIn: false, justCheckedIn: false, streak: 2, newBadges: [],
    summary: { reviews: 0, firstRight: 0, learned: 12, failed: 0, perfect: false }, left, speak: { list: ['a', 'b'], done: [], left: ['a', 'b'] },
  };
  const v = checkinView({ result: learned, checkedDays: [], today: TODAY, themes: data.themes });
  assert.equal(v.title, 'Learning done');
  assert.deepEqual(v.lines, ['12 new words learned.', '2 words of speaking practice are left before today\'s check-in.']);
  assert.deepEqual(v.next, { label: 'Next: speaking practice', href: '#/speak' });
  // The speaking panel's result has the counts of its words instead of a session summary.
  const spoken = { ...learned, checkedIn: true, justCheckedIn: true, summary: undefined, speak: { list: ['a', 'b'], done: ['a', 'b'], left: [] },
    spoken: { pass: 1, listened: 0, skip: 1 } };
  const w = checkinView({ result: spoken, checkedDays: [TODAY], today: TODAY, themes: data.themes });
  assert.deepEqual([w.title, w.lines, w.next, w.confetti], ['Checked in!', ['1 said well and 1 skipped in speaking practice.'], null, true]);
});
