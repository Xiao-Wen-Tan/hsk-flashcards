// The tone check of the speaking panel. It compares the pitch of each spoken syllable with the
// tone the word's pinyin expects. Pure functions, so Node tests them.
//
// The steps, for 你好 said by a learner:
//   1. expectedTones() reads the card pinyin, so nǐ is to be said as a 2nd tone and hǎo as a 3rd.
//   2. syllableSegments() cuts the pitch track of pitch.js into 2 syllables.
//   3. shapeOf() reads 5 pitch points of each syllable, at 10%, 30%, 50%, 70% and 90% of it, in
//      semitones from the middle of the learner's voice, divided by the learner's voice range
//      (voiceRange), so a high and a low voice give the same numbers.
//   4. toneScores() compares the 5 points with the shape of each tone in that place of a word
//      (SHAPES) and gives each tone a distance. The nearest tone is what was heard.
//   5. judgeTones() marks each syllable right or wrong by the strictness the learner chose, and
//      says whether the word passes.
import { CONFIG } from './config.js';
import { syllableSpans, syllables, toneOf } from './pinyin.js';
import { semitones, voicedRuns } from './pitch.js';

// The tones to expect, one item per syllable, from the card pinyin `py`, which already shows
// the changes of 一 and 不 (一点儿 is yìdiǎnr, 不客气 is bú kèqi), while `pyNum` keeps the
// dictionary tones (yi1 dian3 r5). The 儿 ending joins the syllable before it. A third tone
// before another third tone is said as a second tone (你好 nǐhǎo is said níhǎo), and in a run
// of third tones every one but the last changes (展览馆 zhǎnlǎnguǎn is said zhánlánguǎn).
// `say` is the tone to listen for. Neutral tones (5) are not judged.
//   expectedTones({ py: 'nǐhǎo', pyNum: 'ni3 hao3' })
//   gives [{ text: 'nǐ', tone: 3, say: 2 }, { text: 'hǎo', tone: 3, say: 3 }]
export function expectedTones(word) {
  const items = syllables(word.pyNum);
  const spans = syllableSpans(word.py, word.pyNum);
  const py = word.py.normalize('NFC');
  const out = [];
  items.forEach((item, k) => {
    if (k > 0 && item.base === 'r' && item.tone === 5) {
      out.at(-1).text += 'r';
      return;
    }
    const text = spans ? py.slice(spans[k][0], spans[k][1]) : item.base;
    const tone = spans ? toneOf(text) : item.tone;
    out.push({ text, tone, say: tone });
  });
  for (let k = 0; k + 1 < out.length; k += 1) if (out[k].tone === 3 && out[k + 1].tone === 3) out[k].say = 2;
  return out;
}

const mean = (list) => list.reduce((s, v) => s + v, 0) / list.length;

// Cuts a pitch track (trackPitch in pitch.js) into `n` syllables. Returns n segments
// [first, last] of window numbers, or null when the recording has too little voice.
// Voiced stretches shorter than 50 ms or 20 dB quieter than the loudest are dropped first.
// Then, while there are more stretches than syllables, the two nearest are joined when the gap
// is at most 120 ms (a third tone often breaks off in a creak), or else the weakest is dropped.
// While there are fewer, the longest is split at its deepest dip in loudness, where a
// consonant such as m, n or l sits between two vowels (我们 wǒmen is one voiced stretch).
// A dip shallower than `minDip` decibels gives null, as no second syllable was heard.
export function syllableSegments({ f0, db }, n, { minFrames = 5, joinGap = 12, minDip = -Infinity } = {}) {
  const level = ([a, b]) => mean(db.slice(a, b + 1));
  let runs = voicedRuns(f0).filter(([a, b]) => b - a + 1 >= minFrames);
  if (!runs.length) return null;
  const loudest = Math.max(...runs.map(level));
  runs = runs.filter((r) => level(r) > loudest - 20);
  const strength = (r) => level(r) + 10 * Math.log10(r[1] - r[0] + 1);
  while (runs.length > n) {
    let at = 0;
    for (let k = 1; k + 1 < runs.length; k += 1) if (runs[k + 1][0] - runs[k][1] < runs[at + 1][0] - runs[at][1]) at = k;
    if (runs[at + 1][0] - runs[at][1] <= joinGap) {
      runs.splice(at, 2, [runs[at][0], runs[at + 1][1]]);
    } else {
      let weak = 0;
      for (let k = 1; k < runs.length; k += 1) if (strength(runs[k]) < strength(runs[weak])) weak = k;
      runs.splice(weak, 1);
    }
  }
  while (runs.length < n) {
    let k = 0;
    for (let j = 1; j < runs.length; j += 1) if (runs[j][1] - runs[j][0] > runs[k][1] - runs[k][0]) k = j;
    const [a, b] = runs[k];
    if (b - a + 1 < 2 * minFrames + 1) return null;
    let cut = a + minFrames;
    let depth = -Infinity;
    for (let i = a + minFrames; i <= b - minFrames; i += 1) {
      const d = Math.min(Math.max(...db.slice(a, i)), Math.max(...db.slice(i + 1, b + 1))) - db[i];
      if (d > depth) { depth = d; cut = i; }
    }
    if (depth < minDip) return null;
    runs.splice(k, 1, [a, cut - 1], [cut + 1, b]);
  }
  return runs;
}

