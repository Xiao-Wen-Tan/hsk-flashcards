// Every tunable number of the app logic lives here, so a change is made in one place.
// Values marked "learner setting" are defaults that the Settings screen (Plan 4) can change.

export const CONFIG = Object.freeze({
  dayStartHour: 4, // a new study day starts at 04:00 local time

  // Days until the next review for steps 1 to 9 (the forgetting-curve ladder).
  ladder: Object.freeze([1, 2, 4, 7, 15, 30, 60, 120, 240]),
  masteredStep: 7, // a word at step 7 or above counts as mastered
  wrongDrop: 2, // a wrong answer drops the word this many steps (never below step 1)

  reviewCap: 100, // most reviews in one study day (learner setting)
  reviewCapMin: 20,
  reviewCapMax: 300,
  newPerDay: 12, // new words per study day (learner setting)
  newPerDayMin: 4,
  newPerDayMax: 30,

  groupSize: 4, // new words are taught in groups of this size
  reaskGap: 4, // a missed review comes back this many cards later
  maxReasks: 3, // at most this many re-asks of a missed review in one session
  lessonMaxRetries: 3, // at most this many re-asks of a missed new-word check

  wrongChoices: 3, // wrong choices in a multiple-choice quiz
  toneVariantChance: 0.5, // chance that one pinyin choice is a tone variant, from step 2 on

  perfectMinReviews: 30, // a perfect session needs at least this many reviews

  badges: Object.freeze({
    streak: Object.freeze([7, 30, 100, 365]),
    checkIns: Object.freeze([10, 50, 200]),
    learned: Object.freeze([50, 100, 500, 1000, 2000, 3000]),
    mastered: Object.freeze([100, 500, 1000, 2500]),
  }),

  statsDays: Object.freeze({ activity: 30, forecast: 7, accuracy: 7 }),

  // Rough seconds per card, used only to print an estimated daily time in the simulation test.
  secondsPerCard: Object.freeze({ review: 8, reask: 6, learn: 20, check: 8, final: 8 }),
});

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Fill in missing learner settings and keep them inside their allowed range.
// For example, normalizeSettings({ newPerDay: 50 }) gives { reviewCap: 100, newPerDay: 30 }.
export function normalizeSettings(raw = {}) {
  const s = raw ?? {};
  return {
    ...s,
    reviewCap: clampInt(s.reviewCap, CONFIG.reviewCapMin, CONFIG.reviewCapMax, CONFIG.reviewCap),
    newPerDay: clampInt(s.newPerDay, CONFIG.newPerDayMin, CONFIG.newPerDayMax, CONFIG.newPerDay),
  };
}
