import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PITCH, cleanPitch, downsample, semitones, trackPitch, voicedRuns } from '../../docs/js/pitch.js';
import { madeUpVoice, pitchAt } from './voice.mjs';
import { mulberry32 } from '../../docs/js/rng.js';

// The largest error of the tracked pitch, as a share of the true pitch, over the windows that
// lie wholly inside the voiced pieces (a window at i covers i * 10 ms to i * 10 ms + 40 ms).
function worstError(pieces, track) {
  let worst = 0;
  let voiced = 0;
  track.f0.forEach((hz, i) => {
    const from = i * track.hop;
    const to = from + PITCH.winMs / 1000;
    const a = pitchAt(pieces, from + 0.001);
    const b = pitchAt(pieces, to - 0.001);
    if (!a || !b) return;
    voiced += 1;
    const truth = pitchAt(pieces, (from + to) / 2);
    worst = Math.max(worst, hz ? Math.abs(hz - truth) / truth : 1);
  });
  return { worst, voiced };
}

test('steady pitches of a low, a middle and a high voice are tracked within 2%', () => {
  for (const hz of [90, 220, 440]) {
    const pieces = [{ ms: 100 }, { ms: 400, hz: [hz] }, { ms: 100 }];
    const { worst, voiced } = worstError(pieces, trackPitch(madeUpVoice(pieces), 16000));
    assert.ok(voiced >= 30, `${hz} Hz: ${voiced} windows`);
    assert.ok(worst < 0.02, `${hz} Hz: worst error ${(worst * 100).toFixed(2)}%`);
  }
});

test('a glide from 300 Hz down to 150 Hz is tracked within 2%, also from 48,000 samples a second', () => {
  const pieces = [{ ms: 100 }, { ms: 400, hz: [300, 150] }, { ms: 100 }];
  for (const rate of [16000, 48000, 44100]) {
    const { worst, voiced } = worstError(pieces, trackPitch(madeUpVoice(pieces, { rate }), rate));
    assert.ok(voiced >= 30, `${rate}: ${voiced} windows`); // an empty track must not pass
    assert.ok(worst < 0.02, `${rate}: worst error ${(worst * 100).toFixed(2)}%`);
  }
});

test('noise is tracked too, a little less closely', () => {
  const pieces = [{ ms: 100 }, { ms: 400, hz: [200, 260] }, { ms: 100 }];
  const sound = madeUpVoice(pieces, { noise: 0.02, random: mulberry32(7) });
  const { worst, voiced } = worstError(pieces, trackPitch(sound, 16000));
  assert.ok(voiced >= 30, `${voiced} windows`);
  assert.ok(worst < 0.03);
});

test('silence and hiss have no pitch', () => {
  assert.deepEqual(voicedRuns(trackPitch(new Float32Array(16000), 16000).f0), []);
  const hiss = madeUpVoice([{ ms: 500 }], { noise: 0.3, random: mulberry32(1) });
  assert.deepEqual(voicedRuns(trackPitch(hiss, 16000).f0), []);
});

test('downsampling keeps a third of the samples from 48,000 a second', () => {
  assert.equal(downsample(new Float32Array(48000), 48000).length, 16000);
  assert.equal(downsample(new Float32Array(16000), 16000).length, 16000);
  assert.equal(downsample(new Float32Array(44100), 44100).length, 16000);
});

test('the clean-up halves an octave jump, smooths, and drops stretches under 40 ms', () => {
  assert.deepEqual(cleanPitch([0, 200, 200, 400, 200, 200, 0]), [0, 200, 200, 200, 200, 200, 0]);
  assert.deepEqual(cleanPitch([0, 200, 100, 200, 200, 200, 0]), [0, 200, 200, 200, 200, 200, 0]);
  assert.deepEqual(cleanPitch([0, 210, 220, 0, 0, 0, 0]), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(voicedRuns([0, 5, 5, 0, 5]), [[1, 2], [4, 4]]);
});

test('the octave check stays inside one voiced stretch, so a lower syllable after a pause keeps its pitch', () => {
  // 20 windows at 300 Hz, a pause of 30 ms, then 8 windows at 174 Hz. Compared with the 300 Hz
  // before the pause, 174 Hz would look like an octave too low and be doubled to 348 Hz.
  const f0 = [0, 0, ...Array(20).fill(300), 0, 0, 0, ...Array(8).fill(174), 0, 0];
  assert.deepEqual(cleanPitch(f0), f0);
});

test('a sample that is not a number or is infinite counts as silence', () => {
  // A voice at 220 Hz between two silences that carry a quiet hum at 100 Hz, 60 dB below the
  // voice, which the silence limit of trackPitch removes.
  const pieces = [{ ms: 200 }, { ms: 400, hz: [220] }, { ms: 200 }];
  const sound = madeUpVoice(pieces).map((v, i) => v + 0.0003 * Math.sin((2 * Math.PI * 100 * i) / 16000));
  const clean = voicedRuns(trackPitch(sound, 16000).f0);
  assert.equal(clean.length, 1);
  for (const bad of [NaN, Infinity, -Infinity]) {
    const broken = Float32Array.from(sound);
    broken[100] = bad;
    assert.deepEqual(voicedRuns(trackPitch(broken, 16000).f0), clean, String(bad));
  }
});

test('semitones count from a reference, 12 to twice the pitch', () => {
  assert.equal(semitones(440, 220), 12);
  assert.equal(semitones(220, 220), 0);
  assert.equal(Math.round(semitones(207.65, 220) * 100) / 100, -1);
});
