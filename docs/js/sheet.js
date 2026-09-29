// The Google Sheet backup, the parts that need no page, so Node can test them.
// docs/js/sync.js joins them to the app, and tools/apps_script/Code.gs is the other end.
//
// How a backup works, with the numbers of a first study day:
//   The phone keeps a cursor, the seq of the last event the Sheet has confirmed (0 at first).
//   A backup sends every event with a larger seq (say seq 1 to 61) in pages of at most 500.
//   Each page also carries the Progress rows of the words its events touched, the Daily rows
//   of their study days, the settings and badges, and a short summary for the Dashboard.
//   The script adds only Log rows with a seq above the last one it has, so a page sent twice
//   does no harm. It answers { ok: true, lastSeq: 61 }, and the phone moves its cursor to 61.
// The web app address and the secret code are kept only in this browser (localStorage).
// They never go into the backup file, the Sheet or the repository.
import { isLearned, isMastered } from './srs.js';
import { liveEvents } from './stats.js';
import { bestStreak, currentStreak } from './checkin.js';
import { studyDay } from './dates.js';

export const STATE_KEY = 'hsk-sheet-backup';
export const PAGE_SIZE = 500; // events per request
export const KEEPALIVE_PAGE_SIZE = 40; // events per request when the app is being closed
export const KEEPALIVE_LIMIT = 60000; // bytes; browsers refuse keepalive bodies over 64 KB
export const RESYNC_HOURS = 12; // the design's "when it opens after 12 or more hours"
export const META_KEYS = Object.freeze(['settings', 'badges']);

// Column headings of the Sheet's tabs. Code.gs repeats them, and a test checks they agree.
export const HEADERS = Object.freeze({
  Progress: ['Word ID', 'Characters', 'Pinyin', 'English', 'Theme', 'HSK level', 'Step', 'Next review',
    'Status', 'Reviews', 'Wrong answers', 'Learned on', 'Data'],
  Log: ['Seq', 'Study day', 'Time (UTC)', 'What', 'Word ID', 'Characters', 'Quiz', 'Answer', 'Result', 'Data'],
  Daily: ['Study day', 'Checked in', 'Reviews', 'Right first time', 'New words learned', 'Minutes', 'Data'],
  Meta: ['Name', 'Data'],
});

const KIND_TEXT = {
  review: 'review', reask: 'asked again', learn: 'learning card', check: 'group check',
  final: 'final check', undo: 'undo', checkin: 'check-in', badges: 'badges', settings: 'settings',
};
const GRADE_TEXT = { right: 'right', wrong: 'wrong', know: 'Know it', unsure: 'Unsure', dontknow: "Don't know" };
const QUIZ_TEXT = { listen: 'listen, pick meaning', pinyin: 'meaning, pick pinyin', recall: 'recall' };

// ---- Settings values ----

// A new secret code: 24 letters and digits in groups of 4, such as 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja'.
// The alphabet leaves out 0, 1, i, l and o, which are easy to mix up when typed.
const CODE_LETTERS = 'abcdefghjkmnpqrstuvwxyz23456789';
export function makeCode(randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = randomBytes(24);
  const chars = [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]);
  return [0, 4, 8, 12, 16, 20].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

