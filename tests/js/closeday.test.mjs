import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeDay } from '../../docs/js/closeday.js';
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
const DAY = '2026-10-05';
const now = localDate(DAY, 20);

// Every fixture word learned on 1 October and next due on 1 December, so nothing is planned in October.
async function allLearned(store) {
  const progress = data.words.map((w) => ({ ...learnedProgress(w.id, '2026-10-01'), due: '2026-12-01' }));
  await store.commit({ progress, event: { day: '2026-10-01', kind: 'settings' } });
}

test('a day with work left is not checked in', async () => {
  const store = new MemoryStore();
  const r = await closeDay({ store, data, day: DAY, now });
  assert.deepEqual([r.day, r.checkedIn, r.justCheckedIn, r.streak, r.left.newWords.length, r.newBadges], [DAY, false, false, 0, 12, []]);
  assert.deepEqual(await store.allDays(), []);
});

test('a day with nothing left is checked in once, with its new badges', async () => {
  const store = new MemoryStore();
  await allLearned(store);
  const r = await closeDay({ store, data, day: DAY, now });
  assert.deepEqual([r.checkedIn, r.justCheckedIn, r.streak], [true, true, 1]);
  // The 61 fixture words are every word, so every theme and HSK 1-2 are finished. With no answer
  // on the day, it is not a perfect day.
  assert.deepEqual(r.newBadges, ['learned-10', 'learned-25', 'learned-50', 'learned-all',
    'theme-t01', 'theme-t02', 'theme-t03', 'theme-t04', 'theme-t05', 'hsk-1-2']);
  assert.deepEqual((await store.allDays()).map((d) => [d.day, d.reviews, d.newWords]), [[DAY, 0, 0]]);
  assert.equal((await store.getMeta('badges'))['learned-all'], DAY);
  const again = await closeDay({ store, data, day: DAY, now: localDate(DAY, 21) });
  assert.deepEqual([again.checkedIn, again.justCheckedIn, again.newBadges], [true, false, []]);
  assert.deepEqual((await store.allEvents()).map((e) => e.kind), ['settings', 'checkin', 'badges']);
});

test('the streak runs across rewound days', async () => {
  // Checked in on 1 and 2 October, and 3 and 4 October were undone by going back to 2 October.
  const store = new MemoryStore();
  await allLearned(store);
  await store.commit({
    days: [{ day: '2026-10-01' }, { day: '2026-10-02' }], meta: { rewound: [['2026-10-03', '2026-10-04']] },
    event: { day: DAY, kind: 'rewind', to: '2026-10-02' },
  });
  const r = await closeDay({ store, data, day: DAY, now });
  assert.equal(r.streak, 3);
  assert.ok(r.newBadges.includes('streak-3'));
});

test('a perfect session earns its badge', async () => {
  const store = new MemoryStore();
  await allLearned(store);
  assert.ok((await closeDay({ store, data, day: DAY, now, perfectSession: true })).newBadges.includes('perfect'));
});

test('the learner\'s settings are read when the caller does not pass them', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 4 } }, event: { day: DAY, kind: 'settings' } });
  assert.equal((await closeDay({ store, data, day: DAY, now })).left.newWords.length, 4);
});
