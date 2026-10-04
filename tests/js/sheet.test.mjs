// Tests of docs/js/sheet.js, the phone's half of the Google Sheet backup. The Sheet's half is
// the real tools/apps_script/Code.gs, run through fake-apps-script.mjs, so these tests send
// real study days from a MemoryStore to the script and restore them into a fresh store.
process.env.TZ = 'UTC';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEADERS, backUp, checkCode, checkWebAppUrl, dailyRow, isDue, loadState, logRow, makeCode, makeDeviceId, postJson,
  progressRow, restoreFromSheet, saveState, statusText, STATE_KEY, withSettings,
} from '../../docs/js/sheet.js';
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadAppsScript } from './fake-apps-script.mjs';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';
const URL_OK = 'https://script.google.com/macros/s/AKfycbTEST-FAKE-ID-abcdefghijklmnop/exec';

// Plays one study day with Study (Plan 2): every answer right, except `wrongFirst` wrong
// answers on the first reviews. Answers are 10 seconds apart from 19:00 UTC.
async function playDay(store, day, { wrongFirst = 0 } = {}) {
  let t = Date.parse(`${day}T19:00:00Z`);
  const study = await Study.start({ store, data, now: new Date(t) });
  let wrong = wrongFirst;
  while (!study.finished) {
    const card = study.card;
    if (card.type === 'learn') { study.next(); continue; }
    t += 10000;
    let grade = card.quiz === 'recall' ? 'know' : 'right';
    if (card.type === 'review' && wrong > 0) { grade = card.quiz === 'recall' ? 'dontknow' : 'wrong'; wrong -= 1; }
    await study.answer(grade, new Date(t));
  }
  return study.finish(new Date(t));
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m };
}

const phone = (device = 'a1b2c3d4e5f60718') => ({ url: URL_OK, code: CODE, device, cursor: 0, lastOk: null, problem: null, detail: '' });

function sheetWithScript() {
  const s = loadAppsScript({ code: CODE });
  s.gs.setup();
  return s;
}

const run = (store, state, post, extra = {}) => backUp({ store, words: data.words, themes: data.themes, state, post, ...extra });

test('the script and the app use the same column headings', () => {
  const { gs } = loadAppsScript();
  for (const [name, headers] of Object.entries(HEADERS)) {
    assert.deepEqual([...gs.TABS[name].headers], headers, name);
    assert.equal(gs.TABS[name].formats.length, headers.length, `${name} formats`);
  }
});

test('a secret code is 24 easy-to-read letters and digits in groups of 4', () => {
  const code = makeCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
  assert.equal(code, 'ahry-7env-4bjs-z8fp-w5ck-t29g');
  assert.match(makeCode(), /^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){5}$/);
  assert.notEqual(makeCode(), makeCode());
  assert.match(makeDeviceId(), /^[0-9a-f]{16}$/);
});

test('only a web app address is accepted', () => {
  assert.equal(checkWebAppUrl(` ${URL_OK} `), URL_OK);
  assert.equal(checkWebAppUrl('https://script.google.com/a/macros/example.edu/s/AKfycbTEST-FAKE-ID-abcdefghij/exec'),
    'https://script.google.com/a/macros/example.edu/s/AKfycbTEST-FAKE-ID-abcdefghij/exec');
  assert.equal(checkWebAppUrl('http://localhost:8125/exec'), 'http://localhost:8125/exec');
  assert.throws(() => checkWebAppUrl('https://docs.google.com/spreadsheets/d/abc/edit'), /not a web app address/);
  assert.throws(() => checkWebAppUrl('https://script.google.com/macros/s/AKfycbTEST-FAKE-ID-abcdefghij/dev'), /ends with \/exec/);
});

test('a code typed on a new phone is checked', () => {
  assert.equal(checkCode(' k7mq-2xrt-9pwd-hc4n-fz6b-y3ja '), 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja');
  assert.throws(() => checkCode('k7mq 2xrt'), /8 to 64 letters, digits and dashes/);
  assert.throws(() => checkCode('short'), /8 to 64/);
});

test('the state lives in one localStorage entry, and a new address starts the Sheet again', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadState(storage), { url: '', code: '', device: '', cursor: 0, lastOk: null, problem: null, detail: '' });
  storage.setItem(STATE_KEY, 'not json');
  assert.equal(loadState(storage).cursor, 0);
  const s = { ...phone(), cursor: 40, lastOk: '2026-10-05T19:00:00.000Z' };
  saveState(storage, s);
  assert.deepEqual(loadState(storage), s);
  assert.equal(withSettings(s, { url: URL_OK, code: 'new-code' }).cursor, 40);
  assert.equal(withSettings(s, { url: 'http://localhost:8125/exec', code: CODE }).cursor, 0);
});

