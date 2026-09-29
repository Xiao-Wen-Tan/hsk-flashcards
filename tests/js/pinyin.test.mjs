import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeTone, inShape, markTone, normPy, pyShape, spacingOf, stripTones, syllableCount, syllableSpans, syllables,
  toneOf,
} from '../../docs/js/pinyin.js';
import { loadFixture } from './helpers.mjs';

test('tones are read and removed, and ü is kept', () => {
  assert.equal(stripTones('lǜsè'), 'lüse');
  assert.equal(toneOf('lǜ'), 4);
  assert.equal(toneOf('hǎo'), 3);
  assert.equal(toneOf('ma'), 5);
});

test('tone marks go on the right vowel', () => {
  assert.equal(markTone('hao', 3), 'hǎo');
  assert.equal(markTone('lüe', 4), 'lüè');
  assert.equal(markTone('gui', 4), 'guì');
  assert.equal(markTone('liu', 2), 'liú');
  assert.equal(markTone('zhou', 1), 'zhōu');
  assert.equal(markTone('Bei', 3), 'Běi');
  assert.equal(markTone('nü', 3), 'nǚ');
  assert.equal(markTone('shí', 4), 'shì');
  assert.equal(markTone('ma', 5), 'ma');
});

test('normPy ignores case, spaces, apostrophes and hyphens but keeps tones', () => {
  assert.equal(normPy("Nǚ'ér "), 'nǚér');
  assert.equal(normPy('nǚ’ér'), 'nǚér');
  assert.equal(normPy('bú kèqi'), 'búkèqi');
  assert.equal(normPy('bámiáo-zhùzhǎng'), 'bámiáozhùzhǎng');
  assert.notEqual(normPy('mǎi'), normPy('mài'));
});

test('pyShape drops tones but keeps the word spacing', () => {
  assert.equal(pyShape('bú kèqi'), 'bu keqi');
  assert.equal(pyShape('bámiáo-zhùzhǎng'), 'bamiao-zhuzhang');
  assert.equal(pyShape('Xī’ān'), "xi'an");
  assert.equal(pyShape('yìdiǎnr'), pyShape('yídiǎnr'));
  assert.notEqual(pyShape('bámiáo-zhùzhǎng'), pyShape('bámiáo zhùzhǎng'));
});

test('numbered pinyin splits into syllables', () => {
  assert.deepEqual(syllables('nü3 er2'), [{ base: 'nü', tone: 3 }, { base: 'er', tone: 2 }]);
  assert.deepEqual(syllables('lu:4 se4'), [{ base: 'lü', tone: 4 }, { base: 'se', tone: 4 }]);
  assert.deepEqual(syllables('xie4 xie5'), [{ base: 'xie', tone: 4 }, { base: 'xie', tone: 5 }]);
  assert.deepEqual(syllables('ma'), [{ base: 'ma', tone: 5 }]);
  assert.deepEqual(syllables('yi1 dian3 r5'), [{ base: 'yi', tone: 1 }, { base: 'dian', tone: 3 }, { base: 'r', tone: 5 }]);
});

test('the 儿 ending is not counted as a syllable', () => {
  assert.equal(syllableCount('yi1 dian3 r5'), 2);
  assert.equal(syllableCount('nü3 er2'), 2);
  assert.equal(syllableCount('ba2 miao2 zhu4 zhang3'), 4);
  assert.equal(syllableCount('bu4 ke4 qi5'), 3);
});

