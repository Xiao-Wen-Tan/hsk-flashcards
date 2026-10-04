// Tests of docs/js/sync.js without a page: the hooks it registers, one backup at a time, and
// the Settings actions, against the real Code.gs through fake-apps-script.mjs.
process.env.TZ = 'UTC';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHooks } from '../../docs/js/hooks.js';
import { PLUGINS } from '../../docs/js/plugins.js';
import { loadState, saveState } from '../../docs/js/sheet.js';
import { install } from '../../docs/js/sync.js';
import { MemoryStore } from '../../docs/js/store.js';
import { rewindTo } from '../../docs/js/rewind.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadAppsScript } from './fake-apps-script.mjs';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';
const URL_OK = 'https://script.google.com/macros/s/AKfycbTEST-FAKE-ID-abcdefghijklmnop/exec';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
}

// A fetch that hands each request to the script, and counts the requests.
function fetchToSheet(sheet) {
  const bodies = [];
  const fetchFn = async (url, init) => {
    bodies.push({ url, ...JSON.parse(init.body), keepalive: init.keepalive });
    return { ok: true, json: async () => sheet.post(JSON.parse(init.body)) };
  };
  return { fetchFn, bodies };
}

async function setUp() {
  const sheet = loadAppsScript({ code: CODE });
  sheet.gs.setup();
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0026', '2026-10-05')], event: { day: '2026-10-05', kind: 'final', id: 'w0026', grade: 'right', outcome: 'learned', ts: '2026-10-05T19:00:00Z' } });
  const storage = memoryStorage();
  const hooks = createHooks();
  const net = fetchToSheet(sheet);
  const sync = install({ on: hooks.on, store, data, storage, fetchFn: net.fetchFn });
  return { sheet, store, storage, hooks, net, sync };
}

test('the Sheet backup is the one plugin', () => {
  assert.deepEqual(PLUGINS, ['./sync.js']);
});

test('the first use makes a device ID and a secret code, once', async () => {
  const { sync, storage } = await setUp();
  const s = sync.state();
  assert.match(s.device, /^[0-9a-f]{16}$/);
  assert.match(s.code, /^[a-z2-9]{4}(-[a-z2-9]{4}){5}$/);
  assert.deepEqual(sync.state(), s);
  assert.deepEqual(loadState(storage), s);
});

test('nothing is sent before the web app address is saved', async () => {
  const { hooks, net } = await setUp();
  await hooks.emit('sessionEnd', {});
  await hooks.emit('open', {});
  await new Promise((r) => { setTimeout(r, 10); });
  assert.equal(net.bodies.length, 0);
});

test('session end and closing the app back up, closing with keepalive', async () => {
  const { sync, hooks, net, sheet, store } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  await hooks.emit('sessionEnd', {});
  await sync.run(); // waits for the backup the hook started
  assert.equal(sheet.ss.rowsOf('Log').length, 1);
  await store.commit({ event: { day: '2026-10-05', kind: 'checkin', ts: '2026-10-05T19:01:00Z' } });
  await hooks.emit('hidden', {});
  await sync.run();
  assert.equal(sheet.ss.rowsOf('Log').length, 2);
  assert.equal(net.bodies.find((b) => b.log?.[0]?.[0] === 2).keepalive, true);
});

test('a hook never waits for the network', async () => {
  const { sync, hooks } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  const hooks2 = createHooks();
  const never = () => new Promise(() => {});
  install({ on: hooks2.on, store: new MemoryStore(), data, storage: memoryStorage(), fetchFn: never });
  const started = Date.now();
  await hooks2.emit('sessionEnd', {});
  await hooks.emit('hidden', {});
  assert.ok(Date.now() - started < 200);
});

test('opening the app backs up only when the last backup is 12 hours old', async () => {
  const { sync, hooks, net, storage, store } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  await sync.run();
  await store.commit({ event: { day: '2026-10-05', kind: 'checkin', ts: '2026-10-05T19:01:00Z' } });
  const count = net.bodies.length;
  await hooks.emit('open', {});
  await new Promise((r) => { setTimeout(r, 10); });
  assert.equal(net.bodies.length, count); // backed up minutes ago, so the change waits
  saveState(storage, { ...loadState(storage), lastOk: '2020-01-01T00:00:00.000Z' });
  await hooks.emit('open', {});
  await sync.run();
  assert.equal(net.bodies.length, count + 1);
});

