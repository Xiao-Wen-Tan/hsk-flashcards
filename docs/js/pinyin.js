// Pinyin helpers for quiz choices. Tones are numbered 1 (ā), 2 (á), 3 (ǎ) and 4 (à), and
// 5 is the neutral tone, which has no mark. Text is handled in Unicode NFD form, where a
// marked vowel is the plain vowel followed by a separate tone mark, so marks can be
// removed or added one by one.
//
// A card's py uses textbook word spacing. The syllables of one word are joined, words
// are separated by spaces, a four-character idiom that divides into two pairs is two
// joined pairs with a hyphen, an apostrophe comes before a syllable starting with a, o or
// e, and the 儿 ending is a bare "r" joined to the syllable before it. Examples: "bú kèqi",
// "bámiáo-zhùzhǎng", "xī'ān", "yìdiǎnr". In pyNum the 儿 ending is its own item "r5", so
// 一点儿 is "yi1 dian3 r5".
// A pattern word puts "…" after each half, as in "suīrán…dànshì…".
const MARKS = ['', '̄', '́', '̌', '̀'];
const TONE_MARK = /[̄́̌̀]/g;
const SEPARATORS = /[\s'’…-]/;

export function stripTones(text) {
  return text.normalize('NFD').replace(TONE_MARK, '').normalize('NFC');
}

// toneOf('hǎo') === 3, toneOf('ma') === 5.
export function toneOf(syllable) {
  const m = syllable.normalize('NFD').match(TONE_MARK);
  return m ? MARKS.indexOf(m[0]) : 5;
}

// The standard rule puts the tone mark on a or e if present, on the o of ou, and otherwise
// on the last vowel. For example, markTone('liu', 2) === 'liú', markTone('Bei', 3) === 'Běi'.
export function markTone(syllable, tone) {
  const bare = stripTones(syllable);
  if (tone < 1 || tone > 4) return bare;
  const lower = bare.toLowerCase();
  let i = lower.search(/[ae]/);
  if (i < 0) i = lower.indexOf('ou');
  if (i < 0) {
    for (let k = lower.length - 1; k >= 0; k--) {
      if ('iouü'.includes(lower[k])) { i = k; break; }
    }
  }
  if (i < 0) return bare;
  return (bare.slice(0, i + 1) + MARKS[tone] + bare.slice(i + 1)).normalize('NFC');
}

// normPy makes pinyin lower case and drops spaces, apostrophes and hyphens but keeps tone
// marks, so normPy("Nǚ'ér") === 'nǚér' and normPy('bú kèqi') === 'búkèqi'.
// Two words with the same normPy sound exactly alike.
export function normPy(py) {
  return py.normalize('NFC').toLowerCase().replace(/[\s'’-]/g, '');
}

// pyShape is the pinyin without tone marks, in lower case, with its spaces, hyphens and
// apostrophes kept (a curly apostrophe becomes a straight one). So
// pyShape('bámiáo-zhùzhǎng') === 'bamiao-zhuzhang' and pyShape('bú kèqi') === 'bu keqi'.
// Two pinyin texts with the same shape differ at most in their tones.
export function pyShape(py) {
  return stripTones(py.normalize('NFC')).toLowerCase().replace(/’/g, "'");
}

// syllables splits numbered pinyin, so syllables('nü3 er2') gives
// [{ base: 'nü', tone: 3 }, { base: 'er', tone: 2 }]. "u:" and "v" are read as ü.
// The 儿 ending "r5" gives { base: 'r', tone: 5 }.
export function syllables(pyNum) {
  return pyNum.trim().toLowerCase().split(/\s+/).map((s) => {
    const m = s.match(/^(.*?)([1-5])?$/);
    return { base: m[1].replace(/u:|v/g, 'ü'), tone: m[2] ? Number(m[2]) : 5 };
  });
}

// The number of syllables, leaving out the 儿 ending, which joins the syllable before it.
// syllableCount('yi1 dian3 r5') === 2, while syllableCount('nü3 er2') === 2 as well.
export function syllableCount(pyNum) {
  return syllables(pyNum).filter((s) => !(s.base === 'r' && s.tone === 5)).length;
}

// Where each item of pyNum sits inside the tone-marked py, as [start, end] positions.
// Spaces, hyphens, apostrophes and "…" between syllables are skipped, and a 儿 ending gets
// the span of its "r". syllableSpans('bú kèqi', 'bu4 ke4 qi5') gives [[0, 2], [3, 5], [5, 7]],
// and syllableSpans('yìdiǎnr', 'yi1 dian3 r5') gives [[0, 2], [2, 6], [6, 7]].
// Returns null when the two do not line up.
export function syllableSpans(py, pyNum) {
  const text = py.normalize('NFC');
  const spans = [];
  let i = 0;
  for (const { base } of syllables(pyNum)) {
    while (i < text.length && SEPARATORS.test(text[i])) i++;
    const start = i;
    for (const letter of base) {
      if (i >= text.length || stripTones(text[i]).toLowerCase() !== letter) return null;
      i++;
    }
    spans.push([start, i]);
  }
  return /[a-zü]/i.test(stripTones(text.slice(i))) ? null : spans;
}

// changeTone changes one syllable's tone and leaves everything else as it is, including
// the spaces, hyphens and apostrophes. changeTone('bú kèqi', [3, 5], 2) === 'bú kéqi'.
export function changeTone(py, [start, end], tone) {
  const text = py.normalize('NFC');
  return text.slice(0, start) + markTone(text.slice(start, end), tone) + text.slice(end);
}

// The word spacing of py is one joint per gap between two syllables, plus the text after
// the last syllable. A joint is '' inside a word, ' ' between words, '-' in the middle of an
// idiom and '…' between the halves of a pattern word. The 儿 ending is part of the syllable
// before it and has no joint of its own. An apostrophe is not a joint, because it only marks
// a syllable inside a word that starts with a, o or e.
// spacingOf('bú kèqi', 'bu4 ke4 qi5') gives { joints: [' ', ''], tail: '' }, and
// spacingOf('suīrán…dànshì…', 'sui1 ran2 dan4 shi4') gives { joints: ['', '…', ''], tail: '…' }.
// Returns null when py and pyNum do not line up.
export function spacingOf(py, pyNum) {
  const spans = syllableSpans(py, pyNum);
  if (!spans) return null;
  const text = py.normalize('NFC');
  const items = syllables(pyNum);
  const joints = [];
  for (let k = 1; k < spans.length; k++) {
    if (items[k].base === 'r' && items[k].tone === 5) continue;
    const gap = text.slice(spans[k - 1][1], spans[k][0]);
    joints.push(gap.includes('…') ? '…' : gap.includes('-') ? '-' : /\s/.test(gap) ? ' ' : '');
  }
  return { joints, tail: text.slice(spans.at(-1)[1]) };
}

// py rewritten in a given word spacing (from spacingOf), with its own syllables and tones.
// Inside a word a syllable starting with a, o or e gets an apostrophe, and the 儿 ending stays
// joined to its syllable. So a wrong choice can be shown with the spacing of the answer:
// inShape('duìbuqǐ', 'dui4 bu5 qi3', { joints: [' ', ''], tail: '' }) === 'duì buqǐ', and
// inShape("píng'ān", 'ping2 an1', { joints: [' '], tail: '' }) === 'píng ān'.
// Returns null when py and pyNum do not line up or the number of syllables differs.
export function inShape(py, pyNum, { joints, tail }) {
  const spans = syllableSpans(py, pyNum);
  if (!spans) return null;
  const text = py.normalize('NFC');
  const items = syllables(pyNum);
  let out = '';
  let n = 0;
  for (let k = 0; k < spans.length; k++) {
    const syllable = text.slice(spans[k][0], spans[k][1]);
    if (k === 0 || (items[k].base === 'r' && items[k].tone === 5)) {
      out += syllable;
      continue;
    }
    if (n >= joints.length) return null;
    const joint = joints[n++];
    out += (joint === '' && /^[aeo]/i.test(stripTones(syllable)) ? "'" : joint) + syllable;
  }
  return n === joints.length ? out + tail : null;
}
