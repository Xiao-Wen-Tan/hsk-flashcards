// One study session as a list of cards. The state is never changed in place. Every
// function returns a new state, so Undo only needs to keep the previous one.
//
// Card types:
//   review  a scheduled review ({ quiz: 'listen' | 'pinyin' | 'recall' }, from quizForReview)
//   reask   a missed review asked again 4 cards later, always as a recall card. It is
//           not a scheduled review, so it changes neither reps nor lastGrade.
//   learn   a new word's learning card (no answer, the learner taps Next)
//   check   listen-then-pick-meaning check of a new word inside its group of 4
//   final   meaning-then-pick-pinyin check of every new word after all groups
//
// Example with 2 due reviews (A, B) and 5 new words (a to e):
//   review A, review B,
//   learn a, learn b, learn c, learn d, check a, check b, check c, check d,
//   learn e, check e,
//   final a, final b, final c, final d, final e
import { CONFIG } from './config.js';
import { FAIL, PASS, failedLessonProgress, learnedProgress, quizForReview, review } from './srs.js';

const MC_GRADES = new Set(['right', 'wrong']);
const RECALL_GRADES = new Set(['know', 'unsure', 'dontknow']);

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function createSession(plan, progressById) {
  const cards = plan.reviews.map((id) => ({ type: 'review', id, quiz: quizForReview(progressById.get(id)) }));
  const lesson = {};
  chunk(plan.newWords, CONFIG.groupSize).forEach((ids, group) => {
    for (const id of ids) {
      cards.push({ type: 'learn', id, group });
      lesson[id] = { group, checkMisses: 0, finalMisses: 0, result: null };
    }
    for (const id of ids) cards.push({ type: 'check', id, quiz: 'listen', group, retry: 0 });
  });
  for (const id of plan.newWords) cards.push({ type: 'final', id, quiz: 'pinyin', retry: 0 });
  return {
    day: plan.day,
    cards,
    pos: 0,
    lesson,
    reasks: {},
    tally: { reviews: 0, firstRight: 0, learned: 0, failed: 0 },
    prev: null,
  };
}

export function currentCard(state) {
  return state.cards[state.pos] ?? null;
}

export function isFinished(state) {
  return state.pos >= state.cards.length;
}

// Leave a learning card. Undo still returns to the last answered question.
export function advance(state) {
  const card = currentCard(state);
  if (!card || card.type !== 'learn') throw new Error('The current card is not a learning card');
  return { ...state, pos: state.pos + 1 };
}

function checkGrade(card, grade) {
  const allowed = card.quiz === 'recall' ? RECALL_GRADES : MC_GRADES;
  if (!allowed.has(grade)) throw new Error(`Grade ${grade} does not fit a ${card.quiz} card`);
}

// A missed review comes back as the 4th card after this one, at most 3 times.
function queueReask(next, id) {
  const count = next.reasks[id] ?? 0;
  if (count >= CONFIG.maxReasks) return;
  next.reasks[id] = count + 1;
  const at = Math.min(next.pos + CONFIG.reaskGap, next.cards.length);
  next.cards.splice(at, 0, { type: 'reask', id, quiz: 'recall', retry: count + 1 });
}

// Just after the last check card of the group (its end), including earlier retries.
function groupEnd(cards, group) {
  for (let i = cards.length - 1; i >= 0; i--) {
    if (cards[i].type === 'check' && cards[i].group === group) return i + 1;
  }
  return cards.length;
}

function removeFinal(next, id) {
  const i = next.cards.findIndex((c, k) => k > next.pos && c.type === 'final' && c.id === id);
  if (i >= 0) next.cards.splice(i, 1);
}

// Answer the current question. Returns the new state, the word's new progress record
// (null when the schedule does not change) and the event to log.
export function answerCard(state, grade, progressById) {
  const card = currentCard(state);
  if (!card || card.type === 'learn') throw new Error('The current card has no question');
  checkGrade(card, grade);
  const next = {
    ...state,
    cards: state.cards.slice(),
    lesson: { ...state.lesson },
    reasks: { ...state.reasks },
    tally: { ...state.tally },
    prev: { ...state, prev: null },
  };
  const { id } = card;
  const day = state.day;
  const pass = PASS.has(grade);
  let progress = null;
  let outcome = null;

  if (card.type === 'review') {
    progress = review(progressById.get(id), grade, day);
    next.tally.reviews += 1;
    if (pass) next.tally.firstRight += 1;
    if (FAIL.has(grade)) queueReask(next, id);
  } else if (card.type === 'reask') {
    if (!pass) queueReask(next, id);
  } else {
    const L = { ...next.lesson[id] };
    next.lesson[id] = L;
    const missKey = card.type === 'check' ? 'checkMisses' : 'finalMisses';
    if (pass && card.type === 'final') {
      progress = learnedProgress(id, day);
      outcome = 'learned';
      L.result = outcome;
      next.tally.learned += 1;
    } else if (!pass && L[missKey] < CONFIG.lessonMaxRetries) {
      L[missKey] += 1;
      const retry = { ...card, retry: L[missKey] };
      next.cards.splice(card.type === 'check' ? groupEnd(next.cards, card.group) : next.cards.length, 0, retry);
    } else if (!pass) {
      progress = failedLessonProgress(id, day);
      outcome = 'failed';
      L.result = outcome;
      next.tally.failed += 1;
      removeFinal(next, id);
    }
  }
  next.pos += 1;
  const event = { day, kind: card.type, id, quiz: card.quiz, grade, first: card.type === 'review', outcome };
  return { state: next, progress, event };
}

export function canUndo(state) {
  return state.prev !== null;
}

// The state just before the last answer.
export function undoAnswer(state) {
  if (!state.prev) throw new Error('Nothing to undo');
  return state.prev;
}

export function sessionSummary(state) {
  const { reviews, firstRight, learned, failed } = state.tally;
  return {
    reviews,
    firstRight,
    learned,
    failed,
    perfect: reviews >= CONFIG.perfectMinReviews && firstRight === reviews,
  };
}
