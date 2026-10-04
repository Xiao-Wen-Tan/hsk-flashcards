import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanHeard, matchWord, numberText, readingsOf, recognizerOutcome, syllablesOf, verdict,
} from '../../docs/js/speakcheck.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
// The fixture's words plus two that are not in it: 塔 tǎ (a tower) and 细 xì (thin).
const readings = readingsOf([...data.words, { hz: '塔', py: 'tǎ', pyNum: 'ta3' }, { hz: '细', py: 'xì', pyNum: 'xi4' }]);

test('each character gets the syllables it is read as, from the card pinyin and the dictionary tones', () => {
  assert.deepEqual([...readings.get('他')], ['tā']);
  assert.deepEqual([...readings.get('她')], ['tā']);
  // 一点儿 is yìdiǎnr on its card and yi1 dian3 r5 in the dictionary.
  assert.ok(readings.get('一').has('yì') && readings.get('一').has('yī'));
  assert.deepEqual(syllablesOf(word(data, '一点儿')), [{ ch: '一', py: 'yì' }, { ch: '点', py: 'diǎn' }, { ch: '儿', py: 'r' }]);
});

test('punctuation, spaces and full-width forms are cleaned away, and digits become characters', () => {
  assert.equal(cleanHeard('她。'), '她');
  assert.equal(cleanHeard(' 不客气！ '), '不客气');
  assert.equal(cleanHeard('ＯＫ，好的'), '好的');
  assert.equal(cleanHeard('我有 2 个'), '我有二个');
  assert.deepEqual([0, 1, 10, 12, 20, 101, 110, 1000, 1010, 20000, 10086].map(numberText),
    ['零', '一', '十', '十二', '二十', '一百零一', '一百一十', '一千', '一千零一十', '二万', '一万零八十六']);
});

test('the word passes as its own characters or a homophone with the same tones', () => {
  const ta = word(data, '他');
  assert.deepEqual(matchWord(ta, ['他'], readings), { ok: true, heard: '他', how: 'same' });
  assert.deepEqual(matchWord(ta, ['她。'], readings), { ok: true, heard: '她', how: 'sounds alike' });
  assert.deepEqual(matchWord(ta, ['塔'], readings), { ok: false, heard: '塔', how: null });
  // Any of the recognizer's guesses may match, and the first is reported when none does.
  assert.equal(matchWord(ta, ['塔', '它'], readings).heard, '它');
  assert.deepEqual(matchWord(ta, ['是'], readings), { ok: false, heard: '是', how: null });
  assert.deepEqual(matchWord(ta, [], readings), { ok: false, heard: '', how: null });
});

test('longer words, the 儿 ending, neutral tones and numbers', () => {
  assert.equal(matchWord(word(data, '不客气'), ['不客气。'], readings).ok, true);
  assert.equal(matchWord(word(data, '一点儿'), ['一点'], readings).ok, true); // without its 儿
  assert.equal(matchWord(word(data, '一点儿'), ['一点儿'], readings).ok, true);
  assert.equal(matchWord(word(data, '一点儿'), ['一'], readings).ok, false);
  // 系 in 没关系 méi guānxi has the neutral tone, so 细 xì sounds alike there.
  assert.deepEqual(matchWord(word(data, '没关系'), ['没关细'], readings), { ok: true, heard: '没关细', how: 'sounds alike' });
  // A recognizer that writes 2 for 两.
  assert.equal(matchWord(word(data, '两'), ['2'], readings).ok, true);
});

test('a try passes when every check that ran passed', () => {
  const tonesOk = { pass: true, share: 1, problem: null };
  const tonesBad = { pass: false, share: 0.5, problem: '2nd syllable: heard a falling tone, it should rise.' };
  assert.deepEqual(verdict({ tones: tonesOk, sounds: { ok: false, heard: '是' } }),
    { pass: false, problems: ['Heard: 是'], check: { tones: 1, heard: '是' } });
  assert.deepEqual(verdict({ tones: tonesBad, sounds: { ok: true, heard: '他' } }),
    { pass: false, problems: ['2nd syllable: heard a falling tone, it should rise.'], check: { tones: 0.5, heard: '他' } });
  // Offline, or when the recognizer failed, the tone check decides alone.
  assert.deepEqual(verdict({ tones: tonesOk }), { pass: true, problems: [], check: { tones: 1, heard: null } });
  assert.equal(verdict({ sounds: { ok: false, heard: '' } }).problems[0], 'The sound check heard nothing.');
  assert.equal(verdict({}).pass, false);
});

test('what the recognizer\'s answer means for a try', () => {
  assert.equal(recognizerOutcome(null, true), 'none');
  assert.equal(recognizerOutcome({ texts: [], error: 'network' }, true), 'failed');
  assert.equal(recognizerOutcome({ texts: [], error: 'not-allowed' }, false), 'failed');
  // No guess although the recording heard a voice means the recognizer missed it.
  assert.equal(recognizerOutcome({ texts: [], error: null }, true), 'empty');
  assert.equal(recognizerOutcome({ texts: [], error: 'no-speech' }, true), 'empty');
  // No guess and no voice means nothing was said, which the sound check reports.
  assert.equal(recognizerOutcome({ texts: [], error: 'no-speech' }, false), 'heard');
  assert.equal(recognizerOutcome({ texts: ['是'], error: null }, true), 'heard');
});

test('a written 二 is not taken for 两, but a digit 2 may be', () => {
  // 二 for 两 is a classic beginner mistake, so the character 二 must fail for 两.
  const liang = word(data, '两');
  assert.deepEqual(matchWord(liang, ['二'], readings), { ok: false, heard: '二', how: null });
  assert.equal(matchWord(liang, ['2'], readings).ok, true);
});

test('100, 1000 and 1万 written in digits pass for 百, 千 and 万', () => {
  const bai = { hz: '百', py: 'bǎi', pyNum: 'bai3' };
  const qian = { hz: '千', py: 'qiān', pyNum: 'qian1' };
  const wan = { hz: '万', py: 'wàn', pyNum: 'wan4' };
  assert.equal(matchWord(bai, ['100'], readings).ok, true);
  assert.equal(matchWord(qian, ['1000'], readings).ok, true);
  assert.equal(matchWord(wan, ['1万'], readings).ok, true);
  assert.equal(matchWord(wan, ['10000'], readings).ok, true);
  assert.equal(matchWord(bai, ['200'], readings).ok, false);
});

test('an answer in Latin letters only is reported as heard, not as nothing', () => {
  assert.deepEqual(matchWord(word(data, '他'), ['OK'], readings), { ok: false, heard: 'OK', how: null });
});
