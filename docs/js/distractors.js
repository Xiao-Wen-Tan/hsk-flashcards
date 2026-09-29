// Wrong choices ("distractors") for the two multiple-choice quizzes:
//   'listen'  the sound plays, pick the English meaning (choices show enShort)
//   'pinyin'  the meaning is shown, pick the pinyin (choices show py)
// Choices stay the same for a word on a study day, because the random generator is
// seeded by the word's ID and the day.
import { CONFIG } from './config.js';
import { seeded, shuffled } from './rng.js';
import {
  changeTone, inShape, normPy, pyShape, spacingOf, stripTones, syllableSpans, syllables, toneOf,
} from './pinyin.js';

// The meaning keys of a word are the senses of en and enShort, in lower case, without
// brackets and without a leading "to", "a", "an" or "the".
// For example, en "to know (someone); to meet" gives the keys "know" and "meet".
// Two words that share a key mean the same thing, so they never appear together.
export function meaningKeys(word) {
  const keys = new Set();
  for (const text of [word.en, word.enShort]) {
    for (const part of text.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[;,/]/)) {
      const key = part.replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(to|a|an|the) /, '');
      if (key) keys.add(key);
    }
  }
  return keys;
}

// makePool does the work needed once per word list. It keeps the meaning keys, each word's
// exact sound (normPy), its look in the pinyin quiz (lookOf), and every syllable-and-tone pair
// that some real word uses (for example 'shi4'), which decides which tone changes are valid.
export function makePool(words) {
  const toneSet = new Set();
  for (const w of words) {
    for (const { base, tone } of syllables(w.pyNum)) if (tone <= 4) toneSet.add(`${base}${tone}`);
  }
  return {
    words,
    keys: new Map(words.map((w) => [w.id, meaningKeys(w)])),
    sound: new Map(words.map((w) => [w.id, normPy(w.py)])),
    look: new Map(words.map((w) => [w.id, lookOf(w)])),
    toneSet,
  };
}

