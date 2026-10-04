import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUNDS, effectsOf, next, pauseMs, startWord } from '../../docs/js/speakflow.js';

const TONES_OK = { pass: true, share: 1, problem: null };
const TONES_BAD = { pass: false, share: 0, problem: 'Tone: heard a falling tone, it should go low.' };
const HEARD_OK = { ok: true, heard: '我', how: 'same' };
const HEARD_BAD = { ok: false, heard: '是', how: null };

// Sends inputs one by one and lists the phases passed through, as 'repeat 2' for round 2.
function run(state, inputs) {
  const seen = [];
  let s = state;
  for (const input of inputs) {
    s = next(s, input);
    seen.push(s.phase === 'repeat' ? `repeat ${s.round}` : s.phase);
  }
  return { s, seen };
}
const DONE = { type: 'done' };

test('the pause after a word is 1.5 times its sound plus 1 second', () => {
  assert.equal(pauseMs(0.8), 2200);
  assert.equal(pauseMs(0), 1000);
});

test('a new word is listened to, repeated three times, then tried, and the try passes', () => {
  const start = startWord({ id: 'w0003', mode: 'tones' });
  assert.equal(start.phase, 'listen');
  assert.deepEqual(effectsOf(start), [{ type: 'play', what: 'word' }, { type: 'play', what: 'sentence' }]);
  const { s, seen } = run(start, [DONE, DONE, DONE, DONE, { type: 'tap' }, { type: 'heard', tones: TONES_OK }]);
  assert.equal(ROUNDS, 3);
  assert.deepEqual(seen, ['repeat 1', 'repeat 2', 'repeat 3', 'turn', 'record', 'done']);
  assert.deepEqual(effectsOf(next(start, DONE)), [{ type: 'play', what: 'word' }, { type: 'pause' }]);
  assert.deepEqual(effectsOf(s), [{ type: 'finish', result: 'pass', tries: 1, check: { tones: 1, heard: null } }]);
});

test('a miss shows what was wrong, plays the word again and asks again, with no limit on tries', () => {
  let s = run(startWord({ id: 'w0003', mode: 'one' }), [DONE, DONE, DONE, DONE, { type: 'tap' }]).s;
  assert.deepEqual(effectsOf(s), [{ type: 'record', sounds: true }]);
  for (let i = 1; i <= 5; i += 1) {
    s = next(s, { type: 'heard', tones: TONES_OK, sounds: HEARD_BAD });
    assert.deepEqual([s.phase, s.tries, s.problems], ['missed', i, ['Heard: 是']]);
    assert.deepEqual(effectsOf(s), [{ type: 'play', what: 'word' }]);
    s = next(next(s, DONE), { type: 'tap' });
  }
  s = next(s, { type: 'heard', tones: TONES_OK, sounds: HEARD_OK });
  assert.deepEqual([s.phase, s.result, s.tries, s.check], ['done', 'pass', 6, { tones: 1, heard: '我' }]);
});

test('Skip ends the word in any phase', () => {
  for (const phase of ['listen', 'repeat', 'turn', 'record', 'missed']) {
    let s = startWord({ id: 'w0003', mode: 'tones' });
    const path = [DONE, DONE, DONE, DONE, { type: 'tap' }, { type: 'heard', tones: TONES_BAD }];
    for (const input of path) {
      if (s.phase === phase) break;
      s = next(s, input);
    }
    assert.equal(s.phase, phase);
    const skipped = next(s, { type: 'skip' });
    assert.deepEqual([skipped.phase, skipped.result], ['done', 'skip']);
  }
});

test('a word spoken well before starts at your turn, and its first miss runs listen and repeat', () => {
  const start = startWord({ id: 'w0003', spokenWell: true, mode: 'tones' });
  assert.deepEqual([start.phase, effectsOf(start)], ['turn', []]);
  const { s, seen } = run(start, [
    { type: 'tap' }, { type: 'heard', tones: TONES_BAD }, DONE, DONE, DONE, DONE, DONE,
    { type: 'tap' }, { type: 'heard', tones: TONES_BAD }, DONE,
  ]);
  // After the first miss the word is taught again. After the second it is only played again.
  assert.deepEqual(seen, ['record', 'missed', 'listen', 'repeat 1', 'repeat 2', 'repeat 3', 'turn', 'record', 'missed', 'turn']);
  assert.equal(s.tries, 2);
});

test('when the phone cannot share the microphone, the word is said twice, sounds first', () => {
  const { s, seen } = run(startWord({ id: 'w0003', mode: 'twice' }), [
    DONE, DONE, DONE, DONE, { type: 'tap' }, { type: 'heard', sounds: HEARD_OK }, { type: 'heard', tones: TONES_OK },
  ]);
  assert.deepEqual(seen.slice(-3), ['sounds', 'record', 'done']);
  assert.deepEqual(effectsOf(run(startWord({ id: 'w0003', mode: 'twice' }), [DONE, DONE, DONE, DONE, { type: 'tap' }]).s), [{ type: 'listen' }]);
  assert.deepEqual([s.result, s.check], ['pass', { tones: 1, heard: '我' }]);
  // A wrong sound fails the try even with the right tones.
  const bad = run(startWord({ id: 'w0003', mode: 'twice' }), [
    DONE, DONE, DONE, DONE, { type: 'tap' }, { type: 'heard', sounds: HEARD_BAD }, { type: 'heard', tones: TONES_OK },
  ]).s;
  assert.deepEqual([bad.phase, bad.problems], ['missed', ['Heard: 是']]);
});

test('when the recognizer fails, the tone check decides alone', () => {
  // When the word is said twice and the recognizer fails the first time, the recording follows at once.
  let s = run(startWord({ id: 'w0003', mode: 'twice' }), [DONE, DONE, DONE, DONE, { type: 'tap' }]).s;
  s = next(s, { type: 'mode', mode: 'tones' });
  assert.deepEqual([s.phase, s.mode], ['record', 'tones']);
  s = next(s, { type: 'heard', tones: TONES_OK });
  assert.deepEqual([s.result, s.check], ['pass', { tones: 1, heard: null }]);
});

test('without a microphone the word is listened to and repeated, and ends as listened', () => {
  const { s, seen } = run(startWord({ id: 'w0003', mode: 'none' }), [DONE, DONE, DONE, DONE]);
  assert.deepEqual(seen, ['repeat 1', 'repeat 2', 'repeat 3', 'done']);
  assert.deepEqual(effectsOf(s), [{ type: 'finish', result: 'listened', tries: 0, check: { tones: null, heard: null } }]);
  // A word spoken well before is taught too when there is no microphone.
  assert.equal(startWord({ id: 'w0003', spokenWell: true, mode: 'none' }).phase, 'listen');
  // When the microphone is refused at the first tap, a new word has been repeated already and ends.
  const turn = run(startWord({ id: 'w0003', mode: 'one' }), [DONE, DONE, DONE, DONE]).s;
  assert.deepEqual([next(turn, { type: 'mode', mode: 'none' }).phase, next(turn, { type: 'mode', mode: 'none' }).result], ['done', 'listened']);
  // A word that started at your turn is first taught.
  const review = next(startWord({ id: 'w0003', spokenWell: true, mode: 'one' }), { type: 'mode', mode: 'none' });
  assert.equal(review.phase, 'listen');
});
