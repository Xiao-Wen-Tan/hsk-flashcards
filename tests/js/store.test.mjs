import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdbStore, MemoryStore, askPersistentStorage, openIdbStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';

const DAY = '2026-10-05';
const ev = (extra = {}) => ({ day: DAY, kind: 'review', id: 'w0001', grade: 'right', ...extra });

test('an answer writes the word\'s progress and its event together, with seq from 1', async () => {
  const store = new MemoryStore();
  const p = learnedProgress('w0001', DAY);
  assert.equal(await store.commit({ progress: [p], event: ev() }), 1);
  assert.equal(await store.commit({ event: ev({ kind: 'reask' }) }), 2);
  assert.deepEqual(await store.getProgress('w0001'), p);
  assert.deepEqual((await store.eventsSince(0)).map((e) => [e.seq, e.kind]), [[1, 'review'], [2, 'reask']]);
});

test('a bad commit writes nothing', async () => {
  const store = new MemoryStore();
  const good = learnedProgress('w0001', DAY);
  await assert.rejects(store.commit({ progress: [good], event: { day: DAY } }), /needs an event/);
  await assert.rejects(store.commit({ progress: [good, { id: 'w0002', step: 12 }], event: ev() }), /Bad progress/);
  await assert.rejects(store.commit({ progress: [good], event: ev({ seq: 9 }) }), /gives events their seq/);
  await assert.rejects(store.commit({ days: [{ day: '2026-13-01' }], event: ev() }), /Bad day/);
  assert.deepEqual(await store.allProgress(), []);
  assert.deepEqual(await store.eventsSince(0), []);
  assert.equal(await store.commit({ event: ev() }), 1);
});

test('remove deletes a progress record (used by Undo of a first lesson)', async () => {
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  await store.commit({ remove: ['w0001'], event: ev({ kind: 'undo', target: 1 }) });
  assert.equal(await store.getProgress('w0001'), undefined);
});

test('events by seq and by study day', async () => {
  const store = new MemoryStore();
  await store.commit({ event: ev({ day: '2026-10-03' }) });
  await store.commit({ event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-05' }) });
  assert.deepEqual((await store.eventsSince(1)).map((e) => e.seq), [2, 3]);
  assert.deepEqual((await store.eventsFrom('2026-10-04')).map((e) => e.day), ['2026-10-04', '2026-10-05']);
});

test('days and meta', async () => {
  const store = new MemoryStore();
  await store.commit({ days: [{ day: '2026-10-06', reviews: 3 }, { day: '2026-10-05', reviews: 5 }],
    meta: { settings: { newPerDay: 8 } }, event: ev({ kind: 'checkin' }) });
  assert.deepEqual((await store.allDays()).map((d) => d.day), ['2026-10-05', '2026-10-06']);
  assert.deepEqual(await store.getMeta('settings'), { newPerDay: 8 });
  assert.equal(await store.getMeta('missing'), undefined);
});

test('reads return copies, so callers cannot change saved data by accident', async () => {
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  const p = await store.getProgress('w0001');
  p.step = 9;
  assert.equal((await store.getProgress('w0001')).step, 1);
});

test('dump and restore round-trip, and seq keeps going up', async () => {
  const a = new MemoryStore();
  await a.commit({ progress: [learnedProgress('w0001', DAY)], days: [{ day: DAY }], meta: { badges: { 'streak-7': DAY } }, event: ev() });
  await a.commit({ event: ev() });
  const backup = await a.dump();
  const b = new MemoryStore();
  await b.restore(backup);
  assert.deepEqual(await b.dump(), backup);
  assert.equal(await b.commit({ event: ev() }), 3);
  await assert.rejects(b.restore({ progress: [], events: [{ seq: 2 }, { seq: 1 }], days: [], meta: {} }), /increasing/);
});

test('the IndexedDB store exists for the browser (it is not run here)', () => {
  assert.equal(typeof openIdbStore, 'function');
  assert.equal(typeof IdbStore.prototype.commit, 'function');
});

test('asking the browser to protect saved data', async () => {
  assert.equal(await askPersistentStorage(undefined), false);
  assert.equal(await askPersistentStorage({ storage: {} }), false);
  assert.equal(await askPersistentStorage({ storage: { persisted: async () => true, persist: async () => false } }), true);
  assert.equal(await askPersistentStorage({ storage: { persisted: async () => false, persist: async () => true } }), true);
});

test('allEvents gives every event, oldest first', async () => {
  const store = new MemoryStore();
  await store.commit({ event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-03', kind: 'settings' }) });
  assert.deepEqual((await store.allEvents()).map((e) => [e.seq, e.day]), [[1, '2026-10-04'], [2, '2026-10-03']]);
});

test('events, days and meta keys are deleted in the same commit as the new event', async () => {
  // A rewind (rewind.js) deletes the answers and check-ins after the chosen day and writes one event.
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', '2026-10-03')], days: [{ day: '2026-10-03' }], event: ev({ day: '2026-10-03' }) });
  await store.commit({ days: [{ day: '2026-10-04' }], meta: { session: { day: '2026-10-04' } }, event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-04', kind: 'checkin' }) });
  const seq = await store.commit({
    removeEvents: [2, 3], removeDays: ['2026-10-04'], removeMeta: ['session'], remove: ['w0001'],
    event: { day: '2026-10-05', kind: 'rewind', to: '2026-10-03' },
  });
  assert.equal(seq, 4);
  assert.deepEqual((await store.allEvents()).map((e) => e.seq), [1, 4]);
  assert.deepEqual((await store.allDays()).map((d) => d.day), ['2026-10-03']);
  assert.equal(await store.getMeta('session'), undefined);
  assert.deepEqual(await store.allProgress(), []);
});

test('clear empties progress, events and days, keeps meta, and seq keeps rising', async () => {
  // "Reset everything" keeps the settings, and its event gets the next seq, so the Sheet backup
  // never sees an old seq number again.
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', DAY)], days: [{ day: DAY }], meta: { settings: { newPerDay: 8 } }, event: ev() });
  await store.commit({ event: ev() });
  const seq = await store.commit({ clear: ['progress', 'events', 'days'], meta: { badges: {} }, event: { day: DAY, kind: 'reset' } });
  assert.equal(seq, 3);
  assert.deepEqual((await store.allEvents()).map((e) => [e.seq, e.kind]), [[3, 'reset']]);
  assert.deepEqual([await store.allProgress(), await store.allDays()], [[], []]);
  assert.deepEqual(await store.getMeta('settings'), { newPerDay: 8 });
  assert.deepEqual(await store.getMeta('badges'), {});
});

test('a commit puts after it deletes, so a word can be cleared and written again', async () => {
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  const again = { ...learnedProgress('w0002', DAY), step: 3 };
  await store.commit({ clear: ['progress'], progress: [again], event: ev({ kind: 'reset' }) });
  assert.deepEqual(await store.allProgress(), [again]);
});

test('bad deletes are refused and write nothing', async () => {
  const store = new MemoryStore();
  await store.commit({ event: ev() });
  await assert.rejects(store.commit({ removeEvents: ['1'], event: ev() }), /removeEvents takes seq numbers/);
  await assert.rejects(store.commit({ removeDays: ['2026-13-01'], event: ev() }), /removeDays takes study days/);
  await assert.rejects(store.commit({ removeMeta: [7], event: ev() }), /removeMeta takes meta names/);
  await assert.rejects(store.commit({ clear: ['meta'], event: ev() }), /clear takes progress, events or days/);
  assert.deepEqual((await store.allEvents()).map((e) => e.seq), [1]);
});
