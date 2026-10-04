import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allTime, bars, dayStats, fullWeeks, perfectDays, periodTotals, personalBests, thisMonth, thisWeek, todayCounters,
} from '../../docs/js/counters.js';
import { learnedProgress } from '../../docs/js/srs.js';

// Events as Study saves them, with times in UTC. ans('2026-10-06', '19:00:00', 'review', 'right')
// is a right review answer at 19:00 on 6 October.
let seq = 0;
const ans = (day, time, kind, grade, outcome = null) => ({ seq: ++seq, day, kind, grade, outcome, ts: `${day}T${time}Z` });
const other = (day, time, kind, extra = {}) => ({ seq: ++seq, day, kind, ts: `${day}T${time}Z`, ...extra });

// Tuesday 6 October has 5 live answers, 4 of them right.
function tuesday() {
  const events = [
    ans('2026-10-06', '19:00:00', 'review', 'right'),
    ans('2026-10-06', '19:00:20', 'review', 'wrong'),
    ans('2026-10-06', '19:01:00', 'reask', 'know'),
    ans('2026-10-06', '19:02:00', 'check', 'right'),
    ans('2026-10-06', '19:40:00', 'final', 'right', 'learned'),
  ];
  const taken = ans('2026-10-06', '19:40:10', 'check', 'wrong');
  return [...events, taken, other('2026-10-06', '19:40:15', 'undo', { target: taken.seq }),
    other('2026-10-06', '19:41:00', 'checkin')];
}

test('one day\'s numbers come from its live answers', () => {
  const s = dayStats(tuesday(), '2026-10-06');
  // The minutes are 20 s + 40 s + 60 s, plus 38 minutes counted as 5, which is 420 s or 7 minutes.
  // The answer taken back by Undo, the undo itself and the check-in are not answers.
  assert.deepEqual(s, { day: '2026-10-06', newWords: 1, reviews: 2, answers: 5, right: 4, accuracy: 80, spoken: 0, minutes: 7 });
  assert.deepEqual(dayStats(tuesday(), '2026-10-07'),
    { day: '2026-10-07', newWords: 0, reviews: 0, answers: 0, right: 0, accuracy: null, spoken: 0, minutes: 0 });
});

test('today\'s ring is the share of the day\'s studying and speaking that is done', () => {
  // 2 reviews studied and spoken, and 2 reviews and 4 new words left to study and then to speak.
  const plan = { reviews: ['a', 'b'], newWords: ['c', 'd', 'e', 'f'], reviewsDone: 2, newDone: 0 };
  const speak = { list: ['x', 'y'], done: ['x', 'y'], left: [] };
  const c = todayCounters({ events: tuesday(), plan, day: '2026-10-06', speak });
  assert.deepEqual([c.done, c.left, c.ring, c.accuracy, c.minutes], [4, 12, 0.25, 80, 7]);
  // With the studying done and 6 words still to speak, the ring is half full.
  const studied = { reviews: [], newWords: [], reviewsDone: 6, newDone: 0 };
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(todayCounters({ events: [], plan: studied, day: '2026-10-06', speak: { list: six, done: [], left: six } }).ring, 0.5);
  // A review skipped yesterday is on the speaking list already, so it counts once to study and once to speak.
  const carried = todayCounters({ events: [], plan: { ...plan, reviewsDone: 0 }, day: '2026-10-06', speak: { list: ['a'], done: [], left: ['a'] } });
  assert.equal(carried.left, 6 + 1 + 5);
  const empty = { reviews: [], newWords: [], reviewsDone: 0, newDone: 0 };
  assert.equal(todayCounters({ events: [], plan: empty, day: '2026-10-06' }).ring, 1);
});

