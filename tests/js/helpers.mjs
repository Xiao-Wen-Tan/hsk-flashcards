// Shared test helpers. Paths are resolved from this file, so tests run from any folder.
import { readFileSync } from 'node:fs';

export function loadFixture() {
  const url = new URL('./fixtures/words_fixture.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

// The fixture word with these characters, for example word(data, '苹果').
export function word(data, hz) {
  const w = data.words.find((x) => x.hz === hz);
  if (!w) throw new Error(`No fixture word ${hz}`);
  return w;
}

// localDate gives a local-time Date, so localDate('2026-10-05', 9) is 09:00 on 5 October.
export function localDate(day, hour = 9) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
}

// Checks one quiz's wrong choices against every rule in the design, independently of how
// distractors.js picks them. Returns a list of broken rules (empty when all is well).
const MARK = /[\u0304\u0301\u030c\u0300]/g;
// exact(py) is how the pinyin sounds, and shape(py) is its letters and word spacing
// without tones. A tone variant must keep the answer's shape and change its sound.
const exact = (s) => s.normalize('NFC').toLowerCase().replace(/[\s'’-]/g, '');
const shape = (s) => s.normalize('NFD').replace(MARK, '').normalize('NFC').toLowerCase().replace(/’/g, "'");
const idMaps = new WeakMap();
// The word spacing of a pinyin text, as the joints between its syllables and the text after
// the last one. pyNum gives the syllables. A joint is '' inside a word (an apostrophe counts as
// inside), ' ' between words, '-' in an idiom and '…' in a pattern word, and the 儿 ending "r5"
// has no joint. So 'bú kèqi' with 'bu4 ke4 qi5' gives ' ||', and 'duìbuqǐ' gives '||'.
function spacing(text, pyNum) {
  const t = shape(text);
  const joints = [];
  let i = 0;
  pyNum.split(' ').forEach((item, k) => {
    let sep = '';
    while (i < t.length && !/[a-zü]/.test(t[i])) sep += t[i++];
    if (k && item !== 'r5') joints.push(sep.includes('…') ? '…' : sep.includes('-') ? '-' : sep.includes(' ') ? ' ' : '');
    i += item.replace(/[1-5]$/, '').replace(/u:|v/g, 'ü').length;
  });
  return `${joints.join('|')}|${t.slice(i)}`;
}

export function brokenRules(words, keysOf, answer, quiz, wrong, step) {
  const problems = [];
  if (!idMaps.has(words)) idMaps.set(words, new Map(words.map((w) => [w.id, w])));
  const byId = idMaps.get(words);
  const say = (text) => problems.push(`${answer.hz} ${quiz}: ${text}`);
  if (wrong.length !== 3) say(`${wrong.length} wrong choices`);
  const texts = wrong.map((c) => c.text);
  if (new Set(texts).size !== texts.length) say('repeated choice');
  if (wrong.filter((c) => c.toneVariant).length > (quiz === 'pinyin' && step >= 2 ? 1 : 0)) say('tone variant not allowed');
  const shares = (a, b) => [...keysOf(a)].some((k) => keysOf(b).has(k));
  const real = wrong.filter((c) => c.id !== null).map((c) => byId.get(c.id));
  for (const c of real) {
    if (c.hz === answer.hz) say(`same characters ${c.hz}`);
    if (answer.noDistract.includes(c.id) || c.noDistract.includes(answer.id)) say(`noDistract ${c.hz}`);
    if (shares(answer, c)) say(`same meaning ${c.hz}`);
    for (const o of real) if (o !== c && shares(o, c)) say(`choices ${o.hz} and ${c.hz} share a meaning`);
  }
  if (quiz === 'listen') {
    for (const c of real) {
      if (exact(c.py) === exact(answer.py)) say(`homophone ${c.hz}`);
      if (c.enShort.length * 2 < answer.enShort.length || c.enShort.length > answer.enShort.length * 2) say(`length ${c.enShort}`);
    }
  } else {
    for (const c of wrong) {
      if (c.toneVariant) {
        if (shape(c.text) !== shape(answer.py) || exact(c.text) === exact(answer.py)) say(`bad tone variant ${c.text}`);
        continue;
      }
      const w = byId.get(c.id);
      if (w.syl !== answer.syl) say(`syllables ${w.hz}`);
      if (w.pyBase === answer.pyBase) say(`same toneless pinyin ${w.hz}`);
    }
    const bases = wrong.filter((c) => !c.toneVariant).map((c) => byId.get(c.id).pyBase);
    if (new Set(bases).size !== bases.length) say('two choices share toneless pinyin');
    // Every choice starts with a capital exactly when the answer does, so no capital gives the answer away.
    const capital = (s) => /^\p{Lu}/u.test(s.normalize('NFC'));
    for (const c of wrong) if (capital(c.text) !== capital(answer.py)) say(`capital of ${c.text} differs from the answer's`);
    // All four choices have one word spacing, so no space or hyphen gives the answer away.
    const want = spacing(answer.py, answer.pyNum);
    for (const c of wrong) {
      if (spacing(c.text, c.id === null ? answer.pyNum : byId.get(c.id).pyNum) !== want) say(`spacing of ${c.text} differs from the answer's`);
    }
    // An answer that ends in the 儿 ending gets at least two wrong choices that end in it too, when
    // the list has that many words that may be offered (same syllable count, other toneless pinyin,
    // no shared meaning and no noDistract), so the "r" alone does not give the answer away.
    const endsInR = (w) => w.pyNum.trim().split(/\s+/).at(-1) === 'r5';
    if (endsInR(answer)) {
      const offered = words.filter((c) => endsInR(c) && c.id !== answer.id && c.hz !== answer.hz && c.syl === answer.syl
        && c.pyBase !== answer.pyBase && !answer.noDistract.includes(c.id) && !c.noDistract.includes(answer.id)
        && !shares(answer, c)).length;
      const got = wrong.filter((c) => c.id === null || endsInR(byId.get(c.id))).length;
      if (got < Math.min(2, offered)) say(`only ${got} choices end in the 儿 ending, although ${offered} words could`);
    }
  }
  return problems;
}

// Plain made-up words for tests that need thousands of words but no real content.
// Word i (from 1) has id 'x00001', ord i, theme 't01' to 't30' in blocks, and level 1 to 6.
export function syntheticWords(count, perTheme = 180) {
  return Array.from({ length: count }, (_, k) => {
    const i = k + 1;
    const theme = `t${String(Math.min(30, Math.ceil(i / perTheme))).padStart(2, '0')}`;
    return { id: `x${String(i).padStart(5, '0')}`, ord: i, theme, lv: 1 + (k % 6) };
  });
}
