// Made-up voices for the pitch and tone tests. A voice is a buzz of 6 harmonics, like a sung
// vowel, whose pitch glides through the listed values.
//   madeUpVoice([{ ms: 100 }, { ms: 300, hz: [220, 180] }, { ms: 100 }])
// gives 100 ms of silence, 300 ms of voice falling from 220 Hz to 180 Hz, and 100 ms of silence,
// at 16,000 samples a second. A piece without `hz` is silence. `dip` lowers the loudness in the
// middle of a voiced piece, as a consonant such as m or n does between two vowels.
export function madeUpVoice(pieces, { rate = 16000, noise = 0, random = Math.random } = {}) {
  const total = pieces.reduce((s, p) => s + Math.round((p.ms / 1000) * rate), 0);
  const out = new Float32Array(total);
  let at = 0;
  let phase = 0;
  for (const piece of pieces) {
    const n = Math.round((piece.ms / 1000) * rate);
    for (let i = 0; i < n; i += 1) {
      let v = 0;
      if (piece.hz) {
        const f = (i / Math.max(1, n - 1)) * (piece.hz.length - 1);
        const k = Math.min(piece.hz.length - 2, Math.floor(f));
        const hz = piece.hz.length === 1 ? piece.hz[0] : piece.hz[k] + (piece.hz[k + 1] - piece.hz[k]) * (f - k);
        phase += (2 * Math.PI * hz) / rate;
        for (let h = 1; h <= 6; h += 1) v += Math.sin(h * phase) / h;
        const edge = Math.min(1, i / (0.01 * rate), (n - 1 - i) / (0.01 * rate));
        const dip = piece.dip ? 1 - piece.dip * Math.exp(-(((i / n - 0.5) / 0.06) ** 2)) : 1;
        v *= 0.3 * edge * dip;
      }
      out[at + i] = v + (noise ? noise * (random() * 2 - 1) : 0);
    }
    at += n;
  }
  return out;
}

// The true pitch of a made-up voice at time t (seconds), or 0 in silence, for checking a track.
export function pitchAt(pieces, t) {
  let start = 0;
  for (const piece of pieces) {
    const end = start + piece.ms / 1000;
    if (t >= start && t < end) {
      if (!piece.hz) return 0;
      if (piece.hz.length === 1) return piece.hz[0];
      const f = ((t - start) / (end - start)) * (piece.hz.length - 1);
      const k = Math.min(piece.hz.length - 2, Math.floor(f));
      return piece.hz[k] + (piece.hz[k + 1] - piece.hz[k]) * (f - k);
    }
    start = end;
  }
  return 0;
}
