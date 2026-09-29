// The review schedule (spaced repetition). A progress record holds one word's place:
//   { id, step, due, reps, lapses, lastReview, lastGrade, learned, lessonDay }
//   step        0 = lesson not passed yet, 1 to 9 = place on the ladder
//   due         study day of the next review (null at step 0)
//   reps        scheduled reviews answered so far
//   lapses      scheduled reviews answered wrong so far
//   lastReview  study day of the last scheduled review (null before the first)
//   lastGrade   grade of the last scheduled review (null before the first), which
//               decides whether the next review is a recall card
//   learned     study day the word passed its lesson (null at step 0)
//   lessonDay   study day the word's last lesson ended, passed or not
import { CONFIG } from './config.js';
import { addDays } from './dates.js';

export const GRADES = Object.freeze(['right', 'wrong', 'know', 'unsure', 'dontknow']);
export const PASS = new Set(['right', 'know']);
export const FAIL = new Set(['wrong', 'dontknow']);

export function intervalFor(step) {
  return CONFIG.ladder[step - 1];
}

export function isLearned(p) {
  return Boolean(p) && p.step >= 1;
}

export function isMastered(p) {
  return Boolean(p) && p.step >= CONFIG.masteredStep;
}

// A word that passed both lesson checks today goes to step 1 and is due tomorrow.
export function learnedProgress(id, day) {
  return {
    id, step: 1, due: addDays(day, 1), reps: 0, lapses: 0, lastReview: null, lastGrade: null,
    learned: day, lessonDay: day,
  };
}

// A word whose lesson ended today without passing. It is taught again next study day.
export function failedLessonProgress(id, day) {
  return {
    id, step: 0, due: null, reps: 0, lapses: 0, lastReview: null, lastGrade: null,
    learned: null, lessonDay: day,
  };
}

// Apply one scheduled review answer. Only the first answer of a study day counts, so a
// second call on the same day returns the record unchanged.
// For example, step 2 answered 'wrong' on 2026-10-08 gives step 1, due 2026-10-09.
export function review(p, grade, day) {
  if (!GRADES.includes(grade)) throw new Error(`Unknown grade: ${grade}`);
  if (!isLearned(p)) throw new Error(`Word ${p?.id} is not learned yet`);
  if (p.lastReview === day) return p;
  const top = CONFIG.ladder.length;
  let { step, lapses } = p;
  let due;
  if (PASS.has(grade)) {
    step = Math.min(top, step + 1);
    due = addDays(day, intervalFor(step));
  } else if (grade === 'unsure') {
    due = addDays(day, Math.max(1, Math.floor(intervalFor(step) / 2)));
  } else {
    step = Math.max(1, step - CONFIG.wrongDrop);
    due = addDays(day, 1);
    lapses += 1;
  }
  return { ...p, step, due, reps: p.reps + 1, lapses, lastReview: day, lastGrade: grade };
}

// The quiz type of a word's next scheduled review, as the design's "Which quiz a review
// uses" (decided by the user on 2026-09-28) sets it:
// 1. If the previous scheduled review was answered wrong ('wrong' or 'dontknow'), it is
//    'recall'. 'unsure' is not a wrong answer.
// 2. Otherwise a word at step 1 gets 'listen' and a word at step 2 gets 'pinyin'.
// 3. From step 3 on the three types take turns by the number of earlier scheduled
//    reviews (reps): 0, 3, 6... give 'recall', 1, 4, 7... give 'listen', and 2, 5, 8...
//    give 'pinyin'. For example, 苹果 at step 3 with 4 earlier reviews gets 'listen'.
// Re-asks inside a session are always recall cards (session.js). They never call
// review(), so they do not count in reps and do not change lastGrade.
export function quizForReview(p) {
  if (FAIL.has(p.lastGrade)) return 'recall';
  if (p.step === 1) return 'listen';
  if (p.step === 2) return 'pinyin';
  return ['recall', 'listen', 'pinyin'][p.reps % 3];
}
