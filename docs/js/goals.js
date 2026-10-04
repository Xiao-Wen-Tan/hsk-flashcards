// Goal countdowns (spec of 2026-10-03, section 2) say how far each next milestone is, in the unit
// it names. Today shows the two nearest, Stats shows them all. A goal's `share` is the part of its
// target still to go, so 3 days left of a 30-day streak is 0.1, and the smallest share is nearest.
import { CONFIG } from './config.js';
import { LEVEL_GROUPS, mapSections, wordsOfGroup } from './stats.js';
import { isLearned } from './srs.js';
import { plural } from './view/format.js';

const grouped = (n) => Number(n).toLocaleString('en-US'); // 1000 gives '1,000'
const nextStep = (steps, have) => steps.find((n) => n > have);
const goal = (id, text, left, target) => ({ id, text, left, share: left / target });

// facts is badgeFacts()'s result and streak today's streak (currentStreak in checkin.js).
// Returns [{ id, text, left, share }], nearest first. A milestone already reached is left out.
export function goals({ data, progressById, facts, streak }) {
  const out = [];
  // The current tile of the progress map ('current' in stats.js mapSections).
  for (const section of mapSections(data.themes, data.words, progressById)) {
    const tile = section.tiles.find((t) => t.status === 'current');
    if (tile) {
      const left = tile.total - tile.learned;
      out.push(goal('theme', `${plural(left, 'more word')} to finish ${tile.name}`, left, tile.total));
      break;
    }
  }
  // The next streak badge needs that many days in a row, counted from today's streak.
  const days = nextStep(CONFIG.badges.streak, facts.bestStreak);
  if (days) out.push(goal('streak', `${plural(days - streak, 'day')} to the ${days}-day badge`, days - streak, days));
  // The next words-learned badge, or every word once the steps are passed.
  const step = nextStep(CONFIG.badges.learned.filter((n) => n < facts.totalWords), facts.learned);
  const target = step ?? facts.totalWords;
  if (facts.learned < target) {
    const left = target - facts.learned;
    const text = step ? `${plural(left, 'more word')} to the ${grouped(step)}-word badge` : `${plural(left, 'more word')} to learn every word`;
    out.push(goal('learned', text, left, target));
  }
  // The first level group that is not finished.
  for (const g of LEVEL_GROUPS) {
    const words = wordsOfGroup(data.words, g);
    const have = words.filter((w) => isLearned(progressById.get(w.id))).length;
    if (words.length && have < words.length) {
      out.push(goal('group', `${plural(words.length - have, 'more word')} to finish ${g.label}`, words.length - have, words.length));
      break;
    }
  }
  const reviews = nextStep(CONFIG.badges.reviews, facts.reviews);
  if (reviews) out.push(goal('reviews', `${plural(reviews - facts.reviews, 'review')} to the ${grouped(reviews)}-review badge`, reviews - facts.reviews, reviews));
  const minutes = nextStep(CONFIG.badges.minutes, facts.minutes);
  if (minutes) {
    const left = Math.ceil(minutes - facts.minutes);
    out.push(goal('minutes', `${plural(left, 'minute')} to the ${grouped(minutes)}-minute badge`, left, minutes));
  }
  return nearest(out, out.length);
}

// The `n` goals with the smallest share left to go. A tie keeps the order of the list.
export function nearest(list, n = 2) {
  return list.slice().sort((a, b) => a.share - b.share).slice(0, n);
}