export function makeDeviceId(randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  return [...randomBytes(8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Checks the web app address the learner pasted. A Google Apps Script web app address looks
// like https://script.google.com/macros/s/AKfycb.../exec (or .../a/macros/<domain>/s/.../exec
// for a school or work account). http://localhost addresses are allowed for local tests.
export function checkWebAppUrl(text) {
  const url = String(text ?? '').trim();
  if (/^https:\/\/script\.google\.com\/(a\/macros\/[^/\s]+|macros)\/s\/[A-Za-z0-9_-]{20,}\/exec$/.test(url)) return url;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+\/[^\s]*$/.test(url)) return url;
  throw new Error('That is not a web app address. It starts with https://script.google.com/macros/s/ and ends with /exec.');
}

// Checks a secret code typed or pasted on a new phone: 8 to 64 letters, digits and dashes.
export function checkCode(text) {
  const code = String(text ?? '').trim();
  if (/^[A-Za-z0-9-]{8,64}$/.test(code)) return code;
  throw new Error('A secret code has 8 to 64 letters, digits and dashes, with no spaces.');
}

// The saved state, from localStorage (or a stand-in with getItem and setItem).
//   url     the web app address          code    the secret code
//   device  a random ID of this browser  cursor  seq of the last event the Sheet confirmed
//   lastOk  time of the last backup      problem null or a word from PROBLEM_TEXT
export function loadState(storage) {
  let saved = {};
  try {
    saved = JSON.parse(storage.getItem(STATE_KEY) ?? '{}') ?? {};
  } catch {
    saved = {};
  }
  return { url: '', code: '', device: '', cursor: 0, lastOk: null, problem: null, detail: '', ...saved };
}

export function saveState(storage, state) {
  storage.setItem(STATE_KEY, JSON.stringify(state));
}

export const isReady = (state) => Boolean(state.url && state.code && state.device);

// Saving a new address or code. A new address is another Sheet, so everything is sent again.
export function withSettings(state, { url, code }) {
  const next = { ...state, url, code };
  if (url !== state.url) Object.assign(next, { cursor: 0, lastOk: null, problem: null, detail: '' });
  if (code !== state.code) Object.assign(next, { problem: null, detail: '' });
  return next;
}

// The 'open' hook backs up when the last backup is 12 or more hours old, or the last try failed.
export function isDue(state, now = new Date()) {
  if (!isReady(state)) return false;
  if (!state.lastOk || state.problem === 'offline') return true;
  return now - new Date(state.lastOk) >= RESYNC_HOURS * 3600 * 1000;
}

// ---- Rows for the Sheet ----

function statusOf(p) {
  if (isMastered(p)) return 'Mastered';
  if (isLearned(p)) return 'Learned';
  return 'Not learned yet';
}

// One readable row per word, with the saved record as JSON in the last column, which Restore reads.
// For 苹果 after its lesson on 5 October:
// ['w0026', '苹果', 'píngguǒ', 'apple', 'Food & Drink', 1, 1, '2026-10-06', 'Learned', 0, 0, '2026-10-05', '{"id":"w0026",...}']
export function progressRow(p, word, themeName = '') {
  return [p.id, word?.hz ?? '', word?.py ?? '', word?.enShort ?? '', themeName, word?.lv ?? '', p.step, p.due ?? '',
    statusOf(p), p.reps ?? 0, p.lapses ?? 0, p.learned ?? '', JSON.stringify(p)];
}

// One row per event. For a right listening review of 苹果:
// [14, '2026-10-06', '2026-10-06T19:02:11.000Z', 'review', 'w0026', '苹果', 'listen, pick meaning', 'right', '', '{...}']
export function logRow(e, word) {
  let result = e.outcome ?? '';
  if (e.kind === 'undo') result = `took back answer ${e.target}`;
  if (e.kind === 'badges') result = (e.badges ?? []).join(', ');
  return [e.seq, e.day, e.ts ?? '', KIND_TEXT[e.kind] ?? e.kind, e.id ?? '', word?.hz ?? '', QUIZ_TEXT[e.quiz] ?? '',
    GRADE_TEXT[e.grade] ?? '', result, JSON.stringify(e)];
}

// Minutes studied on a day: the gaps between answers added up, each gap counted as at most
// 5 minutes, so a break does not count. Answers at 19:00:00, 19:00:20 and 19:40:00 give 5.3 min.
export function minutesOf(events) {
  const times = events.map((e) => Date.parse(e.ts)).filter(Number.isFinite).sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < times.length; i += 1) ms += Math.min(times[i] - times[i - 1], 5 * 60 * 1000);
  return Math.round(ms / 6000) / 10;
}

// One row per study day. dayRecord is the saved check-in record of that day, or undefined.
// ['2026-10-06', 'yes', 12, 0.917, 12, 21.5, '{"day":"2026-10-06",...}']
export function dailyRow(day, events, dayRecord) {
  const live = liveEvents(events.filter((e) => e.day === day));
  const reviews = live.filter((e) => e.kind === 'review');
  const right = reviews.filter((e) => e.grade === 'right' || e.grade === 'know').length;
  const learned = live.filter((e) => e.outcome === 'learned').length;
  return [day, dayRecord ? 'yes' : 'no', reviews.length, reviews.length ? Math.round((right / reviews.length) * 1000) / 1000 : '',
    learned, minutesOf(events.filter((e) => e.day === day)), dayRecord ? JSON.stringify(dayRecord) : ''];
}

// The numbers the Dashboard shows at the top.
export function summaryOf({ progress, days, words, now = new Date() }) {
  const checked = days.map((d) => d.day);
  const today = studyDay(now);
  return {
    updated: now.toISOString(),
    today,
    streak: currentStreak(checked, today),
    bestStreak: bestStreak(checked),
    checkIns: checked.length,
    learned: progress.filter(isLearned).length,
    mastered: progress.filter(isMastered).length,
    words: words.length,
  };
}

// ---- Talking to the web app ----

// Sends one request. The body is sent as text/plain, which a browser sends without asking the
// server first (a CORS preflight, which Apps Script cannot answer). Google answers from
// script.googleusercontent.com after a redirect, and fetch follows it.
export async function postJson(url, body, { fetchFn = globalThis.fetch, keepalive = false } = {}) {
  const text = JSON.stringify(body);
  const small = new TextEncoder().encode(text).length < KEEPALIVE_LIMIT;
  let res;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: text,
      redirect: 'follow',
      keepalive: keepalive && small,
    });
  } catch (err) {
    throw Object.assign(new Error(`Could not reach the Sheet (${err.message}).`), { problem: 'offline' });
  }
  if (!res.ok) throw Object.assign(new Error(`The Sheet's web app answered with error ${res.status}.`), { problem: 'answer' });
  try {
    return await res.json();
  } catch {
    throw Object.assign(new Error('The web app sent an answer this app cannot read.'), { problem: 'answer' });
  }
}

