// Pitch tracking of a recorded voice, for the tone check of the speaking panel (tones.js).
// Pure functions on plain number arrays, so Node tests them with made-up sounds.
//
// How it works, for a 1-second recording at 48,000 samples a second:
//   1. downsample() keeps every third sample after smoothing, so 16,000 samples a second are left.
//   2. trackPitch() looks at a 40 ms window every 10 ms, 100 windows in all. In each window the
//      YIN method (de Cheveigné and Kawahara, 2002) finds how far the wave must be shifted to
//      repeat itself. A shift of 64 samples at 16,000 a second is a pitch of 16000 / 64 = 250 Hz.
//      A window that does not repeat clearly (a breath, an "s", silence) gets pitch 0.
//   3. cleanPitch() removes single wrong values. A pitch twice or half that of its neighbours (an
//      octave jump) is halved or doubled, a 5-window median smooths the rest, and voiced
//      stretches shorter than 40 ms are dropped.
// semitones() turns a pitch into semitones from a reference, so 12 semitones is twice the pitch.
export const PITCH = Object.freeze({
  rate: 16000, // samples a second after downsampling
  hopMs: 10, // one pitch value every 10 ms
  winMs: 40, // each value looks at 40 ms of sound
  fmin: 70, // Hz, below a deep man's voice
  fmax: 500, // Hz, above a child's voice
  threshold: 0.15, // YIN's limit of how clearly a window must repeat
  loose: 0.4, // a window that repeats less clearly than this has no pitch
  silenceDb: 40, // a window this many decibels below the loudest one is silence
});

