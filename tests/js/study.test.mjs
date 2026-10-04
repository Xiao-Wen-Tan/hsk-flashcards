import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Study, canContinue, previewDay } from '../../docs/js/study.js';
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress, quizForReview } from '../../docs/js/srs.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
const right = (card) => (card.quiz === 'recall' ? 'know' : 'right');

// Plays a whole session, answering with grade(card). Returns the finish() result.
async function playDay(store, day, grade = right, hour = 9) {
  const study = await Study.start({ store, data, now: localDate(day, hour) });
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(grade(study.card), localDate(day, hour));
  }
  return study.finish(localDate(day, hour));
}

test('on day 1, 12 new words in 3 groups are all learned and the day is checked in', async () => {
  const store = new MemoryStore();
  const preview = await previewDay({ store, data, now: localDate('2026-10-05') });
  assert.equal(preview.reviews.length, 0);
  assert.equal(preview.newWords.length, 12);
  const result = await playDay(store, '2026-10-05');
  assert.equal(result.checkedIn, true);
  assert.equal(result.justCheckedIn, true);
  assert.equal(result.streak, 1);
  assert.equal(result.summary.learned, 12);
  const progress = await store.allProgress();
  assert.equal(progress.length, 12);
  assert.ok(progress.every((p) => p.step === 1 && p.due === '2026-10-06'));
  assert.deepEqual((await store.allDays()).map((d) => [d.day, d.newWords]), [['2026-10-05', 12]]);
});

test('on day 2, yesterday\'s 12 words come back as listening reviews before 12 new words', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const study = await Study.start({ store, data, now: localDate('2026-10-06') });
  assert.equal(study.plan.reviews.length, 12);
  assert.equal(study.plan.newWords.length, 12);
  assert.ok(study.state.cards.slice(0, 12).every((c) => c.type === 'review' && c.quiz === 'listen'));
  assert.equal(study.state.cards[12].type, 'learn');
});

test('a session at 02:00 counts for the day before', async () => {
  const store = new MemoryStore();
  const study = await Study.start({ store, data, now: localDate('2026-10-06', 2) });
  assert.equal(study.day, '2026-10-05');
});

test('the learner\'s new-word setting is used', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 8 } }, event: { day: '2026-10-05', kind: 'settings' } });
  assert.equal((await previewDay({ store, data, now: localDate('2026-10-05') })).newWords.length, 8);
});

test('leaving early does not check in, and the streak still shows yesterday', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const study = await Study.start({ store, data, now: localDate('2026-10-06') });
  await study.answer('right', localDate('2026-10-06'));
  const result = await study.finish(localDate('2026-10-06'));
  assert.equal(result.checkedIn, false);
  assert.equal(result.streak, 1);
  assert.equal(result.left.reviews.length, 11);
});

test('Undo of a review puts the word back and logs an undo event', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const study = await Study.start({ store, data, now: localDate('2026-10-06') });
  const id = study.card.id;
  const before = await store.getProgress(id);
  const { seq } = await study.answer('wrong', localDate('2026-10-06'));
  assert.equal(study.state.cards.filter((c) => c.type === 'reask').length, 1);
  assert.ok(study.canUndo);
  await study.undo(localDate('2026-10-06'));
  assert.deepEqual(await store.getProgress(id), before);
  assert.equal(study.card.id, id);
  assert.equal(study.state.cards.filter((c) => c.type === 'reask').length, 0);
  const last = (await store.eventsSince(0)).at(-1);
  assert.deepEqual([last.kind, last.target, last.id], ['undo', seq, id]);
  assert.ok(!study.canUndo);
  await study.answer('right', localDate('2026-10-06'));
  assert.equal((await store.getProgress(id)).step, 2);
});

