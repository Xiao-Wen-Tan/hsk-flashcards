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

  // Badge steps (badges.js BADGE_GROUPS). The spec of 2026-10-03 added streaks of 3, 14, 60 and
  // 200 days, 10, 25, 250 and 4000 words, and the perfect-day, review and minute badges.
  badges: Object.freeze({
    streak: Object.freeze([3, 7, 14, 30, 60, 100, 200, 365]),
    checkIns: Object.freeze([10, 50, 200]),
    learned: Object.freeze([10, 25, 50, 100, 250, 500, 1000, 2000, 3000, 4000]),
    mastered: Object.freeze([100, 500, 1000, 2500]),
    perfectDays: Object.freeze([1, 7, 30]),
    reviews: Object.freeze([100, 1000, 5000, 10000]),
    minutes: Object.freeze([60, 300, 1000, 3000]),
    spoken: Object.freeze([10, 50, 100, 500, 1000]), // words spoken well (speaking practice spec)
  }),

  statsDays: Object.freeze({ forecast: 7, accuracy: 7 }),

  // The tone check of the speaking panel (tones.js, speaking practice spec of 2026-10-03).
  speak: Object.freeze({
    levelWeight: 0.5, // how much a syllable's height counts next to its shape
    // How far the last syllable of a word must fall to count as a 4th tone, in voice ranges
    // (tones.js). An earlier 4th tone is often said short and nearly level, so it is not held to it.
    minFall: 0.15,
    // The dip in loudness, in decibels, needed to split a two-syllable word said in one voiced
    // stretch (tones.js), so that a word said as one syllable is not heard as two.
    minDip: 0.5,
    voiceKeep: 0.98, // older recordings count this much less with each new one
    voiceRecordings: 5, // recordings needed before the height of the learner's voice is trusted
    // The learner setting "Speaking check". margin is how much farther the expected tone may be
    // than the nearest tone (toneScores), and share is the part of the judged syllables of a
    // word that must be right.
    strictness: Object.freeze({
      gentle: Object.freeze({ margin: 0.04, share: 0.6 }),
      normal: Object.freeze({ margin: 0.02, share: 1 }),
      strict: Object.freeze({ margin: 0, share: 1 }),
    }),
  }),

  // Rough seconds per card, used only to print an estimated daily time in the simulation test.
  secondsPerCard: Object.freeze({ review: 8, reask: 6, learn: 20, check: 8, final: 8 }),
});

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// How strictly the speaking panel checks the tones (learner setting, CONFIG.speak.strictness).
export const STRICTNESS = Object.freeze(['gentle', 'normal', 'strict']);

// Fill in missing learner settings and keep them inside their allowed range.
// For example, normalizeSettings({ newPerDay: 50 }) gives
// { reviewCap: 100, newPerDay: 30, speakStrictness: 'normal' }.
export function normalizeSettings(raw = {}) {
  const s = raw ?? {};
  return {
    ...s,
    reviewCap: clampInt(s.reviewCap, CONFIG.reviewCapMin, CONFIG.reviewCapMax, CONFIG.reviewCap),
    newPerDay: clampInt(s.newPerDay, CONFIG.newPerDayMin, CONFIG.newPerDayMax, CONFIG.newPerDay),
    speakStrictness: STRICTNESS.includes(s.speakStrictness) ? s.speakStrictness : 'normal',
  };
}