// A name such as 北京 "Běijīng" starts with a capital letter. In the pinyin quiz every choice
// is shown with the answer's capitals, word by word, so a capital never tells the answer apart.
// For 北京 the real word 背景 "bèijǐng" is shown as "Bèijǐng", and for 背景 the name 北京 is
// shown as "běijīng".
const isCapital = (py) => /^\p{Lu}/u.test(py.normalize('NFC'));
export function inCaseOf(py, answerPy) {
  const capitals = answerPy.normalize('NFC').split(' ').map(isCapital);
  return py.normalize('NFC').toLowerCase().split(' ')
    .map((part, i) => ((capitals[i] ?? capitals[0]) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

// In the pinyin quiz every choice is also shown in the answer's word spacing, so a space or
// a hyphen never tells the answer apart either. The choices have the answer's number of
// syllables, so this always works. For 不客气 "bú kèqi", 对不起 "duìbuqǐ" is shown as
// "duì buqǐ", and for 拔苗助长 "bámiáo-zhùzhǎng", 飞禽走兽 "fēiqín zǒushòu" would be shown as
// "fēiqín-zǒushòu". The syllables, tones and 儿 ending stay as they are.
export function inAnswerForm(w, answer) {
  const shape = spacingOf(answer.py, answer.pyNum);
  const spaced = shape && inShape(w.py, w.pyNum, shape);
  return inCaseOf(spaced || w.py, answer.py);
}

// The look of a word's pinyin is its word spacing, which of its words start with a capital, and
// whether it ends in the 儿 ending, because each of these could tell the answer apart. So
// 不客气 "bú kèqi" and 没关系 "méi guānxi" look alike, while 对不起 "duìbuqǐ" does not, and
// 一点儿 "yìdiǎnr" looks like 一会儿 "yíhuìr" but not like 一样 "yíyàng".
const endsInR = (w) => w.pyNum.trim().split(/\s+/).at(-1) === 'r5';
function lookOf(w) {
  const shape = spacingOf(w.py, w.pyNum);
  return JSON.stringify([shape && shape.joints, shape && shape.tail, w.py.normalize('NFC').split(' ').map(isCapital),
    endsInR(w)]);
}

// A wrong choice shows the English meaning, or the pinyin in the answer's form.
const textOf = (w, quiz, answer) => (quiz === 'listen' ? w.enShort : inAnswerForm(w, answer));
const posShare = (a, b) => a.pos.some((p) => b.pos.includes(p));
const nearLevel = (a, b) => Math.abs(a.lv - b.lv) <= 1;

// Where wrong choices come from, best first.
const TIERS = [
  (a, c) => c.theme === a.theme && posShare(a, c) && nearLevel(a, c),
  (a, c) => c.theme === a.theme,
  (a, c) => posShare(a, c) && nearLevel(a, c),
  () => true,
];

function sharesKey(pool, a, b) {
  const kb = pool.keys.get(b.id);
  for (const k of pool.keys.get(a.id)) if (kb.has(k)) return true;
  return false;
}

// Rules every wrong choice follows, whatever the quiz.
function neverWith(pool, answer, c) {
  return c.id === answer.id || c.hz === answer.hz || answer.noDistract.includes(c.id)
    || c.noDistract.includes(answer.id) || sharesKey(pool, answer, c);
}

// The quick checks run first, and the meaning-key comparison last.
function allowed(pool, answer, c, quiz) {
  if (quiz === 'listen') {
    const len = answer.enShort.length;
    if (c.enShort.length * 2 < len || c.enShort.length > len * 2) return false;
    if (pool.sound.get(c.id) === pool.sound.get(answer.id)) return false;
  } else if (c.syl !== answer.syl || c.pyBase === answer.pyBase) {
    return false;
  }
  return !neverWith(pool, answer, c);
}

function fitsWith(pool, answer, c, chosen, quiz) {
  return chosen.every((o) => o.text !== textOf(c, quiz, answer) && (!o.word
    || (!sharesKey(pool, o.word, c) && (quiz !== 'pinyin' || o.word.pyBase !== c.pyBase))));
}

// A pinyin choice that differs from the answer only in tone, with the same spaces,
// hyphens and apostrophes. A real word with the same letters and the same word spacing
// comes first (买 mǎi gets 卖 mài). Otherwise one syllable of the answer gets another
// tone that some real word uses (老师 lǎoshī can become lǎoshí or lǎoshì, and
// 没关系 méi guānxi can become mèi guānxi). changeTone only touches that one syllable,
// so a made-up variant always keeps the answer's spacing.
function toneVariant(pool, answer, rand) {
  const shape = pyShape(answer.py);
  const real = pool.words.filter((c) => c.pyBase === answer.pyBase && c.syl === answer.syl
    && pool.sound.get(c.id) !== pool.sound.get(answer.id) && pyShape(c.py) === shape
    && !neverWith(pool, answer, c));
  if (real.length) {
    const c = real[Math.floor(rand() * real.length)];
    return { id: c.id, text: inCaseOf(c.py, answer.py), toneVariant: true, word: c };
  }
  const spans = syllableSpans(answer.py, answer.pyNum);
  if (!spans) return null;
  const dictionaryTones = syllables(answer.pyNum).map((s) => s.tone);
  const options = [];
  spans.forEach(([start, end], i) => {
    const syllable = answer.py.normalize('NFC').slice(start, end);
    const current = toneOf(syllable);
    const base = stripTones(syllable).toLowerCase();
    // A neutral-tone syllable and the 儿 ending (its span is the bare "r") are left alone.
    if (current === 5) return;
    // The dictionary tone is skipped too, because 不客气 is shown as "bú kèqi" while "bù"
    // is its dictionary tone, so "bù kèqi" would not be wrong.
    for (let t = 1; t <= 4; t++) {
      if (t !== current && t !== dictionaryTones[i] && pool.toneSet.has(`${base}${t}`)) options.push([i, t]);
    }
  });
  if (!options.length) return null;
  const [i, t] = options[Math.floor(rand() * options.length)];
  return { id: null, text: changeTone(answer.py, spans[i], t), toneVariant: true, word: null };
}

// Up to 3 wrong choices as [{ id, text, toneVariant }]. id is null for a made-up tone variant.
// `step` is the word's ladder step; tone variants are allowed from step 2 on.
export function pickDistractors(pool, answer, quiz, { day, step = 0 }) {
  if (quiz !== 'listen' && quiz !== 'pinyin') throw new Error(`No choices for quiz ${quiz}`);
  const rand = seeded(answer.id, day);
  const chosen = [];
  if (quiz === 'pinyin' && step >= 2 && rand() < CONFIG.toneVariantChance) {
    const variant = toneVariant(pool, answer, rand);
    if (variant) chosen.push(variant);
  }
  const candidates = pool.words.filter((c) => allowed(pool, answer, c, quiz));
  // In the pinyin quiz, the tiers are first searched for real words that already look like the
  // answer, with the same word spacing, capitals and 儿 ending (lookOf), shown as they are.
  // So 不客气 "bú kèqi" gets 没关系 "méi guānxi" first, a name gets other names (北京 gets 中国 or
  // 长城 before 米饭), and 一点儿 "yìdiǎnr" gets words that end in the 儿 ending, at least two
  // where the list has them. Next come words with the answer's first capital and 儿 ending, shown
  // in its spacing, and only then any word, shown in its spacing and capitals.
  const passes = quiz === 'pinyin'
    ? [(c) => pool.look.get(c.id) === pool.look.get(answer.id),
      (c) => isCapital(c.py) === isCapital(answer.py) && endsInR(c) === endsInR(answer), () => true]
    : [() => true];
  for (const pass of passes) {
    for (const tier of TIERS) {
      if (chosen.length >= CONFIG.wrongChoices) break;
      const fresh = candidates.filter((c) => pass(c) && tier(answer, c) && !chosen.some((o) => o.id === c.id));
      for (const c of shuffled(fresh, rand)) {
        if (chosen.length >= CONFIG.wrongChoices) break;
        if (fitsWith(pool, answer, c, chosen, quiz)) {
          chosen.push({ id: c.id, text: textOf(c, quiz, answer), toneVariant: false, word: c });
        }
      }
    }
  }
  return chosen.map(({ id, text, toneVariant: tv }) => ({ id, text, toneVariant: tv }));
}

// The four choices in a fixed shuffled order, and where the right one is.
export function buildChoices(pool, answer, quiz, { day, step = 0 }) {
  const wrong = pickDistractors(pool, answer, quiz, { day, step });
  const rand = seeded(answer.id, day, 'order');
  const answerIndex = Math.floor(rand() * (wrong.length + 1));
  const choices = wrong.map((w) => ({ ...w, correct: false }));
  const text = quiz === 'listen' ? answer.enShort : answer.py;
  choices.splice(answerIndex, 0, { id: answer.id, text, toneVariant: false, correct: true });
  return { choices, answerIndex };
}
