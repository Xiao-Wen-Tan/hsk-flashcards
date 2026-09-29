// Small seeded random numbers. The same seed always gives the same sequence, so a quiz
// shows the same choices every time the same word is asked on the same study day.

// hashString uses FNV-1a, a standard simple hash, to turn a text into a 32-bit whole
// number. For example, hashString('a') === 3826002220.
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 is a tiny generator that returns numbers from 0 (included) to 1 (excluded).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// seeded('w0001', '2026-10-05') gives a generator keyed by those parts.
export function seeded(...parts) {
  return mulberry32(hashString(parts.join('|')));
}

// A shuffled copy (Fisher-Yates). The input list is not changed.
export function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
