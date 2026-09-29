// Plans one study day. It picks the due reviews to ask (most overdue first, up to the cap)
// and how many new words to teach (fewer when reviews pile up). The quiz type of each
// review is chosen by quizForReview in srs.js, when session.js builds the cards.
import { daysBetween } from './dates.js';
import { intervalFor } from './srs.js';
import { nextNewWords } from './curriculum.js';

// New words for the day, given how many reviews were due in total.
// With the default cap of 100 and 12 new words, 100 due reviews give 12 new words,
// 101 to 200 give 6, and 201 or more give 0.
export function newQuota(backlog, cap, perDay) {
  if (backlog <= cap) return perDay;
  if (backlog <= 2 * cap) return Math.floor(perDay / 2);
  return 0;
}

// Most overdue first, measured as days overdue divided by the word's gap, so a word
// 3 days late on a 2-day gap (1.5) comes before one 10 days late on a 30-day gap (0.33).
// Ties go to the lower step, then the earlier due day, then the ID.
export function sortDue(due, today) {
  const ratio = (p) => daysBetween(p.due, today) / intervalFor(p.step);
  return due.slice().sort((a, b) => ratio(b) - ratio(a) || a.step - b.step
    || a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
}

// The plan for `today`. It also works for a second session on the same day, because it
// counts the reviews and lessons already done today.
export function planDay({ words, progress, today, settings }) {
  const { reviewCap, newPerDay } = settings;
  const progressById = new Map(progress.map((p) => [p.id, p]));
  const reviewsDone = progress.filter((p) => p.lastReview === today).length;
  const newDone = progress.filter((p) => p.lessonDay === today).length;
  const due = sortDue(progress.filter((p) => p.step >= 1 && p.due <= today), today);
  const backlog = due.length + reviewsDone;
  const quota = newQuota(backlog, reviewCap, newPerDay);
  return {
    day: today,
    reviews: due.slice(0, Math.max(0, reviewCap - reviewsDone)).map((p) => p.id),
    newWords: nextNewWords(words, progressById, Math.max(0, quota - newDone), today),
    backlog,
    quota,
    reviewsDone,
    newDone,
  };
}

// The day can be checked in when no capped reviews and no new words are left.
export function isDayDone(plan) {
  return plan.reviews.length === 0 && plan.newWords.length === 0;
}
