import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tilesOf, todayView } from '../../docs/js/view/today.js';

const TODAY = '2026-10-07'; // a Wednesday
const SETTINGS = { reviewCap: 100, newPerDay: 12 };
const plan = (extra) => ({ day: TODAY, reviews: [], newWords: [], backlog: 0, quota: 12, reviewsDone: 0, newDone: 0, ...extra });
const ids = (n) => Array.from({ length: n }, (_, i) => `w${i}`);

test('a normal day shows the counts, the streak and this week', () => {
  const v = todayView({ plan: plan({ reviews: ids(20), newWords: ids(12), backlog: 20 }), checkedDays: ['2026-10-05', '2026-10-06'], today: TODAY, settings: SETTINGS });
  assert.equal(v.streak, 2);
  assert.deepEqual(v.week.map((d) => d.letter), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.deepEqual(v.week.map((d) => d.checkedIn), [true, true, false, false, false, false, false]);
  assert.equal(v.week[2].isToday, true);
  assert.deepEqual([v.reviews, v.newWords], [20, 12]);
  assert.equal(v.status, '20 reviews and 12 new words today.');
  assert.equal(v.note, null);
  assert.deepEqual([v.canStart, v.startLabel], [true, 'Start']);
});

test('after a first session today the button says Continue', () => {
  const v = todayView({ plan: plan({ reviews: ids(3), reviewsDone: 5 }), checkedDays: [], today: TODAY, settings: SETTINGS });
  assert.equal(v.startLabel, 'Continue');
});

test('a backlog halves or pauses new words, and the note says why', () => {
  const half = todayView({ plan: plan({ reviews: ids(100), newWords: ids(6), backlog: 150, quota: 6 }), checkedDays: [], today: TODAY, settings: SETTINGS });
  assert.equal(half.note, 'New words are halved today because 150 reviews are waiting.');
  const paused = todayView({ plan: plan({ reviews: ids(100), backlog: 250, quota: 0 }), checkedDays: [], today: TODAY, settings: SETTINGS });
  assert.equal(paused.note, 'New words are paused until the waiting reviews (250) are down to 200.');
});

test('with nothing due the learner can still tap Start to check in, once', () => {
  const open = todayView({ plan: plan({}), checkedDays: [], today: TODAY, settings: SETTINGS });
  assert.equal(open.canStart, true);
  assert.equal(open.status, 'Nothing is due. Tap Start to check in.');
  const done = todayView({ plan: plan({}), checkedDays: [TODAY], today: TODAY, settings: SETTINGS });
  assert.equal(done.canStart, false);
  assert.equal(done.status, 'Done for today. See you tomorrow!');
});

test('a session stopped earlier today makes the button say Continue', () => {
  // Stopped during the first new words: nothing has a record yet, but the saved session continues.
  const v = todayView({ plan: plan({ newWords: ids(12) }), checkedDays: [], today: TODAY, settings: SETTINGS, resumable: true });
  assert.deepEqual([v.canStart, v.startLabel, v.newWords], [true, 'Continue', 12]);
});

test('the ring, the four tiles of today and the two nearest goals', () => {
  // With 6 reviews and 4 new words done and 30 cards of work left, the ring is a quarter full.
  const counters = { newWords: 4, reviews: 6, answers: 20, right: 17, accuracy: 85, minutes: 7.6, done: 10, left: 30, ring: 0.25 };
  const goals = [{ id: 'reviews', text: '5 reviews to the 100-review badge' }, { id: 'streak', text: '3 days to the 30-day badge' }];
  const v = todayView({
    plan: plan({ reviews: ids(18), newWords: ids(12), reviewsDone: 6, newDone: 4 }), checkedDays: [], today: TODAY, settings: SETTINGS, counters, goals,
  });
  assert.deepEqual([v.ring, v.ringPct], [0.25, '25%']);
  assert.deepEqual(v.tiles, [
    { label: 'new words', value: '4' }, { label: 'reviews', value: '6' }, { label: 'accuracy', value: '85%' }, { label: 'minutes', value: '8' },
  ]);
  assert.deepEqual(v.goals, ['5 reviews to the 100-review badge', '3 days to the 30-day badge']);
  // Before the first answer of the day the accuracy tile has nothing to show.
  assert.deepEqual(tilesOf({ newWords: 0, reviews: 0, accuracy: null, minutes: 0 }).map((t) => t.value), ['0', '0', '-', '0']);
});

test('the streak runs across rewound days', () => {
  const v = todayView({ plan: plan({}), checkedDays: ['2026-10-04'], today: TODAY, settings: SETTINGS, rewound: [['2026-10-05', '2026-10-06']] });
  assert.equal(v.streak, 1);
});

// Speaking practice is optional (the user's decision of 2026-10-10): the learning alone checks
// the day in, and the speaking button stays open while words are left.
test('the speaking button sits under Start, and Today does not wait for the speaking', () => {
  const speak = { list: ids(18), done: [], left: ids(18) };
  const v = todayView({ plan: plan({ reviewsDone: 6, newDone: 12 }), checkedDays: [TODAY], today: TODAY, settings: SETTINGS, speak });
  assert.deepEqual(v.speak, { label: 'Speaking practice', count: '18 words to speak', enabled: true });
  assert.equal(v.status, 'Done for today. See you tomorrow!');
  assert.equal(v.canStart, false);
  // A word carried over from an earlier day does not hold back Start, which checks the day in.
  const carried = todayView({ plan: plan({}), checkedDays: [], today: TODAY, settings: SETTINGS, speak: { list: ['x'], done: [], left: ['x'] } });
  assert.deepEqual([carried.status, carried.canStart], ['Nothing is due. Tap Start to check in.', true]);
  // Before any learning, the list holds only the words carried over from earlier days.
  const morning = todayView({ plan: plan({ reviews: ids(20), newWords: ids(12) }), checkedDays: [], today: TODAY, settings: SETTINGS, speak: { list: ['x'], done: [], left: ['x'] } });
  assert.deepEqual([morning.status, morning.canStart, morning.speak.count], ['20 reviews and 12 new words today.', true, '1 word to speak']);
  // Spoken and checked in, the day is done.
  const done = todayView({ plan: plan({ reviewsDone: 6 }), checkedDays: [TODAY], today: TODAY, settings: SETTINGS, speak: { list: ['x'], done: ['x'], left: [] } });
  assert.deepEqual([done.status, done.canStart, done.speak.enabled], ['Done for today. See you tomorrow!', false, false]);
});
