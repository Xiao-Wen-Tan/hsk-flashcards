// What a session card shows before it is answered, and how a tap is graded.
// It never touches the page, so Node can test it.
import { buildChoices } from '../distractors.js';
import { AUDIO_BASE } from './card.js';

export const HEADINGS = Object.freeze({
  review: 'Review', reask: 'Once more', learn: 'New word', check: 'Quick check', final: 'Final check',
});

export const RECALL_GRADES = Object.freeze([
  { grade: 'know', label: 'Know it' },
  { grade: 'unsure', label: 'Unsure' },
  { grade: 'dontknow', label: "Don't know" },
]);

// The question for one card of the session (a card from Plan 2's session.js).
// step is the word's ladder step before this answer (0 for a new word), which
// buildChoices needs, because a tone-variant choice appears only from step 2.
// For example, the review card { type: 'review', id: 'w0026', quiz: 'listen' } of 苹果 gives
//   { kind: 'listen', heading: 'Review', hz: null, sound: 'audio/w/w0026_6ce06b7e.mp3',
//     prompt: 'Listen, then pick the meaning', choices: [4 English meanings], answerIndex }.
// The listening question hides the characters (hz: null), so the learner has to listen.
// They appear on the learning card after the answer (the user's decision of 2026-09-28).
export function questionView({ card, word, pool, day, step }) {
  const heading = HEADINGS[card.type];
  const sound = AUDIO_BASE + word.au;
  if (card.type === 'learn') return { kind: 'learn', heading };
  if (card.quiz === 'recall') {
    return { kind: 'recall', heading, hz: word.hz, py: word.py, sound, prompt: 'Do you know this word?', grades: RECALL_GRADES };
  }
  const { choices, answerIndex } = buildChoices(pool, word, card.quiz, { day, step });
  const texts = choices.map((c) => c.text);
  if (card.quiz === 'listen') {
    return { kind: 'listen', heading, hz: null, sound, prompt: 'Listen, then pick the meaning', choices: texts, answerIndex };
  }
  return { kind: 'pinyin', heading, hz: word.hz, en: word.en, sound: null, prompt: 'Pick the pinyin', choices: texts, answerIndex };
}

// The grade Plan 2's Study.answer expects for a tap on choice `index`.
export function gradeFor(view, index) {
  return index === view.answerIndex ? 'right' : 'wrong';
}

// The banner above the learning card after a multiple-choice answer.
export function feedbackFor(view, index) {
  const right = index === view.answerIndex;
  return {
    right,
    picked: index,
    answerIndex: view.answerIndex,
    message: right ? 'Right!' : `Not quite. The answer is "${view.choices[view.answerIndex]}".`,
  };
}

// '3 / 17' for the session header. Re-asks and retries make the total grow.
export function progressLabel(state) {
  const total = state.cards.length;
  return `${Math.min(state.pos + 1, total)} / ${total}`;
}
