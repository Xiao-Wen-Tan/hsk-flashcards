import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../../docs/js/audio.js';

// A stand-in for the browser's audio element. play() starts a sound, and the test ends it
// with finish(), as the real element does when the sound is over.
function fakeAudio({ refuse = null } = {}) {
  const el = {
    src: '', plays: [], paused: 0,
    play() {
      el.plays.push(el.src);
      if (refuse) return Promise.reject(Object.assign(new Error('refused'), { name: refuse }));
      return Promise.resolve();
    },
    pause() { el.paused += 1; },
    finish() { el.onended?.(); },
    fail() { el.onerror?.(); },
  };
  return el;
}

const tick = () => new Promise((resolve) => { setImmediate(resolve); });

test('a word plays twice with a pause between', async () => {
  const el = fakeAudio();
  const waits = [];
  const player = createPlayer({ makeAudio: () => el, wait: async (ms) => { waits.push(ms); } });
  const done = player.play('audio/w/w0026.mp3', 2);
  await tick();
  el.finish();
  await tick();
  el.finish();
  assert.equal(await done, 'done');
  assert.deepEqual(el.plays, ['audio/w/w0026.mp3', 'audio/w/w0026.mp3']);
  assert.deepEqual(waits, [700]);
});

test('stop (a tap on Next) ends the sound at once', async () => {
  const el = fakeAudio();
  const player = createPlayer({ makeAudio: () => el, wait: async () => {} });
  const done = player.play('a.mp3', 2);
  await tick();
  player.stop();
  assert.equal(await done, 'stopped');
  assert.equal(el.plays.length, 1);
  assert.ok(el.paused >= 1);
});

test('a new sound stops the one before', async () => {
  const el = fakeAudio();
  const player = createPlayer({ makeAudio: () => el, wait: async () => {} });
  const first = player.play('a.mp3', 2);
  await tick();
  const second = player.play('b.mp3', 1);
  assert.equal(await first, 'stopped');
  await tick();
  el.finish();
  assert.equal(await second, 'done');
  assert.deepEqual(el.plays, ['a.mp3', 'b.mp3']);
});

test('a refusal to play reaches the caller, so the screen can ask for a tap', async () => {
  const player = createPlayer({ makeAudio: () => fakeAudio({ refuse: 'NotAllowedError' }), wait: async () => {} });
  await assert.rejects(player.play('a.mp3', 2), { name: 'NotAllowedError' });
});

test('a file that cannot load is an error too', async () => {
  const el = fakeAudio();
  const player = createPlayer({ makeAudio: () => el, wait: async () => {} });
  const done = player.play('missing.mp3', 2);
  await tick();
  el.fail();
  await assert.rejects(done, /Could not play missing.mp3/);
});
