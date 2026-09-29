// Which new words come next. Words are taught in `ord` order (theme by theme, easiest
// HSK level first). A word is skipped once learned. A word whose lesson ended today
// without passing waits until the next study day, where it comes first again because
// its ord is lower than any word not yet taught.
const sortedCache = new WeakMap();

function byOrd(words) {
  let sorted = sortedCache.get(words);
  if (!sorted) {
    sorted = words.slice().sort((a, b) => a.ord - b.ord);
    sortedCache.set(words, sorted);
  }
  return sorted;
}

// nextNewWords(words, progressById, 12, '2026-10-05') gives up to 12 word IDs.
export function nextNewWords(words, progressById, count, today) {
  const out = [];
  if (count <= 0) return out;
  for (const w of byOrd(words)) {
    const p = progressById.get(w.id);
    if (!p || (p.step === 0 && p.lessonDay !== today)) {
      out.push(w.id);
      if (out.length === count) break;
    }
  }
  return out;
}
