import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_NOTE, checkText, speakButton, speakView, spokenLine } from '../../docs/js/view/speak.js';
import { next, startWord } from '../../docs/js/speakflow.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const wo = word(data, '我');
const DONE = { type: 'done' };

test('the screen of a word shows its characters, pinyin, meaning and example, and what to do now', () => {
  let s = startWord({ id: wo.id, mode: 'tones' });
  const listen = speakView({ word: wo, state: s, position: { done: 2, total: 18 } });
  assert.deepEqual([listen.progress, listen.hz, listen.py, listen.heading, listen.counter, listen.mic],
    ['Word 3 of 18', '我', 'wǒ', 'Listen', null, false]);
  assert.equal(listen.wordAudio, `audio/${wo.au}`);
  assert.equal(listen.sentenceAudio, `audio/${wo.ex.au}`);
  assert.ok(listen.sentence.some((p) => p.hl && p.text === '我'));
  s = next(next(s, DONE), DONE);
  const repeat = speakView({ word: wo, state: s, position: { done: 2, total: 18 } });
  assert.deepEqual([repeat.heading, repeat.counter, repeat.prompt], ['Repeat after me', '2 of 3', 'Say it after the voice. Nothing is recorded.']);
  s = next(next(s, DONE), DONE);
  const turn = speakView({ word: wo, state: s, position: { done: 2, total: 18 } });
  assert.deepEqual([turn.heading, turn.mic, turn.prompt], ['Your turn', true, 'Tap the microphone and say the word.']);
});

test('after a miss the screen says what was wrong, and the next try says try again', () => {
  let s = startWord({ id: wo.id, spokenWell: true, mode: 'one' });
  s = next(next(s, { type: 'tap' }), { type: 'heard', tones: { pass: true, share: 1 }, sounds: { ok: false, heard: '是' } });
  const missed = speakView({ word: wo, state: s, position: { done: 0, total: 1 } });
  assert.deepEqual([missed.heading, missed.problems, missed.prompt, missed.mic], ['Not quite', ['Heard: 是'], 'Listen again.', false]);
  const twice = startWord({ id: wo.id, spokenWell: true, mode: 'twice' });
  assert.equal(speakView({ word: wo, state: next(twice, { type: 'tap' }), position: { done: 0, total: 1 } }).prompt, 'Say it now, for the sound check.');
  const second = next(next(twice, { type: 'tap' }), { type: 'heard', sounds: { ok: true, heard: '我' } });
  assert.equal(speakView({ word: wo, state: second, position: { done: 0, total: 1 } }).prompt, 'Now say it once more, for the tone check.');
});

test('"Play the word" and "Play my voice" work only while the routine waits for the learner', () => {
  const replay = (s) => speakView({ word: wo, state: s, position: { done: 0, total: 1 } }).replay;
  let s = startWord({ id: wo.id, mode: 'one' });
  assert.equal(replay(s), false, 'listen: the word and its sentence play');
  s = next(s, DONE);
  assert.equal(replay(s), false, 'repeat: the word plays, then a pause');
  s = next(next(next(s, DONE), DONE), DONE);
  assert.deepEqual([s.phase, replay(s)], ['turn', true], 'turn: the routine waits for the microphone button');
  s = next(s, { type: 'tap' });
  assert.deepEqual([s.phase, replay(s)], ['record', false], 'record: the microphone is open');
  s = next(s, { type: 'heard', tones: { pass: true, share: 1 }, sounds: { ok: false, heard: '是' } });
  assert.deepEqual([s.phase, replay(s)], ['missed', false], 'missed: the word plays again');
  s = next(s, DONE);
  assert.deepEqual([s.phase, s.tries, replay(s)], ['turn', 1, true], 'after a miss, before the next try');
  const sounds = next(startWord({ id: wo.id, spokenWell: true, mode: 'twice' }), { type: 'tap' });
  assert.deepEqual([sounds.phase, replay(sounds)], ['sounds', false], 'sounds: the recognizer listens');
});

test('Today\'s button counts the words left to speak', () => {
  assert.deepEqual(speakButton({ list: ['a', 'b'], done: [], left: ['a', 'b'] }), { label: 'Speaking practice', count: '2 words to speak', enabled: true });
  assert.deepEqual(speakButton({ list: ['a'], done: ['a'], left: [] }), { label: 'Speaking practice', count: 'The word is spoken.', enabled: false });
  assert.equal(speakButton({ list: [], done: [], left: [] }).count, 'No words to speak yet. Study first.');
  assert.equal(speakButton({ list: ['a', 'b'], done: ['a', 'b'], left: [] }).count, 'All 2 words spoken.');
});

test('Settings says which checks work on this phone, and the Google note', () => {
  assert.equal(checkText('one'), 'Speaking check on this phone: sounds and tones.');
  assert.equal(checkText('twice'), 'Speaking check on this phone: sounds and tones, saying each word twice.');
  assert.match(checkText('tones'), /^Speaking check on this phone: tones only\./);
  assert.match(checkText(null), /not tried yet/);
  assert.match(GOOGLE_NOTE, /sends your voice to Google/);
});

test('the check-in line about speaking', () => {
  assert.equal(spokenLine({ pass: 11, listened: 0, skip: 1 }), '11 said well and 1 skipped in speaking practice.');
  assert.equal(spokenLine({ pass: 3, listened: 2, skip: 1 }), '3 said well, 2 listened to and 1 skipped in speaking practice.');
  assert.equal(spokenLine({ pass: 0, listened: 12, skip: 0 }), '12 listened to in speaking practice.');
  assert.equal(spokenLine({ pass: 0, listened: 0, skip: 0 }), null);
});
