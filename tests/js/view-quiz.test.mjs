import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePool } from '../../docs/js/distractors.js';
import { feedbackFor, gradeFor, progressLabel, questionView } from '../../docs/js/view/quiz.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const pool = makePool(data.words);
const DAY = '2026-10-06';
const apple = word(data, '苹果');

test('a listening review hides the characters, plays the sound and offers 4 English meanings', () => {
  const v = questionView({ card: { type: 'review', id: apple.id, quiz: 'listen' }, word: apple, pool, day: DAY, step: 1 });
  assert.equal(v.kind, 'listen');
  assert.equal(v.heading, 'Review');
  assert.equal(v.hz, null); // a learner who reads 苹果 could answer without listening
  assert.equal(v.sound, 'audio/w/w0026_6ce06b7e.mp3');
  assert.equal(v.choices.length, 4);
  assert.equal(v.choices[v.answerIndex], 'apple');
  assert.equal(new Set(v.choices).size, 4);
});

test('a pinyin question shows the meaning and offers 4 pinyin, with no sound', () => {
  const v = questionView({ card: { type: 'final', id: apple.id, quiz: 'pinyin', retry: 0 }, word: apple, pool, day: DAY, step: 0 });
  assert.equal(v.kind, 'pinyin');
  assert.equal(v.heading, 'Final check');
  assert.equal(v.hz, '苹果'); // characters are shown here but never tested
  assert.equal(v.en, 'apple');
  assert.equal(v.sound, null); // the sound would give the answer away
  assert.equal(v.choices.length, 4);
  assert.equal(v.choices[v.answerIndex], 'píngguǒ');
});

test('the same card on the same day shows the same choices in the same order', () => {
  const card = { type: 'review', id: apple.id, quiz: 'pinyin' };
  const a = questionView({ card, word: apple, pool, day: DAY, step: 2 });
  const b = questionView({ card, word: apple, pool, day: DAY, step: 2 });
  assert.deepEqual(a, b);
});

test('a recall card shows characters, pinyin and sound, and the three ratings', () => {
  const v = questionView({ card: { type: 'reask', id: apple.id, quiz: 'recall', retry: 1 }, word: apple, pool, day: DAY, step: 1 });
  assert.equal(v.kind, 'recall');
  assert.equal(v.heading, 'Once more');
  assert.deepEqual([v.hz, v.py, v.sound], ['苹果', 'píngguǒ', 'audio/w/w0026_6ce06b7e.mp3']);
  assert.deepEqual(v.grades.map((g) => g.grade), ['know', 'unsure', 'dontknow']);
  assert.deepEqual(v.grades.map((g) => g.label), ['Know it', 'Unsure', "Don't know"]);
});

test('a learning card has no question', () => {
  assert.deepEqual(questionView({ card: { type: 'learn', id: apple.id, group: 0 }, word: apple, pool, day: DAY, step: 0 }),
    { kind: 'learn', heading: 'New word' });
});

test('a tap is graded right or wrong, and the banner names the answer', () => {
  const v = questionView({ card: { type: 'check', id: apple.id, quiz: 'listen', group: 0, retry: 0 }, word: apple, pool, day: DAY, step: 0 });
  const wrongIndex = (v.answerIndex + 1) % 4;
  assert.equal(gradeFor(v, v.answerIndex), 'right');
  assert.equal(gradeFor(v, wrongIndex), 'wrong');
  assert.deepEqual(feedbackFor(v, v.answerIndex), { right: true, picked: v.answerIndex, answerIndex: v.answerIndex, message: 'Right!' });
  assert.equal(feedbackFor(v, wrongIndex).message, 'Not quite. The answer is "apple".');
});

test('the session header counts cards, and never past the last one', () => {
  assert.equal(progressLabel({ cards: [1, 2, 3], pos: 0 }), '1 / 3');
  assert.equal(progressLabel({ cards: [1, 2, 3], pos: 3 }), '3 / 3');
});