// ---- The learner's voice ----

// A voice is a count of pitch values per half semitone, from 55 Hz (bin 0) up 6 octaves, kept
// over the learner's recordings with older ones counting less, so the middle and the range of
// the voice follow the learner. ui/speak.js keeps it in this browser. The recordings themselves
// are never kept.
export const VOICE_BINS = 144;
export const emptyVoice = () => ({ bins: new Array(VOICE_BINS).fill(0), recordings: 0 });

// The voice with the pitch values (Hz) of one more recording added.
export function addToVoice(voice, hzList) {
  const bins = voice.bins.map((v) => v * CONFIG.speak.voiceKeep);
  for (const hz of hzList) {
    if (!(hz > 0)) continue;
    const bin = Math.round(2 * semitones(hz, 55));
    if (bin >= 0 && bin < VOICE_BINS) bins[bin] += 1;
  }
  return { bins, recordings: voice.recordings + 1 };
}

// The middle (`ref`, Hz) and the range (`span`, semitones from the 10th to the 90th percentile,
// kept between 4 and 14) of the pitch values counted in `bins`, or null when there are none.
function rangeOf(bins) {
  const total = bins.reduce((s, v) => s + v, 0);
  if (!total) return null;
  // The pitch (semitones above 55 Hz) below which `share` of the values lie, read between the
  // edges of the half-semitone bin where the count passes that share.
  const at = (share) => {
    let run = 0;
    for (let i = 0; i < bins.length; i += 1) {
      if (run + bins[i] >= share * total) return (i - 0.5 + (share * total - run) / bins[i]) / 2;
      run += bins[i];
    }
    return (bins.length - 1) / 2;
  };
  const span = Math.min(14, Math.max(4, at(0.9) - at(0.1)));
  return { ref: 55 * 2 ** (at(0.5) / 12), span: Math.round(span * 10) / 10 };
}

// Whether a recording's pitch values (Hz) fit a voice range: their middle is at most
// CONFIG.speak.voiceFit ranges from the middle of the voice. A recording without pitch fits.
// Another person speaking on the learner's phone, such as a teacher or a native speaker, mostly
// does not fit, and the heights of their syllables are not judged against the learner's voice.
// With the range { ref: 263, span: 6.8 }, a voice around 120 Hz (13.6 semitones lower) does not fit.
export function fitsVoice(range, hzList) {
  const hz = hzList.filter((v) => v > 0).sort((a, b) => a - b);
  if (!hz.length) return true;
  return Math.abs(semitones(hz[hz.length >> 1], range.ref) / range.span) <= CONFIG.speak.voiceFit;
}

// The learner's voice range for judging one recording (pitch values `hzList`, Hz), as
// { ref, span, known }. The stored voice is used once it has CONFIG.speak.voiceRecordings
// recordings and the recording fits it (fitsVoice). Otherwise the recording's own pitch values
// are used and `known` is false, so the tone check looks at the shapes, and in a word of 2 or
// more syllables at the heights of the syllables next to each other (relativeHeights).
// A voice whose pitch values run from 205 Hz to 322 Hz with the middle at 274 Hz gives
// { ref: 274, span: 7.8, known: true }.
export function voiceRange(voice, hzList = []) {
  if (voice && voice.recordings >= CONFIG.speak.voiceRecordings) {
    const stored = rangeOf(voice.bins);
    if (stored && fitsVoice(stored, hzList)) return { ...stored, known: true };
  }
  return { ...(rangeOf(addToVoice(emptyVoice(), hzList).bins) ?? { ref: 200, span: 8 }), known: false };
}