// Fewer samples a second. Each new sample is the mean of the old samples around it, which
// removes the high sounds that would otherwise fold back as noise. downsample(x, 48000) gives
// a third as many samples.
export function downsample(samples, fromRate, toRate = PITCH.rate) {
  if (fromRate === toRate) return Float32Array.from(samples);
  const ratio = fromRate / toRate;
  const n = Math.floor(samples.length / ratio);
  const out = new Float32Array(n);
  const half = Math.max(0, Math.floor(ratio / 2));
  for (let i = 0; i < n; i += 1) {
    const centre = Math.round(i * ratio);
    let sum = 0;
    let count = 0;
    for (let k = centre - half; k <= centre + half; k += 1) {
      if (k >= 0 && k < samples.length) { sum += samples[k]; count += 1; }
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

// The pitch of one window by the YIN method, in Hz, or 0 when the window does not repeat
// clearly enough. `start` is the first sample of the window in `x`.
export function yinPitch(x, start, rate = PITCH.rate, {
  fmin = PITCH.fmin, fmax = PITCH.fmax, threshold = PITCH.threshold, loose = PITCH.loose,
} = {}) {
  const maxLag = Math.min(Math.floor(rate / fmin), Math.floor((x.length - start) / 2));
  const minLag = Math.max(2, Math.floor(rate / fmax));
  const size = Math.floor((PITCH.winMs / 1000) * rate) - maxLag;
  if (size < minLag || maxLag <= minLag) return 0;
  const d = new Float64Array(maxLag + 2);
  for (let lag = 1; lag <= maxLag + 1; lag += 1) {
    let sum = 0;
    for (let j = 0; j < size; j += 1) {
      const diff = x[start + j] - x[start + j + lag];
      sum += diff * diff;
    }
    d[lag] = sum;
  }
  // The cumulative mean normalised difference, d'(lag) = d(lag) * lag / (d(1) + ... + d(lag)).
  let running = 0;
  const dn = new Float64Array(maxLag + 2);
  dn[0] = 1;
  for (let lag = 1; lag <= maxLag + 1; lag += 1) {
    running += d[lag];
    dn[lag] = running > 0 ? (d[lag] * lag) / running : 1;
  }
  // The first dip under the threshold, or else the deepest dip when it is under `loose`.
  let lag = minLag;
  while (lag <= maxLag && dn[lag] >= threshold) lag += 1;
  if (lag > maxLag) {
    lag = minLag;
    for (let k = minLag + 1; k <= maxLag; k += 1) if (dn[k] < dn[lag]) lag = k;
    if (dn[lag] >= loose) return 0;
  }
  while (lag + 1 <= maxLag && dn[lag + 1] < dn[lag]) lag += 1;
  // A parabola through the three values around the dip finds the shift between two samples.
  const a = dn[lag - 1];
  const b = dn[lag];
  const c = dn[lag + 1];
  const bend = a - 2 * b + c;
  const shift = bend > 0 ? (0.5 * (a - c)) / bend : 0;
  return rate / (lag + Math.max(-1, Math.min(1, shift)));
}

// Loudness of one window in decibels (0 dB is a full-scale wave).
function decibels(x, start, size) {
  let sum = 0;
  const end = Math.min(x.length, start + size);
  for (let i = start; i < end; i += 1) sum += x[i] * x[i];
  return 10 * Math.log10(sum / Math.max(1, end - start) + 1e-12);
}

// The pitch track of a recording, with one value every 10 ms. Returns { hop, f0, db }, where
// f0[i] is the pitch in Hz of the window that starts at i * 10 ms (0 for no pitch) and db[i] its
// loudness. `samples` are numbers between -1 and 1 at `rate` samples a second.
export function trackPitch(samples, rate) {
  const x = downsample(samples, rate);
  const hop = Math.round((PITCH.hopMs / 1000) * PITCH.rate);
  const win = Math.round((PITCH.winMs / 1000) * PITCH.rate);
  const f0 = [];
  const db = [];
  for (let start = 0; start + win < x.length; start += hop) {
    db.push(decibels(x, start, win));
    f0.push(yinPitch(x, start));
  }
  const loudest = Math.max(-120, ...db);
  for (let i = 0; i < f0.length; i += 1) if (db[i] < loudest - PITCH.silenceDb) f0[i] = 0;
  return { hop: PITCH.hopMs / 1000, f0: cleanPitch(f0), db };
}

const median = (list) => {
  const s = list.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// The voiced stretches of a track, as [first, last] window numbers.
export function voicedRuns(f0) {
  const runs = [];
  let from = -1;
  for (let i = 0; i <= f0.length; i += 1) {
    const on = i < f0.length && f0[i] > 0;
    if (on && from < 0) from = i;
    if (!on && from >= 0) { runs.push([from, i - 1]); from = -1; }
  }
  return runs;
}

// Removes single wrong pitch values (see the top of this file). Returns a new list.
export function cleanPitch(f0, { minRun = 4 } = {}) {
  const out = f0.slice();
  if (!out.some((v) => v > 0)) return out;
  // An octave jump is found by comparing with the median of the voiced values within 15 windows.
  for (let i = 0; i < out.length; i += 1) {
    if (!out[i]) continue;
    const near = [];
    for (let k = Math.max(0, i - 15); k <= Math.min(out.length - 1, i + 15); k += 1) if (f0[k] > 0) near.push(f0[k]);
    const m = median(near);
    if (out[i] > 1.7 * m) out[i] /= 2;
    else if (out[i] < 0.6 * m) out[i] *= 2;
  }
  // A 5-window median inside each voiced stretch.
  const smooth = out.slice();
  for (const [a, b] of voicedRuns(out)) {
    for (let i = a; i <= b; i += 1) {
      smooth[i] = median(out.slice(Math.max(a, i - 2), Math.min(b, i + 2) + 1));
    }
  }
  for (const [a, b] of voicedRuns(smooth)) if (b - a + 1 < minRun) for (let i = a; i <= b; i += 1) smooth[i] = 0;
  return smooth;
}

// Semitones of `hz` above `ref` (negative below it). semitones(440, 220) === 12.
export function semitones(hz, ref) {
  return 12 * Math.log2(hz / ref);
}
