import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Speaking, saveSpoken } from '../../docs/js/speaking.js';
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
const DAY = '2026-10-05';
const DONE = { type: 'done' };
const TONES_OK = { pass: true, share: 1, problem: null };
const TONES_BAD = { pass: false, share: 0, problem: 'Tone: heard a falling tone, it should go low.' };

async function learnDay(store, day) {
  const at = localDate(day, 9);
  const study = await Study.start({ store, data, now: at });
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(study.card.quiz === 'recall' ? 'know' : 'right', at);
  }
  return study.finish(at);
}

// Takes the current word through listen, three repeats and one try with the given tone result.
async function sayOnce(speaking, tones, at) {
  for (let i = 0; i < 4; i += 1) await speaking.send(DONE, at);
  await speaking.send({ type: 'tap' }, at);
  return speaking.send({ type: 'heard', tones }, at);
}

test('each finished word is saved as one speak event, and the next word starts', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const speaking = await Speaking.start({ store, data, now: at, mode: 'tones' });
  assert.deepEqual([speaking.position, speaking.word.hz, speaking.state.phase], [{ done: 0, total: 12 }, '我', 'listen']);
  const wo = speaking.state.id;
  assert.deepEqual(await sayOnce(speaking, TONES_OK, at), { id: wo, result: 'pass', tries: 1, check: { tones: 1, heard: null } });
  const saved = (await store.allEvents()).at(-1);
  assert.deepEqual({ ...saved, seq: 0 }, {
    seq: 0, day: DAY, kind: 'speak', id: wo, result: 'pass', tries: 1, check: { tones: 1, heard: null }, ts: at.toISOString(),
  });
  assert.deepEqual([speaking.position, speaking.word.hz, speaking.state.phase], [{ done: 1, total: 12 }, '你', 'listen']);
});

test('a miss keeps the word, a skip saves it as skipped, and the day checks in when the list is done', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const speaking = await Speaking.start({ store, data, now: at, mode: 'tones' });
  assert.equal(await sayOnce(speaking, TONES_BAD, at), null);
  assert.deepEqual([speaking.state.phase, speaking.state.tries, speaking.state.problems], ['missed', 1, [TONES_BAD.problem]]);
  const wo = speaking.state.id; // 我
  assert.deepEqual(await speaking.send({ type: 'skip' }, at), { id: wo, result: 'skip', tries: 1, check: { tones: 0, heard: null } });
  while (!speaking.finished) await sayOnce(speaking, TONES_OK, at);
  const r = await speaking.close(at);
  assert.deepEqual([r.checkedIn, r.spoken], [true, { pass: 11, skip: 1, listened: 0 }]);
  assert.equal(speaking.word, null);
});

test('the next day the skipped word comes back, and a word spoken well starts at your turn', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const day1 = await Speaking.start({ store, data, now: at, mode: 'tones' });
  const wo = day1.state.id;
  await day1.send({ type: 'skip' }, at); // 我 is skipped
  while (!day1.finished) await sayOnce(day1, TONES_OK, at);
  await day1.close(at);
  await learnDay(store, '2026-10-06');
  const day2 = await Speaking.start({ store, data, now: localDate('2026-10-06', 10), mode: 'tones' });
  // The list has 24 words, yesterday's 12 as reviews in the order they were reviewed, and 12 new words.
  assert.equal(day2.position.total, 24);
  // The first review was spoken well yesterday, so it starts at your turn.
  assert.deepEqual([day2.word.hz, day2.state.phase], ['不', 'turn']);
  // 我 was skipped, so it is on the list and is taught again from the start.
  assert.deepEqual([day2.queue.includes(wo), day2.spokenWell.has(wo), day2.spokenWell.size], [true, false, 11]);
});

test('without a microphone the words are listened to, repeated and saved as listened', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const speaking = await Speaking.start({ store, data, now: at, mode: 'one' });
  for (let i = 0; i < 4; i += 1) await speaking.send(DONE, at); // the first word reaches your turn
  // The microphone is refused at the first tap.
  const first = speaking.state.id;
  assert.deepEqual(await speaking.setMode('none', at), { id: first, result: 'listened', tries: 0, check: { tones: null, heard: null } });
  while (!speaking.finished) {
    assert.equal(speaking.state.mode, 'none');
    await speaking.send(DONE, at);
  }
  const r = await speaking.close(at);
  assert.deepEqual([r.checkedIn, r.spoken], [true, { pass: 0, skip: 0, listened: 12 }]);
});

test('an unknown result is refused', async () => {
  await assert.rejects(saveSpoken({ store: new MemoryStore(), day: DAY, id: 'w0001', result: 'great' }), /Unknown speaking result great/);
});

test('an input that arrives while a word is being saved is dropped, and a failed save can be done again', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const speaking = await Speaking.start({ store, data, now: at, mode: 'tones' });
  const commit = store.commit.bind(store);
  store.commit = async (c) => { await new Promise((resolve) => { setTimeout(resolve, 20); }); return commit(c); };
  // Two taps on Skip at once: the first saves the word, the second must not skip the next word.
  const [first, second] = await Promise.all([speaking.send({ type: 'skip' }, at), speaking.send({ type: 'skip' }, at)]);
  assert.equal(first.result, 'skip');
  assert.equal(second, null);
  assert.equal((await store.allEvents()).filter((e) => e.kind === 'speak').length, 1);
  assert.deepEqual([speaking.position, speaking.word.hz], [{ done: 1, total: 12 }, '你']);
  // A save that fails leaves the word as it was, so the learner can finish it again.
  store.commit = async () => { throw new Error('disk full'); };
  await assert.rejects(speaking.send({ type: 'skip' }, at), /disk full/);
  assert.deepEqual([speaking.word.hz, speaking.state.phase], ['你', 'listen']);
  store.commit = commit;
  assert.equal((await speaking.send({ type: 'skip' }, at)).result, 'skip');
});
