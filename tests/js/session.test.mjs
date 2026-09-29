import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advance, answerCard, canUndo, createSession, currentCard, isFinished, sessionSummary, undoAnswer,
} from '../../docs/js/session.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const DAY = '2026-10-20';
const id = (hz) => word(data, hz).id;
const REVIEWS = ['一', '二', '三', '四', '五', '六'].map(id);
const NEW = ['爸爸', '妈妈', '儿子', '女儿', '朋友'].map(id);

function progressMap(ids, step = 1) {
  return new Map(ids.map((w) => [w, { ...learnedProgress(w, '2026-10-01'), step, due: DAY }]));
}

const show = (state) => state.cards.map((c) => `${c.type}:${data.words.find((w) => w.id === c.id).hz}`);

// Answers every card. Learning cards are passed with Next, and questions get grade(card).
function play(state, progress, grade) {
  const events = [];
  while (!isFinished(state)) {
    const card = currentCard(state);
    if (card.type === 'learn') { state = advance(state); continue; }
    const out = answerCard(state, grade(card), progress);
    if (out.progress) progress.set(out.progress.id, out.progress);
    events.push(out.event);
    state = out.state;
  }
  return { state, events };
}
const allRight = (card) => (card.quiz === 'recall' ? 'know' : 'right');

test('reviews come first, then groups of 4 with learn and check cards, then final checks', () => {
  const s = createSession({ day: DAY, reviews: REVIEWS.slice(0, 2), newWords: NEW }, progressMap(REVIEWS));
  assert.deepEqual(show(s), [
    'review:一', 'review:二',
    'learn:爸爸', 'learn:妈妈', 'learn:儿子', 'learn:女儿',
    'check:爸爸', 'check:妈妈', 'check:儿子', 'check:女儿',
    'learn:朋友', 'check:朋友',
    'final:爸爸', 'final:妈妈', 'final:儿子', 'final:女儿', 'final:朋友',
  ]);
  assert.equal(s.cards[0].quiz, 'listen');
  assert.equal(s.cards[6].quiz, 'listen');
  assert.equal(s.cards[12].quiz, 'pinyin');
});

test('a missed review comes back 4 cards later as a recall card', () => {
  const progress = progressMap(REVIEWS, 3);
  let s = createSession({ day: DAY, reviews: REVIEWS, newWords: [] }, progress);
  const out = answerCard(s, s.cards[0].quiz === 'recall' ? 'dontknow' : 'wrong', progress);
  s = out.state;
  assert.equal(out.progress.step, 1);
  assert.equal(out.progress.due, '2026-10-21');
  assert.deepEqual(out.event, { day: DAY, kind: 'review', id: REVIEWS[0], quiz: out.event.quiz,
    grade: out.event.grade, first: true, outcome: null });
  assert.deepEqual(show(s), ['review:一', 'review:二', 'review:三', 'review:四', 'reask:一', 'review:五', 'review:六']);
  assert.equal(s.cards[4].quiz, 'recall');
});

test('re-asks stop after a right answer, and never exceed 3', () => {
  const progress = progressMap(REVIEWS, 1);
  const first = createSession({ day: DAY, reviews: REVIEWS, newWords: [] }, progress);
  const wrongOne = (card) => (card.id === REVIEWS[0] ? (card.quiz === 'recall' ? 'dontknow' : 'wrong') : allRight(card));
  const { state, events } = play(first, progress, wrongOne);
  assert.equal(state.cards.filter((c) => c.type === 'reask').length, 3);
  assert.equal(events.filter((e) => e.kind === 'reask').length, 3);
  assert.ok(events.filter((e) => e.kind === 'reask').every((e) => e.first === false));
  assert.equal(progress.get(REVIEWS[0]).step, 1);
  assert.equal(progress.get(REVIEWS[0]).due, '2026-10-21');
  assert.equal(progress.get(REVIEWS[0]).reps, 1); // the 3 re-asks are not scheduled reviews

  const rightOnReask = (card) => (card.id === REVIEWS[0] && card.type === 'review' ? 'wrong' : allRight(card));
  const progress2 = progressMap(REVIEWS, 1);
  const again = play(createSession({ day: DAY, reviews: REVIEWS, newWords: [] }, progress2), progress2, rightOnReask);
  assert.equal(again.state.cards.filter((c) => c.type === 'reask').length, 1);
  assert.equal(progress2.get(REVIEWS[0]).lastGrade, 'wrong'); // a right re-ask does not change it
});

test('the next session asks a word missed last time as a recall card', () => {
  const progress = progressMap(REVIEWS, 1);
  const wrongFirst = (card) => (card.id === REVIEWS[0] && card.type === 'review' ? 'wrong' : allRight(card));
  play(createSession({ day: DAY, reviews: REVIEWS, newWords: [] }, progress), progress, wrongFirst);
  const next = createSession({ day: '2026-10-21', reviews: [REVIEWS[0]], newWords: [] }, progress);
  assert.deepEqual([next.cards[0].type, next.cards[0].quiz], ['review', 'recall']);
});

test('a re-ask near the end of the reviews may fall among the new-word cards', () => {
  const progress = progressMap(REVIEWS, 1);
  const s = createSession({ day: DAY, reviews: REVIEWS.slice(0, 1), newWords: NEW }, progress);
  const { state } = answerCard(s, 'wrong', progress);
  assert.deepEqual(show(state).slice(0, 6), ['review:一', 'learn:爸爸', 'learn:妈妈', 'learn:儿子', 'reask:一', 'learn:女儿']);
});

