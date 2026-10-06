import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES, addToVoice, emptyVoice, expectedTones, fitsVoice, judgeTones, syllableSegments, updateVoice, voiceRange,
} from '../../docs/js/tones.js';
import { CONFIG } from '../../docs/js/config.js';
import { trackPitch } from '../../docs/js/pitch.js';
import { mulberry32 } from '../../docs/js/rng.js';
import { madeUpVoice } from './voice.mjs';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const says = (w) => expectedTones(w).map((e) => e.say);

test('the tones to expect come from the card pinyin, with the changes of 一 and 不', () => {
  // pyNum keeps the dictionary tones (yi1 dian3 r5, bu4 ke4 qi5), the card pinyin shows how they are said.
  assert.deepEqual(expectedTones(word(data, '一点儿')), [{ text: 'yì', tone: 4, say: 4 }, { text: 'diǎnr', tone: 3, say: 3 }]);
  assert.deepEqual(says(word(data, '不客气')), [2, 4, 5]);
  assert.deepEqual(says(word(data, '对不起')), [4, 5, 3]);
  assert.deepEqual(says(word(data, '谢谢')), [4, 5]);
  assert.deepEqual(says(word(data, '我')), [3]);
});

test('a third tone before another third tone is said as a second tone', () => {
  assert.deepEqual(expectedTones({ py: 'nǐhǎo', pyNum: 'ni3 hao3' }),
    [{ text: 'nǐ', tone: 3, say: 2 }, { text: 'hǎo', tone: 3, say: 3 }]);
  assert.deepEqual(says({ py: 'zhǎnlǎnguǎn', pyNum: 'zhan3 lan3 guan3' }), [2, 2, 3]);
  assert.deepEqual(says({ py: 'wǒmen', pyNum: 'wo3 men5' }), [3, 5]); // a neutral tone breaks the run
});

// A voice whose middle is 200 Hz and whose range is 8 semitones, as the voice histogram of
// a learner who has made a few recordings.
const RANGE = { ref: 200, span: 8 };
const hzOf = (points) => points.map((p) => RANGE.ref * 2 ** ((p * RANGE.span) / 12));
let KNOWN = emptyVoice();
for (let i = 0; i < 6; i += 1) KNOWN = addToVoice(KNOWN, hzOf([-0.5, -0.25, 0, 0.25, 0.5]).flatMap((hz) => Array(40).fill(hz)));

test('the middle and the range of a learner\'s voice', () => {
  // Pitch values from 141 Hz to 283 Hz, evenly spread over 12 semitones around 200 Hz.
  const hz = Array.from({ length: 121 }, (_, i) => 200 * 2 ** ((i / 10 - 6) / 12));
  let voice = emptyVoice();
  for (let i = 0; i < 5; i += 1) voice = addToVoice(voice, hz);
  const r = voiceRange(voice);
  // The 10th and 90th percentiles are 4.8 semitones below and above the middle.
  assert.ok(Math.abs(r.ref - 200) < 2, `ref ${r.ref}`);
  assert.ok(Math.abs(r.span - 9.6) <= 0.2, `span ${r.span}`);
  assert.equal(r.known, true);
  // Before 5 recordings, the recording itself is used and the height of the voice is not trusted.
  assert.equal(voiceRange(addToVoice(emptyVoice(), hz), hz).known, false);
  assert.deepEqual(voiceRange(null, []), { ref: 200, span: 8, known: false });
});

test('a recording is cut into its syllables', () => {
  const track = (pieces) => trackPitch(madeUpVoice(pieces), 16000);
  // Two syllables with a silent consonant between them.
  const two = syllableSegments(track([{ ms: 100 }, { ms: 250, hz: [220] }, { ms: 80 }, { ms: 250, hz: [180] }, { ms: 100 }]), 2);
  assert.equal(two.length, 2);
  assert.ok(two[0][1] < 36 && two[1][0] > 38, JSON.stringify(two));
  // Two syllables joined by a voiced consonant, found at the dip in loudness.
  const joined = syllableSegments(track([{ ms: 100 }, { ms: 500, hz: [220, 200], dip: 0.9 }, { ms: 100 }]), 2);
  assert.ok(Math.abs(joined[0][1] - 33) <= 4, JSON.stringify(joined));
  // One syllable broken by a 60 ms creak is joined again.
  const one = syllableSegments(track([{ ms: 100 }, { ms: 150, hz: [200] }, { ms: 60 }, { ms: 150, hz: [180] }, { ms: 100 }]), 1);
  assert.equal(one.length, 1);
  assert.equal(syllableSegments(track([{ ms: 300 }]), 1), null);
});