test('a second request during a backup runs once more afterwards', async () => {
  const { sync, store, sheet } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  const first = sync.run();
  await store.commit({ event: { day: '2026-10-05', kind: 'checkin', ts: '2026-10-05T19:01:00Z' } });
  const second = sync.run();
  assert.equal(first, second); // the same running backup
  await second;
  assert.equal(sheet.ss.rowsOf('Log').length, 2);
});

test('Test connection, a new code and restore work through the Settings actions', async () => {
  const { sync, sheet } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  assert.equal(await sync.ping(), 'Connected. The Sheet has saved answers up to number 0.');
  await sync.run();
  assert.equal(await sync.pending(), 0);
  const fresh = new MemoryStore();
  const other = install({ on: createHooks().on, store: fresh, data, storage: memoryStorage(), fetchFn: fetchToSheet(sheet).fetchFn });
  other.saveSettings({ url: URL_OK, code: CODE });
  assert.equal(await other.ping(), 'Connected, but another phone or browser backs up to this Sheet.');
  const { counts } = await other.restore();
  assert.deepEqual(counts, { progress: 1, events: 1, days: 0 });
  assert.equal((await fresh.getProgress('w0026')).step, 1);
  const old = sync.state().code;
  assert.notEqual(sync.newCode(), old);
  await assert.rejects(sync.ping(), /refused the secret code/);
});

test('after going back to a day, the backup replaces the Sheet, once', async () => {
  const { sync, hooks, sheet, store, net } = await setUp();
  // A second study day, so there is a day to go back to.
  const p = learnedProgress('w0039', '2026-10-06');
  await store.commit({ progress: [p], event: { day: '2026-10-06', kind: 'final', id: 'w0039', grade: 'right', outcome: 'learned', before: null, after: p, ts: '2026-10-06T19:00:00Z' } });
  await hooks.emit('rewound', { store }); // not set up yet, so nothing is marked or sent
  assert.equal(sync.state().resetPending, undefined);
  sync.saveSettings({ url: URL_OK, code: CODE });
  await sync.run();
  assert.equal(sheet.ss.rowsOf('Log').length, 2);
  await rewindTo({ store, toDay: '2026-10-05', now: new Date('2026-10-07T08:00:00Z') });
  await hooks.emit('rewound', { store });
  assert.equal(sync.state().resetPending, true);
  await sync.run(); // waits for the backup the hook started
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => [r[0], r[3]]), [[1, 'final check'], [3, 'went back to a day']]);
  assert.deepEqual([sync.state().resetPending, sync.state().problem], [false, null]);
  assert.equal(net.bodies.filter((b) => b.reset).length, 1);
});

test('going back while a backup is running still replaces the Sheet afterwards', async () => {
  // A backup that started before going back saves its own copy of the state when it ends. That
  // copy must not wipe the mark that the Sheet is to be replaced.
  const sheet = loadAppsScript({ code: CODE });
  sheet.gs.setup();
  const store = new MemoryStore();
  for (const [id, day] of [['w0026', '2026-10-05'], ['w0039', '2026-10-06']]) {
    const p = learnedProgress(id, day);
    await store.commit({ progress: [p], event: { day, kind: 'final', id, grade: 'right', outcome: 'learned', before: null, after: p, ts: `${day}T19:00:00Z` } });
  }
  // The first request waits until open() is called, like a slow network at the end of a session.
  let open;
  const gate = new Promise((resolve) => { open = resolve; });
  const bodies = [];
  const fetchFn = async (url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (bodies.length === 1) await gate;
    return { ok: true, json: async () => sheet.post(body) };
  };
  const hooks = createHooks();
  const sync = install({ on: hooks.on, store, data, storage: memoryStorage(), fetchFn });
  sync.saveSettings({ url: URL_OK, code: CODE });
  const backup = sync.run(); // sends answers 1 and 2, and waits at the gate
  await rewindTo({ store, toDay: '2026-10-05', now: new Date('2026-10-07T08:00:00Z') });
  await hooks.emit('rewound', { store });
  open();
  await backup;
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), [1, 3]);
  assert.deepEqual([sync.state().resetPending, sync.state().problem], [false, null]);
  assert.equal(bodies.filter((b) => b.reset).length, 1);
});

test('going back in a second browser does not replace the main phone Sheet copy', async () => {
  const { sync, storage } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  saveState(storage, { ...sync.state(), problem: 'other-device' });
  assert.equal(sync.markReset(), false);
  assert.equal(sync.state().resetPending, undefined);
});
