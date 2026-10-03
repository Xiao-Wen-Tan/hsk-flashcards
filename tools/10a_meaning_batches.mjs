// Step 10a. Batch files for the agents that check the quiz meanings of the words file.
//
// Input:  the latest docs/data/words_vNNN.json
// Output: data/build/meaning_batches_vNNN/ (the next free version), holding
//   theme_tNN.csv   every card of one theme, sorted by part of speech and then by enShort, with the
//                   columns id, hz, py, pos, lv, enShort, en. Most wrong quiz answers come from the
//                   answer's own theme (99.4% in a sample of 181,548 on 2026-10-02).
//   cross_theme.csv the pairs of cards from different themes that the app offered together as a
//                   question and a wrong answer, over 30 study days and both multiple-choice quizzes
//                   (id_a, hz_a, enShort_a, en_a, id_b, hz_b, enShort_b, en_b)
//   cut_off.csv     the cards whose enShort was shortened with "…" (id, hz, py, pos, enShort, en)
// Run from the project root:  node tools/10a_meaning_batches.mjs
// It uses the app's own docs/js/distractors.js, so the sampled pairs are the ones the app shows.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { makePool, pickDistractors } = await import(pathToFileURL(resolve('docs/js/distractors.js')).href);

const wordsFile = readdirSync('docs/data').filter((n) => /^words_v\d{3}\.json$/.test(n)).sort().at(-1);
const data = JSON.parse(readFileSync(`docs/data/${wordsFile}`, 'utf8'));
let n = 1;
while (existsSync(`data/build/meaning_batches_v${String(n).padStart(3, '0')}`)) n += 1;
const out = `data/build/meaning_batches_v${String(n).padStart(3, '0')}`;
mkdirSync(out, { recursive: true });

const cell = (v) => {
  const s = Array.isArray(v) ? v.join(' ') : String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const write = (name, header, rows) => writeFileSync(`${out}/${name}`, [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n',
  { encoding: 'utf8', flag: 'wx' });

const COLUMNS = ['id', 'hz', 'py', 'pos', 'lv', 'enShort', 'en'];
const byTheme = new Map();
for (const w of data.words) {
  if (!byTheme.has(w.theme)) byTheme.set(w.theme, []);
  byTheme.get(w.theme).push(w);
}
for (const [theme, words] of [...byTheme].sort()) {
  words.sort((a, b) => a.pos.join(' ').localeCompare(b.pos.join(' ')) || a.enShort.localeCompare(b.enShort));
  write(`theme_${theme}.csv`, COLUMNS, words.map((w) => COLUMNS.map((c) => w[c])));
}

const pool = makePool(data.words);
const byId = new Map(data.words.map((w) => [w.id, w]));
const pairs = new Map();
for (let d = 0; d < 30; d += 1) {
  const day = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
  for (const w of data.words) {
    for (const quiz of ['listen', 'pinyin']) {
      for (const g of pickDistractors(pool, w, quiz, { day, step: 0 })) {
        const c = g.id && byId.get(g.id);
        if (c && c.theme !== w.theme) pairs.set([w.id, c.id].sort().join(' '), [w, c].sort((x, y) => x.id.localeCompare(y.id)));
      }
    }
  }
}
write('cross_theme.csv', ['id_a', 'hz_a', 'enShort_a', 'en_a', 'id_b', 'hz_b', 'enShort_b', 'en_b'],
  [...pairs.values()].map(([a, b]) => [a.id, a.hz, a.enShort, a.en, b.id, b.hz, b.enShort, b.en]));

const cut = data.words.filter((w) => w.enShort.endsWith('…'));
write('cut_off.csv', ['id', 'hz', 'py', 'pos', 'enShort', 'en'], cut.map((w) => [w.id, w.hz, w.py, w.pos, w.enShort, w.en]));

console.log(`${byTheme.size} theme files, ${pairs.size} cross-theme pairs and ${cut.length} cut-off meanings in ${out}, from docs/data/${wordsFile}.`);