// In made-up words each syllable follows the tone shape of its place in the word (SHAPES), with
// every point moved at random by up to a tenth of the voice range.
function sayShapes(shapes, random) {
  const pieces = [{ ms: 120 }];
  shapes.forEach((points, k) => {
    const wobbly = points.map((p) => p + (random() - 0.5) * 0.2);
    pieces.push({ ms: 220 + Math.round(random() * 120), hz: hzOf(wobbly) });
    pieces.push({ ms: k === shapes.length - 1 ? 150 : 60 + Math.round(random() * 40) });
  });
  return madeUpVoice(pieces, { noise: 0.005, random });
}
const shapeOfTone = (k, list) => {
  if (list.length === 1) return SHAPES.alone[list[0]];
  if (k === 0) return SHAPES.before[list[0]][list[1]] ?? SHAPES.alone[list[0]];
  return SHAPES.after[list[k - 1]][list[k]] ?? SHAPES.later[list[k]];
};
const PY = { 1: 'mā', 2: 'má', 3: 'mǎ', 4: 'mà' };

test('the tones of made-up words with noise are heard right at least 90% of the time', () => {
  const random = mulberry32(2026);
  let right = 0;
  let total = 0;
  const lists = [[1], [2], [3], [4]];
  for (const a of [1, 2, 3, 4]) for (const b of [1, 2, 3, 4]) if (!(a === 3 && b === 3)) lists.push([a, b]);
  for (let round = 0; round < 5; round += 1) {
    for (const list of lists) {
      const w = { py: list.map((t) => PY[t]).join(''), pyNum: list.map((t) => `ma${t}`).join(' ') };
      const sound = sayShapes(list.map((_, k) => shapeOfTone(k, list)), random);
      const j = judgeTones({ track: trackPitch(sound, 16000), word: w, voice: KNOWN });
      j.syllables.forEach((s) => { total += 1; if (s.heard === s.say) right += 1; });
    }
  }
  assert.equal(total, 5 * (4 + 2 * 15));
  console.log(`made-up words: ${right} of ${total} syllables right`);
  assert.ok(right / total >= 0.9, `${right} of ${total} right`);
});

test('a wrong tone is named, and the strictness decides how close is close enough', () => {
  // 再见 zàijiàn said with a rising 2nd syllable.
  const w = word(data, '再见');
  const sound = sayShapes([SHAPES.before[4][4], SHAPES.after[4][2]], mulberry32(3));
  const j = judgeTones({ track: trackPitch(sound, 16000), word: w, voice: KNOWN });
  assert.deepEqual(j.syllables.map((s) => [s.text, s.say, s.heard, s.ok]), [['zài', 4, 4, true], ['jiàn', 4, 2, false]]);
  assert.deepEqual([j.right, j.judged, j.share, j.pass], [1, 2, 0.5, false]);
  assert.equal(j.problem, '2nd syllable: heard a rising tone, it should fall.');
  // A one-syllable word names its tone.
  const one = judgeTones({ track: trackPitch(sayShapes([SHAPES.alone[4]], mulberry32(4)), 16000), word: word(data, '我'), voice: KNOWN });
  assert.equal(one.problem, 'Tone: heard a falling tone, it should go low.');
});

test('neutral tones are not judged, and silence does not pass', () => {
  const w = word(data, '谢谢');
  const j = judgeTones({ track: trackPitch(sayShapes([SHAPES.before[4][5], SHAPES.alone[1]], mulberry32(5)), 16000), word: w, voice: KNOWN });
  assert.deepEqual(j.syllables.map((s) => [s.say, s.heard, s.ok]), [[4, 4, true], [5, null, true]]);
  assert.equal(j.pass, true);
  const quiet = judgeTones({ track: trackPitch(new Float32Array(16000), 16000), word: w, voice: KNOWN });
  assert.deepEqual([quiet.pass, quiet.problem], [false, 'Could not hear 2 syllables.']);
});