export const PROBLEM_TEXT = {
  offline: 'Could not reach the Sheet. The phone may be offline, or the web app address is wrong or not open to "Anyone". Changes wait and are sent later.',
  answer: 'The web app gave an unexpected answer. Check the web app address.',
  code: 'The Sheet refused the secret code. The code in the script must be the code shown here.',
  'other-device': 'Another phone or browser backs up to this Sheet. Restore from the Sheet here, or replace the Sheet with this phone\'s progress.',
  mismatch: 'The progress on this phone no longer matches the Sheet, for example after restoring a backup file. Restore from the Sheet, or replace the Sheet with this phone\'s progress.',
  empty: 'This phone has no progress yet, so there is nothing to put in the Sheet.',
  'not-set-up': 'The script in the Sheet is not set up. Run setup in the script editor.',
  busy: 'The Sheet was busy. The backup will be tried again later.',
  server: 'The Sheet reported a problem.',
};

function failed(state, problem, detail = '') {
  return { ...state, problem, detail };
}

// Sends everything the Sheet does not have yet. Never throws: the result says what happened.
//   post(body)   sends one request and returns the parsed answer (postJson bound to the address)
//   save(state)  stores the state, called after every confirmed page
//   reset        true replaces everything in the Sheet with this phone's progress
// Returns { state, sent }, where sent counts the events the Sheet confirmed.
export async function backUp({
  store, words, themes = [], state, post, save = () => {}, now = new Date(), pageSize = PAGE_SIZE, reset = false,
}) {
  if (!isReady(state)) return { state, sent: 0 };
  let current = { ...state };
  let sent = 0;
  try {
    let cursor = reset ? 0 : current.cursor;
    // The event at the cursor must still be on the phone. When it is gone, the phone's log was
    // replaced (a backup file was restored), and sending more would mix two histories.
    if (cursor > 0) {
      const around = await store.eventsSince(cursor - 1);
      if (around[0]?.seq !== cursor) {
        current = failed(current, 'mismatch');
        save(current);
        return { state: current, sent };
      }
    }
    let pending = await store.eventsSince(cursor);
    if (reset && pending.length === 0) {
      current = failed(current, 'empty');
      save(current);
      return { state: current, sent };
    }
    if (pending.length === 0) {
      if (current.problem === 'offline' || current.problem === 'busy') current = { ...current, problem: null, detail: '' };
      save(current);
      return { state: current, sent };
    }
    const wordsById = new Map(words.map((w) => [w.id, w]));
    const themeNames = new Map(themes.map((t) => [t.id, t.name]));
    const progressById = new Map((await store.allProgress()).map((p) => [p.id, p]));
    const days = await store.allDays();
    const daysByDay = new Map(days.map((d) => [d.day, d]));
    const meta = [];
    for (const key of META_KEYS) {
      const value = await store.getMeta(key);
      if (value !== undefined) meta.push([key, JSON.stringify(value)]);
    }
    const summary = summaryOf({ progress: [...progressById.values()], days, words, now });
    let dayEvents = await store.eventsFrom(pending.reduce((m, e) => (e.day < m ? e.day : m), pending[0].day));
    let retried = false;
    for (let i = 0; i < pending.length; i += pageSize) {
      const page = pending.slice(i, i + pageSize);
      const ids = [...new Set(page.map((e) => e.id).filter(Boolean))];
      const pageDays = [...new Set(page.map((e) => e.day))];
      const answer = await post({
        action: 'push',
        code: current.code,
        device: current.device,
        from: cursor,
        reset: reset && i === 0,
        log: page.map((e) => logRow(e, wordsById.get(e.id))),
        progress: ids.filter((id) => progressById.has(id)).map((id) => {
          const w = wordsById.get(id);
          return progressRow(progressById.get(id), w, themeNames.get(w?.theme) ?? '');
        }),
        removed: ids.filter((id) => !progressById.has(id)),
        daily: pageDays.map((d) => dailyRow(d, dayEvents, daysByDay.get(d))),
        meta,
        summary,
      });
      if (!answer?.ok && answer?.error === 'behind' && !retried && answer.lastSeq < cursor) {
        // The Sheet has fewer events than the phone thought (for example rows were deleted by
        // hand). Send again from what the Sheet has, once.
        retried = true;
        cursor = answer.lastSeq;
        pending = await store.eventsSince(cursor);
        dayEvents = await store.eventsFrom(pending.reduce((m, e) => (e.day < m ? e.day : m), pending[0].day));
        i = -pageSize;
        continue;
      }
      if (!answer?.ok) {
        current = failed(current, PROBLEM_TEXT[answer?.error] ? answer.error : 'server', answer?.message ?? '');
        save(current);
        return { state: current, sent };
      }
      cursor = page[page.length - 1].seq;
      sent += page.length;
      current = { ...current, cursor, lastOk: now.toISOString(), problem: null, detail: '' };
      save(current);
    }
    return { state: current, sent };
  } catch (err) {
    current = failed(current, err.problem ?? 'offline', err.message);
    save(current);
    return { state: current, sent };
  }
}

