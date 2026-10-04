// The sound check of the speaking panel, and the verdict of a try. Pure functions, so Node
// tests them.
//
// Chrome's speech recognizer, set to Chinese, writes down what it heard, for example '她。'.
// cleanHeard() keeps only the characters ('她'), and matchWord() accepts the word's own
// characters or a homophone with the same pinyin and tones. With the target 他 tā, 她 (tā)
// passes and 塔 (tǎ) fails. Which characters sound alike comes from readingsOf(), a map from
// each character of the words file to its pinyin syllables.
import { markTone, stripTones, syllableSpans, syllables } from './pinyin.js';

const HAN = /\p{Script=Han}/u;
const DIGITS = '零一二三四五六七八九';

// A whole number as Chinese characters, as a Chinese speaker reads it.
// numberText(2) === '二', numberText(10) === '十', numberText(15) === '十五',
// numberText(101) === '一百零一', numberText(20000) === '二万'.
export function numberText(n) {
  if (n === 0) return '零';
  if (n >= 100000000) return String(n);
  const below10000 = (m, leading) => {
    const parts = [[1000, '千'], [100, '百'], [10, '十'], [1, '']];
    let out = '';
    let zero = false;
    for (const [unit, name] of parts) {
      const d = Math.floor(m / unit) % 10;
      if (d === 0) {
        if (out) zero = true;
        continue;
      }
      if (zero) out += '零';
      zero = false;
      out += (d === 1 && unit === 10 && !out && leading ? '' : DIGITS[d]) + name;
    }
    return out;
  };
  const high = Math.floor(n / 10000);
  const low = n % 10000;
  if (!high) return below10000(low, true);
  return `${below10000(high, true)}万${low && low < 1000 ? '零' : ''}${below10000(low, false)}`;
}

// Cleans up what the recognizer heard. Full-width forms become plain ones, punctuation, spaces
// and Latin letters go, and numbers written in digits become characters.
// cleanHeard('我有 2 个。') gives '我有二个'.
export function cleanHeard(text) {
  const plain = String(text ?? '').normalize('NFKC').replace(/\d+/g, (d) => numberText(Number(d)));
  return [...plain].filter((ch) => HAN.test(ch)).join('');
}

// 2 may also mean 两, as in 两个 and 两百. withLiang('二个') gives '两个'.
const withLiang = (text) => text.replaceAll('二', '两');

// The syllables of a word, one per character of its characters when they line up, as
// [{ ch: '他', py: 'tā' }], from the card pinyin `py` (so 一 in 一点儿 is yì). The 儿 ending is
// { ch: '儿', py: 'r' }. Returns null when the characters and the syllables do not line up.
export function syllablesOf(word) {
  const chars = [...word.hz].filter((ch) => HAN.test(ch));
  const items = syllables(word.pyNum);
  const spans = syllableSpans(word.py, word.pyNum);
  if (!spans || chars.length !== items.length) return null;
  const py = word.py.normalize('NFC').toLowerCase();
  return chars.map((ch, i) => ({ ch, py: py.slice(spans[i][0], spans[i][1]) }));
}

// Each character of the words file with the toned syllables it is read as, from the card
// pinyin and from the dictionary tones (pyNum). For example 他 gives Set { 'tā' } and 一 gives
// Set { 'yī', 'yì', 'yí' }.
export function readingsOf(words) {
  const map = new Map();
  const add = (ch, syllable) => {
    if (!map.has(ch)) map.set(ch, new Set());
    map.get(ch).add(syllable);
  };
  for (const w of words) {
    const list = syllablesOf(w);
    if (!list) continue;
    const items = syllables(w.pyNum);
    list.forEach(({ ch, py }, i) => {
      add(ch, py);
      const { base, tone } = items[i];
      add(ch, markTone(base, tone));
    });
  }
  return map;
}

// True when the character `ch` can be read as the syllable `py`. A neutral-tone syllable (no
// mark, as qi in 客气 kèqi) matches any reading with the same letters.
function soundsLike(ch, py, readings) {
  const set = readings.get(ch);
  if (!set) return false;
  if (set.has(py)) return true;
  const neutral = stripTones(py) === py;
  return neutral && [...set].some((r) => stripTones(r) === py);
}

// Whether what the recognizer heard is the word. heardList holds its guesses, best first.
// Returns { ok, heard, how }, where heard is the cleaned guess that matched, or the first
// guess when none did, and how is 'same' (the word's characters), 'sounds alike' (a homophone)
// or null. A word ending in the 儿 ending also passes without its 儿 (一点 for 一点儿).
//   matchWord(他, ['她。'], readings) gives { ok: true, heard: '她', how: 'sounds alike' }
export function matchWord(word, heardList, readings) {
  const target = [...word.hz].filter((ch) => HAN.test(ch)).join('');
  const parts = syllablesOf(word);
  const cleaned = heardList.map(cleanHeard).filter(Boolean);
  const guesses = cleaned.flatMap((h) => (withLiang(h) === h ? [h] : [h, withLiang(h)]));
  const short = parts && parts.at(-1).py === 'r' ? target.slice(0, -1) : null;
  for (const h of guesses) {
    if (h === target || h === short) return { ok: true, heard: h, how: 'same' };
  }
  if (parts) {
    for (const h of guesses) {
      const chars = [...h];
      const list = chars.length === parts.length ? parts : short && chars.length === parts.length - 1 ? parts.slice(0, -1) : null;
      if (list && list.every((p, i) => chars[i] === p.ch || soundsLike(chars[i], p.py, readings))) {
        return { ok: true, heard: h, how: 'sounds alike' };
      }
    }
  }
  return { ok: false, heard: cleaned[0] ?? '', how: null };
}

// What the recognizer's answer means for one try. heard is its { texts, error } (ui/recognize.js
// listen) or null when it did not listen, and voice is true when the recording heard a voice.
//   'failed'  an error other than 'no-speech' (for example 'network' or 'not-allowed'), so the
//             recognizer does not work here and the tone check decides alone from now on
//   'empty'   no guess at all, although the recording heard a voice, so the recognizer missed it
//             and the tone check decides this try alone
//   'heard'   its guesses go to matchWord(), and no guess with no voice means nothing was said
//   'none'    it did not listen
export function recognizerOutcome(heard, voice) {
  if (!heard) return 'none';
  if (heard.error && heard.error !== 'no-speech') return 'failed';
  if (heard.texts.length === 0 && voice) return 'empty';
  return 'heard';
}

// The verdict of one try from the checks that ran. tones is judgeTones()'s result (tones.js)
// or null, and sounds is matchWord()'s result or null. A try passes when every check that ran
// passed. Returns { pass, problems, check }, where check is what is saved with the word:
// { tones: the share of syllables with the right tone, heard: what the recognizer heard }.
//   verdict({ tones: { pass: true, share: 1 }, sounds: { ok: false, heard: '是' } })
//   gives { pass: false, problems: ['Heard: 是'], check: { tones: 1, heard: '是' } }
export function verdict({ tones = null, sounds = null }) {
  const problems = [];
  if (sounds && !sounds.ok) problems.push(sounds.heard ? `Heard: ${sounds.heard}` : 'The sound check heard nothing.');
  if (tones && !tones.pass && tones.problem) problems.push(tones.problem);
  const ran = Boolean(tones || sounds);
  return {
    pass: ran && (!tones || tones.pass) && (!sounds || sounds.ok),
    problems,
    check: { tones: tones ? Math.round(tones.share * 100) / 100 : null, heard: sounds ? sounds.heard : null },
  };
}
