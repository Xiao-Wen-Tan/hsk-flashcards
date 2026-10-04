// How often the tone check (tones.js) passes made-up tries of real words, said with the right
// tones and with the wrong tones learners often use. The words come from the app's words file,
// picked at random with a fixed seed, so every run gives the same numbers.
//
// Each try is a made-up voice (voice.mjs) whose syllables follow the tone shapes of tones.js
// (SHAPES) in their place of the word, with every pitch point moved at random by up to a tenth
// of the voice range and a little hiss added. About 4 in 10 neighbouring syllables are joined
// by a voiced consonant (a dip in loudness, as the m of 见面 jiànmiàn) instead of a short silence.
// Each try is judged at every strictness, once with the learner's voice range known and once
// without it, as in a learner's first 5 tries.
//
// The first test prints the share of tries that pass. For the right tones higher is better, for
// the wrong tones lower is better. The tests after it check a few clear cases at the normal
// strictness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHAPES, addToVoice, emptyVoice, expectedTones, judgeTones } from '../../docs/js/tones.js';
import { trackPitch } from '../../docs/js/pitch.js';
import { mulberry32 } from '../../docs/js/rng.js';
import { WORDS_FILE } from '../../docs/js/release.js';
import { madeUpVoice } from './voice.mjs';

const WORDS = JSON.parse(readFileSync(new URL(`../../docs/${WORDS_FILE}`, import.meta.url), 'utf8')).words;

// A voice whose middle is 200 Hz and whose range is 8 semitones, and the learner's voice range
// made from 6 recordings of it (as in tones.test.mjs).
const RANGE = { ref: 200, span: 8 };
const hzOf = (points) => points.map((p) => RANGE.ref * 2 ** ((p * RANGE.span) / 12));
let KNOWN = emptyVoice();
for (let i = 0; i < 6; i += 1) KNOWN = addToVoice(KNOWN, hzOf([-0.5, -0.25, 0, 0.25, 0.5]).flatMap((hz) => Array(40).fill(hz)));

const mean = (list) => list.reduce((s, v) => s + v, 0) / list.length;
const level = (points, height = mean(points)) => points.map(() => height);

// The shape of `tone` in place `k` of a word whose tones to listen for are `says`, chosen as
// tones.js chooses it.
function shapeIn(tone, k, says) {
  if (says.length === 1) return SHAPES.alone[tone];
  if (k === 0) return SHAPES.before[tone][says[1]] ?? SHAPES.alone[tone];
  return SHAPES.after[says[k - 1]]?.[tone] ?? SHAPES.later[tone];
}

// The pitch track of one made-up try. `syllables` lists the 5 pitch points of each syllable.
function sayTry(syllables, random) {
  const wobbly = (points) => points.map((p) => p + (random() - 0.5) * 0.2);
  const ms = () => 220 + Math.round(random() * 120);
  const pieces = [{ ms: 120 }];
  for (let k = 0; k < syllables.length;) {
    if (k + 1 < syllables.length && random() < 0.4) {
      pieces.push({ ms: ms() + ms(), hz: hzOf([...wobbly(syllables[k]), ...wobbly(syllables[k + 1])]), dip: 0.6 + 0.3 * random() });
      k += 2;
    } else {
      pieces.push({ ms: ms(), hz: hzOf(wobbly(syllables[k])) });
      k += 1;
    }
    pieces.push({ ms: k >= syllables.length ? 150 : 60 + Math.round(random() * 40) });
  }
  return trackPitch(madeUpVoice(pieces, { noise: 0.005, random }), 16000);
}

// The wrong ways to say a word. `tone` is the tone to listen for that is said wrong, and
// `points` gives what is said instead, from the right shape of that syllable.
const WRONG = [
  { name: 'tone 4 said level and high', tone: 4, points: (right) => level(right, right[0]) },
  { name: 'tone 1 said falling', tone: 1, points: (right, k, says) => shapeIn(4, k, says) },
  { name: 'tone 2 said level', tone: 2, points: (right) => level(right) },
  { name: 'tone 3 said rising', tone: 3, points: (right, k, says) => shapeIn(2, k, says) },
  { name: 'tone 3 said level and high', tone: 3, points: (right, k, says) => level(shapeIn(1, k, says)) },
  { name: 'tone 1 said level and low', tone: 1, points: (right, k, says) => level(shapeIn(3, k, says)) },
];

// The syllables of `w` said right, or with syllable `k` said as `wrong` says.
function syllablesOf(w, wrong = null, k = -1) {
  const says = expectedTones(w).map((e) => e.say);
  return says.map((t, i) => {
    const right = shapeIn(t, i, says);
    return wrong && i === k ? wrong.points(right, i, says) : right;
  });
}

const STRICT = ['gentle', 'normal', 'strict'];
// Whether each try passes, at each strictness, with and without the voice range:
// { known: { gentle, normal, strict }, unknown: { ... } }, each a count of passes.
function judgeAll(tries) {
  const out = { known: {}, unknown: {}, of: tries.length };
  for (const [key, voice] of [['known', KNOWN], ['unknown', null]]) {
    for (const strictness of STRICT) {
      out[key][strictness] = tries.filter(({ w, track }) => judgeTones({ track, word: w, voice, strictness }).pass).length;
    }
  }
  return out;
}

