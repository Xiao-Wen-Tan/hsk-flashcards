// Tests of tools/apps_script/Code.gs, run in Node through fake-apps-script.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScript } from './fake-apps-script.mjs';

const CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';
const PHONE = 'a1b2c3d4e5f60718';
const OTHER = 'ffeeddccbbaa9988';

function ready() {
  const s = loadAppsScript({ code: CODE });
  s.gs.setup();
  return s;
}

// A Log row as the phone builds it (docs/js/sheet.js logRow), for seq n.
const logRow = (n, day = '2026-10-05') => [n, day, `${day}T19:00:0${n % 10}.000Z`, 'review', 'w0026', '苹果', 'recall', 'Know it', '',
  JSON.stringify({ seq: n, day, kind: 'review', id: 'w0026', grade: 'know' })];
const progressRow = (id, step, due) => [id, '苹果', 'píngguǒ', 'apple', 'Food & Drink', 1, step, due, 'Learned', 0, 0, '2026-10-05',
  JSON.stringify({ id, step, due })];
const push = (extra = {}) => ({ action: 'push', code: CODE, device: PHONE, from: 0, log: [], progress: [], removed: [], daily: [], meta: [], ...extra });

test('setup refuses to run until the secret code is pasted', () => {
  const { gs } = loadAppsScript();
  assert.throws(() => gs.setup(), /Replace PASTE-THE-CODE-FROM-THE-APP/);
});

test('setup makes the five tabs with the Dashboard first and its chart', () => {
  const { ss, props, logs } = ready();
  assert.deepEqual(ss.sheets.map((s) => s.name), ['Dashboard', 'Sheet1', 'Progress', 'Log', 'Daily', 'Meta']);
  assert.deepEqual(ss.rowsOf('Log'), []);
  assert.equal(ss.getSheetByName('Log').cell(1, 1), 'Seq');
  assert.equal(ss.getSheetByName('Dashboard').charts.length, 1);
  assert.equal(props.get('SHEET_ID'), 'sheet-id-1');
  assert.equal(props.get('LAST_SEQ'), '0');
  assert.match(logs[0], /Setup done/);
});

test('running setup again keeps the data and makes one chart', async () => {
  const s = ready();
  await s.post(push({ log: [logRow(1)] }));
  s.gs.setup();
  assert.equal(s.ss.rowsOf('Log').length, 1);
  assert.equal(s.ss.getSheetByName('Dashboard').charts.length, 1);
});

test('a visit in a browser says the backup is running', () => {
  const { gs } = loadAppsScript();
  assert.match(gs.doGet().getContent(), /"app":"hsk-flashcards-backup"/);
});

test('a wrong secret code is refused and writes nothing', async () => {
  const s = ready();
  assert.deepEqual(await s.post(push({ code: 'wrong', log: [logRow(1)] })), { ok: false, error: 'code', message: 'Wrong secret code.' });
  assert.deepEqual(s.ss.rowsOf('Log'), []);
});

test('before setup every request is refused with not-set-up', async () => {
  const s = loadAppsScript({ code: CODE });
  assert.equal((await s.post(push())).error, 'not-set-up');
});

test('a push adds its Log rows once, even when it is sent twice', async () => {
  const s = ready();
  const body = push({ log: [logRow(1), logRow(2), logRow(3)] });
  assert.deepEqual(await s.post(body), { ok: true, lastSeq: 3 });
  assert.deepEqual(await s.post(body), { ok: true, lastSeq: 3 });
  assert.deepEqual(s.ss.rowsOf('Log').map((r) => r[0]), [1, 2, 3]);
  assert.equal(s.ss.rowsOf('Log')[0][1], '2026-10-05'); // still text, not a date
  assert.equal(s.props.get('DEVICE'), PHONE); // the first push claims the Sheet
  assert.deepEqual(await s.post(push({ from: 3, log: [logRow(3), logRow(4)] })), { ok: true, lastSeq: 4 });
  assert.deepEqual(s.ss.rowsOf('Log').map((r) => r[0]), [1, 2, 3, 4]);
});