// Pulls everything back from the Sheet into this phone (the design's "New phone" restore).
// It replaces all progress on the phone, so the screen asks first. Throws an Error with a
// plain message when something is wrong, and then the phone's progress is left as it was.
export async function restoreFromSheet({ store, state, post, save = () => {}, now = new Date() }) {
  if (!isReady(state)) throw new Error('Enter the web app address first.');
  const ask = async (body) => {
    const answer = await post({ code: state.code, device: state.device, ...body });
    if (!answer?.ok) throw new Error(PROBLEM_TEXT[answer?.error] ?? answer?.message ?? 'The Sheet reported a problem.');
    return answer;
  };
  const first = await ask({ action: 'restore', page: 0 });
  if (!first.lastSeq) throw new Error('The Sheet has no saved progress yet.');
  const events = [...first.events];
  for (let page = 1; page < first.pages; page += 1) events.push(...(await ask({ action: 'restore', page })).events);
  const dump = { progress: first.progress, events, days: first.days, meta: first.meta };
  const counts = { progress: dump.progress.length, events: events.length, days: dump.days.length };
  if (JSON.stringify(counts) !== JSON.stringify(first.counts)) {
    throw new Error(`The Sheet's rows did not all arrive (${JSON.stringify(counts)}). Nothing was changed. Try again.`);
  }
  await store.restore(dump);
  await ask({ action: 'claim', lastSeq: first.lastSeq });
  const next = { ...state, cursor: first.lastSeq, lastOk: now.toISOString(), problem: null, detail: '' };
  save(next);
  return { state: next, counts };
}

// ---- What Settings shows ----

function localTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// The status line of the Settings section. pending is the number of events not yet sent.
export function statusText(state, pending) {
  if (!state.url) return 'Not set up yet. Paste the web app address from the Sheet owner below.';
  const lines = [];
  lines.push(state.lastOk ? `Last backup: ${localTime(state.lastOk)}.` : 'No backup yet.');
  lines.push(pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to be sent.` : 'Nothing waiting to be sent.');
  if (state.problem) lines.push(PROBLEM_TEXT[state.problem] ?? PROBLEM_TEXT.server);
  if (state.detail && state.problem !== 'offline') lines.push(`(${state.detail})`);
  return lines.join(' ');
}