test('a review answered wrong comes back next time as a recall card, unless Undo takes it back', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  // On 6 October the first review is answered wrong, and every other card right.
  const study = await Study.start({ store, data, now: localDate('2026-10-06') });
  const id = study.card.id;
  await study.answer('wrong', localDate('2026-10-06'));
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(right(study.card), localDate('2026-10-06'));
  }
  await study.finish(localDate('2026-10-06'));
  const p = await store.getProgress(id);
  assert.deepEqual([p.step, p.due, p.reps, p.lastGrade], [1, '2026-10-07', 1, 'wrong']);
  // On 7 October only that word is due, and it is asked as a recall card.
  const day3 = await Study.start({ store, data, now: localDate('2026-10-07') });
  assert.deepEqual([day3.card.type, day3.card.id, day3.card.quiz], ['review', id, 'recall']);

  // With Undo, the wrong answer leaves no trace, so the next review is a pinyin card at step 2.
  const store2 = new MemoryStore();
  await playDay(store2, '2026-10-05');
  const study2 = await Study.start({ store: store2, data, now: localDate('2026-10-06') });
  await study2.answer('wrong', localDate('2026-10-06'));
  await study2.undo(localDate('2026-10-06'));
  await study2.answer('right', localDate('2026-10-06'));
  const p2 = await store2.getProgress(id);
  assert.deepEqual([p2.step, p2.lastGrade, quizForReview(p2)], [2, 'right', 'pinyin']);
});

test('Undo of the answer that taught a word removes its new record', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 4 } }, event: { day: '2026-10-05', kind: 'settings' } });
  const study = await Study.start({ store, data, now: localDate('2026-10-05') });
  while (!(study.card.type === 'final' && study.state.pos === study.state.cards.length - 1)) {
    if (study.card.type === 'learn') study.next();
    else await study.answer('right');
  }
  const id = study.card.id;
  await study.answer('right');
  assert.equal((await store.getProgress(id)).step, 1);
  await study.undo();
  assert.equal(await store.getProgress(id), undefined);
});

test('a finished theme earns its badge once', async () => {
  const store = new MemoryStore();
  const first = await playDay(store, '2026-10-05'); // words 1 to 12, all 12 of the Starter Kit
  assert.deepEqual(first.newBadges, ['theme-t01']);
  const second = await playDay(store, '2026-10-06'); // words 13 to 24, and Greetings ends at 22
  assert.deepEqual(second.newBadges, ['theme-t02']);
  assert.deepEqual(await store.getMeta('badges'), { 'theme-t01': '2026-10-05', 'theme-t02': '2026-10-06' });
});

test('learning the last HSK 1 and 2 words earns the theme badge and the HSK 1-2 badge', async () => {
  const store = new MemoryStore();
  const early = data.words.filter((w) => w.theme !== 't05'); // all but Food & Drink, the last 15 words
  const seeded = early.map((w) => ({ ...learnedProgress(w.id, '2026-10-01'), due: '2026-12-01' }));
  const before = Object.fromEntries(['learned-50', 'theme-t01', 'theme-t02', 'theme-t03', 'theme-t04'].map((id) => [id, '2026-10-04']));
  await store.commit({ progress: seeded, meta: { settings: { newPerDay: 15 }, badges: before }, event: { day: '2026-10-04', kind: 'settings' } });
  const result = await playDay(store, '2026-10-05');
  assert.equal(result.summary.learned, 15);
  assert.deepEqual(result.newBadges, ['learned-all', 'theme-t05', 'hsk-1-2']);
});

test('30 reviews all right first time earn the perfect-session badge', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 30 } }, event: { day: '2026-10-05', kind: 'settings' } });
  await playDay(store, '2026-10-05');
  const day2 = await playDay(store, '2026-10-06');
  assert.equal(day2.summary.reviews, 30);
  assert.ok(day2.newBadges.includes('perfect'));
});

test('a missed day resets the streak', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  assert.equal((await playDay(store, '2026-10-06')).streak, 2);
  assert.equal((await playDay(store, '2026-10-08')).streak, 1);
});

// Works through a session until stop(card) is true, answering every question right.
async function playUntil(study, now, stop) {
  while (!study.finished && !stop(study.card)) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(right(study.card), now);
  }
}

