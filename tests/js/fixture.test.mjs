// Checks that the hand-written fixture follows the word-data contract
// (.claude/plans/words-json-schema.md), so the app logic is tested on the real shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const TONES = /[̄́̌̀]/g;
// pyBase is the pinyin without tone marks, spaces, apostrophes or hyphens, in lower case.
const toneless = (py) => py.normalize('NFD').replace(TONES, '').normalize('NFC').toLowerCase().replace(/[\s'’-]/g, '');
const POS = new Set(['n.', 'v.', 'adj.', 'adv.', 'm.', 'pron.', 'prep.', 'conj.', 'part.', 'num.', 'int.']);

test('top-level fields and themes', () => {
  assert.equal(data.version, 'v001');
  assert.match(data.generated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof data.license, 'string');
  data.themes.forEach((t, i) => {
    assert.equal(t.id, `t${String(i + 1).padStart(2, '0')}`);
    assert.equal(t.order, i + 1);
    assert.equal(t.count, data.words.filter((w) => w.theme === t.id).length);
  });
  assert.equal(data.words.length, 61);
});

test('every word has every field with the right shape', () => {
  const ids = new Set(data.words.map((w) => w.id));
  assert.equal(ids.size, data.words.length);
  for (const w of data.words) {
    assert.match(w.id, /^w\d{4}$/);
    assert.equal(w.pyBase, toneless(w.py), w.hz);
    // One pyNum item per character, where the 儿 ending is the item "r5". syl leaves r5 out.
    const items = w.pyNum.split(' ');
    assert.equal(items.length, [...w.hz].length, w.hz);
    assert.equal(w.syl, items.filter((s) => s !== 'r5').length, w.hz);
    assert.ok(w.lv >= 1 && w.lv <= 6);
    assert.ok(w.pos.every((p) => POS.has(p)), w.hz);
    assert.ok(w.en.length > 0 && w.en.length <= 80);
    assert.ok(w.enShort.length > 0 && w.enShort.length <= 30);
    assert.ok(data.themes.some((t) => t.id === w.theme));
    assert.match(w.au, new RegExp(`^w/${w.id}_[0-9a-f]{8}\\.mp3$`));
    assert.ok(w.noDistract.every((id) => ids.has(id)));
    assert.ok(w.ex.hz.includes(w.hz), `${w.hz} is in its sentence`);
    assert.match(w.ex.au, new RegExp(`^s/${w.id}_[0-9a-f]{8}\\.mp3$`));
    assert.ok(['pdf', 'claude'].includes(w.ex.src));
  }
});

test('ord runs 1 to N, in theme order, and the level never goes down within a theme', () => {
  const sorted = data.words.slice().sort((a, b) => a.ord - b.ord);
  sorted.forEach((w, i) => assert.equal(w.ord, i + 1));
  const themeOrder = new Map(data.themes.map((t) => [t.id, t.order]));
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    assert.ok(themeOrder.get(a.theme) <= themeOrder.get(b.theme));
    if (a.theme === b.theme) assert.ok(a.lv <= b.lv, `${a.hz} then ${b.hz}`);
  }
});

test('the fixture holds the cases the quiz-choice tests need', () => {
  const hz = (h) => data.words.find((w) => w.hz === h);
  assert.equal(hz('他').py, hz('她').py); // exact homophones
  assert.equal(hz('买').pyBase, hz('卖').pyBase); // tone twins
  assert.deepEqual(hz('高兴').noDistract, [hz('快乐').id]); // same meaning
  assert.equal(data.words.filter((w) => w.syl === 3).length, 4); // enough three-syllable words
  assert.equal(hz('不客气').py, 'bú kèqi'); // textbook word spacing with a space
  assert.equal(hz('女儿').py, "nǚ'ér"); // an apostrophe before a syllable starting with a, o or e
  const erhua = hz('一点儿'); // the 儿 ending joins the syllable before it
  assert.deepEqual([erhua.py, erhua.pyNum, erhua.pyBase, erhua.syl], ['yìdiǎnr', 'yi1 dian3 r5', 'yidianr', 2]);
});

test('the example pinyin follows the pinyin style sheet', () => {
  const hz = (h) => data.words.find((w) => w.hz === h);
  assert.equal(hz('好').ex.py, 'Zhège píngguǒ hěn hǎochī.'); // point 1: 这个 is one word, zhège
  assert.equal(hz('九').ex.py, 'Jiǔyuè wǒ qù Zhōngguó.'); // point 2: a month name is one word
  assert.equal(hz('六').ex.py, 'Wǒ mǎile liù gè píngguǒ.'); // points 3 and 6: 了 joins its verb, a numeral stands apart
  assert.equal(hz('老师').ex.py, 'Wáng lǎoshī hěn hǎo.'); // point 7: a surname with a capital, a title in lower case
  assert.equal(hz('没关系').ex.py, 'Méi guānxi, wǒ bú lèi.'); // points 8 and 9: 不 changes tone, a Western comma
  assert.equal(hz('吃').ex.py, 'Nǐ chīfàn le ma?'); // reference rule 2: 吃饭 is one entry of the public list, so one word
  // 个 after a number keeps its dictionary tone ("yí gè"), and the headword 个 is written "gè" as on its card.
  for (const w of data.words) assert.ok(!/ ge[ .,!?]/.test(w.ex.py), `${w.hz}: ${w.ex.py}`);
  assert.equal(hz('个').ex.py, 'Wǒ yǒu sān gè péngyou.');
});