test('the week runs Monday to Sunday and the month is the calendar month', () => {
  assert.deepEqual(thisWeek('2026-10-07'), { from: '2026-10-05', to: '2026-10-11' });
  assert.deepEqual(thisWeek('2026-10-11'), { from: '2026-10-05', to: '2026-10-11' });
  assert.deepEqual(thisMonth('2026-10-07'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(thisMonth('2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
});

test('week and month totals add words, reviews, study days and minutes', () => {
  const events = [
    ans('2026-09-30', '19:00:00', 'review', 'right'),
    ans('2026-10-04', '19:00:00', 'final', 'right', 'learned'),
    ans('2026-10-04', '19:01:00', 'final', 'right', 'learned'),
    ...tuesday(),
  ];
  // 5 October has a check-in but no answers (nothing was due), so it is a study day too.
  const checked = ['2026-10-04', '2026-10-05', '2026-10-06'];
  assert.deepEqual(periodTotals(events, checked, '2026-10-05', '2026-10-11'), { newWords: 1, reviews: 2, spoken: 0, studyDays: 2, minutes: 7 });
  assert.deepEqual(periodTotals(events, checked, '2026-10-01', '2026-10-31'), { newWords: 3, reviews: 2, spoken: 0, studyDays: 3, minutes: 8 });
});

test('bars give each of the last days its words and reviews, scaled to the busiest day', () => {
  const rows = bars(tuesday(), ['2026-10-06'], '2026-10-07', 7);
  assert.deepEqual(rows.map((r) => r.day), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
  assert.deepEqual(rows[5], { day: '2026-10-06', newWords: 1, reviews: 2, minutes: 7, checkedIn: true, height: 1 });
  assert.equal(rows[6].height, 0);
  assert.equal(bars([], [], '2026-10-07', 30).length, 30);
});

test('a perfect day is a checked-in day on which every answer was right', () => {
  const events = [
    ans('2026-10-05', '19:00:00', 'check', 'right'), ans('2026-10-05', '19:00:10', 'final', 'right', 'learned'),
    ...tuesday(), // one wrong answer
    ans('2026-10-07', '19:00:00', 'review', 'know'), // not checked in
  ];
  // 4 October was checked in without any answer, so it is not counted.
  assert.deepEqual(perfectDays(events, ['2026-10-04', '2026-10-05', '2026-10-06']), ['2026-10-05']);
});

test('a full week is a check-in on every day from Monday to Sunday', () => {
  const week = (monday, n = 7) => Array.from({ length: n }, (_, i) => `2026-10-${String(Number(monday.slice(8)) + i).padStart(2, '0')}`);
  assert.equal(fullWeeks(week('2026-10-05')), 1);
  assert.equal(fullWeeks(week('2026-10-05', 6)), 0);
  assert.equal(fullWeeks(week('2026-10-06')), 0); // Tuesday to Monday is not a week of the calendar
  assert.equal(fullWeeks([...week('2026-10-05'), ...week('2026-10-12'), ...week('2026-10-19', 3)]), 2);
});

test('all-time records', () => {
  const events = [ans('2026-10-05', '19:00:00', 'final', 'right', 'learned'), ...tuesday()];
  const progress = [learnedProgress('w0001', '2026-10-05'), { ...learnedProgress('w0002', '2026-09-01'), step: 7 }];
  // The 3 and 4 October rewound days join the runs before and after them.
  const checked = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'];
  const rewound = [['2026-10-03', '2026-10-04']];
  assert.deepEqual(allTime({ events, checkedDays: checked, progress, rewound }), {
    bestStreak: 4, perfectDays: 1, reviews: 2, learned: 2, mastered: 1, studyDays: 4, minutes: 7,
  });
  assert.equal(allTime({ events, checkedDays: checked, progress }).bestStreak, 2);
});

test('personal bests compare today with earlier days', () => {
  const events = [
    // Monday 5 October has 1 new word, 2 reviews, 2 of 4 answers right (50%) and 1 minute.
    ans('2026-10-05', '19:00:00', 'review', 'right'), ans('2026-10-05', '19:00:30', 'review', 'wrong'),
    ans('2026-10-05', '19:01:00', 'final', 'wrong'),
    ans('2026-10-05', '19:01:00', 'final', 'right', 'learned'),
    ...tuesday(), // 1 new word, 2 reviews, 80% right, 7 minutes
  ];
  assert.deepEqual(personalBests({ events, today: '2026-10-06' }), ['Best accuracy this week!', 'Most minutes this week!']);
  const more = [...events, ans('2026-10-06', '19:41:00', 'final', 'right', 'learned'), ans('2026-10-06', '19:41:10', 'review', 'right')];
  assert.deepEqual(personalBests({ events: more, today: '2026-10-06' }),
    ['Most words in a day!', 'Most reviews in a day!', 'Best accuracy this week!', 'Most minutes this week!']);
  // The first day ever has nothing to beat, and a day without answers has no bests.
  assert.deepEqual(personalBests({ events: tuesday(), today: '2026-10-06' }), []);
  assert.deepEqual(personalBests({ events, today: '2026-10-07' }), []);
  // A week starts on Monday, so on Monday 12 October last week's days do not count for accuracy.
  const nextMonday = [...events, ans('2026-10-12', '19:00:00', 'review', 'wrong'), ans('2026-10-12', '19:00:30', 'review', 'right')];
  assert.deepEqual(personalBests({ events: nextMonday, today: '2026-10-12' }), []);
});

test('speaking counts in the minutes and as words spoken, but not in the accuracy', () => {
  // On Tuesday the learner also spoke three words after the answers, two of them well and one skipped.
  const spoke = (time, result) => other('2026-10-06', time, 'speak', { id: 'w0001', result, tries: 1, check: { tones: 1, heard: null } });
  const events = [...tuesday(), spoke('19:41:00', 'pass'), spoke('19:41:30', 'skip'), spoke('19:42:00', 'listened')];
  // The 420 seconds of the answers plus the 2 minutes from 19:40:00 to 19:42:00 make 9 minutes.
  assert.deepEqual(dayStats(events, '2026-10-06'),
    { day: '2026-10-06', newWords: 1, reviews: 2, answers: 5, right: 4, accuracy: 80, spoken: 2, minutes: 9 });
  // A day with speaking only is a study day, with no accuracy, and it is not a perfect day.
  const only = [spoke('19:00:00', 'pass')].map((e) => ({ ...e, day: '2026-10-07', ts: '2026-10-07T19:00:00Z' }));
  assert.deepEqual(dayStats(only, '2026-10-07'),
    { day: '2026-10-07', newWords: 0, reviews: 0, answers: 0, right: 0, accuracy: null, spoken: 1, minutes: 0 });
  assert.deepEqual(perfectDays(only, ['2026-10-07']), []);
  assert.equal(periodTotals([...events, ...only], [], '2026-10-05', '2026-10-11').studyDays, 2);
  assert.deepEqual(personalBests({ events: [...events, ...only], today: '2026-10-07' }), []);
});