test('Unsure on a recall review keeps the step and is not re-asked', () => {
  const progress = new Map([[REVIEWS[0], { ...learnedProgress(REVIEWS[0], '2026-10-01'), step: 3, reps: 3, due: DAY }]]);
  const s = createSession({ day: DAY, reviews: [REVIEWS[0]], newWords: [] }, progress);
  assert.equal(s.cards[0].quiz, 'recall');
  const out = answerCard(s, 'unsure', progress);
  assert.equal(out.progress.step, 3);
  assert.equal(out.progress.due, '2026-10-22');
  assert.equal(out.state.cards.length, 1);
});

test('grades must fit the card', () => {
  const progress = new Map([[REVIEWS[0], { ...learnedProgress(REVIEWS[0], '2026-10-01'), step: 3, reps: 3, due: DAY }]]);
  const s = createSession({ day: DAY, reviews: [REVIEWS[0]], newWords: NEW.slice(0, 1) }, progress);
  assert.throws(() => answerCard(s, 'right', progress), /does not fit/);
  const s2 = answerCard(s, 'know', progress).state;
  assert.throws(() => answerCard(s2, 'right', progress), /no question/);
  assert.throws(() => advance(s), /not a learning card/);
});

test('new words that pass both checks are learned at step 1 and due tomorrow', () => {
  const progress = new Map();
  const { state, events } = play(createSession({ day: DAY, reviews: [], newWords: NEW }, progress), progress, allRight);
  for (const w of NEW) {
    assert.deepEqual(progress.get(w), learnedProgress(w, DAY));
    assert.equal(progress.get(w).due, '2026-10-21');
  }
  assert.equal(events.filter((e) => e.outcome === 'learned').length, 5);
  assert.deepEqual(sessionSummary(state), { reviews: 0, firstRight: 0, learned: 5, failed: 0, perfect: false });
});

test('a missed group check is shown again at the end of its group', () => {
  const progress = new Map();
  let s = createSession({ day: DAY, reviews: [], newWords: NEW }, progress);
  for (let i = 0; i < 4; i++) s = advance(s);
  s = answerCard(s, 'right', progress).state; // 爸爸
  s = answerCard(s, 'wrong', progress).state; // 妈妈 missed
  assert.deepEqual(show(s).slice(4, 11), ['check:爸爸', 'check:妈妈', 'check:儿子', 'check:女儿', 'check:妈妈', 'learn:朋友', 'check:朋友']);
  assert.equal(s.cards[8].retry, 1);
});

test('a word that misses its group check 4 times fails, with no final check and step 0', () => {
  const progress = new Map();
  const failMama = (card) => (card.id === NEW[1] && card.type === 'check' ? 'wrong' : 'right');
  const { state, events } = play(createSession({ day: DAY, reviews: [], newWords: NEW }, progress), progress, failMama);
  assert.equal(state.cards.filter((c) => c.type === 'check' && c.id === NEW[1]).length, 4);
  assert.ok(!state.cards.some((c) => c.type === 'final' && c.id === NEW[1]));
  assert.equal(progress.get(NEW[1]).step, 0);
  assert.equal(progress.get(NEW[1]).lessonDay, DAY);
  assert.equal(events.filter((e) => e.outcome === 'failed').length, 1);
  assert.equal(sessionSummary(state).learned, 4);
});

test('a missed final check is asked again at the end, and passing it still counts', () => {
  const progress = new Map();
  let missed = false;
  const missOnce = (card) => {
    if (card.type === 'final' && card.id === NEW[0] && !missed) { missed = true; return 'wrong'; }
    return 'right';
  };
  const { state } = play(createSession({ day: DAY, reviews: [], newWords: NEW }, progress), progress, missOnce);
  const last = state.cards[state.cards.length - 1];
  assert.deepEqual([last.type, last.id, last.retry], ['final', NEW[0], 1]);
  assert.equal(progress.get(NEW[0]).step, 1);
});

test('Undo returns to the question before the last answer, once', () => {
  const progress = progressMap(REVIEWS, 1);
  const s0 = createSession({ day: DAY, reviews: REVIEWS.slice(0, 1), newWords: NEW.slice(0, 1) }, progress);
  assert.ok(!canUndo(s0));
  const s1 = answerCard(s0, 'wrong', progress).state;
  assert.ok(canUndo(s1));
  const s2 = advance(s1); // leave the learning card
  const back = undoAnswer(s2);
  assert.deepEqual(back, s0);
  assert.ok(!canUndo(back));
  assert.throws(() => undoAnswer(back), /Nothing to undo/);
});

test('a perfect session needs 30 or more reviews, all right first time', () => {
  const ids = data.words.slice(0, 30).map((w) => w.id);
  const progress = progressMap(ids, 1);
  const perfect = play(createSession({ day: DAY, reviews: ids, newWords: [] }, progress), progressMap(ids, 1), allRight);
  assert.equal(sessionSummary(perfect.state).perfect, true);
  const short = play(createSession({ day: DAY, reviews: ids.slice(1), newWords: [] }, progress), progressMap(ids, 1), allRight);
  assert.equal(sessionSummary(short.state).perfect, false);
  const oneMiss = (card) => (card.id === ids[5] && card.type === 'review' ? 'wrong' : allRight(card));
  const flawed = play(createSession({ day: DAY, reviews: ids, newWords: [] }, progress), progressMap(ids, 1), oneMiss);
  assert.equal(sessionSummary(flawed.state).perfect, false);
});