test('Progress, Daily and Meta rows are replaced by key, and removed words disappear', async () => {
  const s = ready();
  await s.post(push({ progress: [progressRow('w0026', 1, '2026-10-06'), progressRow('w0027', 1, '2026-10-06')],
    daily: [['2026-10-05', 'yes', 0, '', 12, 20.5, '{"day":"2026-10-05"}']], meta: [['settings', '{"newPerDay":12}']] }));
  await s.post(push({ progress: [progressRow('w0026', 2, '2026-10-08')], removed: ['w0027'],
    daily: [['2026-10-05', 'yes', 3, 1, 12, 25, '{"day":"2026-10-05"}']], meta: [['settings', '{"newPerDay":8}']] }));
  const rows = s.ss.rowsOf('Progress');
  assert.deepEqual(rows.map((r) => [r[0], r[6], r[7]]), [['w0026', 2, '2026-10-08']]);
  assert.deepEqual(s.ss.rowsOf('Daily').map((r) => [r[0], r[2]]), [['2026-10-05', 3]]);
  assert.deepEqual(s.ss.rowsOf('Meta'), [['settings', '{"newPerDay":8}']]);
});

test('a text that looks like a formula stays text', async () => {
  const s = ready();
  const row = progressRow('w0026', 1, '2026-10-06');
  row[3] = '=to be (stand-in meaning)';
  await s.post(push({ progress: [row] }));
  assert.equal(s.ss.rowsOf('Progress')[0][3], '=to be (stand-in meaning)');
});

test('the summary fills the Dashboard', async () => {
  const s = ready();
  await s.post(push({ summary: { updated: '2026-10-05T19:30:00.000Z', today: '2026-10-05', streak: 1, bestStreak: 1, checkIns: 1, learned: 12, mastered: 0, words: 61 } }));
  const dash = s.ss.getSheetByName('Dashboard');
  assert.deepEqual(dash.getRange(3, 1, 8, 2).getValues(), [
    ['Last backup (UTC)', '2026-10-05T19:30:00.000Z'], ['Study day of the last backup', '2026-10-05'],
    ['Current streak (days)', 1], ['Best streak (days)', 1], ['Check-ins', 1], ['Words learned', 12],
    ['Words mastered', 0], ['Words in the course', 61]]);
});

test('another phone is refused until it claims the Sheet', async () => {
  const s = ready();
  await s.post(push({ log: [logRow(1)] }));
  assert.equal((await s.post(push({ device: OTHER, from: 1, log: [logRow(2)] }))).error, 'other-device');
  assert.deepEqual(await s.post({ action: 'ping', code: CODE, device: OTHER }), { ok: true, lastSeq: 1, device: 'other' });
  assert.deepEqual(await s.post({ action: 'claim', code: CODE, device: OTHER }), { ok: true, lastSeq: 1 });
  assert.equal((await s.post(push({ from: 1, log: [logRow(2)] }))).error, 'other-device');
});

test('a phone that expects more than the Sheet has is told how far the Sheet got', async () => {
  const s = ready();
  await s.post(push({ log: [logRow(1)] }));
  assert.deepEqual(await s.post(push({ from: 5, log: [logRow(6)] })),
    { ok: false, error: 'behind', lastSeq: 1, message: 'The Sheet has fewer answers than the phone expected.' });
});

test('a reset empties the tabs and starts again from this phone', async () => {
  const s = ready();
  await s.post(push({ log: [logRow(1), logRow(2)], progress: [progressRow('w0026', 1, '2026-10-06')] }));
  assert.deepEqual(await s.post(push({ device: OTHER, reset: true, log: [logRow(1)] })), { ok: true, lastSeq: 1 });
  assert.deepEqual(s.ss.rowsOf('Log').map((r) => r[0]), [1]);
  assert.deepEqual(s.ss.rowsOf('Progress'), []);
  assert.equal(s.props.get('DEVICE'), OTHER);
});

test('restore sends everything back, the Log in pages', async () => {
  const s = ready();
  s.gs.RESTORE_PAGE = 3;
  await s.post(push({ log: [1, 2, 3, 4, 5, 6, 7].map((n) => logRow(n)), progress: [progressRow('w0026', 1, '2026-10-06')],
    daily: [['2026-10-05', 'yes', 0, '', 12, 20, '{"day":"2026-10-05","reviews":0}'], ['2026-10-04', 'no', 1, 0, 0, 1, '']],
    meta: [['badges', '{"learned-50":"2026-10-05"}']] }));
  const first = await s.post({ action: 'restore', code: CODE, page: 0 });
  assert.equal(first.pages, 3);
  assert.deepEqual(first.counts, { progress: 1, events: 7, days: 1 });
  assert.deepEqual(first.events.map((e) => e.seq), [1, 2, 3]);
  assert.deepEqual(first.days, [{ day: '2026-10-05', reviews: 0 }]);
  assert.deepEqual(first.meta, { badges: { 'learned-50': '2026-10-05' } });
  assert.deepEqual((await s.post({ action: 'restore', code: CODE, page: 2 })).events.map((e) => e.seq), [7]);
  assert.equal((await s.post({ action: 'restore', code: 'wrong', page: 0 })).error, 'code');
});
