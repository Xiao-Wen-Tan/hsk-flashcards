// Plan 2's store checks (tests/js/store.test.mjs), run against the IndexedDB store in a real
// browser, because Node has no IndexedDB. Each check uses a fresh database that is deleted
// afterwards. The page shows one line per check and sets its title to "PASS n" or "FAIL n".
import { openIdbStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';

const DAY = '2026-10-05';
const ev = (extra = {}) => ({ day: DAY, kind: 'review', id: 'w0001', grade: 'right', ...extra });
const out = document.getElementById('out');
const results = [];

function equal(a, b, what) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what}: got ${x}, expected ${y}`);
}

async function rejects(promise, pattern, what) {
  try {
    await promise;
  } catch (err) {
    if (pattern.test(String(err.message))) return;
    throw new Error(`${what}: wrong error ${err.message}`);
  }
  throw new Error(`${what}: did not fail`);
}

async function check(name, body) {
  const dbName = `hsk-check-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const store = await openIdbStore(dbName);
  try {
    await body(store, dbName);
    results.push(`PASS ${name}`);
  } catch (err) {
    results.push(`FAIL ${name}: ${err.message}`);
  } finally {
    store.db.close();
    await new Promise((resolve) => { const r = indexedDB.deleteDatabase(dbName); r.onsuccess = resolve; r.onerror = resolve; r.onblocked = resolve; });
  }
}

await check('an answer writes progress and its event together, seq from 1', async (store) => {
  const p = learnedProgress('w0001', DAY);
  equal(await store.commit({ progress: [p], event: ev() }), 1, 'first seq');
  equal(await store.commit({ event: ev({ kind: 'reask' }) }), 2, 'second seq');
  equal(await store.getProgress('w0001'), p, 'progress');
  equal((await store.eventsSince(0)).map((e) => [e.seq, e.kind]), [[1, 'review'], [2, 'reask']], 'events');
});

await check('a bad commit writes nothing', async (store) => {
  const good = learnedProgress('w0001', DAY);
  await rejects(store.commit({ progress: [good], event: { day: DAY } }), /needs an event/, 'no kind');
  await rejects(store.commit({ progress: [good, { id: 'w0002', step: 12 }], event: ev() }), /Bad progress/, 'bad step');
  equal(await store.allProgress(), [], 'no progress');
  equal(await store.eventsSince(0), [], 'no events');
});

await check('remove deletes a progress record', async (store) => {
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  await store.commit({ remove: ['w0001'], event: ev({ kind: 'undo', target: 1 }) });
  equal(await store.getProgress('w0001'), undefined, 'removed');
});

await check('events by seq and by study day', async (store) => {
  await store.commit({ event: ev({ day: '2026-10-03' }) });
  await store.commit({ event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-05' }) });
  equal((await store.eventsSince(1)).map((e) => e.seq), [2, 3], 'since 1');
  equal((await store.eventsFrom('2026-10-04')).map((e) => e.day), ['2026-10-04', '2026-10-05'], 'from day');
});

await check('days and meta', async (store) => {
  await store.commit({ days: [{ day: '2026-10-06', reviews: 3 }, { day: '2026-10-05', reviews: 5 }],
    meta: { settings: { newPerDay: 8 } }, event: ev({ kind: 'checkin' }) });
  equal((await store.allDays()).map((d) => d.day), ['2026-10-05', '2026-10-06'], 'days');
  equal(await store.getMeta('settings'), { newPerDay: 8 }, 'meta');
  equal(await store.getMeta('missing'), undefined, 'missing meta');
});

await check('dump and restore round-trip, and seq keeps going up', async (store) => {
  await store.commit({ progress: [learnedProgress('w0001', DAY)], days: [{ day: DAY }], meta: { badges: { 'streak-7': DAY } }, event: ev() });
  await store.commit({ event: ev() });
  const backup = await store.dump();
  const other = await openIdbStore(`hsk-check-restore-${Date.now()}`);
  try {
    await other.restore(backup);
    equal(await other.dump(), backup, 'round trip');
    equal(await other.commit({ event: ev() }), 3, 'next seq');
    await rejects(other.restore({ progress: [], events: [{ seq: 2 }, { seq: 1 }], days: [], meta: {} }), /increasing/, 'bad order');
  } finally {
    other.db.close();
    indexedDB.deleteDatabase(other.db.name);
  }
});

await check('data survives closing and opening the database again', async (store, dbName) => {
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  store.db.close();
  const again = await openIdbStore(dbName);
  equal((await again.getProgress('w0001')).step, 1, 'reopened');
  store.db = again.db; // so the check's clean-up closes the reopened connection
});

await check('events, days and meta keys are deleted in the same commit as the new event', async (store) => {
  await store.commit({ progress: [learnedProgress('w0001', '2026-10-03')], days: [{ day: '2026-10-03' }], event: ev({ day: '2026-10-03' }) });
  await store.commit({ days: [{ day: '2026-10-04' }], meta: { session: { day: '2026-10-04' } }, event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-04', kind: 'checkin' }) });
  const seq = await store.commit({
    removeEvents: [2, 3], removeDays: ['2026-10-04'], removeMeta: ['session'], remove: ['w0001'],
    event: { day: '2026-10-05', kind: 'rewind', to: '2026-10-03' },
  });
  equal(seq, 4, 'seq of the rewind');
  equal((await store.allEvents()).map((e) => e.seq), [1, 4], 'events left');
  equal((await store.allDays()).map((d) => d.day), ['2026-10-03'], 'days left');
  equal(await store.getMeta('session'), undefined, 'session gone');
  equal(await store.allProgress(), [], 'word removed');
});

await check('clear empties progress, events and days, and seq keeps rising', async (store) => {
  await store.commit({ progress: [learnedProgress('w0001', DAY)], days: [{ day: DAY }], meta: { settings: { newPerDay: 8 } }, event: ev() });
  await store.commit({ event: ev() });
  const seq = await store.commit({ clear: ['progress', 'events', 'days'], meta: { badges: {} }, event: { day: DAY, kind: 'reset' } });
  equal(seq, 3, 'seq after the clear');
  equal((await store.allEvents()).map((e) => [e.seq, e.kind]), [[3, 'reset']], 'only the reset event');
  equal([await store.allProgress(), await store.allDays()], [[], []], 'progress and days empty');
  equal(await store.getMeta('settings'), { newPerDay: 8 }, 'settings kept');
  equal(await store.commit({ event: ev() }), 4, 'next seq');
});

const failed = results.filter((r) => r.startsWith('FAIL')).length;
out.textContent = results.join('\n');
document.title = failed ? `FAIL ${failed}` : `PASS ${results.length}`;