test('syllables are found inside tone-marked pinyin', () => {
  assert.deepEqual(syllableSpans("nǚ'ér", 'nü3 er2'), [[0, 2], [3, 5]]);
  assert.deepEqual(syllableSpans('bú kèqi', 'bu4 ke4 qi5'), [[0, 2], [3, 5], [5, 7]]);
  assert.deepEqual(syllableSpans('Běijīng', 'bei3 jing1'), [[0, 3], [3, 7]]);
  assert.deepEqual(syllableSpans('méi guānxi', 'mei2 guan1 xi5'), [[0, 3], [4, 8], [8, 10]]);
  assert.deepEqual(syllableSpans('bámiáo-zhùzhǎng', 'ba2 miao2 zhu4 zhang3'), [[0, 2], [2, 6], [7, 10], [10, 15]]);
  assert.deepEqual(syllableSpans("yílù-píng'ān", 'yi1 lu4 ping2 an1'), [[0, 2], [2, 4], [5, 9], [10, 12]]);
  assert.deepEqual(syllableSpans('xī’ān', 'xi1 an1'), [[0, 2], [3, 5]]);
  assert.deepEqual(syllableSpans('yìdiǎnr', 'yi1 dian3 r5'), [[0, 2], [2, 6], [6, 7]]);
  assert.equal(syllableSpans('yìdiǎnr', 'yi1 dian3'), null);
  assert.equal(syllableSpans('píngguǒ', 'ping2'), null);
  assert.equal(syllableSpans('píngguǒ', 'pang2 guo3'), null);
});

test('one syllable\'s tone can be changed', () => {
  assert.equal(changeTone('bú kèqi', [3, 5], 2), 'bú kéqi');
  assert.equal(changeTone('lǎoshī', [3, 6], 4), 'lǎoshì');
});

test('changing a tone keeps the spaces, hyphens, apostrophes and 儿 ending', () => {
  assert.equal(changeTone('méi guānxi', [0, 3], 4), 'mèi guānxi');
  assert.equal(changeTone('bámiáo-zhùzhǎng', [7, 10], 2), 'bámiáo-zhúzhǎng');
  assert.equal(changeTone("yílù-píng'ān", [10, 12], 2), "yílù-píng'án");
  assert.equal(changeTone('yìdiǎnr', [2, 6], 1), 'yìdiānr');
});

test('the word spacing of a pinyin text is its joints and what follows the last syllable', () => {
  assert.deepEqual(spacingOf('bú kèqi', 'bu4 ke4 qi5'), { joints: [' ', ''], tail: '' });
  assert.deepEqual(spacingOf('bámiáo-zhùzhǎng', 'ba2 miao2 zhu4 zhang3'), { joints: ['', '-', ''], tail: '' });
  assert.deepEqual(spacingOf("nǚ'ér", 'nü3 er2'), { joints: [''], tail: '' });
  assert.deepEqual(spacingOf('yìdiǎnr', 'yi1 dian3 r5'), { joints: [''], tail: '' });
  assert.deepEqual(spacingOf('suīrán…dànshì…', 'sui1 ran2 dan4 shi4'), { joints: ['', '…', ''], tail: '…' });
  assert.equal(spacingOf('píngguǒ', 'ping2'), null);
});

test('a pinyin text can be rewritten in another word spacing', () => {
  assert.equal(inShape('duìbuqǐ', 'dui4 bu5 qi3', { joints: [' ', ''], tail: '' }), 'duì buqǐ');
  assert.equal(inShape('bú kèqi', 'bu4 ke4 qi5', { joints: ['', ''], tail: '' }), 'búkèqi');
  assert.equal(inShape('tōnghuò péngzhàng', 'tong1 huo4 peng2 zhang4', { joints: ['', '-', ''], tail: '' }),
    'tōnghuò-péngzhàng');
  assert.equal(inShape("yílù-píng'ān", 'yi1 lu4 ping2 an1', { joints: ['', ' ', ''], tail: '' }), "yílù píng'ān");
  assert.equal(inShape("nǚ'ér", 'nü3 er2', { joints: [' '], tail: '' }), 'nǚ ér');
  assert.equal(inShape('yìdiǎnr', 'yi1 dian3 r5', { joints: [' '], tail: '' }), 'yì diǎnr');
  assert.equal(inShape('tōnghuò péngzhàng', 'tong1 huo4 peng2 zhang4', { joints: ['', '…', ''], tail: '…' }),
    'tōnghuò…péngzhàng…');
  assert.equal(inShape('píngguǒ', 'ping2 guo3', { joints: ['', ''], tail: '' }), null);
});

test('every fixture word\'s py lines up with its pyNum, and syl leaves out the 儿 ending', () => {
  for (const w of loadFixture().words) {
    assert.ok(syllableSpans(w.py, w.pyNum), `${w.hz} ${w.py} ${w.pyNum}`);
    assert.equal(syllableCount(w.pyNum), w.syl, w.hz);
  }
});