// The stored voice after one more recording (pitch values `hzList`, Hz). A recording that does
// not fit the voice (fitsVoice) is left out, so another speaker does not change the learner's
// voice, and `misfits` counts such recordings in a row. When CONFIG.speak.voiceRecordings of
// them come in a row, the voice on this phone has changed (or the first recordings were someone
// else's), and the voice starts again from this recording.
export function updateVoice(voice, hzList) {
  const stored = voice.recordings >= CONFIG.speak.voiceRecordings ? rangeOf(voice.bins) : null;
  if (!stored || fitsVoice(stored, hzList)) return { ...addToVoice(voice, hzList), misfits: 0 };
  const misfits = (voice.misfits ?? 0) + 1;
  if (misfits >= CONFIG.speak.voiceRecordings) return { ...addToVoice(emptyVoice(), hzList), misfits: 0 };
  return { ...voice, misfits };
}

// ---- Tone shapes ----

// The 5 pitch points of each tone, in voice ranges from the middle of the voice (0.25 is a
// quarter of the range above the middle). They are the averages of the app's own recordings
// (the Xiaoxiao voice) of 1,712 words, the one-syllable words at even places of the words file
// and the two-syllable words at places 0, 3, 6 and so on, so they include how a tone sounds next
// to another. tests/browser/tones-check.js measures the check on the other words.
//   alone[tone]                   a word of one syllable
//   before[tone][next]            the first syllable of a longer word, before the tone `next`
//   after[previous][tone]         a later syllable, after the tone `previous`
//   later[tone]                   a later syllable after a neutral tone
//   fullThird                     a third tone that dips and rises fully, as textbooks teach it
//                                 (the user's tone samples of 2 October), also accepted at the
//                                 end of a word
export const SHAPES = Object.freeze({
  alone: { 1: [0.32, 0.34, 0.34, 0.33, 0.29], 2: [-0.33, -0.39, -0.34, -0.08, 0.20], 3: [-0.27, -0.40, -0.43, -0.36, -0.28], 4: [0.40, 0.40, 0.27, -0.10, -0.31] },
  before: {
    1: { 1: [0.28, 0.28, 0.31, 0.34, 0.31], 2: [0.38, 0.39, 0.44, 0.48, 0.47], 3: [0.34, 0.36, 0.41, 0.47, 0.46], 4: [0.29, 0.30, 0.35, 0.39, 0.40], 5: [0.35, 0.37, 0.43, 0.48, 0.49] },
    2: { 1: [-0.33, -0.41, -0.40, -0.29, -0.25], 2: [-0.28, -0.32, -0.21, 0.03, 0.22], 3: [-0.25, -0.28, -0.12, 0.16, 0.31], 4: [-0.35, -0.45, -0.44, -0.31, -0.18], 5: [-0.34, -0.43, -0.45, -0.34, -0.26] },
    3: { 1: [-0.31, -0.43, -0.54, -0.58, -0.55], 2: [-0.27, -0.38, -0.48, -0.52, -0.52], 4: [-0.30, -0.43, -0.55, -0.57, -0.50], 5: [-0.27, -0.39, -0.52, -0.57, -0.52] },
    4: { 1: [0.39, 0.34, 0.18, 0.01, -0.15], 2: [0.46, 0.45, 0.36, 0.21, 0.00], 3: [0.48, 0.46, 0.39, 0.27, 0.06], 4: [0.43, 0.40, 0.29, 0.14, -0.03], 5: [0.46, 0.47, 0.41, 0.25, 0.01] },
  },
  after: {
    1: { 1: [0.36, 0.32, 0.30, 0.29, 0.28], 2: [-0.05, -0.35, -0.49, -0.44, -0.24], 3: [-0.13, -0.44, -0.67, -0.74, -0.54], 4: [0.47, 0.41, 0.19, -0.14, -0.30] },
    2: { 1: [0.37, 0.40, 0.42, 0.44, 0.47], 2: [-0.08, -0.29, -0.38, -0.29, -0.11], 3: [-0.03, -0.31, -0.59, -0.70, -0.53], 4: [0.43, 0.45, 0.38, 0.10, -0.17] },
    3: { 1: [0.24, 0.31, 0.37, 0.40, 0.44], 2: [-0.41, -0.41, -0.28, 0.01, 0.23], 4: [0.25, 0.35, 0.37, 0.22, -0.07] },
    4: { 1: [0.23, 0.24, 0.25, 0.30, 0.30], 2: [-0.33, -0.50, -0.55, -0.43, -0.18], 3: [-0.35, -0.58, -0.72, -0.75, -0.50], 4: [0.12, 0.04, -0.12, -0.37, -0.46] },
  },
  later: { 1: [0.30, 0.31, 0.32, 0.34, 0.36], 2: [-0.20, -0.39, -0.44, -0.31, -0.10], 3: [-0.17, -0.44, -0.66, -0.72, -0.52], 4: [0.30, 0.30, 0.18, -0.07, -0.27] },
  fullThird: [-0.36, -0.51, -0.56, -0.27, 0.08],
});