// 40 words each of 1, 2 and 3 syllables without a neutral tone, picked with a fixed seed.
function pickWords(n, count, random) {
  const pool = WORDS.filter((w) => {
    const e = expectedTones(w);
    return e.length === n && e.every((x) => x.say !== 5);
  });
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// Every row of the printed table, as { name, size, result }. Each word is tried twice.
function measureAll() {
  const random = mulberry32(2610);
  const rows = [];
  for (const n of [1, 2, 3]) {
    const words = pickWords(n, 40, random);
    const right = words.flatMap((w) => [0, 1].map(() => ({ w, track: sayTry(syllablesOf(w), random) })));
    rows.push({ name: 'right tones', size: n, result: judgeAll(right) });
    for (const wrong of WRONG) {
      const tries = [];
      for (const w of words) {
        const places = expectedTones(w).map((e, k) => (e.say === wrong.tone ? k : -1)).filter((k) => k >= 0);
        if (!places.length) continue;
        for (let t = 0; t < 2; t += 1) {
          const k = places[Math.floor(random() * places.length)];
          tries.push({ w, track: sayTry(syllablesOf(w, wrong, k), random) });
        }
      }
      rows.push({ name: wrong.name, size: n, result: judgeAll(tries) });
    }
    if (n === 2) {
      // The word said as one syllable, with the shape of its first syllable said alone.
      const tries = words.flatMap((w) => [0, 1].map(() => ({ w, track: sayTry([SHAPES.alone[expectedTones(w)[0].say]], random) })));
      rows.push({ name: 'said as one syllable', size: n, result: judgeAll(tries) });
    }
  }
  return rows;
}

test('made-up tries of real words: the share that passes, right tones and wrong tones', () => {
  const rows = measureAll();
  const pct = (r, key, s) => `${Math.round((100 * r[key][s]) / r.of)}%`.padStart(5);
  const lines = [
    'Share of made-up tries that pass. For the right tones higher is better, for the wrong tones lower is better.',
    `${''.padEnd(52)}voice range known       no voice range yet`,
    `${''.padEnd(52)}gentle normal strict    gentle normal strict`,
  ];
  for (const { name, size, result } of rows) {
    const label = `${name}, ${size} syllable${size === 1 ? '' : 's'} (${result.of} tries)`;
    lines.push(`${label.padEnd(52)}${STRICT.map((s) => pct(result, 'known', s)).join('  ')}   ${STRICT.map((s) => pct(result, 'unknown', s)).join('  ')}`);
  }
  console.log(lines.join('\n'));
  assert.ok(rows.every((r) => r.result.of > 0), 'every row has tries');
});

// `count` tries of a word said a given way, each with its own seeded randomness. Returns the
// number that pass the normal check, with and without the voice range.
function passes(w, syllables, count = 10) {
  let known = 0;
  let unknown = 0;
  for (let i = 0; i < count; i += 1) {
    const track = sayTry(syllables, mulberry32(100 + i));
    if (judgeTones({ track, word: w, voice: KNOWN }).pass) known += 1;
    if (judgeTones({ track, word: w, voice: null }).pass) unknown += 1;
  }
  return { known, unknown };
}
const real = (hz) => WORDS.find((w) => w.hz === hz);
const wrongWay = (name) => WRONG.find((x) => x.name === name);

test('said with the right tones, 是, 见面, 天气, 马 and mā pass the normal check', () => {
  for (const w of [real('是'), real('见面'), real('天气'), real('马'), { hz: '妈', py: 'mā', pyNum: 'ma1' }]) {
    const r = passes(w, syllablesOf(w));
    assert.ok(r.known >= 9 && r.unknown >= 9, `${w.hz}: ${JSON.stringify(r)} of 10`);
  }
});

test('a 4th tone at the end of a word said level and high does not pass the normal check', () => {
  // 是 shì and the qì of 天气 tiānqì, each said level. (A 4th tone before another syllable, as
  // the jiàn of 见面 jiànmiàn, is not held to falling, see CONFIG.speak.minFall.)
  for (const [hz, k] of [['是', 0], ['天气', 1]]) {
    const w = real(hz);
    const r = passes(w, syllablesOf(w, wrongWay('tone 4 said level and high'), k));
    assert.ok(r.known <= 1 && r.unknown <= 1, `${hz}: ${JSON.stringify(r)} of 10 passed`);
  }
});

test('once the voice range is known, 马 said high and mā said low do not pass the normal check', () => {
  const ma3 = real('马');
  const ma1 = { hz: '妈', py: 'mā', pyNum: 'ma1' };
  assert.ok(passes(ma3, syllablesOf(ma3, wrongWay('tone 3 said level and high'), 0)).known <= 1);
  assert.ok(passes(ma1, syllablesOf(ma1, wrongWay('tone 1 said level and low'), 0)).known <= 1);
});

test('before the voice range is known, a word of two syllables shows a syllable said too high or too low', () => {
  // The tiān of 天气 tiānqì said low, and the lǎo of 老师 lǎoshī and the mǎ of 马上 mǎshàng said high.
  for (const [hz, wrong] of [['天气', 'tone 1 said level and low'], ['老师', 'tone 3 said level and high'], ['马上', 'tone 3 said level and high']]) {
    const w = real(hz);
    const r = passes(w, syllablesOf(w, wrongWay(wrong), 0));
    assert.ok(r.unknown <= 1, `${hz}: ${JSON.stringify(r)} of 10 passed`);
  }
});

test('再见 said as one falling syllable does not pass the normal check', () => {
  const w = real('再见');
  const r = passes(w, [SHAPES.alone[4]]);
  assert.ok(r.known <= 1 && r.unknown <= 1, `${JSON.stringify(r)} of 10 passed`);
});
