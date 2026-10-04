// Measures the tone check of the speaking panel on the app's own word recordings (the Xiaoxiao
// voice of docs/audio/w/), in Chrome, which can decode MP3. check.mjs 'tones' imports this file
// into a page of the project folder (served on port 8124) and prints what it returns.
//
// The words measured are those whose recordings were not used to make the tone shapes of
// tones.js (SHAPES). They are the one-syllable words at odd places in the words file, the
// two-syllable words at places 1, 4, 7, ... (counting from 0), and every word of 3 or more
// syllables. Each recording is decoded at 48,000 samples a second, as a phone's microphone
// records, so the downsampling of pitch.js runs too. The learner's voice range is made from all
// the recordings, as it is after a learner's first few tries.
import { trackPitch } from '../../docs/js/pitch.js';
import { addToVoice, emptyVoice, expectedTones, judgeTones } from '../../docs/js/tones.js';

const RATE = 48000;

async function decode(buffer) {
  const ctx = new OfflineAudioContext(1, RATE, RATE);
  const audio = await ctx.decodeAudioData(buffer);
  return audio.getChannelData(0);
}

// The words to measure, as described at the top.
export function heldOut(words) {
  const ofLength = (n) => words.filter((w) => expectedTones(w).length === n);
  return [
    ...ofLength(1).filter((_, i) => i % 2 === 1),
    ...ofLength(2).filter((_, i) => i % 3 === 1),
    ...words.filter((w) => expectedTones(w).length >= 3),
  ];
}

const share = (right, total) => (total ? Math.round((1000 * right) / total) / 10 : null);

// Decodes and judges every held-out word, and the extra recordings in `samples` (WAV files as
// base64, with the word they say). Returns the shares in percent:
//   syllables   tone heard right, per tone, per tone in words of 1, 2 and 3+ syllables, per place
//               (alone, first, later) and in all
//   words       words that pass, per number of syllables and strictness
//   confusion   'said->heard' counts of the syllables heard wrong, such as { '2->3': 60 }
//   samples     the extra recordings, each with its result at the normal strictness
export async function measure({ wordsFile, base, samples = [] }) {
  const data = await (await fetch(wordsFile)).json();
  const words = heldOut(data.words);
  const tracks = [];
  let voice = emptyVoice();
  for (const w of words) {
    const buffer = await (await fetch(`${base}audio/${w.au}`)).arrayBuffer();
    const track = trackPitch(await decode(buffer), RATE);
    tracks.push(track);
    voice = addToVoice(voice, track.f0);
  }
  const tally = {};
  const count = (key, ok) => {
    tally[key] = tally[key] ?? [0, 0];
    tally[key][1] += 1;
    if (ok) tally[key][0] += 1;
  };
  const confusion = {};
  words.forEach((w, i) => {
    const n = expectedTones(w).length;
    const size = n >= 3 ? '3+' : String(n);
    for (const strictness of ['gentle', 'normal', 'strict']) {
      const j = judgeTones({ track: tracks[i], word: w, voice, strictness });
      count(`words ${size} ${strictness}`, j.pass);
      if (strictness !== 'normal') continue;
      j.syllables.forEach((s, k) => {
        if (s.say === 5) return;
        const place = n === 1 ? 'alone' : k === 0 ? 'first' : 'later';
        const right = s.heard === s.say;
        for (const key of ['all', `tone ${s.say}`, `tone ${s.say} in ${size}`, `place ${place}`]) count(`syllables ${key}`, right);
        if (!right) confusion[`${s.say}->${s.heard ?? 0}`] = (confusion[`${s.say}->${s.heard ?? 0}`] ?? 0) + 1;
      });
    }
  });
  const out = { measured: words.length, syllables: {}, words: {}, confusion, samples: [] };
  for (const [key, [right, total]] of Object.entries(tally)) {
    const [group, ...rest] = key.split(' ');
    out[group][rest.join(' ')] = { share: share(right, total), of: total };
  }
  for (const sample of samples) {
    const bytes = Uint8Array.from(atob(sample.wav), (c) => c.charCodeAt(0));
    const j = judgeTones({ track: trackPitch(await decode(bytes.buffer), RATE), word: sample.word, voice, strictness: 'normal' });
    out.samples.push({ name: sample.name, pass: j.pass, heard: j.syllables.map((s) => s.heard) });
  }
  return out;
}
