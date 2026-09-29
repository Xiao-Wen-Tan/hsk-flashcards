import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hrefOf, parseRoute } from '../../docs/js/view/route.js';
import {
  backupFileName, backupText, parseBackup, settingsFromForm, settingsView,
} from '../../docs/js/view/settings.js';
import { filesForWords, soonWords } from '../../docs/js/view/files.js';
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();

test('addresses name the screens', () => {
  assert.deepEqual(parseRoute(''), { name: 'today' });
  assert.deepEqual(parseRoute('#/session'), { name: 'session' });
  assert.deepEqual(parseRoute('#/theme/t05'), { name: 'theme', id: 't05' });
  assert.deepEqual(parseRoute('#/word/w0026'), { name: 'word', id: 'w0026' });
  assert.deepEqual(parseRoute('#/nonsense'), { name: 'today' });
  assert.deepEqual(parseRoute('#/theme'), { name: 'today' });
  // A map tile opens one level group's words of a theme, for example the HSK 3 words of t05.
  assert.deepEqual(parseRoute('#/theme/t05/3'), { name: 'theme', id: 't05', group: '3' });
  assert.deepEqual(parseRoute('#/theme/t05/1-2'), { name: 'theme', id: 't05', group: '1-2' });
  assert.equal(hrefOf({ name: 'theme', id: 't05', group: '1-2' }), '#/theme/t05/1-2');
  // A word opened from a group's list keeps the group, so its Back link returns to that list.
  assert.deepEqual(parseRoute('#/word/w0026/3'), { name: 'word', id: 'w0026', group: '3' });
  assert.equal(hrefOf({ name: 'word', id: 'w0026', group: '3' }), '#/word/w0026/3');
  assert.equal(hrefOf({ name: 'word', id: 'w0026' }), '#/word/w0026');
  assert.equal(hrefOf({ name: 'stats' }), '#/stats');
});

test('settings have defaults, ranges and auto-play on', () => {
  assert.deepEqual(settingsView(undefined), { newPerDay: 12, reviewCap: 100, autoplay: true, newRange: [4, 30], capRange: [20, 300] });
  assert.equal(settingsView({ autoplay: false }).autoplay, false);
  assert.deepEqual(settingsFromForm({ newPerDay: '50', reviewCap: '80', autoplay: false }, { other: 1 }),
    { other: 1, newPerDay: 30, reviewCap: 80, autoplay: false });
});

test('a backup file round-trips through the store', async () => {
  const a = new MemoryStore();
  await a.commit({ progress: [learnedProgress('w0026', '2026-10-05')], days: [{ day: '2026-10-05' }], event: { day: '2026-10-05', kind: 'checkin' } });
  const text = backupText(await a.dump(), { release: 'r001', now: new Date('2026-10-05T12:00:00Z') });
  assert.equal(backupFileName('2026-10-05'), 'hsk-flashcards-backup-2026-10-05.json');
  const { dump, exported } = parseBackup(text);
  assert.equal(exported, '2026-10-05T12:00:00.000Z');
  const b = new MemoryStore();
  await b.restore(dump);
  assert.deepEqual(await b.dump(), await a.dump());
});

test('a file that is not a backup is refused with a plain message', () => {
  assert.throws(() => parseBackup('hello'), /not a backup file/);
  assert.throws(() => parseBackup('{"app":"other"}'), /not a backup of this app/);
  assert.throws(() => parseBackup('{"app":"hsk-flashcards","format":1,"progress":[]}'), /damaged/);
});

test('a word brings its two sounds and the stroke data of each character', () => {
  assert.deepEqual(filesForWords([word(data, '苹果')]),
    ['audio/w/w0026_6ce06b7e.mp3', 'audio/s/w0026_814ba0af.mp3', 'strokes/82f9.json', 'strokes/679c.json']);
  assert.equal(filesForWords([word(data, '谢谢')]).filter((f) => f.startsWith('strokes/')).length, 1); // 谢 once
  const all = filesForWords(data.words);
  assert.equal(new Set(all).size, all.length);
});

test('today\'s and tomorrow\'s words are kept ready', () => {
  const byOrd = data.words.slice().sort((a, b) => a.ord - b.ord);
  const learned = byOrd.slice(0, 4).map((w) => learnedProgress(w.id, '2026-10-05')); // due 6 October
  const later = { ...learnedProgress(byOrd[4].id, '2026-10-01'), step: 3, due: '2026-10-07' }; // due tomorrow
  const farther = { ...learnedProgress(byOrd[5].id, '2026-10-01'), step: 5, due: '2026-10-20' };
  const plan = { day: '2026-10-06', reviews: learned.map((p) => p.id), newWords: byOrd.slice(6, 10).map((w) => w.id) };
  const soon = soonWords({ words: data.words, progress: [...learned, later, farther], plan, settings: { newPerDay: 4 } });
  const expected = [...byOrd.slice(0, 5), ...byOrd.slice(6, 14)].map((w) => w.id).sort();
  assert.deepEqual(soon.map((w) => w.id).sort(), expected);
});
