import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addRange, confirmText, rewindChoices, rewindPlan } from '../../docs/js/rewind.js';

// Word records as srs.js keeps them, cut down to the fields that matter here.
const rec = (id, step, due) => ({ id, step, due });
const A1 = rec('a', 1, '2026-10-02');
const A2 = rec('a', 2, '2026-10-04');
const A3 = rec('a', 3, '2026-10-08');
const B1 = rec('b', 1, '2026-10-04');
const C1 = rec('c', 1, '2026-10-03');
const C2 = rec('c', 2, '2026-10-05');

// Four study days. Word a is learned on 1 October and reviewed on 2 and 4 October, word b is
// learned on 3 October, and word c's review on 3 October is answered wrong, taken back by Undo
// and answered again.
const EVENTS = [
  { seq: 1, day: '2026-10-01', kind: 'final', id: 'a', grade: 'right', outcome: 'learned', before: null, after: A1 },
  { seq: 2, day: '2026-10-01', kind: 'checkin' },
  { seq: 3, day: '2026-10-01', kind: 'badges', badges: ['learned-10'] },
  { seq: 4, day: '2026-10-02', kind: 'review', id: 'a', grade: 'right', outcome: null, before: A1, after: A2 },
  { seq: 5, day: '2026-10-02', kind: 'checkin' },
  { seq: 6, day: '2026-10-03', kind: 'review', id: 'c', grade: 'wrong', outcome: null, before: C1, after: rec('c', 1, '2026-10-04') },
  { seq: 7, day: '2026-10-03', kind: 'undo', target: 6, id: 'c' },
  { seq: 8, day: '2026-10-03', kind: 'review', id: 'c', grade: 'right', outcome: null, before: C1, after: C2 },
  { seq: 9, day: '2026-10-03', kind: 'check', id: 'b', grade: 'right', outcome: null, before: null, after: null },
  { seq: 10, day: '2026-10-03', kind: 'final', id: 'b', grade: 'right', outcome: 'learned', before: null, after: B1 },
  { seq: 11, day: '2026-10-03', kind: 'settings', settings: { newPerDay: 8 } },
  { seq: 12, day: '2026-10-03', kind: 'checkin' },
  { seq: 13, day: '2026-10-03', kind: 'badges', badges: ['streak-3'] },
  { seq: 14, day: '2026-10-04', kind: 'review', id: 'a', grade: 'right', outcome: null, before: A2, after: A3 },
  { seq: 15, day: '2026-10-04', kind: 'checkin' },
];
const DAYS = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((day) => ({ day }));
const BADGES = { 'learned-10': '2026-10-01', 'streak-3': '2026-10-03' };

test('the days to go back to are earlier study days before the last one', () => {
  // 4 October is the last study day, so going back to it would undo nothing.
  assert.deepEqual(rewindChoices({ events: EVENTS, days: DAYS, today: '2026-10-05' }), ['2026-10-01', '2026-10-02', '2026-10-03']);
  // With answers today, yesterday can be chosen too, but never today.
  const today = [...EVENTS, { seq: 16, day: '2026-10-05', kind: 'review', id: 'a', grade: 'right' }];
  assert.deepEqual(rewindChoices({ events: today, days: DAYS, today: '2026-10-05' }), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(rewindChoices({ events: [], days: [], today: '2026-10-05' }), []);
});

test('going back to 2 October undoes every later answer, check-in and badge', () => {
  const plan = rewindPlan({ events: EVENTS, days: DAYS, badges: BADGES, rewound: [], toDay: '2026-10-02', today: '2026-10-05' });
  // a goes back to its record from before 4 October, c to its record from before 3 October (the
  // answer taken back by Undo is skipped), and b, new on 3 October, loses its record.
  assert.deepEqual(plan.put, [C1, A2]);
  assert.deepEqual(plan.remove, ['b']);
  // Every event after 2 October goes, except the settings change.
  assert.deepEqual(plan.eventSeqs, [6, 7, 8, 9, 10, 12, 13, 14, 15]);
  assert.deepEqual(plan.dayKeys, ['2026-10-03', '2026-10-04']);
  assert.deepEqual(plan.badges, { 'learned-10': '2026-10-01' });
  assert.deepEqual(plan.rewound, [['2026-10-03', '2026-10-04']]);
  assert.deepEqual(plan.counts, { days: 2, newWords: 1, reviews: 2 });
  // The streak is as at the end of 2 October, 1 and 2 October in a row, and the rewound days do not break it.
  assert.equal(plan.streakAfter, 2);
  assert.equal(confirmText(plan), 'Undo 2 days: 1 new word and 2 reviews. Your streak becomes 2 days.');
});

test('going back to the first study day leaves only that day', () => {
  const plan = rewindPlan({ events: EVENTS, days: DAYS, badges: BADGES, rewound: [], toDay: '2026-10-01', today: '2026-10-05' });
  assert.deepEqual([plan.put, plan.remove], [[A1, C1], ['b']]);
  assert.deepEqual(plan.counts, { days: 3, newWords: 1, reviews: 3 });
  assert.equal(confirmText(plan), 'Undo 3 days: 1 new word and 3 reviews. Your streak becomes 1 day.');
});

test('going back is refused for today, and for an answer without its saved records', () => {
  assert.throws(() => rewindPlan({ events: EVENTS, days: DAYS, toDay: '2026-10-05', today: '2026-10-05' }), /a day before today/);
  const old = EVENTS.map((e) => (e.seq === 14 ? { seq: 14, day: e.day, kind: 'review', id: 'a', grade: 'right' } : e));
  assert.throws(() => rewindPlan({ events: old, days: DAYS, toDay: '2026-10-02', today: '2026-10-05' }), /Answer 14 cannot be undone/);
});

test('rewound ranges join when they touch or overlap', () => {
  assert.deepEqual(addRange([], '2026-10-03', '2026-10-04'), [['2026-10-03', '2026-10-04']]);
  assert.deepEqual(addRange([['2026-10-03', '2026-10-04']], '2026-10-05', '2026-10-06'), [['2026-10-03', '2026-10-06']]);
  assert.deepEqual(addRange([['2026-10-08', '2026-10-09']], '2026-10-06', '2026-10-11'), [['2026-10-06', '2026-10-11']]);
  assert.deepEqual(addRange([['2026-10-01', '2026-10-01']], '2026-10-03', '2026-10-04'), [['2026-10-01', '2026-10-01'], ['2026-10-03', '2026-10-04']]);
  // Going back to yesterday adds no range.
  assert.deepEqual(addRange([['2026-10-01', '2026-10-01']], '2026-10-05', '2026-10-04'), [['2026-10-01', '2026-10-01']]);
});

test('a saved rewound range that is not two study days in order is dropped', () => {
  // From a hand-edited Sheet. Merged in, ['', ...] would hide 3 to 7 October from the streak.
  assert.deepEqual(addRange([['', '2026-10-04'], null, ['2026-10-09', '2026-10-08']], '2026-10-03', '2026-10-07'),
    [['2026-10-03', '2026-10-07']]);
});