test('opening the app backs up after 12 hours, or when the last try failed', () => {
  const s = { ...phone(), lastOk: '2026-10-05T19:00:00.000Z' };
  assert.equal(isDue(s, new Date('2026-10-06T06:59:00Z')), false);
  assert.equal(isDue(s, new Date('2026-10-06T07:00:00Z')), true);
  assert.equal(isDue({ ...s, problem: 'offline' }, new Date('2026-10-05T19:01:00Z')), true);
  assert.equal(isDue({ ...s, url: '' }, new Date('2026-10-09T00:00:00Z')), false);
});

test('rows are readable, with the saved record as JSON in the last column', () => {
  const apple = word(data, '苹果');
  const p = learnedProgress(apple.id, '2026-10-05');
  const row = progressRow(p, apple, 'Food & Drink');
  assert.deepEqual(row.slice(0, 12), [apple.id, '苹果', 'píngguǒ', apple.enShort, 'Food & Drink', 1, 1, '2026-10-06', 'Learned', 0, 0, '2026-10-05']);
  assert.deepEqual(JSON.parse(row[12]), p);
  assert.deepEqual(logRow({ seq: 9, day: '2026-10-06', kind: 'undo', target: 8, id: apple.id, ts: 'T' }, apple).slice(0, 9),
    [9, '2026-10-06', 'T', 'undo', apple.id, '苹果', '', '', 'took back answer 8']);
});

test('a Daily row counts the live reviews, and minutes from the day\'s answers only', () => {
  const events = [
    { seq: 1, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:00:00Z' },
    { seq: 2, day: '2026-10-06', kind: 'review', grade: 'wrong', ts: '2026-10-06T19:00:30Z' },
    { seq: 3, day: '2026-10-06', kind: 'undo', target: 2, ts: '2026-10-06T19:00:40Z' },
    { seq: 4, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:01:00Z' },
    { seq: 5, day: '2026-10-06', kind: 'review', grade: 'know', ts: '2026-10-06T19:01:30Z' },
    { seq: 6, day: '2026-10-06', kind: 'review', grade: 'unsure', ts: '2026-10-06T19:01:40Z' },
    { seq: 7, day: '2026-10-06', kind: 'checkin', ts: '2026-10-06T19:04:40Z' },
  ];
  // 4 live reviews (answer 2 was taken back), 3 of them right or Know it. The live answers span
  // 100 seconds, 1.7 minutes. The check-in 3 minutes later is not an answer, so it adds nothing.
  assert.deepEqual(dailyRow('2026-10-06', events, undefined), ['2026-10-06', 'no', 4, 0.75, 0, 1.7, '']);
});

test('a first day goes to the Sheet, and a second backup sends nothing new', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const events = await store.eventsSince(0);
  const sheet = sheetWithScript();
  const storage = memoryStorage();
  const { state, sent } = await run(store, phone(), sheet.post, { save: (s) => saveState(storage, s), now: new Date('2026-10-05T19:30:00Z') });
  assert.equal(sent, events.length);
  assert.equal(state.cursor, events.at(-1).seq);
  assert.equal(state.problem, null);
  assert.deepEqual(loadState(storage), state);
  assert.equal(sheet.ss.rowsOf('Log').length, events.length);
  assert.equal(sheet.ss.rowsOf('Progress').length, 12);
  assert.deepEqual(sheet.ss.rowsOf('Daily').map((r) => r.slice(0, 5)), [['2026-10-05', 'yes', 0, '', 12]]);
  assert.deepEqual(sheet.ss.rowsOf('Meta').map((r) => r[0]), ['badges']);
  assert.equal(sheet.ss.getSheetByName('Dashboard').getRange(5, 2).getValues()[0][0], 1); // streak
  const again = await run(store, state, sheet.post);
  assert.equal(again.sent, 0);
  assert.equal(sheet.ss.rowsOf('Log').length, events.length);
});

test('the next day sends only its own events, in pages', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  let { state } = await run(store, phone(), sheet.post);
  const before = state.cursor;
  await playDay(store, '2026-10-06', { wrongFirst: 1 });
  const bodies = [];
  const post = (body) => { bodies.push(body); return sheet.post(body); };
  ({ state } = await run(store, state, post, { pageSize: 10 }));
  const newEvents = await store.eventsSince(before);
  assert.equal(bodies.length, Math.ceil(newEvents.length / 10));
  assert.equal(bodies[0].from, before);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), (await store.eventsSince(0)).map((e) => e.seq));
  const day2 = sheet.ss.rowsOf('Daily').find((r) => r[0] === '2026-10-06');
  assert.equal(day2[1], 'yes');
  assert.equal(day2[2], 12); // 12 reviews
});

test('offline, changes wait, and they arrive after reconnecting', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  const offline = async () => { throw Object.assign(new Error('Could not reach the Sheet (Failed to fetch).'), { problem: 'offline' }); };
  let { state, sent } = await run(store, phone(), offline);
  assert.equal(sent, 0);
  assert.equal(state.problem, 'offline');
  assert.equal(state.cursor, 0);
  assert.match(statusText(state, 61), /61 changes waiting to be sent\. Could not reach the Sheet/);
  ({ state } = await run(store, state, sheet.post));
  assert.equal(state.problem, null);
  assert.equal(sheet.ss.rowsOf('Log').length, (await store.eventsSince(0)).length);
});

