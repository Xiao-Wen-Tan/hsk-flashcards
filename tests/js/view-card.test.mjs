import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightParts, learningCard } from '../../docs/js/view/card.js';
import { monthTitle, percent, plural, posText, shortDate } from '../../docs/js/view/format.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();

test('the headword is highlighted wherever the sentence has it', () => {
  assert.deepEqual(highlightParts('我爱我的家。', '爱'), [
    { text: '我', hl: false }, { text: '爱', hl: true }, { text: '我的家。', hl: false },
  ]);
  assert.deepEqual(highlightParts('谢谢，谢谢！', '谢谢'), [
    { text: '谢谢', hl: true }, { text: '，', hl: false }, { text: '谢谢', hl: true }, { text: '！', hl: false },
  ]);
});

test('a pattern word is highlighted half by half', () => {
  assert.deepEqual(highlightParts('虽然下雨，但是他来了。', '虽然…但是…'), [
    { text: '虽然', hl: true }, { text: '下雨，', hl: false }, { text: '但是', hl: true }, { text: '他来了。', hl: false },
  ]);
});

test('the learning card of 苹果 has every part the design names', () => {
  const c = learningCard(word(data, '苹果'));
  assert.equal(c.hz, '苹果');
  assert.equal(c.py, 'píngguǒ');
  assert.equal(c.pos, 'noun');
  assert.equal(c.en, 'apple');
  assert.equal(c.wordAudio, 'audio/w/w0026_6ce06b7e.mp3');
  assert.deepEqual(c.chars, ['苹', '果']);
  assert.equal(c.sentence.map((p) => p.text).join(''), '我想吃苹果。');
  assert.deepEqual(c.sentence.filter((p) => p.hl).map((p) => p.text), ['苹果']);
  assert.equal(c.sentencePy, 'Wǒ xiǎng chī píngguǒ.');
  assert.equal(c.sentenceEn, 'I want to eat an apple.');
  assert.equal(c.sentenceAudio, 'audio/s/w0026_814ba0af.mp3');
});

test('a new word\'s card plays the word twice, the card after an answer plays it once', () => {
  assert.equal(learningCard(word(data, '苹果')).plays, 2);
  assert.equal(learningCard(word(data, '苹果'), { afterAnswer: true }).plays, 1);
});

test('every fixture word gets a card whose sentence highlights its headword', () => {
  for (const w of data.words) {
    const c = learningCard(w);
    assert.ok(c.sentence.some((p) => p.hl), w.hz);
    assert.equal(c.sentence.map((p) => p.text).join(''), w.ex.hz);
  }
});

test('text helpers', () => {
  assert.equal(posText(['v.', 'n.']), 'verb, noun');
  assert.equal(posText([]), '');
  assert.equal(percent(0.254), '25%');
  assert.equal(plural(1, 'review'), '1 review');
  assert.equal(plural(3, 'review'), '3 reviews');
  assert.equal(plural(2500, 'more word'), '2,500 more words'); // goal countdowns on Today and Stats
  assert.equal(shortDate('2026-10-05'), 'Mon 5 Oct');
  assert.equal(monthTitle('2026-10'), 'October 2026');
});