const POINTS = [0.1, 0.3, 0.5, 0.7, 0.9];

// The 5 points of one syllable (segment [a, b] of the track), in voice ranges from the middle
// of the voice. Each point is the middle value of 3 neighbouring pitch values, which ignores a
// single stray one. Unvoiced windows inside the segment are skipped.
export function shapeOf(f0, [a, b], { ref, span }) {
  const values = f0.slice(a, b + 1).filter((v) => v > 0).map((v) => semitones(v, ref) / span);
  if (values.length < 3) return null;
  return POINTS.map((p) => {
    const i = Math.min(values.length - 1, Math.floor(p * values.length));
    const near = values.slice(Math.max(0, i - 1), i + 2).sort((x, y) => x - y);
    return near[near.length >> 1];
  });
}

// The shape of `tone` in place `k` of a word whose tones to listen for are `says`.
function shapeFor(tone, k, says) {
  if (says.length === 1) return SHAPES.alone[tone];
  if (k === 0) return SHAPES.before[tone][says[1]] ?? SHAPES.alone[tone];
  return SHAPES.after[says[k - 1]]?.[tone] ?? SHAPES.later[tone];
}

// How far a syllable's 5 points are from a tone shape. The shape may sit a little higher or
// lower, but a difference in height counts `levelWeight` times. `upTo` below 1 compares only
// the first part of the shape, because the end of a falling 4th tone often fades into a creak
// that has no pitch.
function distance(points, shape, levelWeight, upTo = 1) {
  const at = (q) => {
    const f = q * upTo * (shape.length - 1);
    const i = Math.min(shape.length - 2, Math.floor(f));
    return shape[i] + (shape[i + 1] - shape[i]) * (f - i);
  };
  const diff = points.map((v, i) => v - at(i / (points.length - 1)));
  const m = mean(diff);
  return mean(diff.map((d) => (d - m) ** 2)) + levelWeight * m * m;
}

const levelWeightOf = (range) => (range.known || range.relative ? CONFIG.speak.levelWeight : 0);

// How far a syllable falls, the largest drop from one of its 5 points to a later one. The
// points [0.40, 0.42, 0.30, 0.05, -0.10] fall by 0.42 - (-0.10) = 0.52.
export function fallOf(points) {
  let fall = -Infinity;
  points.forEach((p, i) => { for (const q of points.slice(i + 1)) fall = Math.max(fall, p - q); });
  return fall;
}

// The usual range of a voice in semitones, for the fall of a 4th tone before the learner's own
// range is known.
const USUAL_SPAN = 8;

// Each tone's distance for syllable `k` of a word whose tones to listen for are `says`, as
// { 1: 0.004, 2: 0.31, 3: 0.52, 4: 0.12 }. The smallest is the tone heard. Without a known
// voice (range.known false) the height of the voice is unknown, so only the shapes count,
// unless relativeHeights() set range.relative.
// The last syllable of a word is not a 4th tone (distance Infinity) when it falls less than
// CONFIG.speak.minFall of the voice range, 0.15. Its distance alone would let a level syllable
// pass, because the first part of a 4th tone's shape, which is also compared, is nearly level.
// Before the voice range is known, the fall is measured in semitones against the usual range
// of 8, so the syllable must fall by 0.15 * 8 = 1.2 semitones, about 7% of its own pitch.
export function toneScores(points, k, says, range = { known: true }) {
  const levelWeight = levelWeightOf(range);
  const out = {};
  for (const tone of [1, 2, 3, 4]) {
    const shape = shapeFor(tone, k, says);
    const ends = tone === 4 ? [0.6, 0.8, 1] : [1];
    out[tone] = Math.min(...ends.map((e) => distance(points, shape, levelWeight, e)));
  }
  const fall = fallOf(points) * (range.known ? 1 : (range.span ?? USUAL_SPAN) / USUAL_SPAN);
  if (k === says.length - 1 && fall < CONFIG.speak.minFall) out[4] = Infinity;
  return out;
}

const TONE_WORDS = { 1: 'a high level tone', 2: 'a rising tone', 3: 'a low tone', 4: 'a falling tone' };
const SHOULD = { 1: 'it should stay high and level', 2: 'it should rise', 3: 'it should go low', 4: 'it should fall' };
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