test('a wrong secret code is refused, and Settings says so', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  const { state } = await run(store, { ...phone(), code: 'wrong-code' }, sheet.post);
  assert.equal(state.problem, 'code');
  assert.match(statusText(state, 61), /refused the secret code/);
  assert.deepEqual(sheet.ss.rowsOf('Log'), []);
});

test('restore into a fresh phone gives the same progress, and the new phone takes over', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  sheet.gs.RESTORE_PAGE = 25; // several pages
  await playDay(store, '2026-10-05');
  await playDay(store, '2026-10-06', { wrongFirst: 2 });
  let { state: oldPhone } = await run(store, phone(), sheet.post);
  const fresh = new MemoryStore();
  const { state: newPhone, counts } = await restoreFromSheet({ store: fresh, state: phone('0011223344556677'), post: sheet.post });
  // The saved session (meta 'session', for continuing a stopped session) stays on the phone.
  const { session, ...meta } = (await store.dump()).meta;
  assert.ok(session);
  assert.deepEqual(await fresh.dump(), { ...(await store.dump()), meta });
  assert.equal(counts.events, (await store.eventsSince(0)).length);
  assert.equal(newPhone.cursor, oldPhone.cursor);
  // The next answer on the new phone gets the next seq, so its backup continues the Sheet's log.
  await playDay(fresh, '2026-10-07');
  const { state: after } = await run(fresh, newPhone, sheet.post);
  assert.equal(after.problem, null);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), (await fresh.eventsSince(0)).map((e) => e.seq));
  // The old phone is now refused.
  await playDay(store, '2026-10-07');
  ({ state: oldPhone } = await run(store, oldPhone, sheet.post));
  assert.equal(oldPhone.problem, 'other-device');
});

test('restore refuses an empty Sheet and a wrong code, and leaves the phone as it was', async () => {
  const sheet = sheetWithScript();
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const dump = await store.dump();
  await assert.rejects(restoreFromSheet({ store, state: phone(), post: sheet.post }), /no saved progress yet/);
  await assert.rejects(restoreFromSheet({ store, state: { ...phone(), code: 'nope' }, post: sheet.post }), /refused the secret code/);
  assert.deepEqual(await store.dump(), dump);
});

test('after a backup file replaces the phone\'s log, the backup stops until the user chooses', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  const oldDump = await store.dump();
  await playDay(store, '2026-10-06');
  let { state } = await run(store, phone(), sheet.post);
  await store.restore(oldDump); // "Restore from a backup file" of Plan 4
  ({ state } = await run(store, state, sheet.post));
  assert.equal(state.problem, 'mismatch');
  ({ state } = await run(store, state, sheet.post, { reset: true })); // "Replace the Sheet with this phone's progress"
  assert.equal(state.problem, null);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), oldDump.events.map((e) => e.seq));
});

test('the Sheet is never replaced by a phone with no progress', async () => {
  const sheet = sheetWithScript();
  const { state } = await run(new MemoryStore(), phone(), sheet.post, { reset: true });
  assert.equal(state.problem, 'empty');
});

test('when the Sheet lost rows, the phone sends again from what the Sheet has', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  const cursor = (await store.eventsSince(0)).at(-1).seq;
  await playDay(store, '2026-10-06');
  // The phone believes the whole first day was sent, but the Sheet is empty.
  const { state } = await run(store, { ...phone(), cursor }, sheet.post);
  assert.equal(state.problem, null);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), (await store.eventsSince(0)).map((e) => e.seq));
});

test('requests are plain text, and keepalive is used only for small ones', async () => {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push([url, init]); return { ok: true, json: async () => ({ ok: true }) }; };
  assert.deepEqual(await postJson(URL_OK, { a: 1 }, { fetchFn, keepalive: true }), { ok: true });
  assert.equal(calls[0][1].headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.equal(calls[0][1].keepalive, true);
  await postJson(URL_OK, { a: '苹'.repeat(30000) }, { fetchFn, keepalive: true }); // 90,000 bytes
  assert.equal(calls[1][1].keepalive, false);
  await assert.rejects(postJson(URL_OK, {}, { fetchFn: async () => { throw new TypeError('Failed to fetch'); } }),
    (err) => err.problem === 'offline');
  await assert.rejects(postJson(URL_OK, {}, { fetchFn: async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }) }),
    (err) => err.problem === 'answer');
});

test('the status line says what happened in plain words', () => {
  assert.match(statusText({ url: '' }, 0), /^Not set up yet/);
  assert.equal(statusText({ ...phone(), lastOk: '2026-10-05T19:30:00.000Z' }, 0), 'Last backup: 2026-10-05 19:30. Nothing waiting to be sent.');
  assert.equal(statusText({ ...phone() }, 1), 'No backup yet. 1 change waiting to be sent.');
});