test('stopping during the new words and starting again continues after the last answer', async () => {
  // The bug of 3 October: a new word is saved only at its final check, so a stopped session
  // used to start again from the first learning card.
  const store = new MemoryStore();
  const now = localDate('2026-10-05');
  const study = await Study.start({ store, data, now });
  // The 8 learning cards and 8 checks of the first two groups, then the third group's
  // learning cards, then Stop.
  await playUntil(study, now, (c) => c.type === 'check' && c.group === 2);
  const { cards } = study.state;
  await study.finish(now);
  assert.equal(await canContinue({ store, data, now: localDate('2026-10-05', 11) }), true);
  const again = await Study.start({ store, data, now: localDate('2026-10-05', 11) });
  // The last answer was the 16th card, so the third group's learning cards show again.
  assert.equal(again.state.pos, 16);
  assert.deepEqual(again.state.cards, cards);
  assert.deepEqual([again.card.type, again.card.group], ['learn', 2]);
  assert.deepEqual(again.plan.newWords, study.plan.newWords);
  assert.equal(again.canUndo, false);
  await playUntil(again, now, () => false);
  const result = await again.finish(now);
  assert.equal(result.checkedIn, true);
  assert.equal(result.summary.learned, 12);
  assert.equal((await store.allProgress()).filter((p) => p.step === 1).length, 12);
  assert.equal(await canContinue({ store, data, now }), false);
});

test('a stopped review session continues with its re-asks', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const now = localDate('2026-10-06');
  const study = await Study.start({ store, data, now });
  await study.answer('wrong', now);
  await study.answer(right(study.card), now);
  await study.finish(now);
  const again = await Study.start({ store, data, now });
  assert.equal(again.state.pos, 2);
  assert.equal(again.state.cards.filter((c) => c.type === 'reask').length, 1);
  assert.equal(again.plan.reviews.length, 10);
});

test('a session stopped yesterday is not continued', async () => {
  const store = new MemoryStore();
  const now = localDate('2026-10-05');
  const study = await Study.start({ store, data, now });
  await playUntil(study, now, (c) => c.type === 'check' && c.group === 2);
  await study.finish(now);
  assert.equal(await canContinue({ store, data, now: localDate('2026-10-06') }), false);
  const next = await Study.start({ store, data, now: localDate('2026-10-06') });
  assert.equal(next.day, '2026-10-06');
  assert.equal(next.state.pos, 0);
  assert.deepEqual(next.plan.newWords, study.plan.newWords);
});

test('a finished session is not continued', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  assert.equal(await canContinue({ store, data, now: localDate('2026-10-05', 11) }), false);
  const again = await Study.start({ store, data, now: localDate('2026-10-05', 11) });
  assert.equal(again.state.cards.length, 0);
});

test('Undo saves the session too, so starting again shows the card that was taken back', async () => {
  const store = new MemoryStore();
  const now = localDate('2026-10-05');
  const study = await Study.start({ store, data, now });
  await playUntil(study, now, (c) => c.type === 'check');
  const id = study.card.id;
  await study.answer('right', now);
  await study.answer('right', now);
  await study.undo(now);
  const again = await Study.start({ store, data, now });
  assert.equal(again.state.pos, 5);
  assert.deepEqual([again.card.type, again.state.cards[4].id], ['check', id]);
});

test('a stopped session is not continued after the daily amounts were lowered', async () => {
  // Stopped after the first group, then new words per day lowered from 12 to 4: Today plans 4
  // new words, so Start must teach those 4, not the 12 of the stopped session.
  const store = new MemoryStore();
  const now = localDate('2026-10-05');
  const study = await Study.start({ store, data, now });
  await playUntil(study, now, (c) => c.type === 'learn' && c.group === 1);
  await study.finish(now);
  await store.commit({ meta: { settings: { newPerDay: 4 } }, event: { day: '2026-10-05', kind: 'settings' } });
  assert.equal(await canContinue({ store, data, now }), false);
  const again = await Study.start({ store, data, now });
  assert.equal(again.state.pos, 0);
  assert.deepEqual(again.plan.newWords, study.plan.newWords.slice(0, 4));
  // Raising the amount keeps the stopped session; the extra words come in a second session.
  await store.commit({ meta: { settings: { newPerDay: 20 } }, event: { day: '2026-10-05', kind: 'settings' } });
  await playUntil(again, now, (c) => c.type === 'final');
  const third = await Study.start({ store, data, now });
  assert.equal(third.card.type, 'final');
});