// Before the learner's voice range is known (range.known false), the height of one syllable
// alone cannot be judged, but in a word of 2 or more judged syllables the height of each
// syllable next to the others can. The points of all syllables (`points`, one list per
// syllable, null for a neutral tone) are moved up or down together until their average height
// is that of the shapes of the expected tones, and heights then count as with a known range.
// In 天气 tiānqì, the shapes of a 1st tone before a 4th and of a 4th after a 1st average 0.35
// and 0.13. Said with tiān at -0.30 and qì at 0.20, both move up by 0.29, so tiān sits at
// -0.01, 0.36 below where a 1st tone should be, and that difference counts.
// Returns { points, range }, the moved points and the range to judge with.
function relativeHeights(points, says, range) {
  const judged = points.map((p, k) => (p ? k : -1)).filter((k) => k >= 0);
  if (range.known || judged.length < 2) return { points, range };
  const shift = mean(judged.map((k) => mean(points[k]) - mean(shapeFor(says[k], k, says))));
  return { points: points.map((p) => p && p.map((v) => v - shift)), range: { ...range, relative: true } };
}

// Judges the tones of one recording. track is trackPitch()'s result, word the card, voice the
// learner's voice (addToVoice) or null, and strictness 'gentle', 'normal' or 'strict'.
// Returns { syllables, judged, right, share, pass, problem }:
//   syllables  [{ text, say, heard, ok }], where heard is null and ok true for a neutral tone
//   share      right / judged, the share of judged syllables with the right tone
//   pass       share reaches the strictness's share (a word of neutral tones passes once its
//              syllables are heard)
//   problem    a sentence for the learner, such as '2nd syllable: heard a falling tone, it should rise.'
// A word whose syllables cannot be found gives pass false and the problem 'Could not hear 2 syllables.'
export function judgeTones({ track, word, voice = null, strictness = 'normal' }) {
  const rule = CONFIG.speak.strictness[strictness] ?? CONFIG.speak.strictness.normal;
  const expected = expectedTones(word);
  const says = expected.map((e) => e.say);
  // A two-syllable word said in one voiced stretch needs a dip in loudness between its
  // syllables, so a word said as one syllable is not heard as two. Longer words are often said
  // in one stretch without a dip (半途而废 bàntú-érfèi in the app's own recording), so they are
  // not held to it.
  const segments = syllableSegments(track, expected.length, { minDip: expected.length === 2 ? CONFIG.speak.minDip : -Infinity });
  const judgedCount = says.filter((t) => t !== 5).length;
  if (!segments) {
    const n = expected.length;
    return { syllables: [], judged: judgedCount, right: 0, share: 0, pass: false, problem: `Could not hear ${n} syllable${n === 1 ? '' : 's'}.` };
  }
  const own = voiceRange(voice, track.f0);
  const read = expected.map((e, k) => (e.say === 5 ? null : shapeOf(track.f0, segments[k], own)));
  const { points: all, range } = relativeHeights(read, says, own);
  const out = expected.map((e, k) => {
    if (e.say === 5) return { text: e.text, say: 5, heard: null, ok: true };
    const points = all[k];
    if (!points) return { text: e.text, say: e.say, heard: null, ok: false };
    const scores = toneScores(points, k, says, range);
    const best = Math.min(...Object.values(scores));
    const heard = Number(Object.keys(scores).find((t) => scores[t] === best));
    // A third tone at the end of a word may also dip and rise fully, as textbooks teach it.
    let mine = scores[e.say];
    if (e.say === 3 && k === expected.length - 1) mine = Math.min(mine, distance(points, SHAPES.fullThird, levelWeightOf(range)));
    return { text: e.text, say: e.say, heard, ok: mine <= best + rule.margin };
  });
  const right = out.filter((s) => s.say !== 5 && s.ok).length;
  const share = judgedCount ? right / judgedCount : 1;
  const wrong = out.findIndex((s) => !s.ok);
  let problem = null;
  if (wrong >= 0 && range.relative) {
    // Before the learner's voice range is known, heights are compared within the word, and one
    // syllable's error moves the others too, so the syllable to name may be the one said right.
    problem = 'Not quite. Listen again and copy how the word rises and falls.';
  } else if (wrong >= 0) {
    const s = out[wrong];
    const where = expected.length === 1 ? 'Tone' : `${ORDINAL[wrong] ?? `${wrong + 1}th`} syllable`;
    problem = s.heard ? `${where}: heard ${TONE_WORDS[s.heard]}, ${SHOULD[s.say]}.` : `${where}: could not hear its pitch.`;
  }
  return { syllables: out, judged: judgedCount, right, share, pass: share >= rule.share, problem };
}
