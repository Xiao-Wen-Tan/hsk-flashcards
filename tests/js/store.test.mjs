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