test('before the voice range is known, a failed word gets general advice, not a syllable that may be the wrong one', () => {
  // Without the learner's range, heights are compared within the word, and one syllable's error
  // spreads over the others, so naming a syllable could point at the one said right.
  const word = { hz: '老师', py: 'lǎoshī', pyNum: 'lao3 shi1' };
  const pieces = [{ ms: 150 }, { ms: 250, hz: [150, 120, 125] }, { ms: 40 }, { ms: 250, hz: [118, 117] }, { ms: 150 }];
  const r = judgeTones({ track: trackPitch(madeUpVoice(pieces), 16000), word, voice: null, strictness: 'normal' });
  assert.equal(r.pass, false); // shī said low and level is wrong
  assert.equal(r.problem, 'Not quite. Listen again and copy how the word rises and falls.');
});

test('another speaker on the learner\'s phone is not judged against the learner\'s voice', () => {
  // The learner's voice is known (middle 200 Hz). A native speaker an octave lower says the
  // words right. Their heights would all sound low against the learner's voice.
  const other = { ref: 100, span: 8 };
  const say = (shapes, random) => {
    const pieces = [{ ms: 120 }];
    shapes.forEach((points) => {
      pieces.push({ ms: 300, hz: points.map((p) => other.ref * 2 ** (((p + (random() - 0.5) * 0.1) * other.span) / 12)) });
      pieces.push({ ms: 80 });
    });
    return madeUpVoice(pieces, { noise: 0.005, random });
  };
  const random = mulberry32(7);
  for (const [hz, shapes] of [
    ['他', [SHAPES.alone[1]]], ['是', [SHAPES.alone[4]]],
    ['再见', [SHAPES.before[4][4], SHAPES.after[4][4]]],
  ]) {
    const track = trackPitch(say(shapes, random), 16000);
    assert.equal(voiceRange(KNOWN, track.f0).known, false, hz);
    const j = judgeTones({ track, word: word(data, hz), voice: KNOWN });
    assert.equal(j.pass, true, `${hz}: ${j.problem}`);
  }
});

test('a recording fits the voice when its middle is within voiceFit ranges of the voice\'s middle', () => {
  const range = { ref: 200, span: 8 };
  const at = (r) => [range.ref * 2 ** ((r * range.span) / 12)];
  assert.equal(CONFIG.speak.voiceFit, 0.75);
  assert.equal(fitsVoice(range, at(0.7)), true);
  assert.equal(fitsVoice(range, at(-0.7)), true);
  assert.equal(fitsVoice(range, at(0.8)), false);
  assert.equal(fitsVoice(range, at(-1.7)), false);
  assert.equal(fitsVoice(range, [0, 0]), true); // no pitch at all
  // The learner's own words, high or low, keep the known range.
  assert.equal(voiceRange(KNOWN, hzOf(SHAPES.alone[1])).known, true);
  assert.equal(voiceRange(KNOWN, hzOf(SHAPES.after[4][3])).known, true);
});

test('another speaker\'s recordings stay out of the learner\'s voice, until they come 5 times in a row', () => {
  const learner = hzOf([-0.25, 0, 0.25]);
  const low = learner.map((hz) => hz / 2);
  let voice = KNOWN;
  voice = updateVoice(voice, low);
  assert.deepEqual([voice.recordings, voice.misfits, voice.bins], [KNOWN.recordings, 1, KNOWN.bins]);
  voice = updateVoice(voice, learner); // the learner again: added, and the count starts again
  assert.deepEqual([voice.recordings, voice.misfits], [KNOWN.recordings + 1, 0]);
  for (let i = 0; i < CONFIG.speak.voiceRecordings - 1; i += 1) voice = updateVoice(voice, low);
  assert.deepEqual([voice.recordings, voice.misfits], [KNOWN.recordings + 1, 4]);
  // The 5th in a row: the voice on this phone has changed, and it starts again from this recording.
  voice = updateVoice(voice, low);
  assert.deepEqual([voice.recordings, voice.misfits], [1, 0]);
  // Before a voice is known, every recording is added.
  assert.equal(updateVoice(emptyVoice(), learner).recordings, 1);
});
